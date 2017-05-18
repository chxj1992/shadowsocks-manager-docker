# URL Safe Base64

URL Safe Base64 util module for Node.js applications

[![Build Status](https://secure.travis-ci.org/RGBboy/urlsafe-base64.png)](http://travis-ci.org/RGBboy/urlsafe-base64)

## Installation

With [npm](http://npmjs.org) do:

```
npm install urlsafe-base64
```

## Usage

Require it within your module:

``` javascript
  var URLSafeBase64 = require('urlsafe-base64');
```

### .encode(buffer)

Encodes a buffer as a URL Safe Base64 string. This function encodes to 
the RFC 4648 Spec where '+' is encoded as '-' and '/' is encoded as '_'. 
The padding character '=' is removed.

``` javascript
  var randomURLSafeBase64;
  crypto.randomBytes(32, function(err, buf) {
    if (err) {
      throw err;
      return;
    };
    randomURLSafeBase64 = URLSafeBase64.encode(buf);
  });
```

### .decode(string)

Decodes a URL Safe Base64 string as a buffer.

``` javascript
var someURLSafeBase64 = '';
URLSafeBase64.decode(someURLSafeBase64); // returns a buffer
```

### .validate(string)

Validates a string if it is URL Safe Base64 encoded.

``` javascript
  var validURLSafeBase64 = '';
  URLSafeBase64.validate(validURLSafeBase64); // returns true

  var invalidURLSafeBase64 = '/+=='
  URLSafeBase64.validate(invalidURLSafeBase64); // returns false
```

## License 

(The MIT License)

Copyright (c) 2014 RGBboy &lt;l-_-l@rgbboy.com&gt;

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.