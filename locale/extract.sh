#!/bin/sh
xgettext -k_ -kN_ --from-code=utf-8 -o messages.pot --sort-output --package-name="todo.txt gnome-shell extension" ../*.js ../libs/*.js
python ./extract_settings.py
