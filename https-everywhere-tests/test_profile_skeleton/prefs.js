// Submit SSL Observatory reports.
user_pref("extensions.https_everywhere._observatory.enabled", true);
// Don't show any popups that might get in the way of testing.
user_pref("extensions.https_everywhere._observatory.popup_shown", true);
user_pref("extensions.https_everywhere.toolbar_hint_shown", true);
// Show all logs.
user_pref("extensions.https_everywhere.LogLevel", 3);
user_pref("extensions.https_everywhere.log_to_stdout", true);
// Allow running of Mixed Content Blocking tests.
user_pref("extensions.https_everywhere.show_ruleset_tests", true);
// Make it quicker to make manual config changes.
user_pref("general.warnOnAboutConfig", false);
// Minimize unnecesary requests.
user_pref("browser.safebrowsing.enabled", false);
user_pref("browser.safebrowsing.malware.enabled", false);
// Enable debugging by default.
user_pref("devtools.chrome.enabled", true);
user_pref("devtools.debugger.remote-enabled", true);
