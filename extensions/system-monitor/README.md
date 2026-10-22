# System Monitor

GNOME Shell 46 extension showing CPU %, memory % and network speed in the top bar.
Its popup lists:

- the top 5 apps by CPU and by memory (processes grouped by name, all users included);
- CPU temperature and the highest current core frequency;
- each connected cable / Wi-Fi interface with its speed and the data used today.

Virtual interfaces (docker, veth, bridges, VPN tunnels) are left out. Process data is only
collected while the popup is open.

Replaces Resource Monitor and Network Stats on this machine. Design:
`docs/superpowers/specs/2026-10-22-system-monitor-design.md`.

## Tests

```bash
for t in format stats usage sources; do gjs -m extensions/system-monitor/$t.test.js; done
```

`sources.test.js` is a smoke test against the running machine.

## Credits

- `icons/cpu-symbolic.svg` and `icons/ram-symbolic.svg` come from
  [Resource Monitor](https://github.com/0ry0n/Resource_Monitor), Copyright © 2018-2026
  Giuseppe Silvestro, GPL-3.0.
- The per-interface network view is inspired by
  [Network Stats](https://github.com/noroadsleft000/gnome-network-stats) (MIT); no code was
  copied from it.

## License

GPL-3.0, see `LICENSE`.
