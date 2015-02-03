// HTTPS Ruleset tester
// Generate a set of test URLs by reading in each of the rulesets and using the
// host from each target. Targets with a left-side wildcard ("*.foo.com") are
// treated as www. Targets with a wildcard elsewhere are ignored for now.
//
// Then, for each of the test URLs:
//  - Run it through the rulesets.
//  - Check that it changed, if not fail that URL.
//  - Fetch the rewritten URL, following redirects.
//  - If there any of the following occur, fail the original URL:
//    - connection failure
//    - connection timeout (30 seconds)
//    - non-200 final status code
//    - more than 10 redirects

var PARALLELISM = 10;

var path = require("path"),
    fs = require("fs"),
    DOMParser = require('xmldom').DOMParser,
    readdirp = require('readdirp'),
    es = require('event-stream'),
    async = require('async'),
    lrucache = require("../chromium/lru"),
    rules = require("../chromium/rules"),
    request = require("request"),
    URI = require("URIjs");

var ruleSets = null;

var cases = [];
var ruleSets = new rules.RuleSets("fake user agent", lrucache.LRUCache, {});
var q;

function runTests() {
  console.log("Running tests")
  q = async.queue(runTestCase, PARALLELISM);
  q.drain = function() {
    console.log("All done.");
  }
  q.push(cases);
}

function runTestCase(testCase, callback) {
  var uriString = testCase.url;
  var ruleFile = testCase.ruleFile;
  var line = ruleFile + " " + uriString;
  var uri = new URI(uriString);
  var rewritten = ruleSets.rewriteURI(uri.toString(), uri.host());
  if (!rewritten) {
    console.log("FAIL: no rewrite: ", line);
    return callback();
  } else {
    line = ruleFile + " " + uriString + " " + rewritten;
    console.log("Requesting:", rewritten);
    request({
      uri: rewritten,
      maxRedirects: 10,
      timeout: 10000, /* ms */
      gzip: true,
      strictSSL: true
    }, function(error, response, body) {
      // On failure, enqueue the test case for a second try later.
      if (!testCase.tries) {
        testCase.tries = 1;
        q.push(testCase);
        return callback();
      }
      if (error && error.message === "CERT_UNTRUSTED") {
        // The nodejs cert validation is somewhat different from Firefox. The
        // may be related to path building, intermediate cert fetching,
        // different roots, and/or many other things. For now, just ignore any
        // CERT_UNTRUSTED errors (but other errors like
        // DEPTH_ZERO_SELF_SIGNED_CERT, we do not ignore).
        console.log("PASS: ", uriString);
        return callback();
      } else if (error) {
        console.log("FAIL:", error.message.replace(/\n/g, ' '), ":", line);
        return callback();
      } else if (response.statusCode !== 200) {
        console.log("FAIL: status code", response.statusCode, ":", line);
        return callback();
      } else {
        console.log("PASS: ", uriString);
        return callback();
      }
    });
  }
};

function readXml(dir) {
  var stream = readdirp({
    root: dir,
    fileFilter: ['*.xml']
  });

  stream
  .on('error', function (err) { console.error('fatal error', err); })
  .pipe(es.map(function (entry, callback) {
    var filename = path.join(dir, entry.path);
    fs.readFile(filename, function(err, fileContents) {
      // If the caller provided a filename or pattern on the command line, skip
      // all rules that don't match that.
      if (process.argv.length > 2) {
        var matched = false;
        for (var i = 2; i < process.argv.length; i++) {
          if (filename.match(process.argv[i])) {
            matched = true;
            break;
          }
        }
        if (!matched) {
          callback();
          return;
        }
      }
      var xml = new DOMParser().parseFromString(fileContents.toString('utf8'), 'text/xml');
      ruleSets.addFromXml(xml);
      var rulesets = xml.getElementsByTagName('ruleset');
      if (rulesets.length > 1) {
        console.log('FAIL: more than one ruleset in', filename);
        process.exit(1);
      }
      addTestCases(rulesets[0], filename);
      callback();
    });
  })).on('end', function(err, body) {
    runTests();
  });
}

function addTestCases(xml, filename) {
  if (xml.getAttribute('default_off') || xml.getAttribute('platform')) {
    //console.log('Skipping inactive ruleset', filename);
    return;
  }
  var targets = xml.getElementsByTagName('target');
  for (var i = 0; i < targets.length; i++) {
    var targetTag = targets[i];
    var target = targetTag.getAttribute('host');
    if (target[0] === '*') {
      cases.push({
        url: 'http://www.' + target.slice(2),
        ruleFile: filename
      });
    } else if (target.match(/\*/)) {
      // skip
    } else {
      cases.push({
        url: 'http://' + target,
        ruleFile: filename
      });
    }
  };
}

console.log("Loading rules...");
readXml(__dirname + '/../rules');
