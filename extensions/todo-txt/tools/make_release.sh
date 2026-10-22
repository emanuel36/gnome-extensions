#!/bin/sh
set -e
LATEST_TAG=$(git describe --tag --abbrev=0)
LATEST_VERSION=$(echo "${LATEST_TAG}" | sed -e 's/v//')
NEW_VERSION=$((LATEST_VERSION+1))
$(dirname -- "${0}")/make_package.sh ${NEW_VERSION}
