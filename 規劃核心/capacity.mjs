import { eventsOn } from "../calendar.mjs";
import { minutes, subtract, mergeIntervals } from "./time.mjs";
export function capacity(date, state, cutoff = 0) {
  const day =
      state.overrides?.[date] ||
      state.days[new Date(date + "T12:00:00Z").getUTCDay()],
    events = eventsOn(state.events, date),
    windows = day.windows ?? [{ start: day.start, end: day.end }],
    blocked = events
      .filter((e) => e.start && e.end)
      .map((e) => [minutes(e.start), minutes(e.end)]),
    free = mergeIntervals(
      windows
        .map((w) => [Math.max(cutoff, minutes(w.start)), minutes(w.end)])
        .filter(([a, b]) => b > a),
    ).flatMap(([a, b]) => subtract(a, b, blocked));
  const slots = [];
  for (const [a, b] of free) {
    for (let s = a; s < b; s += state.settings.focus + state.settings.rest) {
      const n = Math.min(state.settings.focus, b - s);
      if (n >= state.settings.minBlock)
        slots.push({ date, start: s, end: s + n });
    }
  }
  const raw = slots.reduce((s, x) => s + x.end - x.start, 0);
  return {
    date,
    free,
    slots,
    raw,
    budget: Math.floor(
      Math.min(raw, day.hours * 60) * (1 - state.settings.buffer / 100),
    ),
  };
}
