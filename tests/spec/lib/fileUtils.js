// Stripped down version of gnome fileUtils.js

export function deleteGFile(file) {
    // Work around 'delete' being a keyword in JS.
    return file['delete'](null);
}

/* vi: set expandtab tabstop=4 shiftwidth=4: */
