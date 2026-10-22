#!/usr/bin/env python3
''' Converts the settings.json file to gsettings schema '''
import json
import os
from lxml import etree
from six import iteritems


def load_json():
    ''' Loads the json information from the settings file '''
    settings_json = json.load(open('settings.json'))
    return settings_json


def get_settings(json_dict):
    ''' Filters the json to only keep the settings '''
    settings = []
    for key, element in iteritems(json_dict):
        if 'type' not in element:
            continue
        if element['type'] == 'category':
            try:
                del element['type']
                del element['help']
            except KeyError:
                pass
            settings.extend(get_settings(element))
        elif element['type'] == 'subcategory' or element['type'] == 'subsection':
            try:
                del element['type']
                del element['help']
            except KeyError:
                pass
            settings.extend(get_settings(element))
        elif element['type'] == 'help':
            continue
        else:
            settings.append([key, element])
    return settings


def json_type_to_schema_type(element):
    ''' Converts the json type name to a "schema" typename '''
    if element['type'] == 'string':
        return 's'
    if element['type'] == 'integer':
        return 'i'
    if element['type'] == 'path':
        return 's'
    if element['type'] == 'boolean':
        return 'b'
    if element['type'] == 'shortcut':
        return 'as'
    if element['type'] == 'dictionary':
        return element['signature']


def json_default_to_schema_default(element):
    ''' Converts a default value from the json file to a "schema" default '''
    if json_type_to_schema_type(element) == 's':
        return '\'{0}\''.format(element['default_value'])
    if element['type'] == 'shortcut':
        return etree.CDATA(element['default_value'])
    return element['default_value']


def create_xml_from_settings(settings):
    ''' Converts the loaded settings to an xml file '''
    schemalist = etree.Element('schemalist', attrib={'gettext-domain': 'gnome-shell-extensions-TodoTxt'})
    schema = etree.SubElement(schemalist, 'schema',
                              path='/org/gnome/shell/extensions/TodoTxt/', id='org.gnome.shell.extensions.TodoTxt')
    for [name, element] in settings:
        key = etree.SubElement(schema, 'key', name=name, type=json_type_to_schema_type(element))
        etree.SubElement(key, 'default').text = json_default_to_schema_default(element)
        etree.SubElement(key, 'summary').text = element['summary']

    tree = etree.ElementTree(schemalist)
    if not os.path.exists('schemas'):
        os.makedirs('schemas')
    tree.write('schemas/org.gnome.shell.extensions.TodoTxt.gschema.xml',
               encoding='UTF-8', pretty_print=True, xml_declaration=True)

create_xml_from_settings(get_settings(load_json()))
