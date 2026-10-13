import { parseSchedule } from "../calendar.mjs";

// Merge calendar events without deleting either store. The main calendar wins
// ID conflicts; the planner can safely add events without replacing user data.
export function mergeCalendarEvents(canonical, planner) {
  const normalizedCanonical = canonical.map((event) =>
    event?.status === "personal" ? { ...event, status: "confirmed" } : event,
  );
  const parsedPrimary = parseSchedule(JSON.stringify({ events: normalizedCanonical })).events;
  const primary = canonical.map((event) => structuredClone(event));
  const local = parseSchedule(JSON.stringify({ events: planner })).events;
  const merged = new Map(primary.map((event) => [event.id, event]));
  let added = 0, conflicts = 0;
  for (const event of local) {
    const existing = merged.get(event.id);
    if (!existing) {
      merged.set(event.id, event);
      added++;
    } else {
      const parsedExisting = parsedPrimary.find((item) => item.id === event.id);
      if (JSON.stringify(parsedExisting) !== JSON.stringify(event)) conflicts++;
    }
  }
  const events = [...merged.values()];
  parseSchedule(JSON.stringify({ events: events.map((event) =>
    event?.status === "personal" ? { ...event, status: "confirmed" } : event,
  ) }));
  return {
    events,
    added,
    conflicts,
  };
}
