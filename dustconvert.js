/**
 *					The Dust simple Utility
 *						July 18, 2013
 * 	This is a simple utility using dust template to convert JSON data
 *  to desired data format.
 *
 **/

'use strict';

var fs = require('fs');
var dust = require ('dustjs-linkedin');
require ('dustjs-helpers');


if(process.argv.length < 4) {
	var prog = process.argv[1].split("/");
	if (prog.length == 1) prog = process.argv[1].split("\\");
	console.log("Usage: node " + prog[prog.length-1] + " datafile.json template.dust [output.html]" );
}
else  {
	var datafile = process.argv[2];
	var tmplfile = process.argv[3];
	var outpfile  = process.argv.length == 4? '': process.argv[4];
	try {
		var data = fs.readFileSync( datafile, 'utf8');
		var model = JSON.parse(data);
		var tmpl = fs.readFileSync( tmplfile, 'utf8');
		var compiled = dust.compile(tmpl, "intro");
		dust.loadSource(compiled);
		dust.render("intro", model, function(err, out) {
			if (err)
				console.log(err);
			else {
				if (outpfile) {
					fs.writeFile(outpfile, out, function (err) {
				        	if (!err)  err = 'It\'s saved in ' + outpfile;
						console.log(err);
					});
				}
				else {
	  				console.log(out);
				}
			}
		});
	}
	catch (exp) {
		console.log('Exception: ' + exp);
	}
}
