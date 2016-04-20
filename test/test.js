/*jslint node:true, maxerr:2*/
/*global require*/

var ok, j = require('jslint-cli2');


//Test of synchronous checks
ok = j.check('./node_modules/jslint-cli/wrapper.js', true);
ok = j.check('./node_modules/sim/lib', true);
ok = j.check('./node_modules/sim/lib/loop.js', true);
ok = j.check('./test_codes.js', true);

//Test of asynchronous checks
ok = j.checkFileAsync('./node_modules/jslint-cli/wrapper.js', function(success, errors, path) {
    console.log({path:path, success:success, errors:errors});
});
ok = j.checkAsync('./node_modules/sim/lib', function(success, errors, path) {
    console.log({path:path, success:success, errors:errors});
});
j.printResult();
