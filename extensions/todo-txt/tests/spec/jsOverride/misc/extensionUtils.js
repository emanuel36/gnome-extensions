import Gio from 'gi://Gio';

export function getCurrentExtension() {
    const meta = {};
    meta.uuid = 'todo.txt@bart.libert.gmail.com';
    const extension = {};

    extension.metadata = meta;
    extension.uuid = meta.uuid;
    extension.type = 2;
    extension.dir = Gio.File.new_for_path('.');
    extension.path = extension.dir.get_path();
    extension.error = '';
    extension.hasPrefs = true;

    const oldSearchPath = imports.searchPath.slice();
    imports.searchPath = [extension.dir.get_parent().get_path()];
    extension.imports = imports[extension.dir.get_basename()];
    imports.searchPath = oldSearchPath;

    return extension;
}

export function getSettings(schema) {
    const GioSSS = Gio.SettingsSchemaSource;

    const schemaDir = getCurrentExtension().dir.get_child('tests/spec/resources/schemas');
    const schemaSource = GioSSS.new_from_directory(schemaDir.get_path(),
        GioSSS.get_default(),
        false);
    const schemaObj = schemaSource.lookup(schema, true);
    return new Gio.Settings({ settings_schema: schemaObj });
}
