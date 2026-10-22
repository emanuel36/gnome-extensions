# gnome-extensions

My GNOME Shell extensions. Most were imported from their upstream project with
`git subtree --squash` and is maintained here as my own code from now on. They are
not forks: upstream history is not kept, only the commit each import was taken from.

## Extensions

| Directory | Upstream | Branch | Imported commit | License | GNOME Shell | Build |
|---|---|---|---|---|---|---|
| `extensions/bluetooth-battery-meter` | [maniacx/Bluetooth-Battery-Meter](https://github.com/maniacx/Bluetooth-Battery-Meter) | `GNOME46` | `e5c960b06cef` | GPL-3.0 | 46–51 | `install.sh` |
| `extensions/clipboard-history` | [SUPERCILEX/gnome-clipboard-history](https://github.com/SUPERCILEX/gnome-clipboard-history) | `master` | `1d4ef6632c58` | MIT | 48–51 | `Makefile` |
| `extensions/just-perfection` | [jrahmatzadeh/just-perfection](https://gitlab.gnome.org/jrahmatzadeh/just-perfection) | `main` | `6e82a6ebf8e9` | GPL-3.0 | 45–51 | `scripts/` |
| `extensions/next-up` | [artisticat1/gnome-next-up](https://github.com/artisticat1/gnome-next-up) | `main` | `44707c4cbc1e` | GPL-3.0 | 45–47 | none |
| `extensions/speech2text` | [bcelary/gnome-speech2text](https://github.com/bcelary/gnome-speech2text) | `main` | `38ff745fb4b6` | MIT | 46–47 | `Makefile` |
| `extensions/todo-txt` | [todo-txt-gnome-shell-extension](https://gitlab.com/todo.txt-gnome-shell-extension/todo-txt-gnome-shell-extension) | `master` | `65345cfb5f93` | GPL-3.0 | 51 | `Makefile` |
| `extensions/top-bar-organizer` | [june/top-bar-organizer](https://gitlab.gnome.org/june/top-bar-organizer) | `main` | `1216ebb994fa` | GPL-3.0-or-later | 45–50 | TypeScript (`package.sh`) |

Extensions written here from scratch:

| Directory | License | GNOME Shell | Build |
|---|---|---|---|
| `extensions/system-monitor` | GPL-3.0 | 46 | none |
| `extensions/window-layout` | MIT | 46 | none |

"Imported commit" is the upstream commit the squash was taken from (also recorded as
`git-subtree-split` in the squash commit). "GNOME Shell" is the range declared in the
upstream `metadata.json` at import time.

## Licensing

Every extension keeps its upstream license file and copyright notices in its own
directory, and my changes to an extension are released under that extension's license.
GPL-3.0 requires modified files to carry a notice saying they were changed, with the date.

## Pulling from upstream

Imports are not expected to be updated, but an upstream fix can still be brought in:

```bash
git subtree pull --prefix=extensions/<dir> <upstream-url> <branch> --squash
```

Update the "Imported commit" column afterwards.
