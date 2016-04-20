jslint-cli2 is a commandline interface wrapper for the new JSLint 2015+.
It provides these capabilities:
  - batch JSLint checking
  - HTML report & CSV static code analysis statistics generation
  - watch file for changes & perform JSLint check on modified file

JSLint checks JS, JS in HTML and JSON.
File extensions that will be checked are '.js', '.json', '.htm', '.html'.

## USAGE

    // At commandline:
    node node_modules\jslint-cli\jslint-cli [options] [files]
    
    Options available:
    --jslintoption <file>		Provide path to JSON file containing JSLint options (will be read 1st).
    --jslintenable <option>		Set given JSLint option to true. This option can be used multiple times.
    --jslintdisable <option>	        Set given JSLint option to false. This option can be used multiple times.
    --jslintmaxerr <#>			Set JSLint option: maximum number of errors to allow (will stop checking if this number is reached)
    --jslintmaxlen <#>			Set JSLint option: maximum allowed length of a source line

    --jslintcheck <file>                Checks a file or entire folder's content. This option can be used multiple times.
    --jslinthtml			Generate HTML report of errors, functions and properties for each file in 'jslint_reports' folder.
    						For folders, folder structure will be recreated.
    --jslintsummary			Generate CSV report for entire folder in 'jslint_reports\summary.csv'.
    						Content: <date>, <LOC>, <Scanned LOC>, <No. of Level 1 Violations, always zero>, <No. of L2 Violations>

    --jslintwatch			Watch a single file for changes & perform JSLint check on modified file.
    						No report will be saved to file; console printout only.
    --jslintcolor			Enable or disable use of colours in Watch results printout.
    						(Default: auto-detect support of colours and enable if supported).
    						For disabling colours in non-colour enabled consoles like Textpad's.
    --jslinthidepath			Whether to hide or print file path in watch printout.
    						(Default: hide file path in each error printout/true);
    						For jumping to error in source code file in Textpad
    						(use regex match: "\(.+\) (line \([0-9]+\) character \([0-9]+\)) ", File: 1, Line: 2, Column: 3).

## Changes in JSLint from pre-2015 to 2015+

* Function level `"use script"` expected. (No more `sloppy` option to ignore the new warning like `Expected ' "use strict"; ' before 'var'.`).
  * Declare jslint-cli2 option `sloppy:true` to tolerate.

* Separate var variable declarations by default.
  * Declare JSLint option `multivar:true` to tolerate.

	E.g.:
```
    var i; //separate var declarations preferred in JSLint 2015+
    var j;
```
Allow old style:
```
    /*jslint multivar:true*/
    var i, j;
```

* `forEach` is preferred, `for` is disallowed.
  * Declare JSLint option `for:true` to tolerate.

* `Object.keys` is preferred, `for in` is disallowed.
> `Object.keys` returns an array whose elements are strings corresponding to the  enumerable properties found _directly_ in the provided object. (I.e. properties inherited through the prototype chain are excluded, unlike `for in` which returns all of them). The ordering of the properties is the same as that given by looping over the properties of the object manually.

	E.g.: Change use of `for in`:
```
    var key, value;
    for (key in anObject)
    {
        if (anObject.hasOwnProperty(key)
        {
            value = anObject[key];
            ...
        }
    }
```
Refactored to use `Object.keys`:
```
    var keys = Object.keys(anObject),
        cnt = key.length, i, value;
    for (i = 0; i < cnt; ++i)
    {
        value = anObject[keys[i]];
        ...
    }
```

* Complains about bad and unrecognised property names.
  * Declare jslint-cli2 option `ignoreprop:true` to tolerate.

* Complains about `Unexpected 'this'`.
  * Declare JSLint option `this:true` to tolerate.

* Complains about `Unused` exception variables in catch statements. Just rename the variable to `ignore`.

	E.g.:
```
    try
    {
        ...
    }
    catch (ex) //JSLint complains: Unused 'ex'
    {
        ...
    }
```
Change it to:
```
    try
    {
        ...
    }
    catch (ignore) //no more complain
    {
        ...
    }
```


* JSLint directives, `/*jslint ...*/` , expected to be placed before 1st statement (and applies to entire script). "Localised" directives are no longer supported, i.e. you can no longer turn on/off a JSLint option just for a portion of code.

* `evil` JSLint option is now `eval` (allows use of eval method).

* If you use `colors` node module, JSLint complains about the colour annotations on strings, e.g.: `'string'.red`.
  * Declare jslint-cli2 option `strdot:true` to tolerate dot notation on strings.

* JSLint expects a space (' ') in regular expression to be escaped like in: `/\ /` instead of plain `/ /`.

	The warning given: `Expected '\' before ' '`

* Complain about `/*global*/ requires the Assume a browser option.` when `/*global ...*/` list is used in non-browser mode.
  * Declare jslint-cli2 option `global:true` to tolerate.

* These options were removed from JSLint 2015+ but added back by jslint-cli2.
  * `ass:true` - tolerate compound assignment statements like `a = b = c`
  * `continue:true` - tolerate use of `continue`
  * `plusplus:true` - tolerate use of `++` and `--` operators. JSLint prefers `+=` and `-=`
  * `sloppy:true` - tolerate non-usage of strict mode
  * `todo:true` - tolerate TODO comments

* These options were removed from JSLint 2015+ and are no longer needed.
  * `nomen` - tolerate use of name with `_` (underscore) prefix
  * `indent` - number of spaces to use for indentation
  * `stupid` - tolerate use of synchronous node methods

* New options in jslint-cli2 for more tolerance.
  * `global` - tolerate `/*global ...*/` list definition even when not in browser mode
  * `ignoreprop` - ignore properties
  * `strdot` - tolerate dot notation on strings


## Examples

    E.g.Watch a file:
    node node_modules\jslint-cli\jslint-cli --jslintwatch node_modules\jslint-cli\jslint-cli.js

    E.g.Watch a file and print results without colours:
    node node_modules\jslint-cli\jslint-cli --no-jslintcolor --jslintwatch node_modules\jslint-cli\jslint-cli.js

    E.g.Check a few files and generate reports to 'jslint_reports' folder:
    node node_modules\jslint-cli\jslint-cli --jslinthtml --jslintcheck node_modules\jslint-cli\jslint-cli.js --jslintcheck test_codes.js

    E.g.Check a folder and generate reports to 'jslint_reports' folder:
    node node_modules\jslint-cli\jslint-cli --jslinthtml --jslintsummary --jslintcheck node_modules\jslint-cli

    E.g. Check a file using various JSLint options:
    node node_modules\jslint-cli\jslint-cli.js --jslintenable node --jslintenable sloppy
    	--jslintenable plusplus --jslintenable white --jslintcheck node_modules\jslint-cli\jslint-cli.js

    E.g. Check a file using pre-defined JSLint options file, but disabling plusplus option:
    node node_modules\jslint-cli\jslint-cli.js --jslintoption options.json
    	--jslintdisable plusplus --jslintcheck node_modules\jslint-cli\jslint-cli.js
```
    Sample JSLint options JSON file:
	{
		"node": true,
		"sloppy": true,
		"plusplus": true,
		"maxerr": 1000,
		"white": true,
		"predef": ["define"]
	}
```

    E.g. Setup in Textpad (JSLint output with contextual jump to errors):
    - Select menu 'Configure> Preferences...> Tools> Add> Program...', 'Apply' to confirm.
    - Edit the newly added program to fill in the path to JSLint-CLI.bat.
      - Set the 'Parameters' to '--jslinthidepath=false --jslintwatch $File' (without the quotes).
      - Set the 'Initial folder' to JSLint-CLI.bat/Node.JS folder.
      - Set 'Regular Expression to match output' to
        "\(.+\) (line \([0-9]+\) character \([0-9]+\)) " (without quotes).
        "(.+) \(line ([0-9]+) character ([0-9]+)\) " (for Textpad V7 using JS-style regex).
      - Set 'Registers' as follows:
        File: 1, Line: 2, Column: 3

    E.g. Setup in Eclipse (no contextual jump; JSLint output in Console only):
    - Select menu 'Run> External Tools> External Tools Configuration',
      double-click 'Program' to create new external tool configuration.
    - Fill in JSLint-CLI details.
    - Set arguments to '--jslinthidepath=false --jslintwatch ${file_prompt}' (without the quotes).
    This will trigger a file-open prompt with the tool is activated.
    If you're using a project, may try ${resouce_loc} instead to run on the active file.

## Updating JSLint

    JSLint can be updated with the latest version by simply replacing the jslint.js file.
    Obtain new release of JSLint from http://github.com/douglascrockford/JSLint/

## Changelog

	V2.0.0 - Apr 2016 - New version for JSLint 2015+.
		- Preserve old JSLint options/style to minimize headache migrating to JSLint 2015+.
		- Reworked batch processing.
		- Soft-patch to JSLint: Force line numbers to start from 1, e.g. for redefinition complains.
		- Incorporate report.js & CSS styles from JSLint webpage for HTML report generation.
		    - Minor fix: underline entire word of 'JSLint'.

### Old versions for JSLint pre-2015
	V1.1.6 - 22 Aug 2013
		- Added <reserved> option to ignore use of reserved keywords, __proto__ & __iterator__, when checking node.js codes.
	V1.1.5 - 5 Aug 2013
		- Added <undef> JSLint option to ignore typedef comparison to 'undefined'.
		  E.g. needed for detecting browser platform (without incurring an undeclared 'window' variable error):
		  	typeof window === 'undefined'
		- Using JSLint dated 2013-07-31.
	V1.1.4 - 19 Apr 2013
		- Watch result printout of unused parameters can now show file path for 'contextual jump to error',
		  and unused parameters of the same function are consolidated.
		- Using JSLint dated 2013-04-09.
	V1.1.2 - 11 Oct 2012
		- Watch result no longer encodes HTML special characters in source text.
		- Added printout of JSLint version used for information.
		- Using JSLint dated 2012-10-18.
	V1.1.1 - 5 Oct 2012
		- Options can now be loaded from JSON file using 'jslintoption <options_file>'.
		- Fixed: HTML report now correctly lists all boolean options.
	V1.1.0 - 10 Sep 2012
		- Option to show file path in watch result printout for jumping to error in source code file.
	V1.0.9 - 23 Aug 2012
		- Auto-detect and select colour mode for watch result printout.
	V1.0.8 - 22 Aug 2012
		- 'Watch' now prints legible error list instead of JSLint's internal JSON representation.
		- Using JSLint dated 2012-08-11.
	V1.0.7 - 13 Aug 2012
		- Add unused parameters into total error count.
		- Add test completion time & unused parameters to report.
	V1.0.6 - 1 Aug 2012
		Added: able to specify JSLint options via CLI
	V1.0.0 - 27 Jul 2012
		Initial usable release; using JSLint dated 2012-07-24.
