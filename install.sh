#!/usr/bin/env bash
# Links extensions from this repo into GNOME Shell's extension folder and enables them.
# Usage: ./install.sh [extension...]   (no argument installs all of them)
set -euo pipefail

repo=$(cd "$(dirname "$0")" && pwd)
dest="${XDG_DATA_HOME:-$HOME/.local/share}/gnome-shell/extensions"

for cmd in glib-compile-schemas gnome-extensions gsettings; do
    command -v "$cmd" >/dev/null || { echo "error: $cmd not found" >&2; exit 1; }
done

names=("$@")
if ((${#names[@]} == 0)); then
    for dir in "$repo"/extensions/*/; do
        names+=("$(basename "$dir")")
    done
fi

# A newly linked extension is unknown to the running shell, so `gnome-extensions enable`
# fails; adding it to the enabled list makes the shell load it on the next start.
enable() {
    local uuid=$1 current
    gnome-extensions enable "$uuid" 2>/dev/null && return
    current=$(gsettings get org.gnome.shell enabled-extensions)
    [[ $current == *"'$uuid'"* ]] && return
    if [[ $current == *"[]" ]]; then
        current="['$uuid']"
    else
        current="${current%]}, '$uuid']"
    fi
    gsettings set org.gnome.shell enabled-extensions "$current"
}

mkdir -p "$dest"
failed=0
for name in "${names[@]}"; do
    src="$repo/extensions/$name"
    if [[ ! -f $src/metadata.json ]]; then
        echo "$name: no such extension" >&2
        failed=1
        continue
    fi
    uuid=$(sed -n 's/.*"uuid": *"\([^"]*\)".*/\1/p' "$src/metadata.json")
    target="$dest/$uuid"

    if [[ -L $target && $(readlink -f "$target") == "$src" ]]; then
        echo "$name: already linked"
    elif [[ -e $target || -L $target ]]; then
        echo "$name: $target already exists and is not this repo's copy; skipped" >&2
        failed=1
        continue
    else
        ln -s "$src" "$target"
        echo "$name: linked"
    fi

    if [[ -d $src/schemas ]]; then
        glib-compile-schemas "$src/schemas"
    fi
    enable "$uuid"
done

echo
echo "Restart GNOME Shell to load new or changed code (X11: Alt+F2, r; Wayland: log out)."
exit "$failed"
