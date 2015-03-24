#!/bin/bash
# This is a convenience wrapper to run the https-everywhere-checker in manual
# mode, which disregards default-off status and does both a coverage and a fetch
# test.
#
# If you pass in a set of ruleset filenames as parameters, it will check those
# ruleset. Otherwise it will check all rulesets that differ between this branch
# and master.
if [ "$#" -gt 1 ] ; then
  exec python2.7 https-everywhere-checker/src/https_everywhere_checker/check_rules.py https-everywhere-checker/manual.checker.config "$@"
else
  echo "Running fetch test over rulesets that differ from master."
  git diff --name-only master -- src/chrome/content/rules/\*.xml | \
    xargs ls | \
    xargs python2.7 https-everywhere-checker/src/https_everywhere_checker/check_rules.py https-everywhere-checker/manual.checker.config
fi
