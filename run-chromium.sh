#!/bin/bash
#
# Build the extension and run a chromium extension with it installed.
#
set -o errexit -o xtrace -o nounset
cd $(dirname $0)
./makecrx.sh
PROFILE_DIRECTORY="$(mktemp -d)"
trap 'rm -r "$PROFILE_DIRECTORY"' EXIT
chromium-browser \
  --user-data-dir="$PROFILE_DIRECTORY" \
  --load-extension=pkg/crx/ "$@"
