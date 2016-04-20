/**
 * JSLint wrapper - wraps JSLint for CLI (commandline) usage in Node.JS.
 * Adds recursive folder checking, asynchronous & concurrent checking of multiple files.
 * Adds formatted reports and report values (like lines of codes) for white box test tracking.
 *
 * @author Neon
 **/

//JSLint static code analysis options
/*jslint node:true, this:true, for:true, strdot:true, ass:true, undef:true, ignoreprop:true, multivar:true, todo:true, eval:true, plusplus:true, sloppy:true, maxerr:100, white:true */

(function (exports /*, global*/) {

var fs = require('fs'),
    sfs = require('scopedfs'),
    util = require('util'),
    path = require("path"),

    nopt = require('nopt'),
    //Declare our commandline options for folder checks
    knownOpts = {
        //Report options available for checkAsync():
        "jslinthtml" : Boolean      //request to generate HTML reports for each file checked; save path is 'jslint_reports' folder
        , "jslintsummary" : Boolean //request to generate CSV summary for folder check; saved to 'jslint_reports/summary.csv'
        , "jslintcheck": [path, Array]  //request to check these paths in CLI mode
        //Request to watch given file and provide live JSLint checking.
        //  jslinthtml & jslintsummary are not applicable to watches.
        , "jslintwatch": path
        , "jslintcolor" : Boolean   //request to enable or disable use of colours in watch printout (default: enabled/true)
        , "jslinthidepath" : Boolean   //request not to print file path in watch printout (default: enabled/true; e.g. for jumping to error in Textpad)

        //Options in JSLint to be set (anything else not specified remains as per JSLint defaults)
        , "jslintoption": String    //provide path to JSON file containing JSLint options (will be read 1st)
        , "jslintenable": [String, Array]   //JSLint options to set to true
        , "jslintdisable": [String, Array]   //JSLint options to set to false
        , "jslintmaxerr": Number    //JSLint option: maximum number of errors to allow
        , "jslintmaxlen": Number    //JSLint option: maximum length of a source line
        , "jslintglobal": [String, Array]   //JS option: add a global pre-definition
        },
    //1. Parse commandline options
    parsedOpts = nopt(knownOpts, {}, process.argv, 2),

    //2. Read jslint.js
    jslintCode = fs.readFileSync(__dirname + '/jslint.js', 'utf8'),
    reportCode = fs.readFileSync(__dirname + '/report.js', 'utf8'),
    dummy = function() { console.log('WRN: JSLint unavailable!'); },
    jslint = null, reportMetd = null, temp;

if (jslintCode)
{
    //3A1. Insert code fragment to store the lines of codes, etc.
    //    Also set flag 'tokenizing' so as to not mistakenly warning about 'TODO' when 1st encountering <todo> option.
    //    Also set 'fudge' to 1 for correct base-1 line numbers.
    jslintCode = jslintCode.replace(/(tokenize\(source\);)/, 'fudge = 1; jslint.tokenizing = true; $1 delete jslint.tokenizing; jslint.loc = lines.length; jslint.options = option;');
    //3A2. Insert code fragment to store the scanned lines of codes.
    jslintCode = jslintCode.replace(/(if\s*\(lex\(\)\.id\s*===\s*\"\(end\)\"\)\s*\{)/, '$1\njslint.sloc = line;');
    //3B. Insert code fragment to add options: <undef>, <reserved>, <sloppy>, <plusplus>, <todo>, <ass>, <strdot>, <continue>, <global>.
    jslintCode = jslintCode.replace(/(var\s+allowed_option\s*=\s*\{)/, "$1\n\tundef: true,\n\treserved: true,\n\tsloppy: true,\n\tplusplus: true,\n\tignoreprop: true,\n\ttodo: true,\n\tass: true,\n\tstrdot: true,\n\tcontinue: true,\n\global: true,");
    //3C. Insert code fragment to check <undef> option to ignore typeof comparison to 'undefined'.
    jslintCode = jslintCode.replace(/if\s*\((\s*value\s*===\s*"null"\s*\|\|\s*value\s*===\s*"undefined")(\s*\)\s*\{\s*warn\s*\(\s*"unexpected_typeof_a"\s*,\s*right\s*,\s*value\s*\)\s*;)/g,
        "if (!option.undef && ($1)$2");
    jslintCode = jslintCode.replace(/(value\s*!==\s*\"string\")/g,
        "$1 && (!(option.undef && ((value === 'undefined') || (value === 'null'))))");
    //3C. Insert code fragment to check <reserved> option to ignore use of reserved keywords, __proto__ & __iterator__, when checking node.js codes.
    jslintCode = jslintCode.replace(/(warn\s*\(\s*\"reserved_a\"\s*,\s*name\s*\)\s*;)/g,
        "if (!option.reserved) { $1 }");
    //3D. Insert code fragment to check <plusplus> option to allow use of ++ operator.
    jslintCode = jslintCode.replace(/(warn\s*\(\s*\"expected_a_b\"\s*,\s*the_for\.inc\s*,\s*\"\+=\ 1\"\s*,\s*\"\+\+\"s*\)\s*;)/g,
        "if (!option.plusplus) { $1 }");
    jslintCode = jslintCode.replace(/(warn\s*\(\s*\"unexpected_expression_a\"\s*,\s*thing\s*\)\s*;)/g,
        "if (!option.plusplus || ((thing.id !== '--') && (thing.id !== '++'))) { $1 }");
    jslintCode = jslintCode.replace(/(case\s*\"post\"\s*:\s*case\s*\"pre\"\s*:\s*)(warn\s*\(\s*\"unexpected_a\"\s*,\s*thing\s*\);)/gm,
        '$1 if (((thing.id !== "++") && (thing.id !== "--")) || !option.plusplus) { $2 }');
    //3E. Insert code fragment to check <sloppy> option to ignore missing "use strict".
    jslintCode = jslintCode.replace(/(^\s*warn\s*\(\s*\"expected_a_before_b\"\s*,\s*next_token\s*,\s*\"\ \\\"use\ strict\\\";\ \"\s*,\s*artifact\s*\(\s*next_token\s*\)\s*\)\s*;)/gm,
        "if (!option.sloppy) {\n$1\n}");
    //3F. Insert code fragment to check <ignoreprop> option to not check property names.
    jslintCode = jslintCode.replace(/(^\s*if\s*\(\s*tenure\s*!==\s*undefined\s*\)(?:[^}]+\}){4})/gm,
        "if (!option.ignoreprop) {\n$1\n}");
    //3G. Insert code fragment to check <todo> option to ignore TODOs.
    jslintCode = jslintCode.replace(/(warn\s*\(\s*\"todo_comment\"\s*,\s*the_comment\s*\)\s*;)/g,
        "if (!jslint.tokenizing && !option.todo) { $1 }");
    //3H. Insert code fragment to check <ass> option to ignore assignment statement in expression.
    jslintCode = jslintCode.replace(/(warn\s*\(\s*\"unexpected_statement_a\"\s*,\s*thing\s*\)\s*;)/g,
        "if (!option.ass) { $1 }");
    jslintCode = jslintCode.replace(/(case\s*\"assignment\"\s*:\s*case\s*\"pre\"\s*:\s*case\s*\"post\"\s*:\s*)(warn\s*\(\s*\"unexpected_a\"\s*,\s*right\s*\);)/gm,
        '$1 if ((right.arity !== "assignment") || (right.id !== "=") || !option.ass) { $2 }');
    //3I. Insert code fragment to check <strdot> option to ignore '.' after string (for colour codes).
    jslintCode = jslintCode.replace(/(!left\.identifier\s*&&)/g,
        "$1\n            (!option.strdot && (left.id === '(string)')) &&");
    //3J. Insert code fragment to check <continue> option to tolerate use of continue in loop.
    jslintCode = jslintCode.replace(/(the_continue\.disrupt\s*=\s*true;\s*)(warn\s*\(\s*\"unexpected_a\"\s*,\s*the_continue\s*\);)/gm,
        "$1if (!option.continue) {  }");
    //3K. Insert code fragment to check <global> option to tolerate globals definition in non-browser mode.
    jslintCode = jslintCode.replace(/(^\s*warn\s*\(\s*\"missing_browser\"\s*,\s*comment\s*\);)/gm,
        "if (!option.global) {\n$1\n}");
//    //3D. Insert code fragment to export warnings/etc in old format
//    jslintCode = jslintCode.replace(/return\s*({\s*functions\s*:\s*functions,.+edition\s*:\s*[^\n]+};)/m, 'jslint.errors = warnings; jslint.DATA = $1; jslint.data = function() { return jslint.DATA; }; return jslint.DATA;');
//    console.log(jslintCode); //DEBUG

//
// Constants, etc
//
var REGEX_FILETYPES = /\.((js(on)?)|(html?))$/i;

    //4. Evaluate jslint.js
    eval(jslintCode); //jslint.js is known to be safe
    reportMetd = eval('(function r() {\n' + reportCode + '\nreturn REPORT;\n}());');

    if (typeof jslint === 'undefined')
    {
        console.log('ERROR: Failed to parse jslint.js!'.bold.error);
        process.exit(-1);
    }

    //5. Setup our exports (with additional features)
    exports.jslintMetd = jslint;
    //console.log(exports.jslintMetd); //DEBUG
    //console.log(jslint.toString()); //DEBUG
    exports.optionsOrg = {};    //master copy of all JSLint options passed in via commandline
    exports.options = {};       //working copy for use in each JSLINT call

    require('colors').setTheme({
        silly: 'rainbow',
        input: 'grey',
        verbose: 'cyan',
        prompt: 'grey',
        info: 'green',
        data: 'grey',
        help: 'cyan',
        warn: 'yellow',
        debug: 'blue',
        error: 'red'
    });

    /**
     * (Internal Use)
     * Determine if given path is one of supported file types/extensions.
     * Supported file extensions are:
     *   htm, html, js, json
     * Also forces JSLint 'browser' option to 'true' for webpages.
     *
     * @param filePath (string) path to be checked
     * @return (boolean) true if is supported type; false o.w.
     **/
    exports.isSupportedFiletype = function(filePath) {
        var ext = path.extname(filePath).toLowerCase();
        if ( (ext === '.js') || (ext === '.json') )
        {
            return true;
        }
        if ( (ext === '.html') || (ext === '.htm') )
        {
            //override 'browser' option to 'true' for webpage
            exports.options.browser = true;
            return true;
        }
        return  false;
    };

    /**
     * (Internal Use)
     * Determine if given path is a webpage, i.e. have extension:
     *   htm or html
     * @param filePath (string) path to be checked
     * @return (boolean) true if is webpage; false o.w.
     **/
//    exports.isWebpage = function(filePath) {
//        var ext = path.extname(filePath).toLowerCase();
//        return (ext === '.html') || (ext === '.htm');
//    };

    /**
     * JSLint the given file sychronously
     * @param filePath (string) path to a file
     * @param print (boolean) whether to print results to console
     * @return (JSON or boolean) JSLint results JSON if no errors found; false o.w.
     *                           Inspect the .warnings object if needed.
     **/
    exports.checkFile = function(filePath, print) {
        console.log('Check file: ' + filePath);
        if (fs.existsSync(filePath))
        {
            var s = fs.statSync(filePath), data, result;
            if (s && s.isFile())
            {
                if (exports.isSupportedFiletype(filePath))
                {
                    data = fs.readFileSync(filePath);
                    if (data)
                    {
                        result = exports.jslintMetd(data.toString(), exports.options);
                        if (print)
                        {
                            console.log('JSLint ' + (result.ok? 'OK: ': 'Found errors in: ') + filePath);
                            //console.log(.result.warnings);   //print without 'syntax highlighting'
                            console.log(util.inspect(result.warnings, true, 1, true)); //print with 'syntax highlighting'
                        }
                        return result;
                    }
                }
                else
                {
                    console.log('WARNING: JSLint skipped file with unsupported extension: ' + filePath);
                    return false;
                }
            }
            else
            {
                console.log('WARNING: JSLint skipped path as it\'s not a file: ' + filePath);
                return false;
            }
        }
        console.log('ERROR: JSLint failed to read file: '.bold.error + filePath);
        return false;
    };

    /**
     * JSLint the given file or folder sychronously
     * @param filePath (string) path to a file
     * @param print (boolean) whether to print results to console
     * @return (JSON) JSLint's result with 'ok' field of true if no errors found; false o.w.
     *                Inspect the .errors object if needed.
     **/
    exports.check = function(filePath, print) {
        if (fs.existsSync(filePath))
        {
            var s = fs.statSync(filePath), result, ok = true,
                files, i, cnt;
            if (s && s.isDirectory())
            {
                files = fs.readdirSync(filePath);
                if (files && files.length > 0)
                {
                    cnt = files.length;
                    for (i = 0; i < cnt; ++i)
                    {
                        result = exports.check(filePath + filePath.sep + files[i], print);
                        if (!exports.getNumErrors(result))
                        {
                            ok = false;
                        }
                    }
                }
                return ok;
            }
            if (s.isFile())
            {
                result = exports.checkFile(filePath, print);
                if (result === false)
                {
                    return false;
                }
                return true;
            }
        }
        return false;
    };

    /**
     * JSLint the given file asychronously
     * @param filePath (string) path to a file
     * @param cb (function) callback to return results to.
     *        callback: function(success, result, path)
     *        where success: (boolean) true if no errors found; false o.w.
     *                       Inspect the .errors object if needed.
     *              result: entire JSLint output result (JSON) if JSLint check was performed,
     *                      or a string indicating reason JSLint was not performed (usually file path errors).
     *              path: path of file that was to be checked.
     **/
    exports.checkFileAsync = function(filePath, cb) {
        fs.stat(filePath, function(err, s) {
            if (!err && s.isFile())
            {
                if (exports.isSupportedFiletype(filePath))
                {
                    fs.readFile(filePath, function(err, data) {
                        if (!err)
                        {
                            var result = exports.jslintMetd(data.toString(), exports.options);
                            if (typeof cb === 'function')
                            {
                                cb(true, result, filePath);
                            }
                        }
                        else
                        {
                            if (typeof cb === 'function')
                            {
                                cb(false, 'cannot read file', filePath);
                            }
                        }
                    });
                }
                else
                {
                    if (typeof cb === 'function')
                    {
                        cb(false, 'ignored unsupported file type', filePath);
                    }
                }
            }
            else
            {
                if (typeof cb === 'function')
                {
                    cb(false, 'either cannot open file or is not a file', filePath);
                }
            }
        });
    };

    /**
     * JSLint the given file or folder asychronously.
     * If the original path given is a folder, callback is called
     * to inform user only when the entire folder has been checked.
     *
     * @param filePath (string) path to a file
     * @param eachCb (function) callback to return results of each file to.
     *        callback: function(success, result, filePath, rootPath)
     *        where success: true if no lint warning for file; false o.w.
     *              result: (JSON) JSLint result for file.
     *              filePath: path of file lint'd.
     *              rootPath: original path of file or folder provided to checkAsync.
     * @param allCb (function) callback to return to when given file or folder has been completely lint'd.
     *        callback: function(path)
     *        where path: original path given.
     **/
    exports.checkAsync = function(filePath, eachCb, allCb)
    {
        var total = -1, //we won't know total number of files until eachFileMatching returns
            cnt = 0;
        function checkComplete()
        {
            if ((total >= 0) //check completion only after total number of files is returned by eachFileMatching
                && (cnt >= total))
            {
                if (typeof allCb === 'function')
                {
                    allCb(filePath);
                }
            }
        }

        function reportLintResult(success, result, path)
        {
            if (typeof eachCb === 'function')
            {
                eachCb(success, result, path, filePath);
            }
            ++cnt;
            checkComplete();
        }

        function complete(err, files) //, stats
        {
            if (err)
            {
                total = 0;
            }
            else
            {
                total = files.length;
            }
            checkComplete();
        }

        function lintFile(err, file)
        {
            console.log('DBG: lint file:'.bold.debug, file);
            if (!err)
            {
                exports.checkFileAsync(file, reportLintResult);
            }
            else
            {
                console.log('WRN: Failed to lint file:'.bold.warn, file);
            }
        }

        fs.stat(filePath, function(err, s) {
            if (!err)
            {
                if (s.isDirectory())
                {
                    var folder = sfs.scoped(filePath);
                    folder.eachFileMatching(REGEX_FILETYPES, '/', true,
                        lintFile, complete);
                }
                else if (s.isFile())
                {
                    lintFile(false, filePath);
                }
            }
            else
            {
                if (typeof eachCb === 'function')
                {
                    eachCb(false, 'cannot open path', filePath, filePath);
                }
            }
        });
    };

    /**
     * (For use with Node-JEWEL bootstrap)
     * Creates WebSocket topic 'jslint' for reporting of JSLint results.
     **/
//    exports.createWsChannel = function(io, chName) {
//        if ( io && (typeof(io.of) === 'function') )
//        {
//            chName = chName || 'jslint';
//            exports.jslintMetd.ws = {
//                'chName': chName,
//                'ns': io.of(chName)
//            };
//            if (exports.jslintMetd.ws.ns)
//            {
//                console.log('INF: JSLint WebSocket service created.');
//                /*
//                exports.jslintMetd.ws.ns.on('connection', function(socket) {
//                    console.log('INF: JSLint client joined');
//                    //socket.join(exports.jslintMetd.ws.chName);
//                });
//                */
//                return exports.jslintMetd.ws.ns;
//            }
//            console.log('ERROR: JSLint WebSocket service creation failed.'.bold.error);
//        }
//    };

    /**
     * Broadcast html report through WebSocket
     **/
//    exports.sendReport = function(success, errors, filePath) {
//        if ( exports.jslintMetd.ws && exports.jslintMetd.ws.ns.manager.rooms[exports.jslintMetd.ws.chName]
//            && (exports.jslintMetd.ws.ns.manager.rooms[exports.jslintMetd.ws.chName].length > 0) )
//        {
//            var rpt, rptErr, repProp, cntErr;
//            if (typeof errors !== 'string')
//            {
//                rpt = exports.jslintMetd.report(exports.jslintMetd.data());
//                rptErr = exports.jslintMetd.error_report(exports.jslintMetd.data());
//                repProp = exports.jslintMetd.properties_report(exports.jslintMetd.property);
//                cntErr = errors.length;
//            }
//            else
//            {
//                rptErr = errors;
//            }
//            exports.jslintMetd.ws.ns.volatile.emit('result', {
//                'path': filePath,
//                'success': success,
//                'report': rpt,
//                'error_report': rptErr,
//                'properties_report': repProp,
//                'num_errors': cntErr
//            });
//            console.log('INF: JSLint report broadcasted on WebSocket for: ' + filePath);
//        }
//        else
//        {
//            console.log('ERROR: JSLint WebSocket service not available or no clients connected.'.bold.error);
//        }
//    };

    exports.getNumErrors = function(result)
    {
        if (result && result.warnings)
        {
            if (result && result.unused && result.unused.length > 0)
            {
                return result.warnings.length + result.unused.length;
            }
            return result.warnings.length;
        }
        return 0;
    };

    exports.getLoc = function(result)
    {
        if (!result || !result.lines)
        {
            return 0;
        }
        return result.lines.length || 0;
    };

    exports.getScannedLoc = function(result)
    {
        if (result && result.tree)
        {
            if (result.stop) //early stop
            {
                //JSLint performed but did not complete owing to errors
                if (result && result.warnings
                    && (result.warnings.length >= 1))
                {
                    //return the line number of last line scanned
                    return result.warnings[result.warnings.length - 1].line;
                }
            }
        }
        else
        {
            return 0;
        }
        return exports.getLoc(result);
    };

//    exports.getReport = function()
//    {
//        return exports.jslintMetd.report(exports.jslintMetd.data());
//    };
//
//    exports.getErrorReport = function()
//    {
//        return exports.jslintMetd.error_report(exports.jslintMetd.data());
//    };
//
    exports.getTree = function() {
        return JSON.stringify(exports.jslintMetd.tree, [
         'string',  'arity', 'name',  'first',
         'second', 'third', 'block', 'else'
        ], 4);
    };

    /**
     * (Internal Use)
     * Generate a formatted date string of current time
     * in the format: dd/mm/yyyy
     **/
    exports.getCurrentDate = function() {
        //new Date return format: Fri Jul 27 2012 10:24:17 GMT+0800 (Malay Peninsula Standard Time)
        var today = new Date();
        return today.getDate() + '\/' + (today.getMonth() + 1) + '\/' + (today.getYear() + 1900);
    };


    /**
     * (Internal Use)
     * Generate a formatted date-time string of current time
     * in the format: dd/mm/yyyy hh:mm:ss
     **/
    exports.getCurrentDateTime = function() {
        function pad2Digits(num)
        {
            return num < 10? ('0' + num): num;
        }
        //new Date return format: Fri Jul 27 2012 10:24:17 GMT+0800 (Malay Peninsula Standard Time)
        var today = new Date();
        return today.getDate() + '\/' + (today.getMonth() + 1) + '\/' + (today.getYear() + 1900)
            + ' ' + today.getHours() + ':' + pad2Digits(today.getMinutes()) + ':' + pad2Digits(today.getSeconds());
    };

    /**
     * Generate a formatted result string for ECI tracking.
     **/
    exports.formatResult = function(loc, sloc, cntErr) {
        return exports.getCurrentDate() + ', ' +
            loc + ', ' +
            sloc + ', 0, ' +
            cntErr;
    };

    /**
     * Generate the numbers for ECI tracking for current completed check.
     **/
    exports.getResult = function(result) {
        return exports.formatResult(exports.getLoc(result), exports.getScannedLoc(result), exports.getNumErrors(result));
    };

    /**
     * Print the numbers for ECI tracking of current completed run.
     **/
    exports.printResult = function(result) {
        console.log(exports.getResult(result));
    };

    /**
     * (Internal Use)
     * Generates HTML fragment for overriden JSLint options
     **/
    exports.getOptionsHtml = function() {
        if (exports.jslintMetd.options === undefined)
        {
            return 'Options are All at default values.';
        }
        var str = '<b>Overriden options:</b><br>',
            keys = Object.keys(exports.jslintMetd.options),
            cnt = keys.length, i;

        //console.log(keys, exports.jslintMetd.options);
        for (i = 0; i < cnt; ++i)
        {
            //we want all the fields in prototype chain as well! so only filter out functions.
            if (typeof(exports.jslintMetd.options[keys[i]]) !== 'function')
            {
                //str += '<li>' + i + ': ' + exports.options[i] + '</li>\n';
                if (typeof(exports.jslintMetd.options[keys[i]]) === 'boolean')
                {
                    str += '<input type="checkbox" name="' + keys[i] + (exports.jslintMetd.options[keys[i]]?'" checked><b>':'"><b>') + keys[i] + '<\/b><\/input>\n';
                }
                else if (keys[i] !== 'predef')
                {
                    str += '<li><b>' + keys[i] + '</b>: ' + exports.jslintMetd.options[keys[i]] + '</li>\n';
                }
            }
        }
        if (exports.optionsOrg && exports.optionsOrg.predef)
        {
            str += '<li><b>predefined globals</b>: ' + exports.optionsOrg.predef + '\n';
        }
        return str;
    };

    //JSLint report HTML fragments
    exports.HTML_RPT_PREFIX =
        "<html>\n" +
        "<head>\n" +
        "<title>JSLint Report</title>\n";
    exports.HTML_RPT_PREFIX2 =
        "</head>\n" +
        "<body>\n" +
        "<div id='JSLINT_'>\n" +
        "<a href='#top' id='top'></a>";
    exports.HTML_RPT_POSTFIX =
        "<p>[ <a href='#top'>Top</a> ]" +
        "</div>\n" +
        "</body>\n" +
        "</html>";
    /**
     * (Internal use) Save JSLint check results for a file as a HTML report in 'jslint_reports' folder.
     * For a folder scan, proper folder tree is created.
     *
     * @param result (JSON) JSLInt result
     * @param rootPath (string) path on which JSLInt is originally initiated
     * @param filePath (string) path to current file checked
     **/
    exports.saveHtmlResult = function(result, rootPath, filePath) {
        if (!fs.existsSync(filePath))
        {
            return;
        }
        var savePath = 'jslint_reports',
            subfolders, fullFilePath,
            i, cnt,
            rpt, rptErr, repProp, cntErr, loc, sloc, f;

        //1. Create report folder ('jslint_reports') if needed
        if (!fs.existsSync(savePath))
        {
            fs.mkdirSync(savePath);
            if (!fs.existsSync(savePath)) //ensure savePath is created
            {
                console.log('ERROR: JSLint failed to create "jslint_reports" savePath'.bold.error);
                return;
            }
        }
        //2. Check if is single file or folder
        rootPath = fs.realpathSync(rootPath);
        fullFilePath = filePath = fs.realpathSync(filePath);
        if (rootPath === filePath)
        {
            //1a. for single file, place report in same folder
            subfolders = filePath.split(path.sep);
            savePath += path.sep + subfolders[(subfolders.length > 1)? (subfolders.length - 1): 0] + '.html';
        }
        else
        {
            filePath = filePath.substring(rootPath.length + 1);
            subfolders = filePath.split(path.sep);

            //For multiple CLI paths scans, add another folder level using the root scanned folder name as well
            //  to separate the outputs.
            if (parsedOpts.jslintcheck && (parsedOpts.jslintcheck.length > 1) )
            {
                i = rootPath.split(path.sep);
                Array.prototype.splice.call(subfolders, 0, 0, i[i.length - 1]);
            }

            // Create folder structure if needed
            cnt = subfolders.length;
            if (cnt > 1)
            {
                for (i = 0; i < (cnt - 1); ++i)
                {
                    savePath += path.sep + subfolders[i];
                    if (!fs.existsSync(savePath))
                    {
                        fs.mkdirSync(savePath);
                        if (!fs.existsSync(savePath)) //ensure savePath is created
                        {
                            console.log('ERROR: JSLint failed to create savePath: '.bold.error + savePath);
                            return;
                        }
                    }
                }
                savePath += path.sep + subfolders[i] + '.html';
            }
            else
            {
                savePath += path.sep + subfolders[0] + '.html';
            }
        }

        //3. Generate & save report
        //console.log('Saving JSLint report to ' + savePath);
        rpt = reportMetd.function(result);
        rptErr = reportMetd.error(result);
        repProp = reportMetd.property(result);

        cntErr = exports.getNumErrors(result);
        loc = exports.getLoc(result);
        sloc = exports.getScannedLoc(result);
        f = fs.openSync(savePath, 'w');
        if ( (f !== undefined) && (f !== null) )
        {
            fs.writeSync(f, exports.HTML_RPT_PREFIX, { encoding: 'utf8' });
            //write styles
            if (!exports.styles) //load styles once
            {
                exports.styles = fs.readFileSync(__dirname + '/styles.css', 'utf8');
            }
            fs.writeSync(f, exports.styles, { encoding: 'utf8' });
            fs.writeSync(f, exports.HTML_RPT_PREFIX2, { encoding: 'utf8' });
            //Format the link to file correctly.
            //  Known issue: Safari does not like the links at all; while Firefox does not like UNC paths.
            if (fullFilePath.indexOf('\\\\') !== 0)
            {
                fullFilePath = 'file://' + fullFilePath;
            }
            fs.writeSync(f, ((cntErr > 0)? '<font color="red"><h1><a href="':'<font color="green"><h1><a href="')  + fullFilePath
                + '">' + filePath + '</a></h1>\n', { encoding: 'utf8' });
            fs.writeSync(f, '<h4>Test completed on: ' + new Date() + ' using JSLint version ' + result.edition + '</h4>\n', { encoding: 'utf8' });
            fs.writeSync(f, '<h3>Total no. of warnings: ' + cntErr + '</h3></font>\n', { encoding: 'utf8' });
            fs.writeSync(f, '<h3>Total lines of codes: ' + loc + '</h3>\n', { encoding: 'utf8' });
            fs.writeSync(f, ((sloc < loc)? '<font color="red"><h3>Total scanned loc: ':
                '<font color="green"><h3>Total scanned loc: ') + sloc + '</h3></font>\n', { encoding: 'utf8' });
            if (result.json !== true)
            {
                //add quick links to function & properties reports
                fs.writeSync(f, '[ <a href="#fn_rpt">Functions</a> | <a href="#prop_rpt">Properties</a> ]\n', { encoding: 'utf8' });
            }
            if (cntErr > 0)
            {
                //fs.writeSync(f, '<p><h2>Error Report</h2>\n');
                fs.writeSync(f, '<p><fieldset id=JSLINT_WARNINGS style="display: block;"><legend>Warnings</legend><div>', { encoding: 'utf8' });
                fs.writeSync(f, rptErr, { encoding: 'utf8' });
                fs.writeSync(f, '</div></fieldset><p>[ <a href="#top">Top</a> ]\n', { encoding: 'utf8' });
            }
            if (result.json !== true) //no function & properties reports for JSON
            {
                fs.writeSync(f, '<p><a href="#fn_rpt" id="fn_rpt"></a><fieldset id=JSLINT_REPORT style="display: block;"><legend>Function Report</legend><div>\n', { encoding: 'utf8' });
                fs.writeSync(f, rpt, { encoding: 'utf8' });
                fs.writeSync(f, '</div></fieldset><p>[ <a href="#top">Top</a> ]\n<p><a href="#prop_rpt" id="prop_rpt"></a>\n<fieldset id=JSLINT_PROPERTY style="display: block;"><legend>Property Directive</legend><textarea rows="8" readonly=true>', { encoding: 'utf8' });
                fs.writeSync(f, repProp, { encoding: 'utf8' });
                fs.writeSync(f, '</textarea></fieldset>', { encoding: 'utf8' });
            }
            fs.writeSync(f, '<p>[ <a href="#top">Top</a> ]\n<p><a href="#options" id="options"></a><h2>Overriden JSLint Options</h2>\n', { encoding: 'utf8' });
            fs.writeSync(f, exports.getOptionsHtml(), { encoding: 'utf8' });
            fs.writeSync(f, exports.HTML_RPT_POSTFIX, { encoding: 'utf8' });
        }
        else
        {
            console.log('ERROR: JSLint failed to create report: '.bold.error + savePath);
            return;
        }
    };

    /**
     * Generate a optionally coloured text version (non-HTML) of report on errors.
     *
     * @param data (JSON) JSLint result
     * @param useColors (boolean) whether to use colours in report (default: true)
     * @param hidePath (boolean) whether to hide file path in report (default: true)
     * @return (string) report generated
     **/
    exports.error_report = function (data, useColors, hidePath, filePath) {
        function collapse(data)
        {
            var i, lastFn = data[0].function, lastLine = data[0].line;
            for (i = 1; i < data.length; i += 1)
            {
                if ((data[i].function === lastFn)
                    && (data[i].line === lastLine))
                {
                    data[i-1].name += ', ' + data[i].name;
                    data.splice(i, 1);
                    --i;
                }
                else
                {
                    lastFn = data[i].function;
                    lastLine = i;
                }
            }

        }
        var evidence, i, output = [], snippets, warning;
        if (useColors)
        {
            if (data.warnings) {
                output.push('==Error(s)==\n'.bold.warn);
                for (i = 0; i < data.warnings.length; i += 1) {
                    warning = data.warnings[i];
                    if (warning) {
                        evidence = data.lines[warning.line] || '';
                        if (isFinite(warning.line)) {
                            if (!hidePath)
                            {
                                output.push(filePath + ' ');
                            }
                            output.push(('(line ' +
                                String(warning.line + 1) +
                                ' character ' + String(warning.column + 1) + ') ').bold.help);
                        }
                        output.push(warning.message.bold.red + '\n');
                        if (evidence) {
                            output.push(evidence + '\n');
                        }
                    }
                }
            }
            if (data.unused || data.undefined) {
                output.push('\n');
                if (data.undefined) {
                    output.push('==Undefined== '.bold.warn + '(' + 'parameter '.bold.error + 'function '.bold.info + 'line#'.bold.help + ')\n');
                    snippets = [];
                    for (i = 0; i < data.undefined.length; i += 1) {
                        snippets[i] = data.undefined[i].name.bold.error + ' ' +
                            data.undefined[i].function.bold.info  + ' ' +
                            String(data.undefined[i].line).bold.help;
                    }
                    output.push(snippets.join(', '));
                    output.push('\n\n');
                }
                if (data.unused) {
                    collapse(data.unused);
                    if (hidePath)
                    {
                        output.push('==Unused== '.bold.warn + '(' + 'function '.bold.info + 'line# '.bold.help + 'parameter(s)'.bold.error + ')\n');
                        snippets = [];
                        for (i = 0; i < data.unused.length; i += 1) {
                            snippets[i] =
                                data.unused[i].function.bold.info + ' ' +
                                String(data.unused[i].line).bold.help + ' ' +
                                data.unused[i].name.bold.error;
                        }
                        output.push(snippets.join(', '));
                    }
                    else
                    {
                        output.push('==Unused== '.bold.warn + '(' + 'function '.bold.info + 'parameter(s)'.bold.error + ')\n');
                        for (i = 0; i < data.unused.length; i += 1) {
                            output.push(filePath + ' ' +
                                ('(line ' + String(data.unused[i].line) + ' character 1) ').bold.help + '\n    ');
                            output.push(data.unused[i].function.bold.info + ' ' +
                                data.unused[i].name.bold.error + '\n');
                        }
                    }
                    output.push('\n');
                }
            }
            if (data.json) {
                output.push('JSON: bad.'.bold.error);
            }
        }
        else //no colours
        {
            if (data.warnings) {
                output.push('==Error(s)==\n');
                for (i = 0; i < data.warnings.length; i += 1) {
                    warning = data.warnings[i];
                    if (warning) {
                        evidence = data.lines[warning.line] || '';
                        if (!hidePath)
                        {
                            output.push(filePath + ' ');
                        }
                        if (isFinite(warning.line)) {
                            output.push('(line ' +
                                String(warning.line + 1) +
                                ' character ' + String(warning.column + 1) + ') ');
                        }
                        output.push(warning.message + '\n');
                        if (evidence) {
                            output.push(evidence + '\n');
                        }
                    }
                }
            }
            if (data.unused || data.undefined) {
                output.push('\n');
                if (data.undefined) {
                    output.push('==Undefined== (parameter function line#)\n');
                    snippets = [];
                    for (i = 0; i < data.undefined.length; i += 1) {
                        snippets[i] = data.undefined[i].name + ' ' +
                            data.undefined[i].function  + ' ' +
                            String(data.undefined[i].line);
                    }
                    output.push(snippets.join(', '));
                    output.push('\n\n');
                }
                if (data.unused) {
                    collapse(data.unused);
                    if (hidePath)
                    {
                        output.push("==Unused== ('function' line# parameter(s))\n");
                        snippets = [];
                        for (i = 0; i < data.unused.length; i += 1) {
                            snippets[i] =
                                data.unused[i].function + ' ' +
                                String(data.unused[i].line) + ' ' +
                                data.unused[i].name;
                        }
                        output.push(snippets.join(', '));
                    }
                    else
                    {
                        output.push("==Unused== ('function' parameter(s))\n");
                        for (i = 0; i < data.unused.length; i += 1) {
                            output.push(filePath + ' ' +
                                '(line ' + String(data.unused[i].line) + ' character 1) \n    ');
                            output.push(data.unused[i].function + ' ' +
                                data.unused[i].name + '\n');
                        }
                    }
                    output.push('\n');
                }
            }
            if (data.json) {
                output.push('JSON: bad.');
            }
        }
        return output.join('');
    };

    /**
     * Prints the results from watch.
     * Colouring of report is enabled/disabled via commandline option of 'jslintcolor'.
     **/
    exports.printError = function(result, filePath)
    {
        //print beautified error list
        var cntErr = exports.getNumErrors(result), rptErr, delimiter, dateTime = exports.getCurrentDateTime();
        if (!parsedOpts.jslintcolor)
        {
            delimiter = '====' + filePath + ' @ ' + dateTime + '====';
        }
        if (cntErr > 0)
        {
            if (parsedOpts.jslintcolor)
            {
                delimiter = '====' + filePath.bold.error + ' @ ' + dateTime + '====';
            }
            console.log(delimiter);
            rptErr = exports.error_report(
                result,
                parsedOpts.jslintcolor !== false,
                parsedOpts.jslinthidepath !== false,
                filePath);
            console.log(rptErr);
            console.log(delimiter);
        }
        else
        {
            if (parsedOpts.jslintcolor)
            {
                delimiter = '==== '+ filePath.bold.info + ' @ ' + dateTime + '====';
            }
            console.log(delimiter);
            console.log(parsedOpts.jslintcolor? '<No errors found>'.bold.info: '<No errors found>');
            console.log(delimiter);
        }
        console.log();
    };

    /**
     * Watch a file and JSLint check it once and whenever it's updated.
     * Will quit if file does not exist, or give an error if is a folder.
     *
     * @param filePath (string) path to file to be watched
     **/
    exports.watch = function(filePath)
    {
        exports.watch.changed = {}; //modification active flag
        exports.watch.mtime = {};   //last file modification timestamp

        //1. Perform 1st JSLint check
        exports.watch.changed[filePath] = true;
        exports.checkFileAsync(filePath, function(success, result, filePath) {
            //clear flag when script file has been reloaded successfully, and wait for new changes
            delete exports.watch.changed[filePath];
            if (!success && (typeof result === 'string'))
            {
                console.log('ERROR: Failed to lint'.bold.error, filePath, 'as', result);
            }
            exports.printError(result, filePath);
        });
        //2. Watch file for changes
        fs.watch(filePath, { persistent: true }, function(event /*, filename*/) {
            //scriptModule access detected, check flag to avoid servicing the same scriptModule change multiple times (as fs.watch may be triggered several times)
            if (event === 'change' && !exports.watch.changed[filePath])
            {
                //check if script file is modified
                var newTime = fs.statSync(filePath).mtime.getTime();
                if (newTime !== exports.watch.mtime[filePath])
                {
                    exports.watch.mtime[filePath] = newTime;
                    exports.watch.changed[filePath] = true;
                    //delayed load to allow script file to be completely written 1st
                    setTimeout(function() {
                        //3. JSLint modified file
                        exports.checkFileAsync(filePath, function(success, result, filePath) {
                            //clear flag when script file has been reloaded successfully, and wait for new changes
                            delete exports.watch.changed[filePath];
                            if (!success && (typeof result === 'string'))
                            {
                                console.log('ERROR: Failed to lint'.bold.error, filePath, 'as', result);
                            }
                            exports.printError(result, filePath);
                        });
                    }, 1000);
                }
            }
        });
    };

    /**
     * Remove watch from a prior watched file.
     * @param filePath (string) path to file to be removed from watch
     **/
    exports.unwatch = function(filePath)
    {
        fs.unwatchFile(filePath);
    };

    /**
     * Execute any JSLint checks requested via CLI.
     * Terminates program when all checks are complete and
     * no watch is to be scheduled.
     **/
    exports.runCliChecks = function()
    {
        if (!parsedOpts.jslintcheck)
        {
            return;
        }
        var i, total = parsedOpts.jslintcheck.length, cnt = 0,
            loc = 0, sloc = 0, cntErr = 0;

        function reportLintResult(success, result, path, rootPath)
        {
            if (success)
            {
                //report individual file
                if (parsedOpts.jslinthtml)
                {
                    exports.saveHtmlResult(result, rootPath, path);
                }
                else
                {
                    exports.printError(result, path);
                }
                loc += exports.getLoc(result);
                sloc += exports.getScannedLoc(result);
                cntErr += exports.getNumErrors(result);
            }
            else
            {
                console.log('WARNING JSLint can\'t process '.bold.warn, path, ': ', result);
            }
        }

        function completionHandler()
        {
            /**
             * Save the numbers for ECI tracking of current completed run to 'jslint_reports/summary.csv'
             * Content: <date>, <LOC>, <Scanned LOC>, <No. of Level 1 Violations, always zero>, <No. of L2 Violations>
             **/
            function saveResult()
            {
                var folder = 'jslint_reports',
                    file = folder + '\/summary.csv';
                if (!fs.existsSync(folder))
                {
                    fs.mkdirSync(folder);
                    if (!fs.existsSync(folder)) //ensure folder is created
                    {
                        console.log('ERROR: JSLint failed to write summary to jslint_reports\/summary.csv'.bold.error);
                        return;
                    }
                }
                fs.writeFileSync(file, exports.formatResult(loc, sloc, cntErr), 'utf8');
            }
            //report summary when entire folder has been checked
            if (parsedOpts.jslintsummary)
            {
                saveResult();
            }

            //Check for completion (i.e. all given paths checked)
            ++cnt;
            if (cnt >= total)
            {
                //All paths passed in via CLI checked
                console.log('JSLint completed checking all paths provided via CLI:'.bold.info);
                if (parsedOpts.jslintsummary)
                {
                    saveResult();
                }
            }
        }

        if (parsedOpts.jslintcheck !== undefined)
        {
            //1. Get entire list of files (recurse folders)
            for (i = 0; i < total; ++i)
            {
                console.log('JSLint scheduled to check: ' + parsedOpts.jslintcheck[i]);
                exports.checkAsync(parsedOpts.jslintcheck[i], reportLintResult, completionHandler);
            }
        }
    };

    /**
     * Process any JSLint options passed via CLI.
     **/
    exports.consolidateOptions = function() {
        var i, cnt;
        if (typeof(parsedOpts.jslintoption) === 'string')
        {
            try
            {
                cnt = fs.readFileSync(parsedOpts.jslintoption);
                i = JSON.parse(cnt);
                if (!!i && (typeof i === 'object'))
                {
                    exports.optionsOrg = i;
                    exports.options = JSON.parse(cnt); //clone JSON object
                }
                console.log('INFO: JSLint loaded options:\n' + util.inspect(i, true, 2, true));
            }
            catch (ex) {
                console.log('WARNING: JSLint failed to load options file:', parsedOpts.jslintoption, 'owing to', ex);
            }
        }
        if (parsedOpts.jslintenable)
        {
            cnt = parsedOpts.jslintenable.length;
            for (i = 0; i < cnt; ++i)
            {
                exports.optionsOrg[parsedOpts.jslintenable[i]] = true;
                exports.options[parsedOpts.jslintenable[i]] = true;
            }
        }
        if (parsedOpts.jslintdisable)
        {
            cnt = parsedOpts.jslintdisable.length;
            for (i = 0; i < cnt; ++i)
            {
                exports.optionsOrg[parsedOpts.jslintdisable[i]] = false;
                exports.options[parsedOpts.jslintdisable[i]] = false;
            }
        }
        if (parsedOpts.jslintmaxerr !== undefined)
        {
            i = parseInt(parsedOpts.jslintmaxerr, 10);
            exports.optionsOrg.maxerr = i;
            exports.options.maxerr = i;
        }
        if (parsedOpts.jslintmaxlen !== undefined)
        {
            i = parseInt(parsedOpts.jslintmaxlen, 10);
            exports.optionsOrg.maxlen = i;
            exports.options.maxlen = i;
        }
        if (parsedOpts.jslintglobal)
        {
            exports.optionsOrg.predef = parsedOpts.jslintglobal;
            exports.options.predef = parsedOpts.jslintglobal;
        }
        if (parsedOpts.jslintcolor === undefined)
        {
            parsedOpts.jslintcolor = !!process.stdout.isTTY;
        }
    };

    //6. Consolidate JSLint options
    exports.consolidateOptions();
    temp = exports.jslintMetd('');
    console.log(parsedOpts.jslintcolor? 'JSLint-CLI: Using JSLint version'.bold.info:
        'JSLint-CLI: Using JSLint version', temp.edition);
    //7. Execute JSLint checks if requested for (via CLI)
    exports.runCliChecks();
    //8. Execute JSLint watch if requested for (via CLI)
    if (parsedOpts.jslintwatch && fs.existsSync(parsedOpts.jslintwatch))
    {
        console.log('JSLint will be watching: ' + parsedOpts.jslintwatch);
        exports.watch(parsedOpts.jslintwatch);
    }
}
else
{
    console.log('ERROR: Failed to load JSLint.js'.bold.error);
    exports.jslintMetd = dummy;
    exports.check = dummy;
    exports.checkFile = dummy;
    exports.checkAsync = dummy;
    exports.checkFileAsync = dummy;
    exports.createWsChannel = dummy;
    exports.sendReport = dummy;
}

return exports;
}('object' === typeof module ? module.exports : (this.JSLINT = {}), this));
