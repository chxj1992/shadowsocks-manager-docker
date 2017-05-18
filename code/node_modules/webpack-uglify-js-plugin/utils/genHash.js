const crypto = require('crypto');
const fs = require('fs');

module.exports = function genHash(content) {
  const hash = crypto
                .createHash('sha1')
                .update(content)
                .digest('hex');

  return hash;
};

