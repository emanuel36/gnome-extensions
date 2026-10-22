#!/usr/bin/env python

import json

json_data = json.load(open('../settings.json'))


def is_category(testme):
    try:
        if testme['type'] == 'category' or testme['type'] == 'subcategory' or testme['type'] == 'subsection':
            return True
        return False
    except Exception:
        return False


def is_translatable(key, value):
    if key == 'open-key' or key == 'open-focus-key':
        if not (isinstance(value, str)):
            return False
        if key == 'type':
            return False
        if key == 'default_value':
            return False
        if key == 'summary':
            return False
        if key == 'widget':
            return False
        if key == 'value_object':
            return False
        if key == 'signature':
            return False
        if key == 'level':
            return False
        if key == 'url':
            return False
        if key == 'icon-name':
            return False
        return True

    if not (isinstance(value, str)):
        return False
    if key == 'type':
        return False
    if key == 'default_value':
        return False
    if key == 'summary':
        return False
    if key == 'widget':
        return False
    if key == 'value_object':
        return False
    if key == 'signature':
        return False
    if key == 'level':
        return False
    if key == 'url':
        return False
    if key == 'icon-name':
        return False
    return True


def get_strings(dictionary, result):
    for key, value in dictionary.items():
        if is_category(value):
            result.add(key)
        if isinstance(value, dict):
            get_strings(value, result)
        if is_translatable(key, value):
            result.add(value)


result = set()
get_strings(json_data, result)
with open('messages.pot', 'a') as potfile:
    for string in sorted(result):
        potfile.write('# settings.json\n')
        if len(string.splitlines()) > 1:
            potfile.write('msgid ""\n')
            for line in string.splitlines(True):
                potfile.write('"{0}"\n'.format(line.replace('\n', '\\n').replace('\t', '\\t')))
        else:
            potfile.write('msgid "{0}"\n'.format(string.replace('\n', '\\n').replace('\t', '\\t')))
        potfile.write('msgstr ""\n\n')
