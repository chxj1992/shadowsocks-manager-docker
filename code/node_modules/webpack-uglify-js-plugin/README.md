# webpack-uglify-js-plugin
Incremental Uglify JS for webpack

## Install
To install the latest release:
```shell
npm install webpack-uglify-js-plugin
```

## Usage
Once webpack-uglify-js-plugin is installed in your project, you can use like this:
```
var webpackUglifyJsPlugin = require('webpack-uglify-js-plugin');

new webpackUglifyJsPlugin({
  cacheFolder: path.resolve(__dirname, 'public/cached_uglify/'),
  debug: true,
  minimize: true,
  sourceMap: false,
  output: {
    comments: false
  },
  compressor: {
    warnings: false
  }
})
```
