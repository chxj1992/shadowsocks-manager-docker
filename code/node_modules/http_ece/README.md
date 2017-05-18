# encrypted-content-encoding

A simple implementation of the [HTTP encrypted
content-encoding](https://tools.ietf.org/html/draft-nottingham-http-encryption-encoding)

# Use

```js
var ece = require('http_ece');
var crypto = require('crypto')
var base64 = require('base64url');

var parameters = {
  key: base64.encode(crypto.randomBytes(16)),
  salt: base64.encode(crypto.randomBytes(16))
};
var encrypted = ece.encrypt(data, parameters);

var decrypted = ece.encrypt(encrypted, parameters);

require('assert').equal(decrypted.compare(data), 0);
```

This also supports the static-ephemeral ECDH mode.  The source explains how.

# TODO

Use the node streams API instead of the legacy APIs.
