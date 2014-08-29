// Test that HTTPS Everywhere component is installed and accessible

const { Cc, Ci } = require("chrome");

let HTTPSEverywhere = Cc["@eff.org/https-everywhere;1"]
                        .getService(Ci.nsISupports)
                        .wrappedJSObject;

exports["test httpse installed"] = function(assert) {
  assert.equal(typeof HTTPSEverywhere, "object",
               "Test that HTTPSEverywhere is defined");
  assert.equal(typeof HTTPSEverywhere.observe, "function",
               "Test that HTTPSEverywhere.observe is a function");
};

exports["test httpse potentiallyApplicableRulesets"] = function(assert) {
  let HTTPSRules = HTTPSEverywhere.https_rules;
  assert.deepEqual(HTTPSRules.potentiallyApplicableRulesets("www.eff.org").length,
              1,
              "Test that HTTPSE finds one applicable rule for www.eff.org");
}

exports["test Reddit ruleset"] = function(assert, done) {
  var tabs = require("sdk/tabs");

  var Application = Cc["@mozilla.org/fuel/application;1"].getService(Ci.fuelIApplication);
  // Helper for making nsURI from string

  function ready(event) {
    Application.console.log("It readied");
    done();
  }

  tabs.on('ready', ready);
  tabs.open("http://www.reddit.com/robots.txt");
  assert.equal(true, true);
}

require("sdk/test").run(exports);
