import { capacity } from "./capacity.mjs";
export function plan(state, dates, now = null) {
  const days = dates.map((d) => ({
      ...capacity(d, state, now?.date === d ? now.minute : 0),
      used: 0,
      ids: new Set(),
      blocks: [],
    })),
    pending = state.tasks.filter((t) => !t.done && t.active),
    tasks = [...pending].sort(
      (a, b) =>
        (a.deadline || "9999").localeCompare(b.deadline || "9999") ||
        b.priority - a.priority,
    ),
    remaining = new Map(tasks.map((t) => [t.id, Math.ceil(t.remaining)])),
    unplaced = [],
    taskById = new Map(state.tasks.map((t) => [t.id, t])),
    completionTimes = new Map();
  let changed = true;
  while (changed) {
    changed = false;
    for (const t of tasks) {
      if (remaining.get(t.id) <= 0) continue;
      if (
        t.depends &&
        taskById.has(t.depends) &&
        !taskById.get(t.depends).done &&
        remaining.get(t.depends) !== 0
      )
        continue;
      const predecessor = completionTimes.get(t.depends);
      for (const d of days) {
        if (t.deadline && d.date > t.deadline) continue;
        if (d.ids.size >= state.settings.limit && !d.ids.has(t.id)) continue;
        for (const slot of d.slots) {
          const after = predecessor
            ? d.date < predecessor.date
              ? Infinity
              : d.date === predecessor.date
                ? predecessor.end
                : 0
            : 0;
          let start = Math.max(slot.start, after);
          const n = Math.min(
            slot.end - start,
            d.budget - d.used,
            remaining.get(t.id),
          );
          if (
            n <= 0 ||
            (n < state.settings.minBlock && n < remaining.get(t.id))
          )
            continue;
          d.blocks.push({
            id: t.id,
            title: t.title,
            date: d.date,
            start,
            end: start + n,
          });
          slot.start = start + n + state.settings.rest;
          d.used += n;
          d.ids.add(t.id);
          remaining.set(t.id, remaining.get(t.id) - n);
          if (remaining.get(t.id) <= 0)
            completionTimes.set(t.id, { date: d.date, end: start + n });
          changed = true;
          if (remaining.get(t.id) <= 0) break;
        }
        if (remaining.get(t.id) <= 0) break;
      }
    }
  }
  for (const t of tasks)
    if (remaining.get(t.id) > 0)
      unplaced.push({ ...t, missing: remaining.get(t.id) });
  return {
    days,
    unplaced,
    demand: tasks.reduce((s, t) => s + t.remaining, 0),
    capacity: days.reduce((s, d) => s + d.budget, 0),
    scheduled: days.reduce((s, d) => s + d.used, 0),
  };
}
