#!/usr/bin/env python3
import json
import xml.etree.ElementTree as ET
import sys
import os


def generate_id(name, suffix):
    return name.lower().replace(' ', '-') + "-" + suffix


def set_row_texts(row, data):
    row.find('./property[@name="title"]').text = data['human_name']
    row.find('./property[@name="tooltip-text"]').text = data['help']


def create_widget(template, name, widget_type, data):
    widget = ET.parse(template)
    row = widget.find('./object[@id="widget-id"]')
    row.set('id', generate_id(name, widget_type))
    set_row_texts(row, data)
    return widget


def create_path_field(name, data, ui_folder):
    widget = create_widget(os.path.join(ui_folder, 'pathWidget.xml'), name, 'path', data)

    widget.find('.//object[@id="image-id"]').set('id', generate_id(name, 'image'))

    return widget.getroot()


def create_boolean_field(name, data, ui_folder):
    widget = create_widget(os.path.join(ui_folder, 'booleanWidget.xml'), name, 'row', data)

    activatable_widget_name = generate_id(name, 'switch')
    widget.find('.//property[@name="activatable-widget"]').text = activatable_widget_name

    widget.find('.//object[@id="switch-id"]').set('id', activatable_widget_name)

    return widget.getroot()


def create_integer_field(name, data, ui_folder):
    widget = create_widget(os.path.join(ui_folder, 'integerWidget.xml'), name, 'combo', data)
    items = widget.find('.//property[@name="model"]/object/items')
    if 'extra_params' in data and 'options' in data['extra_params']:
        for item in data['extra_params']['options']:
            ET.SubElement(items, 'item', {'translatable': 'yes'}).text = data['extra_params']['options'][item]

    return widget.getroot()


def create_string_field(name, data, ui_folder):
    widget = create_widget(os.path.join(ui_folder, 'stringWidget.xml'), name, 'string', data)



    return widget.getroot()


def create_color_widget(name, data, ui_folder):
    widget = create_widget(os.path.join(ui_folder, 'colorWidget.xml'), name, 'color', data)

    activatable_widget_name = generate_id(name, 'color-button')
    widget.find('.//property[@name="activatable-widget"]').text = activatable_widget_name

    widget.find('.//object[@id="color-button-id"]').set('id', activatable_widget_name)

    return widget.getroot()


def create_spin_widget(name, data, ui_folder):
    widget = create_widget(os.path.join(ui_folder, 'spinWidget.xml'), name, 'spin', data)

    adjustment_id = generate_id(name, 'adjustment')
    widget.find('.//object[@id="spin-button-id"]/property[@name="adjustment"]').text = adjustment_id
    widget.find('.//object[@id="spin-button-id"]').set('id', generate_id(name, 'spin-button'))

    widget.find(
        './/object[@id="adjustment-id"]/property[@name="lower"]').text = str(data['extra_params']['range']['min'])
    widget.find(
        './/object[@id="adjustment-id"]/property[@name="upper"]').text = str(data['extra_params']['range']['max'])
    widget.find(
        './/object[@id="adjustment-id"]/property[@name="step_increment"]').text = str(data['extra_params']['range']['step'])
    widget.find('.//object[@id="adjustment-id"]').set('id', adjustment_id)

    return widget.getroot()


def create_priority_markup_widget(name, data, ui_folder):
    widget = ET.parse(os.path.join(ui_folder, 'priorityMarkupWidget.xml'))
    row = widget.find('./object[@id="widget-id"]')
    row.set('id', generate_id(name, 'row'))
    widget.find('.//object[@id="view-id"]').set('id', generate_id(name, 'view'))
    widget.find('.//object[@id="prio-col-id"]').set('id', generate_id(name, 'prio-col'))
    widget.find('.//object[@id="change-color-col-id"]').set('id', generate_id(name, 'change-color-col'))
    widget.find('.//object[@id="color-col-id"]').set('id', generate_id(name, 'color-col'))
    widget.find('.//object[@id="bold-col-id"]').set('id', generate_id(name, 'bold-col'))
    widget.find('.//object[@id="italic-col-id"]').set('id', generate_id(name, 'italic-col'))
    widget.find('.//object[@id="add-button-id"]').set('id', generate_id(name, 'add-button'))
    widget.find('.//object[@id="delete-button-id"]').set('id', generate_id(name, 'delete-button'))

    return widget.getroot()


def create_custom_widget_field(name, data, ui_folder):
    if data['widget'] == 'color':
        return create_color_widget(name, data, ui_folder)
    elif data['widget'] == 'spin':
        return create_spin_widget(name, data, ui_folder)
    elif data['widget'] == 'priorityMarkup':
        return create_priority_markup_widget(name, data, ui_folder)
    else:
        print('Unhandled custom widget: ' + data['widget'], file=sys.stderr)
        return None


def create_help_field(name, data, parent, ui_folder):
    header_suffix = parent.find('.//property[@name="header-suffix"]')
    if header_suffix:
        raise OverflowError("{0} can only contain one help link".format(parent.find('./property[@name="title"]').text))

    widget = ET.parse(os.path.join(ui_folder, 'helpWidget.xml'))
    button = widget.find('./object[@id="button-id"]')
    button.set('id', generate_id(name, 'help-button'))
    return widget.getroot()


def create_shortcut_field(name, data, ui_folder):
    widget = create_widget(os.path.join(ui_folder, 'shortcutWidget.xml'), name, 'shortcut', data)
    widget.find('.//object[@id="accelerator_label"]').set('id', generate_id(name, 'shortcut-accelerator-label'))
    return widget.getroot()


def create_setting(name, data, subcategory, ui_folder):
    if 'widget' in data:
        return create_custom_widget_field(name, data, ui_folder)
    if data['type'] == 'path':
        return create_path_field(name, data, ui_folder)
    if data['type'] == 'boolean':
        return create_boolean_field(name, data, ui_folder)
    if data['type'] == 'integer':
        return create_integer_field(name, data, ui_folder)
    if data['type'] == 'string':
        return create_string_field(name, data, ui_folder)
    if data['type'] == 'help':
        return create_help_field(name, data, subcategory, ui_folder)
    if data['type'] == 'shortcut':
        return create_shortcut_field(name, data, ui_folder)
    print('Unhandled type: ' + data['type'], file=sys.stderr)
    return None


def add_settings_widget(name, data, subcategory, subcategory_name, ui_folder):
    widget = create_setting(name, data, subcategory, ui_folder)
    if widget:
        subcategory.append(widget)


def create_subcategory(name, data, parent, ui_folder):
    child = ET.parse(os.path.join(ui_folder, 'subcategoryWidget.xml')).getroot()
    subcat = child.find('.//object[@id="group-id"]')
    subcat.find('./property[@name="title"]').text = name
    subcat.set('id', generate_id(name, 'group'))

    parent.append(child)

    for setting in [setting for setting in data if 'type' in data[setting] and data[setting]['type'] not in
                    ['subcategory', 'subsection']]:
        add_settings_widget(setting, data[setting], subcat, name, ui_folder)


def create_category(name, data, parent, ui_folder):
    cat = ET.parse(os.path.join(ui_folder, 'categoryWidget.xml')).getroot()
    cat.set('id', generate_id(name, 'page'))
    cat.find('./property[@name="name"]').text = name.lower()
    cat.find('./property[@name="title"]').text = name
    cat.find('./property[@name="icon-name"]').text = data['icon-name']

    parent.append(cat)

    for subcategory in [subcat for subcat in data if 'type' in data[subcat] and data[subcat]['type'] in ['subcategory',
                                                                                                         'subsection']]:
        create_subcategory(subcategory, data[subcategory], cat, ui_folder)


prefs_folder = os.path.dirname(os.path.abspath(sys.argv[0]))
extension_folder = os.path.split(prefs_folder)[0]
ui_folder = os.path.join(prefs_folder, 'ui')
with open(os.path.join(extension_folder, 'settings.json')) as settings:
    data = json.load(settings)

template = ET.Element('interface')
template.set('domain', 'todotxt')
for category in [cat for cat in data if data[cat]['type'] == 'category']:
    create_category(category, data[category], template, os.path.join(prefs_folder, ui_folder))

ET.indent(template)
ET.ElementTree(template).write(os.path.join(ui_folder, 'prefs.xml'), xml_declaration=True, encoding='utf-8')
