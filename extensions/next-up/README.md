# Next Up

GNOME Shell 46 extension showing the next meeting of the day in the top bar:
`14:00 Design review · 2h45` (the countdown faded), `Design review · 25m left` during a
meeting, and `+N` when several start together. All-day events are ignored, and the
indicator hides when nothing is left today.

Clicking it opens a list of today's meetings: past ones faded, the one in progress marked
with a dot. Clicking a meeting opens the default calendar app; Settings (which part of the
bar to use) is at the end of the list.

Events come from the date menu's event source, the same one the clock's calendar uses, so
both always agree.

## Tests

```bash
gjs -m extensions/next-up/src/date.test.js
```

## Credits

Imported from [artisticat1/gnome-next-up](https://github.com/artisticat1/gnome-next-up)
(commit `44707c4cbc1e`) and largely rewritten. Modified files carry a notice with the
changes and the date.

## License

GPL-3.0, see `LICENSE.md` (some file headers say GPL-2.0-or-later, as upstream).
