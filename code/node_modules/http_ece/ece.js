'use strict';

var crypto = require('crypto');
var base64 = require('urlsafe-base64');

var savedKeys = {};
var keyLabels = {};
var AES_GCM = 'aes-128-gcm';
var PAD_SIZE = 2;
var TAG_LENGTH = 16;
var KEY_LENGTH = 16;
var NONCE_LENGTH = 12;
var SHA_256_LENGTH = 32;
var MODE_ENCRYPT = 'encrypt';
var MODE_DECRYPT = 'decrypt';

var keylog;
if (process.env.ECE_KEYLOG === '1') {
  keylog = function(m, k) {
    console.warn(m + ' [' + k.length + ']: ' + base64.encode(k));
  };
} else {
  keylog = function() {};
}

function HMAC_hash(key, input) {
  var hmac = crypto.createHmac('sha256', key);
  hmac.update(input);
  return hmac.digest();
}

/* HKDF as defined in RFC5869, using SHA-256 */
function HKDF_extract(salt, ikm) {
  return HMAC_hash(salt, ikm);
}

function HKDF_expand(prk, info, l) {
  var output = new Buffer(0);
  var T = new Buffer(0);
  info = new Buffer(info, 'ascii');
  var counter = 0;
  var cbuf = new Buffer(1);
  while (output.length < l) {
    cbuf.writeUIntBE(++counter, 0, 1);
    T = HMAC_hash(prk, Buffer.concat([T, info, cbuf]));
    output = Buffer.concat([output, T]);
  }

  return output.slice(0, l);
}

function HKDF(salt, ikm, info, len) {
  return HKDF_expand(HKDF_extract(salt, ikm), info, len);
}

function info(base, context) {
  var result = Buffer.concat([
    new Buffer('Content-Encoding: ' + base + '\0', 'ascii'),
    context
  ]);
  keylog('info ' + base, result);
  return result;
}

function extractSalt(salt) {
  if (!salt) {
    throw new Error('A salt is required');
  }
  salt = base64.decode(salt);
  if (salt.length !== KEY_LENGTH) {
    throw new Error('The salt parameter must be ' + KEY_LENGTH + ' bytes');
  }
  return salt;
}

function lengthPrefix(buffer) {
  var b = Buffer.concat([ new Buffer(2), buffer ]);
  b.writeUIntBE(buffer.length, 0, 2);
  return b;
}

function extractDH(keyid, dh, mode) {
  if (!savedKeys[keyid]) {
    throw new Error('No known DH key for ' + keyid);
  }
  if (!keyLabels[keyid]) {
    throw new Error('No known DH key label for ' + keyid);
  }
  var share = base64.decode(dh);
  var key = savedKeys[keyid];
  var senderPubKey, receiverPubKey;
  if (mode === MODE_ENCRYPT) {
    senderPubKey = key.getPublicKey();
    receiverPubKey = share;
  } else if (mode === MODE_DECRYPT) {
    senderPubKey = share;
    receiverPubKey = key.getPublicKey();
  } else {
    throw new Error('Unknown mode only ' + MODE_ENCRYPT +
                    ' and ' + MODE_DECRYPT + ' supported');
  }
  return {
    secret: key.computeSecret(share),
    context: Buffer.concat([
      keyLabels[keyid],
      lengthPrefix(receiverPubKey),
      lengthPrefix(senderPubKey)
    ])
  };
}

function extractSecretAndContext(params, mode) {
  var result = { secret: null, context: new Buffer(0) };
  if (params.key) {
    result.secret = base64.decode(params.key);
    if (result.secret.length !== KEY_LENGTH) {
      throw new Error('An explicit key must be ' + KEY_LENGTH + ' bytes');
    }
  } else if (params.dh) { // receiver/decrypt
    result = extractDH(params.keyid, params.dh, mode);
  } else if (params.keyid) {
    result.secret = savedKeys[params.keyid];
  }
  if (!result.secret) {
    throw new Error('Unable to determine key');
  }
  keylog('secret', result.secret);
  keylog('context', result.context);
  if (params.authSecret) {
    result.secret = HKDF(base64.decode(params.authSecret), result.secret,
                         info('auth', new Buffer(0)), SHA_256_LENGTH);
    keylog('authsecret', result.secret);
  }
  return result;
}

function deriveKeyAndNonce(params, mode) {
  var padSize = params.padSize || PAD_SIZE;
  var salt = extractSalt(params.salt);
  var s = extractSecretAndContext(params, mode);
  var prk = HKDF_extract(salt, s.secret);
  var keyInfo;
  var nonceInfo;
  if (padSize === 1) {
    keyInfo = 'Content-Encoding: aesgcm128';
    nonceInfo = 'Content-Encoding: nonce';
  } else if (padSize === 2) {
    keyInfo = info('aesgcm', s.context);
    nonceInfo = info('nonce', s.context);
  } else {
    throw new Error('Unable to set context for padSize ' + params.padSize);
  }
  var result = {
    key: HKDF_expand(prk, keyInfo, KEY_LENGTH),
    nonce: HKDF_expand(prk, nonceInfo, NONCE_LENGTH)
  };
  keylog('key', result.key);
  keylog('nonce base', result.nonce);
  return result;
}

function determineRecordSize(params) {
  var rs = parseInt(params.rs, 10);
  if (isNaN(rs)) {
    return 4096;
  }
  var padSize = params.padSize || PAD_SIZE;
  if (rs <= padSize) {
    throw new Error('The rs parameter has to be greater than ' + padSize);
  }
  return rs;
}

function generateNonce(base, counter) {
  var nonce = new Buffer(base);
  var m = nonce.readUIntBE(nonce.length - 6, 6);
  var x = ((m ^ counter) & 0xffffff) +
      ((((m / 0x1000000) ^ (counter / 0x1000000)) & 0xffffff) * 0x1000000);
  nonce.writeUIntBE(x, nonce.length - 6, 6);
  keylog('nonce' + counter, nonce);
  return nonce;
}

function decryptRecord(key, counter, buffer, padSize) {
  keylog('decrypt', buffer);
  var nonce = generateNonce(key.nonce, counter);
  var gcm = crypto.createDecipheriv(AES_GCM, key.key, nonce);
  gcm.setAuthTag(buffer.slice(buffer.length - TAG_LENGTH));
  var data = gcm.update(buffer.slice(0, buffer.length - TAG_LENGTH));
  data = Buffer.concat([data, gcm.final()]);
  keylog('decrypted', data);
  padSize = padSize || PAD_SIZE
  var pad = data.readUIntBE(0, padSize);
  if (pad + padSize > data.length) {
    throw new Error('padding exceeds block size');
  }
  var padCheck = new Buffer(pad);
  padCheck.fill(0);
  if (padCheck.compare(data.slice(padSize, padSize + pad)) !== 0) {
    throw new Error('invalid padding');
  }
  return data.slice(padSize + pad);
}

// TODO: this really should use the node streams stuff

/**
 * Decrypt some bytes.  This uses the parameters to determine the key and block
 * size, which are described in the draft.  Binary values are base64url encoded.
 * For an explicit key that key is used.  For a keyid on its own, the value of
 * the key is a buffer that is stored with saveKey().  For ECDH, the p256-dh
 * parameter identifies the public share of the recipient and the keyid is
 * anECDH key pair (created by crypto.createECDH()) that is stored using
 * saveKey().
 */
function decrypt(buffer, params) {
  var key = deriveKeyAndNonce(params, MODE_DECRYPT);
  var rs = determineRecordSize(params);
  var start = 0;
  var result = new Buffer(0);

  for (var i = 0; start < buffer.length; ++i) {
    var end = start + rs + TAG_LENGTH;
    if (end === buffer.length) {
      throw new Error('Truncated payload');
    }
    end = Math.min(end, buffer.length);
    if (end - start <= TAG_LENGTH) {
      throw new Error('Invalid block: too small at ' + i);
    }
    var block = decryptRecord(key, i, buffer.slice(start, end),
                              params.padSize);
    result = Buffer.concat([result, block]);
    start = end;
  }
  return result;
}

function encryptRecord(key, counter, buffer, pad, padSize) {
  keylog('encrypt', buffer);
  pad = pad || 0;
  var nonce = generateNonce(key.nonce, counter);
  var gcm = crypto.createCipheriv(AES_GCM, key.key, nonce);
  padSize = padSize || PAD_SIZE;
  var padding = new Buffer(pad + padSize);
  padding.fill(0);
  padding.writeUIntBE(pad, 0, padSize);
  var epadding = gcm.update(padding);
  var ebuffer = gcm.update(buffer);
  gcm.final();
  var tag = gcm.getAuthTag();
  if (tag.length !== TAG_LENGTH) {
    throw new Error('invalid tag generated');
  }
  var encrypted = Buffer.concat([epadding, ebuffer, tag]);
  keylog('encrypted', encrypted);
  return encrypted;
}

/**
 * Encrypt some bytes.  This uses the parameters to determine the key and block
 * size, which are described in the draft.  Note that for encryption, the
 * p256-dh parameter identifies the public share of the recipient and the keyid
 * identifies a local DH key pair (created by crypto.createECDH() or
 * crypto.createDiffieHellman()).
 */
function encrypt(buffer, params) {
  if (!Buffer.isBuffer(buffer)) {
    throw new Error('buffer argument must be a Buffer');
  }
  var key = deriveKeyAndNonce(params, MODE_ENCRYPT);
  var rs = determineRecordSize(params);
  var start = 0;
  var result = new Buffer(0);
  var padSize = params.padSize || PAD_SIZE;
  var pad = isNaN(parseInt(params.pad, 10)) ? 0 : parseInt(params.pad, 10);

  // Note the <= here ensures that we write out a padding-only block at the end
  // of a buffer.
  for (var i = 0; start <= buffer.length; ++i) {
    // Pad so that at least one data byte is in a block.
    var recordPad = Math.min((1 << (padSize * 8)) - 1, // maximum padding
                             Math.min(rs - padSize - 1, pad));
    pad -= recordPad;

    var end = Math.min(start + rs - padSize - recordPad, buffer.length);
    var block = encryptRecord(key, i, buffer.slice(start, end),
                              recordPad, padSize);
    result = Buffer.concat([result, block]);
    start += rs - padSize - recordPad;
  }
  if (pad) {
    throw new Error('Unable to pad by requested amount, ' + pad + ' remaining');
  }
  return result;
}

/**
 * This function saves a key under the provided identifier.  This is used to
 * save the keys that are used to decrypt and encrypt blobs that are identified
 * by a 'keyid'.  DH or ECDH keys that are used with the 'dh' parameter need to
 * include a label (included in 'dhLabel') that identifies them.
 */
function saveKey(id, key, dhLabel) {
  savedKeys[id] = key;
  if (dhLabel) {
    keyLabels[id] = new Buffer(dhLabel + '\0', 'ascii');
  }
}

module.exports = {
  decrypt: decrypt,
  encrypt: encrypt,
  saveKey: saveKey
};
