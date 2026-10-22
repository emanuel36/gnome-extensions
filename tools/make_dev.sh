#!/bin/sh
set -e
VERSION=$(git describe --dirty | sed -e 's/v//')
NO_COMMIT=1 $(dirname -- "${0}")/make_package.sh ${VERSION}
