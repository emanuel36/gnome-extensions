#!/usr/bin/env python
from jsonschema import Draft4Validator
import json
import os
import sys

tools_folder = os.path.dirname(os.path.abspath(sys.argv[0]))
extension_folder = os.path.split(tools_folder)[0]

schema = json.load(open(os.path.join(tools_folder, 'settings_schema.json')))
toValidate = json.load(open(os.path.join(extension_folder, 'settings.json')))

v = Draft4Validator(schema)

for error in sorted(v.iter_errors(toValidate), key=str):
    print('{error.instance}: {error.message}'.format(error=error))
    if (len(error.context) > 0):
        for context in error.context:
            print('\t{context.message}'.format(context=context))
    print('--')
