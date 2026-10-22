import Gio from 'gi://Gio';

export function deleteFile(file) {
    return file['delete'](null);
}

export function makeTemporaryFile(contents) {
    const [file, stream] = Gio.File.new_tmp('XXXXXX.todo.txt_utest.txt');
    stream.get_output_stream().write(contents, null);
    stream.close(null);
    return file;
}

/* vi: set expandtab tabstop=4 shiftwidth=4: */
