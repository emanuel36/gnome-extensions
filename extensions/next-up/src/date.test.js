// Run with: gjs -m extensions/next-up/src/date.test.js
import System from "system";

import {
  eventStatusToIndicatorText,
  formatDuration,
  getEventListRows,
  getNextEventsToDisplay,
  getTimeOfEventAsText,
} from "./date.js";

let failures = 0;

function check(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    print(`ok   ${name}`);
  } else {
    failures++;
    print(`FAIL ${name}\n     expected ${e}\n     got      ${a}`);
  }
}

const at = (h, m, s = 0) => new Date(2026, 9, 22, h, m, s);
const event = (summary, start, end) => ({ summary, date: start, end });

const standup = event("Daily standup", at(10, 0), at(10, 15));
const review = event("Design review", at(14, 0), at(14, 45));
const oneOnOne = event("1:1", at(14, 0), at(14, 30));
const sync = event("Team sync", at(16, 30), at(17, 0));
const day = [sync, review, standup]; // unsorted on purpose

const textAt = (events, now) =>
  eventStatusToIndicatorText(getNextEventsToDisplay(events, now), now);

check("duration minutes", formatDuration(5 * 60000), "5m");
check("duration rounds up", formatDuration(4 * 60000 + 1), "5m");
check("duration whole hour", formatDuration(60 * 60000), "1h");
check("duration hours and minutes", formatDuration(165 * 60000), "2h45");
check("duration pads minutes", formatDuration(65 * 60000), "1h05");

check("clock pads", getTimeOfEventAsText(at(9, 5)), "09:05");

check("far away", textAt(day, at(11, 15)), { text: "14:00 Design review", hint: "· 2h45" });
check("soon", textAt(day, at(13, 55)), { text: "14:00 Design review", hint: "· 5m" });
check("whole hours away", textAt(day, at(13, 0)), { text: "14:00 Design review", hint: "· 1h" });
check("under a minute", textAt(day, at(13, 59, 30)),
  { text: "14:00 Design review", hint: "· now" });
check("in a meeting, more later", textAt(day, at(14, 20)),
  { text: "Design review", hint: "· 25m left" });
check("in the last meeting", textAt(day, at(16, 40)), { text: "Team sync", hint: "· 20m left" });
check("nothing left", textAt(day, at(17, 5)), null);
check("no meetings at all", textAt([], at(11, 0)), null);
check("meeting ends exactly now", textAt(day, at(14, 45)),
  { text: "16:30 Team sync", hint: "· 1h45" });

const busy = [review, oneOnOne, sync];
check("two starting together", textAt(busy, at(13, 55)),
  { text: "14:00 Design review", hint: "+1 · 5m" });
check("two in progress together", textAt(busy, at(14, 10)),
  { text: "Design review", hint: "+1 · 35m left" });

const long = event("Quarterly planning review with the Device team", at(15, 0), at(16, 0));
check("long name cut", textAt([long], at(14, 20)),
  { text: "15:00 Quarterly planning review with the…", hint: "· 40m" });
check("long name cut while in it", textAt([long], at(15, 20)),
  { text: "Quarterly planning review with the…", hint: "· 40m left" });

check("list sorted with states", getEventListRows(day, at(14, 20)), [
  { time: "10:00 – 10:15", summary: "Daily standup", state: "past" },
  { time: "14:00 – 14:45", summary: "Design review", state: "current" },
  { time: "16:30 – 17:00", summary: "Team sync", state: "upcoming" },
]);
check("list meeting ends exactly now", getEventListRows([review], at(14, 45))[0].state, "past");
check("list empty", getEventListRows([], at(11, 0)), []);

if (failures > 0) {
  print(`\n${failures} failed`);
  System.exit(1);
}
print("\nall passed");
