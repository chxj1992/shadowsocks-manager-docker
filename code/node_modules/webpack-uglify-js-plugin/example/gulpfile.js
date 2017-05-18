const gulp = require('gulp');
const webpack = require('webpack');
const gutil = require('gulp-util');
const webpackConfig = require('./webpack.config');

gulp.task('default', function (callback) {
  webpack(webpackConfig, function(err, stats){
    if(err) throw new gutil.PluginError("webpack", err);

    gutil.log("[webpack]", stats.toString({
      colors: true,
      warnings: false,
      asset: false,
      chunks: false,
      chunkModules: false
    }));
    callback();
  });
});
