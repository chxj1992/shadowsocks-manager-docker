module.exports = function() {
  console.log('I am b2.');
  require.ensure([], function(){
    var b3 = require('./b3');
    console.log('require ensure b3');
    b3();
  }, 'b3')
};