// Modified 2026-10-22 by emanuel36: read events from the source passed in; new compact
// indicator text (start time + faded countdown, current meeting with time left, "+N"
// for meetings starting together).

const MAX_EVENT_SUMMARY_LENGTH = 35;

function trimLongEventName(summary) {
  if (summary.length > MAX_EVENT_SUMMARY_LENGTH) {
    return summary.substring(0, MAX_EVENT_SUMMARY_LENGTH).trimEnd() + "…";
  } else {
    return summary;
  }
}

function notFullDayEvent(event) {
  return !(
    event.date.getHours() === 0 &&
    event.date.getMinutes() === 0 &&
    event.end.getHours() === 0 &&
    event.end.getMinutes() === 0
  );
}

export function getTodaysEvents(eventSource) {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Get event from today at midnight

  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const todaysEvents = eventSource.getEvents(today, tomorrow).filter(notFullDayEvent);

  return todaysEvents;
}

function byStart(a, b) {
  return a.date - b.date;
}

// Meetings in progress win over upcoming ones; "others" counts the meetings that start
// at the same time as the one shown.
export function getNextEventsToDisplay(todaysEvents, now = new Date()) {
  const events = [...todaysEvents].sort(byStart);

  const currentEvent = events.find((e) => e.date <= now && now < e.end) ?? null;
  const nextEvent = events.find((e) => now < e.date) ?? null;
  const shown = currentEvent ?? nextEvent;
  const others = shown
    ? events.filter((e) => e !== shown && e.date.valueOf() === shown.date.valueOf()).length
    : 0;

  return { currentEvent, nextEvent, others };
}

/**
 * Text for the panel.
 *
 * Args:
 *   eventStatus: Result of getNextEventsToDisplay().
 *   now: Current time.
 *
 * Returns:
 *   `{text, hint}`, where `hint` is shown faded after `text`, e.g.
 *   `{text: "14:00 Design review", hint: "· 2h45"}`; or null when nothing is left today.
 */
export function eventStatusToIndicatorText(eventStatus, now = new Date()) {
  const { currentEvent, nextEvent, others } = eventStatus;
  const extra = others > 0 ? `+${others} ` : "";

  if (currentEvent !== null) {
    return {
      text: trimLongEventName(currentEvent.summary),
      hint: `${extra}· ${formatDuration(currentEvent.end - now)} left`,
    };
  }

  if (nextEvent !== null) {
    const startsIn = nextEvent.date - now;
    return {
      text: `${getTimeOfEventAsText(nextEvent.date)} ${trimLongEventName(nextEvent.summary)}`,
      hint: `${extra}· ${startsIn < 60000 ? "now" : formatDuration(startsIn)}`,
    };
  }

  return null;
}

export function getTimeOfEventAsText(eventDate) {
  const hrs = eventDate.getHours().toString().padStart(2, "0");
  const mins = eventDate.getMinutes().toString().padStart(2, "0");

  return `${hrs}:${mins}`;
}

// 5m, 1h, 2h45
export function formatDuration(ms) {
  const totalMins = Math.ceil(ms / 60000);
  if (totalMins < 60) return `${totalMins}m`;

  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  return mins === 0 ? `${hrs}h` : `${hrs}h${mins.toString().padStart(2, "0")}`;
}
