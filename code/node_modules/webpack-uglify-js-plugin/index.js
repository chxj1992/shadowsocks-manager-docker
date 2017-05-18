/*
  Incremental Uglify JS for webpack
*/
var path = require('path');
var fs = require('fs');
var chalk = require('chalk');
var uglify = require("uglify-js");
var SourceMapConsumer = require("webpack-core/lib/source-map").SourceMapConsumer;
var SourceMapSource = require("webpack-core/lib/SourceMapSource");
var RawSource = require("webpack-core/lib/RawSource");
var RequestShortener = require("./utils/RequestShortener");
var ModuleFilenameHelpers = require("./utils/ModuleFilenameHelpers");
var genHash = require('./utils/genHash');
var fileUtils = require('./utils/file');

var CACHED_UGLIFY_JS_FOLDER = 'cached_uglify';

function UglifyJsPlugin(options) {
  if(typeof options !== "object") options = {};

  if(options.cacheFolder === undefined) {
    console.error(chalk.bold.red('cacheFolder parameter must be required!'))
    return;
  }

  if(typeof options.compressor !== "undefined") {
    options.compress = options.compressor;
  }

  this.options = options;
}
module.exports = UglifyJsPlugin;

UglifyJsPlugin.prototype.apply = function(compiler) {
  var options = this.options,
    log = this.log.bind(this);
  options.test = options.test || /\.js($|\?)/i;

  var requestShortener = new RequestShortener(compiler.context);
  compiler.plugin("compilation", function(compilation) {
    debugger;
    if(options.sourceMap !== false) {
      compilation.plugin("build-module", function(module) {
        // to get detailed location info about errors
        module.useSourceMap = true;
      });
    }
    compilation.plugin("optimize-chunk-assets", function(chunks, callback) {
      var cacheUglifyFolder = options.cacheFolder+'/'+CACHED_UGLIFY_JS_FOLDER,
        compileHash = compilation.hash,
        changedChunks = [], unChangedChunks = [];
      debugger;
      var files = [];
      chunks.forEach(function(chunk) {
        chunk.files.forEach(function(file) {
          files.push(file);
        });
      });
      compilation.additionalChunkAssets.forEach(function(file) {
        files.push(file);
      });
      files = files.filter(ModuleFilenameHelpers.matchObject.bind(undefined, options));
      files.forEach(function(file) {
        var asset = compilation.assets[file],
          input, fileHash, curFilePath,
          cachedContent;
        input = asset.source();
        fileHash = genHash(input);
        curFilePath = cacheUglifyFolder + '/' + file.replace(compilation.hash, '').slice(0, -3) + '.' + fileHash + '.js';

        if (fs.existsSync(curFilePath)) {
          cachedContent = fs.readFileSync(curFilePath).toString();
          compilation.assets[file] = new RawSource(cachedContent);
          unChangedChunks.push(file);
          return;
        }
        changedChunks.push(file);

        var oldWarnFunction = uglify.AST_Node.warn_function;
        var warnings = [];
        try {
          if(asset.__UglifyJsPlugin) {
            compilation.assets[file] = asset.__UglifyJsPlugin;
            return;
          }
          if(options.sourceMap !== false) {
            if(asset.sourceAndMap) {
              var sourceAndMap = asset.sourceAndMap();
              var inputSourceMap = sourceAndMap.map;
              input = sourceAndMap.source;
            } else {
              var inputSourceMap = asset.map();
              input = asset.source();
            }
            var sourceMap = new SourceMapConsumer(inputSourceMap);
            uglify.AST_Node.warn_function = function(warning) { // eslint-disable-line camelcase
              var match = /\[.+:([0-9]+),([0-9]+)\]/.exec(warning);
              var line = +match[1];
              var column = +match[2];
              var original = sourceMap.originalPositionFor({
                line: line,
                column: column
              });
              if(!original || !original.source || original.source === file) return;
              warnings.push(warning.replace(/\[.+:([0-9]+),([0-9]+)\]/, "") +
                "[" + requestShortener.shorten(original.source) + ":" + original.line + "," + original.column + "]");
            };
          } else {
            uglify.AST_Node.warn_function = function(warning) { // eslint-disable-line camelcase
              warnings.push(warning);
            };
          }
          uglify.base54.reset();
          var ast = uglify.parse(input, {
            filename: file
          });
          if(options.compress !== false) {
            ast.figure_out_scope();
            var compress = uglify.Compressor(options.compress); // eslint-disable-line new-cap
            ast = ast.transform(compress);
          }
          if(options.mangle !== false) {
            ast.figure_out_scope();
            ast.compute_char_frequency(options.mangle || {});
            ast.mangle_names(options.mangle || {});
            if(options.mangle && options.mangle.props) {
              uglify.mangle_properties(ast, options.mangle.props);
            }
          }
          var output = {};
          output.comments = Object.prototype.hasOwnProperty.call(options, "comments") ? options.comments : /^\**!|@preserve|@license/;
          output.beautify = options.beautify;
          for(var k in options.output) {
            output[k] = options.output[k];
          }
          if(options.sourceMap !== false) {
            var map = uglify.SourceMap({ // eslint-disable-line new-cap
              file: file,
              root: ""
            });
            output.source_map = map; // eslint-disable-line camelcase
          }
          var stream = uglify.OutputStream(output); // eslint-disable-line new-cap
          ast.print(stream);
          if(map) map = map + "";
          stream = stream + "";
          asset.__UglifyJsPlugin = compilation.assets[file] = (map ?
            new SourceMapSource(stream, file, JSON.parse(map), input, inputSourceMap) :
            new RawSource(stream));
          if(warnings.length > 0) {
            compilation.warnings.push(new Error(file + " from UglifyJs\n" + warnings.join("\n")));
          }
        } catch(err) {
          if(err.line) {
            var original = sourceMap && sourceMap.originalPositionFor({
              line: err.line,
              column: err.col
            });
            if(original && original.source) {
              compilation.errors.push(new Error(file + " from UglifyJs\n" + err.message + " [" + requestShortener.shorten(original.source) + ":" + original.line + "," + original.column + "]"));
            } else {
              compilation.errors.push(new Error(file + " from UglifyJs\n" + err.message + " [" + file + ":" + err.line + "," + err.col + "]"));
            }
          } else if(err.msg) {
            compilation.errors.push(new Error(file + " from UglifyJs\n" + err.msg));
          } else
            compilation.errors.push(new Error(file + " from UglifyJs\n" + err.stack));
        } finally {
          uglify.AST_Node.warn_function = oldWarnFunction; // eslint-disable-line camelcase

          if(asset.__UglifyJsPlugin && asset.__UglifyJsPlugin._value) {
            fileUtils.write(curFilePath, asset.__UglifyJsPlugin._value);
          }
        }
      });

      log('changedChunks: '+chalk.red.bold(changedChunks.length)+'\n'+chalk.green(changedChunks.join('\n')));
      log('unChangedChunks: '+chalk.red.bold(unChangedChunks.length)+'\n'+chalk.green(unChangedChunks.join('\n')));

      callback();
    });
    compilation.plugin("normal-module-loader", function(context) {
      context.minimize = true;
    });
  });
};

UglifyJsPlugin.prototype.log = function(logInfo) {
  if(this.options.debug) {
    console.log(logInfo);
  }
};

function getFilesFromChunks(chunks) {
  var files = [];
  chunks.forEach(function(chunk) {
    chunk.files.forEach(function(file) {
      files.push(file);
    });
  });
  return files;
}
