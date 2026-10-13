import { eventsOn, conflicts, parseSchedule, weekDates } from "./calendar.mjs";
import {
  calendarDate,
  minutes,
  defaultCalendarPlan,
  validateCalendarPlan,
} from "./calendar-schema.mjs";
export { defaultCalendarPlan, validateCalendarPlan };
export function shiftDate(date, days) {
  if (!calendarDate(date) || !Number.isInteger(days))
    throw Error("日期位移不正確。");
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  const result = d.toISOString().slice(0, 10);
  if (!calendarDate(result)) throw Error("日期超出範圍。");
  return result;
}
export function periodDates(date, view) {
  if (
    !calendarDate(date) ||
    !["day", "week", "month", "quarter", "year"].includes(view)
  )
    throw Error("日期或檢視不正確。");
  if (view === "day") return [date];
  if (view === "week") return weekDates(date);
  const y = Number(date.slice(0, 4)),
    m = Number(date.slice(5, 7)) - 1;
  const start = new Date(
    date.slice(0, 4) +
      "-" +
      String(
        view === "year"
          ? 1
          : (view === "quarter" ? Math.floor(m / 3) * 3 : m) + 1,
      ).padStart(2, "0") +
      "-01T12:00:00Z",
  );
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + { month: 1, quarter: 3, year: 12 }[view]);
  end.setUTCDate(end.getUTCDate() - 1);
  const dates = [];
  for (const d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1))
    dates.push(d.toISOString().slice(0, 10));
  return dates;
}
export function shiftPeriod(date, view, direction) {
  if (
    !calendarDate(date) ||
    !["day", "week", "month", "quarter", "year"].includes(view) ||
    ![-1, 1].includes(direction)
  )
    throw Error("檢視位移不正確。");
  if (view === "week" || view === "day")
    return shiftDate(date, direction * (view === "week" ? 7 : 1));
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(1);
  d.setUTCMonth(
    d.getUTCMonth() + direction * { month: 1, quarter: 3, year: 12 }[view],
  );
  const result = d.toISOString().slice(0, 10);
  if (!calendarDate(result)) throw Error("日期超出範圍。");
  return result;
}
export const activeEvents = (events, date) =>
  eventsOn(events, date).filter((e) => e.status !== "cancelled");
export function duration(event) {
  if (Boolean(event.start) !== Boolean(event.end))
    throw Error("行程時間不完整。");
  if (!event.start) return 0;
  const n = minutes(event.end) - minutes(event.start);
  if (n <= 0) throw Error("時段結束須晚於開始。");
  return n;
}
export function occupiedMinutes(events) {
  for (const event of events) if (event.status !== "cancelled") duration(event);
  const ranges = events
    .filter((e) => e.status !== "cancelled" && e.start && e.end)
    .map((e) => [minutes(e.start), minutes(e.end)])
    .sort((a, b) => a[0] - b[0]);
  let total = 0,
    last = -1;
  for (const [start, end] of ranges) {
    if (end <= start) throw Error("時段結束須晚於開始。");
    total += Math.max(0, end - Math.max(start, last));
    last = Math.max(last, end);
  }
  return total;
}
export function daySummary(events, date, limit = 4) {
  const entries = activeEvents(events, date),
    byCategory = { course: 0, study: 0, rest: 0, personal: 0, deadline: 0 };
  for (const e of entries)
    byCategory[e.category ?? "personal"] =
      (byCategory[e.category ?? "personal"] ?? 0) + duration(e);
  const study = entries.filter((e) => e.category === "study");
  const subjects = new Set(
    study.map((e) => e.subject?.trim() || e.title.trim()),
  );
  const major = new Set(
    entries
      .filter(
        (e) =>
          ["study", "personal", "deadline"].includes(e.category) &&
          e.category !== "rest",
      )
      .map((e) => e.subject?.trim() || e.title.trim()),
  );
  return {
    date,
    entries,
    byCategory,
    scheduled: byCategory.study,
    actual: study.reduce((n, e) => n + (e.actualMinutes ?? 0), 0),
    occupied: occupiedMinutes(entries),
    conflicts: conflicts(entries),
    majorCount: major.size,
    subjects: [...subjects],
    overLimit: major.size > limit,
  };
}
export function weekPlan(plan, date) {
  const p = validateCalendarPlan(plan ?? defaultCalendarPlan());
  return (
    p.weekly[weekDates(date)[0]] ?? {
      title: "本週，留時間給重要的事",
      focus: [],
      mode: "normal",
      targetHours: p.defaultTargetHours,
      capacityHours: p.defaultCapacityHours,
      review: "",
    }
  );
}
export function summarize(events, dates, plan) {
  const p = validateCalendarPlan(plan ?? defaultCalendarPlan()),
    days = dates.map((date) => daySummary(events, date, p.dailyMajorLimit));
  const totals = { course: 0, study: 0, rest: 0, personal: 0, deadline: 0 };
  const subjects = new Map();
  for (const day of days) {
    for (const [k, v] of Object.entries(day.byCategory))
      totals[k] = (totals[k] ?? 0) + v;
    for (const e of day.entries.filter((x) => x.category === "study")) {
      const name = e.subject || e.title;
      const old = subjects.get(name) ?? { name, planned: 0, actual: 0 };
      old.planned += duration(e);
      old.actual += e.actualMinutes ?? 0;
      subjects.set(name, old);
    }
  }
  return {
    days,
    totals,
    scheduled: totals.study,
    actual: days.reduce((n, d) => n + d.actual, 0),
    occupied: days.reduce((n, d) => n + d.occupied, 0),
    conflictCount: days.reduce((n, d) => n + d.conflicts.length, 0),
    subjects: [...subjects.values()],
    completionRate: totals.study
      ? days.reduce((n, d) => n + d.actual, 0) / totals.study
      : null,
  };
}
export function proposalImpact(events, candidate, plan, ignoreId) {
  const parsed = parseSchedule(JSON.stringify({ events: [candidate] }))
    .events[0];
  let date = parsed.date ?? parsed.from;
  while (
    parsed.weekday !== undefined &&
    new Date(date + "T12:00:00Z").getUTCDay() !== parsed.weekday &&
    date <= parsed.until
  )
    date = shiftDate(date, 1);
  if (parsed.weekday !== undefined && date > parsed.until)
    throw Error("重複範圍內沒有符合星期的日期。");
  const remaining = events.filter((e) => e.id !== ignoreId);
  const before = daySummary(remaining, date);
  const added = activeEvents([parsed], date);
  const after = daySummary([...remaining, ...[parsed]], date);
  const config = weekPlan(plan, date);
  const week = summarize([...remaining, parsed], weekDates(date), plan);
  return {
    date,
    duration: duration(added[0] ?? parsed),
    conflicts: after.conflicts.filter(([a, b]) =>
      added.some((e) => e.id === a || e.id === b),
    ),
    restConflicts: before.entries.filter(
      (e) => e.category === "rest" && conflicts([e, ...added]).length,
    ),
    remainingStudyMinutes: Math.round(
      config.capacityHours * 60 - week.scheduled,
    ),
    majorCount: after.majorCount,
  };
}
export function mergeSchedule(existing, incoming) {
  const parsed = parseSchedule(JSON.stringify(incoming));
  const map = new Map(existing.map((e) => [e.id, e]));
  for (const e of parsed.events) map.set(e.id, e);
  const events = parseSchedule(
    JSON.stringify({ events: [...map.values()] }),
  ).events;
  return { events, weeks: parsed.weeks };
}
export function updateSeries(existing, candidate) {
  const old = existing.find((e) => e.id === candidate.id);
  const next = { ...old, ...candidate };
  if (candidate.weekday === undefined) {
    for (const k of ["weekday", "from", "until", "excludedDates", "overrides"])
      delete next[k];
  } else {
    delete next.date;
    const belongs = (d) =>
      d >= next.from &&
      d <= next.until &&
      new Date(d + "T12:00:00Z").getUTCDay() === next.weekday;
    next.excludedDates = (old?.excludedDates ?? []).filter(belongs);
    next.overrides = Object.fromEntries(
      Object.entries(old?.overrides ?? {}).filter(([d]) => belongs(d)),
    );
  }
  return parseSchedule(
    JSON.stringify({
      events: [...existing.filter((e) => e.id !== next.id), next],
    }),
  ).events;
}
export function generateStudyTemplate({
  from,
  until,
  subject,
  mode = "normal",
  prefix = "study-template",
}) {
  if (typeof prefix !== "string" || !prefix.trim() || prefix.length > 60)
    throw Error("模板代號不正確。");
  if (
    !calendarDate(from) ||
    !calendarDate(until) ||
    until < from ||
    shiftDate(from, 366) < until ||
    typeof subject !== "string" ||
    !subject.trim() ||
    subject.length > 80 ||
    !["normal", "exam", "report"].includes(mode)
  )
    throw Error("模板日期、科目或模式不正確，最多一年。");
  const events = [];
  for (let date = from; date <= until; date = shiftDate(date, 1)) {
    const wd = new Date(date + "T12:00:00Z").getUTCDay();
    if (wd !== 1 && wd !== 6) continue;
    let cursor = wd === 1 ? 18 * 60 + 55 : 8 * 60 + 30;
    const segments =
      mode === "normal"
        ? wd === 1
          ? [
              [50, "概念理解"],
              [10, "休息"],
              [40, "白紙重現"],
              [10, "休息"],
              [40, "獨立例題"],
              [30, "閉卷檢查"],
            ]
          : [
              [50, "基礎練題"],
              [10, "休息"],
              [50, "進階練題"],
              [10, "休息"],
              [60, "訂正重算"],
            ]
        : [
            [50, "校內例題"],
            [10, "休息"],
            [40, "練題與訂正"],
          ];
    for (const [length, task] of segments) {
      const start = `${Math.floor(cursor / 60)
        .toString()
        .padStart(2, "0")}:${(cursor % 60).toString().padStart(2, "0")}`;
      cursor += length;
      const end = `${Math.floor(cursor / 60)
        .toString()
        .padStart(2, "0")}:${(cursor % 60).toString().padStart(2, "0")}`;
      events.push({
        id: `${prefix}-${date}-${start.replace(":", "")}`,
        date,
        start,
        end,
        title: task === "休息" ? "休息" : subject + " · " + task,
        subject: task === "休息" ? "" : subject,
        category: task === "休息" ? "rest" : "study",
        commitment: task === "休息" ? "fixed" : "flexible",
        outcome:
          task === "休息" ? "离開座位，讓自己休息" : "完成後記錄一項觀念或錯因",
        status: "draft",
        source: "自行選用學習模板",
      });
    }
  }
  return parseSchedule(JSON.stringify({ events })).events;
}
