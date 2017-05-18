const webpack = require('webpack');
const path = require('path');
const webpackUglifyJsPlugin = require('webpack-uglify-js-plugin');

const srcPath = path.resolve(__dirname, 'src');
const buildPath = path.resolve(__dirname, 'build2');

module.exports = {
  entry: {
    'a': 'src/a',
    'b': 'src/b',
    'c': 'src/c'
  },

  output: {
    path: buildPath,
    filename: '[name].bundle.js',
    chunkFilename: 'pages/[name].chunk-[hash].js',
    pathinfo: true
  },

  resolve: {
    root: [srcPath],
    extensions: ['', '.js'],
    modulesDirectories: ['node_modules', 'src'],
    alias: {
      src: srcPath
    }
  },

  devtool: '',

  plugins: [

    new webpack.optimize.CommonsChunkPlugin('common.js', ['a', 'b']),

    new webpack.NoErrorsPlugin(),

    // new webpack.optimize.UglifyJsPlugin({
    //   minimize: true,
    //   sourceMap: false,
    //   output: {
    //     comments: false
    //   },
    //   compressor: {
    //     warnings: false
    //   }
    // })

    new webpackUglifyJsPlugin({
      cacheFolder: path.resolve(__dirname, './public/webpack_cached/'),
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
  ],

  module: {
    loaders: [
      // {
      //   test: /\.(js|jsx)$/,
      //   loaders: ['react-hot', 'babel?stage=0'],
      //   include: path.join(__dirname, 'src'),
      //   exclude: ['/node_modules/']
      // }
    ]
  }
};