# System Monitor

![System Monitor](../../docs/images/system-monitor.svg)

CPU % and memory % in the top bar. The popup lists:

- the top 5 apps by CPU and by memory, counting every user's processes;
- the CPU temperature and the highest current core frequency;
- each Wi-Fi interface and each Ethernet adapter named `eth*`, connected or not, plus the
  built-in Ethernet port while it has a link, with the data it used today, in the last 7
  or 30 days, or in total, picked with the buttons above the list. Connected ones also
  show their speed.

Virtual interfaces (Docker, bridges, VPN tunnels) are left out, and app usage is only
measured while the popup is open.

Replaces Resource Monitor and Network Stats.

## Credits

- The CPU and memory icons come from
  [Resource Monitor](https://github.com/0ry0n/Resource_Monitor), Copyright © 2018-2026
  Giuseppe Silvestro, GPL-3.0.
- The per-interface network view is inspired by
  [Network Stats](https://github.com/noroadsleft000/gnome-network-stats) (MIT); no code was
  copied from it.

## License

GPL-3.0, see `LICENSE`.
