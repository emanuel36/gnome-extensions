#!/bin/sh
if [ -z "$1" ]; then
    echo "Usage $0 <version>"
    exit 1
fi
version=$1

TOOLS_DIR=$(dirname "${0}")
set -e
"${TOOLS_DIR}"/json2schema.py
if [ -z "${ZIP_NAME}" ]; then
    zip_file="todo.txt@bart.libert.gmail.com-v${version}.zip"
else
    zip_file=${ZIP_NAME}
fi
rm -f "${zip_file}"
EXTENSION_DIR="$(cd -P "$(dirname "${0}")/..";pwd)"
case ${version} in
    ''|*[!0-9]*) jq '.version="'"${version}"'"' "${EXTENSION_DIR}"/metadata.json | sponge "${EXTENSION_DIR}"/metadata.json ;;
    *) jq '.version='"${version}" "${EXTENSION_DIR}"/metadata.json | sponge "${EXTENSION_DIR}"/metadata.json ;;
esac
if [ -z "${NO_COMMIT}" ]; then
    git add "${EXTENSION_DIR}"/metadata.json
    SKIP=gitlint git commit -m "chore: Update metadata"
    git tag -a -s "v${version}"
fi
"${TOOLS_DIR}/check_dist_files"
glib-compile-schemas "${EXTENSION_DIR}"/schemas
zip "${zip_file}" -MM -T -@ < "${TOOLS_DIR}"/dist_files.lst
