#!/bin/bash -x
set -o errexit -o pipefail
APP_NAME=https-everywhere

# builds a .xpi from the git repository, placing the .xpi in the root
# of the repository.
#
# invoke with no arguments to build from the current src directory.
#
#  ./makexpi.sh
#
# OR, invoke with a tag name to build a specific branch or tag.
#
# e.g.:
#
#  ./makexpi.sh 0.2.3.development.2

cd "`dirname $0`"
RULESETS_UNVALIDATED="$PWD/pkg/rulesets.unvalidated.sqlite"
RULESETS_SQLITE="$PWD/src/defaults/rulesets.sqlite"

[ -d pkg ] || mkdir pkg

# If the command line argument is a tag name, check that out and build it
if [ -n "$1" ] && [ "$2" != "--no-recurse" ] && [ "$1" != "--fast" ] ; then
	BRANCH=`git branch | head -n 1 | cut -d \  -f 2-`
	SUBDIR=checkout
	[ -d $SUBDIR ] || mkdir $SUBDIR
	cp -r -f -a .git $SUBDIR
	cd $SUBDIR
	git reset --hard "$1"
  # This is an optimization to get the OS reading the rulesets into RAM ASAP;
  # it's useful on machines with slow disk seek times; there might be something
  # better (vmtouch? readahead?) that tells the IO subsystem to read the files
  # in whatever order it wants...
  nohup cat src/chrome/content/rules/*.xml >/dev/null 2>/dev/null &

  # Use the version of the build script that was current when that
  # tag/release/branch was made.
  ./makexpi.sh $1 --no-recurse || exit 1
  # The fact that the above works even when the thing you are building predates
  # support for --no-recurse in this script is (1) non-intuitive; (2) crazy; and (3)
  # involves two pristine checkouts of $1 within each other

  # Now escape from the horrible mess we've made
  cd ..
	XPI_NAME="$APP_NAME-$1.xpi"
  # In this mad recursive situation, sometimes old buggy build scripts make
  # the xpi as ./pkg :(
  if ! cp $SUBDIR/pkg/$XPI_NAME pkg/ ; then
    echo Recovering from hair-raising recursion:
    echo cp $SUBDIR/pkg pkg/$XPI_NAME
    cp $SUBDIR/pkg pkg/$XPI_NAME
  fi
  rm -rf $SUBDIR
  exit 0
fi

# Only generate the sqlite database if any rulesets have changed. Tried
# implementing this with make, but make is very slow with 11k+ input files.
needs_update() {
  find src/chrome/content/rules/ -newer $RULESETS_UNVALIDATED |\
    grep -q .
}
if [ ! -f "$RULESETS_UNVALIDATED" ] || needs_update ; then
  echo "Generating sqlite DB"
  python2.7 ./utils/make-sqlite.py
fi

# If the unvalidated rulesets have changed, validate and copy to the validated
# rulesets file.
if [ "$RULESETS_UNVALIDATED" -nt "$RULESETS_SQLITE" ] ; then
  bash utils/validate.sh
fi

# The name/version of the XPI we're building comes from src/install.rdf
XPI_NAME="pkg/$APP_NAME-`grep em:version src/install.rdf | sed -e 's/[<>]/	/g' | cut -f3`"
if [ "$1" ] && [ "$1" != "--fast" ] ; then
	XPI_NAME="$XPI_NAME.xpi"
else
  # During development, generate packages named with the short hash of HEAD.
	XPI_NAME="$XPI_NAME~`git rev-parse --short HEAD`.xpi"
fi

[ -d pkg ] || mkdir pkg

# Used for figuring out which branch to pull from when viewing source for rules
GIT_OBJECT_FILE=".git/refs/heads/master"
export GIT_COMMIT_ID="HEAD"
if [ -e "$GIT_OBJECT_FILE" ]; then
	export GIT_COMMIT_ID=$(cat "$GIT_OBJECT_FILE")
fi

cd src

# Build the XPI!
rm -f "../$XPI_NAME"
#zip -q -X -9r "../$XPI_NAME" . "-x@../.build_exclusions"

python2.7 ../utils/create_xpi.py -n "../$XPI_NAME" -x "../.build_exclusions" "."

ret="$?"
if [ "$ret" != 0 ]; then
    rm -f "../$XPI_NAME"
    exit "$?"
else
  echo >&2 "Total included rules: `sqlite3 $RULESETS_SQLITE 'select count(*) from rulesets'`"
  echo >&2 "Created $XPI_NAME"
  if [ -n "$BRANCH" ]; then
    cd ../..
    cp $SUBDIR/$XPI_NAME pkg
    rm -rf $SUBDIR
  fi
fi
