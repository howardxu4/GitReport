/***
 *              The GitHub report generator
 *                      Howard Xu  
 *                    July 13, 2013
 *
 *    This utility provides an issues and pull requests report 
 *    under certain repositories of github host.
 *    This program can be easily extended to make other reports.
 *    The flexible input parameters can generate html or json data,
 *    and it may run on different github hosts with a small adjustment
 *    on pattern matches in parsing html web pages.
 *
 *    The output report using JavaScript and CSS to control display 
 *    and it can fit on different purpose. 
 *
 *    Pre-required install nodejs, npm.
 *    then using npm to install the related modules as necessary.
 *    e.g.  npm install dustjs-linkedin dustjs-helpers
 *
 **/

'use strict';

// requires
var fs = require('fs');
var http = require('https'); 
var dust = require ('dustjs-linkedin');
require ('dustjs-helpers');

// constants
var patns = [
    'counter',
    'class="js-navigation-open">',
    'class="js-relative-date"',
    'data-name=',
    'class="repolist-name"',                // github.com
    'title="Issues"',                       
    'title="Pull Requests"',    
    'mega-icon mega-icon-public-repo',      // github.paypal.com
    'repo_issues',
    'repo_pulls',
];

var githost = {
    'GITHUB': 4,
    'PAYPAL': 7, 
}
// global variables
var gout = [];          // data output holder
var gnum = 0;           // count
var gfmt = 0;           // json output flag
var gtmpl = "";         // template file name
var gfile = "";         // output file name
var goptions = []       // holder of host and repo
var ghost = 'github.com';   // default host

/*
// data structure
{
    dtime: now,
    report : [
        host: host,
        groups[
            group: group,
            results: [
                repo: repo,
                inum: 0,
                pnum: 0,
                issues[
                    link: url,
                    title: til,
                    label: lbl
                ],           
                pulls[
                    link: url,
                    title: til
                ]
            ],
            itot: 0,
            ptot: 0,
            total: n
        ],
        num: m
    ]
}
*/

// template
var templ = "<html>\
<head>\
<script>\
var disp=[1, 1, 1];\
function change(obj, n) {\
    switch(n) {\
        case 0:\
            obj.innerHTML = disp[0]?'Show all Repositories':'Hide Repos w/o Issues';\
        break;\
        case 1:\
            obj.innerHTML = disp[1]?'Show Issues':'Hide Issues';\
        break;\
        case 2:\
            obj.innerHTML = disp[2]?'Show Pulls':'Hide Pulls';\
        break;\
    }\
}\
function toggle(obj, n) {\
    var mysheet=document.styleSheets[0];\
    var myrules=mysheet.cssRules? mysheet.cssRules: mysheet.rules;\
    var mydisp=myrules[n];\
    if (disp[n]) {\
        mydisp.style.display='table-row';\
    }\
    else {\
        mydisp.style.display='none';\
    }\
    disp[n] = disp[n]?0:1;\
    change(obj, n);\
}\
</script>\
<style type=text/css>\
.disp {display: none;}\
.issue {display: none;}\
.pull {display: none;}\
.error {color:red;}\
.fine {color:green;}\
.warn {color:brown;}\
.bissue {background-color: lightyellow;}\
.bpull {background-color: moccasin;}\
.norm {background-color: lightgreen;}\
.enhancement {color:white; background-color: steelblue;}\
.bug {color:white; background-color: red;}\
.duplicate {color:white; background-color: darkgray;}\
.invalid {color:white; background-color: lightgray;}\
.question {color:white; background-color: deeppink;}\
.wontfix {color:white; background-color: linen;}\
</style>\
</head><body>\
<h2> GitHub Issues and Pull Requests Report</h2>\
<table><tr>\
<td><h4>  Created on {dtime} </td><td width=100></td>\
<td><button type='button' onclick='toggle(this,0);'>Show all Repositories</button></td>\
<td><button type='button' onclick='toggle(this,1);'>Show Issues</button></td>\
<td><button type='button' onclick='toggle(this,2);'>Show Pulls</button></td>\
</tr></table>\
<table border=1>\
<tr><th>Host</th>\
<th>Group</th>\
<th> Repository</th>\
<th> Issue or Pull Request</th>\
</tr>\
{#report}\
<tr><td class='norm'>{host}</td></tr>\
{#groups}\
<tr><td></td><td><a href='https://{host}/{group}'>{group}</a></td>\
<td class='fine'>Total {total}</td>\
{@math key=\"{itot}\" method=\"add\" operand=\"{ptot}\"}\
{@gt value=0}\
<td class='warn'>\
{/gt}\
{@default}\
<td class='fine'>\
{/default}\
{/math}\
(Issues {itot} | Pull Requests {ptot})</td></tr>\
{#results}\
{@math key=\"{inum}\" method=\"add\" operand=\"{pnum}\"}\
{@gt value=0}\
<tr><td></td><td></td><td class='error'>{repo}</td><td class='error'>(\
{?issues}\
Issues: {inum}\
{?pulls} | Pulls: {pnum}\
{/pulls}\
{/issues}\
{^issues}\
Pulls: {pnum}\
{/issues}\
)</td></tr>\
{/gt}\
{@default}\
<tr class='disp'><td></td><td></td><td class='fine'>{repo}</td></tr>\
{/default}\
{/math}\
{#issues}\
<tr class='issue'><td></td><td></td><td></td>\
    <td class='bissue'><a href='{link}'>{title}&nbsp;\
    {?label}<span class='{label}'>&nbsp{label}&nbsp</span>{/label}\
    </a></td>\
</tr>\
{/issues}\
{#pulls}\
<tr class='pull'><td></td><td></td><td></td>\
    <td class='bpull'><a href='{link}'>{title}</a></td>\
</tr>\
{/pulls}\
{/results}\
{/groups}\
{/report}\
</table>\
<br><h4>Use above Toggle buttons to show or hide the more information.\
<br>To visit the detail report of issue or pull request click the related link.</h4>\
</body>\
</html>";

// find host index 
function findhost(host) {
    var k = -1;
    for (var i = 0; i < gout.length; i++) {
        if (gout[i].host == host) {
            k = i;
            break;
        }
    }
    if (k == -1) {
        var tmp = { 
            host: host,
            groups: [],
            num: 0
        }
        gout.push(tmp);
        k = gout.length - 1;
    }
    return k;    
}

// find host and group index
function findgroup(host, group) {
    var k = findhost(host);
    for (var i = 0; i < gout[k].groups.length; i++) {
        if (group == gout[k].groups[i].group)
            return [k, i];
    }
    return [k, -1];
}

// add group and host 
function addgroup(host, group) {
    var k = findhost(host);
    if (group[0] == '/') group = group.substr(1);
    var rtmp = {
        group: group,
        results: [],
        total: 0
    }
    gout[k].groups.push(rtmp);
    return { host: host, path: '/' + group + '?tab=repositories' , group: group};
}

// exception
function except(msg) {
    console.log(msg);
    process.exit(1);
}

// data ouput
function output(data) {
    if (gfile) {
        fs.writeFile(gfile, data, function (err) {
            if (!err)  err = 'It\'s saved in ' + gfile;
            except(err);
        });
    }
    else
        except(data);
}

// check final
function checkfinal() {
    if (++gnum == gout.length) {
        var model = {   
            "dtime": new Date() ,
            "report": gout 
        };
        if (gfmt && gfmt != 'html') {
            output(JSON.stringify(model));
        }
        else {
            var tmpl = templ;
            if (gtmpl) {
                try {
                    tmpl = fs.readFileSync( gtmpl, 'utf8');
                }
                catch(e) {
                    except("Template read exception:" + e);
                }
            }
            var compiled = dust.compile(tmpl, "intro");
            dust.loadSource(compiled);
            dust.render("intro", model, function(err, out) {
                if (err) except(err);
                else output(out);
            });
        }
    }
}

// check finish 
function checkfinish(index) {
    if (gout[index[0]].groups[index[1]].total == 
        gout[index[0]].groups[index[1]].results.length) {
        var itot = 0;
        var ptot = 0;
        var results = gout[index[0]].groups[index[1]].results;
        for (var i = 0; i < results.length; i++) {
            itot += results[i].inum;
            ptot += results[i].pnum;
        }
        gout[index[0]].groups[index[1]].itot = itot;
        gout[index[0]].groups[index[1]].ptot = ptot;
        if (++gout[index[0]].num == gout[index[0]].groups.length)
            checkfinal();
    }
}

// check the number
function checknum(str, n) {
    var k = 0;
    var i = str.indexOf(patns[n]);
    if (i > 0) {
        str = str.substr(i);
        i = str.indexOf(patns[0]);
        if (i > 0) {
            str = str.substr(i);
            i = str.indexOf('>') + 1;
            var j = str.indexOf('<');
            k = parseInt(str.substr(i,j-i));
        }
    }
    return k;
}

// get list of pair url and title
function getlist(host, str) {
    var lst = [];
    var i, j, k;
    i = str.indexOf(patns[1]);
    while(i > 0) {
        k = str.substr(0,i).lastIndexOf('href=');
        j = str.substr(k).indexOf('"') + k + 1;
        k = str.substr(j).indexOf('"');
        var url ="https://" + host + str.substr(j, k);
        str = str.substr(i+patns[1].length);
        k = str.indexOf('<');
        var til = str.substr(0, k);
        var tmp = { link: url, title: til }
        j = str.indexOf(patns[2]);
        k = str.substr(0,j).indexOf(patns[3]);
        if (k >=0) {
            str = str.substr(k+patns[3].length+1);
            j = str.indexOf('"');
            tmp['label'] = str.substr(0,j);
        }
        lst.push(tmp);
        i = str.indexOf(patns[1]);
    }
    return lst;
}

// get the pulls
function getpulls(options, index, re) {
    var inoptions = { 
        host: options.host, 
        path: '/' + options.group + '/' + re.repo + '/pulls'
    };
    var innreq = http.request(inoptions, function(innres) {
        var inndata = '';
        innres.on('data', function(chunk) {
            inndata += chunk;
        });
        innres.on('end', function() {
            var str = inndata.toString();
            re.pulls = getlist(inoptions.host, str);
            gout[index[0]].groups[index[1]].results.push(re);
            checkfinish(index);        
        });
    });
    innreq.on('error', function(e){
        except('Error: ' + e.message);
    });
    innreq.end();
}

// get the issues
function getissues(options, index, re) {
    var inoptions = { 
        host: options.host, 
        path: '/' + options.group + '/' + re.repo + '/issues'
    };
    var innreq = http.request(inoptions, function(innres) {
        var inndata = '';
        innres.on('data', function(chunk) {
            inndata += chunk;
        });
        innres.on('end', function() {
            var str = inndata.toString();
            re.issues = getlist(inoptions.host, str);
            if (re.pnum > 0)
                getpulls(options, index, re);
            else {
                gout[index[0]].groups[index[1]].results.push(re);
                checkfinish(index);     
            }   
        });
    });
    innreq.on('error', function(e){
        except('Error: ' + e.message);
    });
    innreq.end();
}

// check each repository
function checkproject(options, index, lst, gh) {
    lst.forEach(function(entry) {
        var inoptions = { 
            host: options.host, 
            path: '/' + options.group + '/' + entry ,
            group: options.group,
            repo: entry,
        };
        var inreq = http.request(inoptions, function(inres) {
            var indata = '';
            inres.on('data', function(chunk) {
                indata += chunk;
            });
            inres.on('end', function() {
                var str = indata.toString();
                var re = { 
                    repo : inoptions.repo ,
                    inum : checknum(str, gh+1),
                    pnum : checknum(str, gh+2)
                }
                if (re.inum > 0) 
                    getissues(options, index, re);
                else if (re.pnum > 0) {
                    getpulls(options, index, re);
                } 
                else {
                    gout[index[0]].groups[index[1]].results.push(re);
                    checkfinish(index);
                }
            });
        });
        inreq.on('error', function(e){
            except('Error: ' + e.message);
        });
        inreq.end();
    });
}

// check all repos under the group
function checkall(options) {
    var request = http.request(options, function (res) {
        var data = '';
        res.on('data', function (chunk) {
            data += chunk;
        });
        res.on('end', function () {
            var lst = [];
            var txt = data.toString();
            var gh = githost['GITHUB'];
            var i = txt.indexOf(patns[gh]);
            if (i < 0) {
                gh = githost['PAYPAL']; 
                i = txt.indexOf(patns[gh]);
            }
            while (i > 0) {
                txt = txt.substr(i);
                i = txt.indexOf('href=');
                txt = txt.substr(i)
                var j = txt.indexOf('</a');
                var k = txt.indexOf('>');
                lst.push(txt.substr(k+1, j-k-1));
                i = txt.indexOf(patns[gh]);
            }
            if (lst.length == 0 ) {
                var msg = "Error: Empty in " + options.group + " at " + options.host;
                msg += "\nPlease check the group " + options.group;
                except(msg);
            }
            var index = findgroup(options.host, options.group);
            gout[index[0]].groups[index[1]].total = lst.length;
            checkproject(options, index, lst, gh);
        });
    });
    request.on('error', function (e) {
        except('Error: ' + e.message);
    });
    request.end();
}

// usage help
function usage(){
    var l =  process.argv[1].lastIndexOf('\\');
    if (l == -1)
        l = process.argv[1].lastIndexOf('/');
    var prog = process.argv[1].substr(l+1);
    var help = "\nThe GitHub Report Generator Utility \nUsage:\n";
    help += "node " + prog + "\n";
    help += "    -d json         ...{optional - default html}\n\
    -f inputfile    ...{optional - batch of arguments. details at following}\n\
    -o outputfile   ...{optional - default stdout}\n\
    -t templatefile ...{optional - default build-in}\n\
    -h host         ...{optional - default github.com}\n\
    -g group        ...{required - at least use one time}\n\
   \nFormat in inputfile:\n\
    # comment\n\
    key=value\n\
    ... # start line or empty line will be ignored\n\
    ... key:   {data|out[putfile]|templ[atefile]|host|{group}\n\
    ... value: {assigned string}\n\
    \nExamples:\n\
\nconf.txt:\n\
#sample of format in inputfile\n\
group=yahoo\n\
group=linkedin\n\
out=report.html\n\n";   
    help += "node " + prog + " -f conf.txt\n";
    help += "node " + prog + " -g google -o report.html\n";
    help += "node " + prog + " -g paypal -h github.paypal.com -g sparta -o mixed.html\n";
    help += 
    except(help);
}

// parse input file
function parsefile(infile)
{
   try {
        var conf = fs.readFileSync( infile, 'utf8');
        var lines = conf.split('\n');
        for (var j=0; j < lines.length; j++) {
            var line = lines[j].trim();
            if (line.length < 3 || line[0] == '#') {
                //  console.log("ignore:" + line);
            }
            else {
                if(line.indexOf('=') > 0) {
                    var kv = line.split('=');
                    if (kv[0].indexOf('group') == 0) {
                        goptions.push(addgroup(ghost, kv[1].trim()));
                    }
                    else if (kv[0].indexOf('data') == 0) {
                        gfmt = kv[1].trim();
                    }
                    else if (kv[0].indexOf('out') == 0) {
                        gfile = kv[1].trim();
                    }
                    else if (kv[0].indexOf('templ') == 0) {
                        gtmpl = kv[1].trim();
                    }
                    else if (kv[0].indexOf('host') == 0) {
                        ghost = kv[1].trim();
                    }
                    else {
                        except("Input file wrong key: " + kv[0]);
                    }
                }
                else except("Input file wrong format: " + line);
            }
        }
    }
    catch(e) {
        except("Input file exception:" + e);
    }
}

// start from here
var i = 2;
var n = process.argv.length;
while(i < n) {
    var kf = process.argv[i++];
    if (kf[0] == '-') {
        if (i < n) {
            var vl = process.argv[i++];
            switch (kf[1]) {
                case 'd':
                    gfmt = vl;
                break;
                case 'f':
                    parsefile(vl);
                break;
                case 'o':
                    gfile = vl;
                break;
                case 't':
                    gtmpl = vl;
                break;
                case 'h':
                    ghost = vl;
                break;
                case 'g':
                    goptions.push(addgroup(ghost, vl));
                break;                
                default:
                    usage();
                break;
            }
            continue;
        }
    }
    console.log("Wrong arguments");
    usage();
}
if (goptions.length > 0) {        
    goptions.forEach(function(entry){
        checkall(entry);
    });
}
else {
    usage();
}