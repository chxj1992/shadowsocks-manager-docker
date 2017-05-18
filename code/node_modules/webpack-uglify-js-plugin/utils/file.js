// Nodejs libs.
var fs = require('fs');
var path = require('path');
var chalk = require('chalk');

// The module to be exported.
var file = module.exports = {};
var pathSeparatorRe = /[\/\\]/g;

// Like mkdir -p. Create a directory and any intermediary directories.
file.mkdir = function(dirpath, mode) {
  // Set directory mode in a strict-mode-friendly way.
  if (mode == null) {
    mode = parseInt('0777', 8) & (~process.umask());
  }
  dirpath.split(pathSeparatorRe).reduce(function(parts, part) {
    parts += part + '/';
    var subpath = path.resolve(parts);
    if (!file.exists(subpath)) {
      try {
        fs.mkdirSync(subpath, mode);
      } catch(e) {
        throw console.error('Unable to create directory "' + subpath + '" (Error code: ' + e.code + ').', e);
      }
    }
    return parts;
  }, '');
};

// The default file encoding to use.
file.defaultEncoding = 'utf8';
// Whether to preserve the BOM on file.read rather than strip it.
file.preserveBOM = false;

// Read a file, return its contents.
file.read = function(filepath) {
  var contents;
  try {
    contents = fs.readFileSync(String(filepath)).toString();
    // console.log('Reading "' + filepath + '" successful');
    return contents;
  } catch(e) {
    console.error('Unable to read "' + filepath + '" file (Error code: ' + e.code + ').');
  }
};


file.readAndReplace = function(filepath, src, replaceStr) {
  var contents;
  try {
    contents = fs.readFileSync(String(filepath)).toString();
    contents = contents.replace(src, replaceStr);

    // Actually write file.
    fs.writeFileSync(filepath, contents);
    console.log('Write "'+chalk.green(filepath)+'" successful');
    return contents;
  } catch(e) {
    console.error('Unable to read "' + filepath + '" file (Error code: ' + e.code + ').');
  }
};

// Write a file.
file.write = function(filepath, contents) {
  // Create path, if necessary.
  file.mkdir(path.dirname(filepath));
  try {
    // If contents is already a Buffer, don't try to encode it. If no encoding
    // was specified, use the default.
    if(!Buffer.isBuffer(contents)){
      contents = new Buffer(contents);
    }
    // Actually write file.
    fs.writeFileSync(filepath, contents);
    console.log('Write "'+chalk.green(filepath)+'" successful');
    return true;
  } catch(e) {
    console.error('Unable to write "' + chalk.red.bold(filepath) + '" file (Error code: ' + e.code + ').');
  }
};

// Read a file, optionally processing its content, then write the output.
file.copy = function(srcpath, destpath) {
  // Actually read the file.
  if(file.isDir(srcpath)){
    file.mkdir(destpath);
    return;
  }
  var contents = file.read(srcpath);
  // Abort copy if the process function returns false.
  if (contents === false) {
    console.error('Write aborted.');
  } else {
    file.write(destpath, contents);
  }
};

// True if the file path exists.
file.exists = function() {
  var filepath = path.join.apply(path, arguments);
  return fs.existsSync(filepath);
};

// True if the file is a symbolic link.
file.isLink = function() {
  var filepath = path.join.apply(path, arguments);
  return file.exists(filepath) && fs.lstatSync(filepath).isSymbolicLink();
};

// True if the path is a directory.
file.isDir = function() {
  var filepath = path.join.apply(path, arguments);
  return file.exists(filepath) && fs.statSync(filepath).isDirectory();
};

// True if the path is a file.
file.isFile = function() {
  var filepath = path.join.apply(path, arguments);
  return file.exists(filepath) && fs.statSync(filepath).isFile();
};

// Is a given file path absolute?
file.isPathAbsolute = function() {
  var filepath = path.join.apply(path, arguments);
  return path.resolve(filepath) === filepath.replace(/[\/\\]+$/, '');
};


// Do all the specified paths refer to the same path?
file.arePathsEquivalent = function(first) {
  first = path.resolve(first);
  for (var i = 1; i < arguments.length; i++) {
    if (first !== path.resolve(arguments[i])) { return false; }
  }
  return true;
};

// Are descendant path(s) contained within ancestor path? Note: does not test
// if paths actually exist.
file.doesPathContain = function(ancestor) {
  ancestor = path.resolve(ancestor);
  var relative;
  for (var i = 1; i < arguments.length; i++) {
    relative = path.relative(path.resolve(arguments[i]), ancestor);
    if (relative === '' || /\w+/.test(relative)) { return false; }
  }
  return true;
};

// Test to see if a filepath is the CWD.
file.isPathCwd = function() {
  var filepath = path.join.apply(path, arguments);
  try {
    return file.arePathsEquivalent(process.cwd(), fs.realpathSync(filepath));
  } catch(e) {
    return false;
  }
};

// Test to see if a filepath is contained within the CWD.
file.isPathInCwd = function() {
  var filepath = path.join.apply(path, arguments);
  try {
    return file.doesPathContain(process.cwd(), fs.realpathSync(filepath));
  } catch(e) {
    return false;
  }
};


//Return an array of all files in directory
file.getFilesInDirectory = function(dir){
  var self = file,
    results = [],
    basePath = process.cwd();

  dir = path.resolve(basePath, dir);
  try{
    list = fs.readdirSync(dir);
    if(list.length === 0){
      results.push(dir);
      console.log('The directory"'+dir+'" is null');
      return results;
    }else{
      list.forEach(function(file){
        file = path.resolve(dir, file);
        fileStat = fs.statSync(file);
        if(fileStat && fileStat.isDirectory()){
          subResults = self.getFilesInDirectory(file);
          results = results.concat(subResults);
        }else{
          results.push(file);
        }
      });
    }
  }catch(e){
    console.error('Unable read directory"'+dir+'" file (' + e.message + ').')
  }
  return results;
};


file.deleteDirectory = function(path){
  if(file.exists(path)){
    fs.readdirSync(path).forEach(function(item, index){
      var curPath = path+'/'+item;
      if(fs.lstatSync(curPath).isDirectory()){
        file.deleteDirectory(curPath);
      }else{
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(path);
  }
};

file.unixifyPath = function(filepath) {
  if (process.platform === 'win32') {
    return filepath.replace(/\\{1,2}/g, "/");
  } else {
    return filepath;
  }
};