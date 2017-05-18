module.exports = function() {
  console.log('I am a1.');
  require.ensure([], function(){
    var a3 = require('./a3');
    console.log('require ensure a3');
    a3();
  }, 'a3');
};