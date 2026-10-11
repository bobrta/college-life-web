import { capacity } from "./capacity.mjs";
import { validate, validPlannerDate } from "./validation.mjs";
export function plan(state, dates, now = null) {
  validate(state);
  if (
    !Array.isArray(dates) ||
    dates.length > 3660 ||
    dates.some((d) => !validPlannerDate(d))
  )
    throw Error("排程日期不正確");
  dates = [...new Set(dates)].sort();
  if (
    now &&
    (!validPlannerDate(now.date) ||
      !Number.isInteger(now.minute) ||
      now.minute < 0 ||
      now.minute > 1440)
  )
    throw Error("目前時間不正確");
  const days = dates.map((d) => ({
      ...capacity(d, state, now?.date === d ? now.minute : 0),
      used: 0,
      ids: new Set(),
      blocks: [],
    })),
    pending = state.tasks.filter((t) => !t.done && t.active),
    index = new Map(state.tasks.map((t) => [t.id, t])),
    pendingIds = new Set(pending.map((t) => t.id)),
    due = new Map(pending.map((t) => [t.id, t.deadline || "9999"])),
    priority = new Map(pending.map((t) => [t.id, t.priority]));
  // A required predecessor shares its descendant's deadline and importance.
  for (const task of pending) {
    let parent = index.get(task.depends);
    while (parent && !parent.done) {
      if (pendingIds.has(parent.id)) {
        due.set(
          parent.id,
          [due.get(parent.id), task.deadline || "9999"].sort()[0],
        );
        priority.set(
          parent.id,
          Math.max(priority.get(parent.id), task.priority),
        );
      }
      parent = index.get(parent.depends);
    }
  }
  const sorted = [...pending].sort(
      (a, b) =>
        due.get(a.id).localeCompare(due.get(b.id)) ||
        priority.get(b.id) - priority.get(a.id),
    ),
    tasks = [],
    visited = new Set();
  function visit(task) {
    if (visited.has(task.id)) return;
    visited.add(task.id);
    const parent = index.get(task.depends);
    if (parent && pendingIds.has(parent.id)) visit(parent);
    tasks.push(task);
  }
  sorted.forEach(visit);
  const remaining = new Map(tasks.map((t) => [t.id, Math.ceil(t.remaining)])),
    completionTimes = new Map();
  for (const task of tasks) {
    if (remaining.get(task.id) <= 0) continue;
    const parent = index.get(task.depends);
    if (parent && !parent.done && !completionTimes.has(parent.id)) continue;
    const predecessor = completionTimes.get(task.depends);
    for (const day of days) {
      if (task.deadline && day.date > task.deadline) continue;
      if (day.ids.size >= state.settings.limit && !day.ids.has(task.id))
        continue;
      for (const slot of day.slots) {
        let after = predecessor
            ? day.date < predecessor.date
              ? Infinity
              : day.date === predecessor.date
                ? predecessor.end + state.settings.rest
                : 0
            : 0,
          start = Math.max(slot.start, after);
        // Protect rest across different windows, not only within one focus slot.
        const previous = day.blocks
          .filter((b) => b.end <= start)
          .sort((a, b) => b.end - a.end)[0];
        if (previous)
          start = Math.max(start, previous.end + state.settings.rest);
        const next = day.blocks
            .filter((b) => b.start >= start)
            .sort((a, b) => a.start - b.start)[0],
          end = Math.min(
            slot.end,
            next ? next.start - state.settings.rest : Infinity,
          ),
          n = Math.min(
            end - start,
            day.budget - day.used,
            remaining.get(task.id),
          );
        if (
          n <= 0 ||
          (n < state.settings.minBlock && n < remaining.get(task.id))
        )
          continue;
        const block = {
          id: task.id,
          title: task.title,
          date: day.date,
          start,
          end: start + n,
        };
        day.blocks.push(block);
        slot.start = block.end + state.settings.rest;
        day.used += n;
        day.ids.add(task.id);
        remaining.set(task.id, remaining.get(task.id) - n);
        if (remaining.get(task.id) === 0) {
          completionTimes.set(task.id, block);
          break;
        }
      }
      if (remaining.get(task.id) === 0) break;
    }
  }
  for (const day of days) day.blocks.sort((a, b) => a.start - b.start);
  const unplaced = tasks
      .filter((t) => remaining.get(t.id) > 0)
      .map((t) => ({
        ...t,
        missing: remaining.get(t.id),
        reason:
          t.depends &&
          !index.get(t.depends).done &&
          !completionTimes.has(t.depends)
            ? "前置工作尚未完成或未排入"
            : "期限、可用時段或件數不足",
      })),
    verification = tasks.filter((t) => t.remaining === 0);
  return {
    days,
    unplaced,
    verification,
    demand: tasks.reduce((n, t) => n + Math.ceil(t.remaining), 0),
    capacity: days.reduce((n, d) => n + d.budget, 0),
    scheduled: days.reduce((n, d) => n + d.used, 0),
  };
}
