export function validate(s) {
  if (
    !s ||
    s.version !== 1 ||
    !Array.isArray(s.tasks) ||
    s.tasks.length > 1000 ||
    !Array.isArray(s.events) ||
    s.events.length > 1000 ||
    !Array.isArray(s.days) ||
    s.days.length !== 7
  )
    throw Error("備份格式不正確");
  const num = (n, a, b) => Number.isFinite(n) && n >= a && n <= b;
  const time = (t) =>
    typeof t === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
  const date = (d) =>
    typeof d === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(d) &&
    !isNaN(Date.parse(d)) &&
    new Date(d + "T12:00:00Z").toISOString().slice(0, 10) === d;
  if (
    !s.settings ||
    !num(s.settings.focus, 5, 180) ||
    !num(s.settings.rest, 1, 60) ||
    !num(s.settings.minBlock, 5, 180) ||
    !num(s.settings.buffer, 0, 80) ||
    !Number.isInteger(s.settings.limit) ||
    !num(s.settings.limit, 1, 10)
  )
    throw Error("設定超出範圍");
  if (s.settings.minBlock > s.settings.focus)
    throw Error("最小區段不可大於每次專注時間");
  const checkDay = (d) => {
    if (!d || !num(d.hours, 0, 24)) throw Error("工時上限不正確");
    if (d.windows !== undefined) {
      if (
        !Array.isArray(d.windows) ||
        d.windows.length > 12 ||
        d.windows.some(
          (w) => !time(w.start) || !time(w.end) || w.end <= w.start,
        )
      )
        throw Error("可用時段不正確");
    } else if (!time(d.start) || !time(d.end) || d.end <= d.start)
      throw Error("可用時段不正確");
  };
  s.days.forEach(checkDay);
  if (s.overrides !== undefined) {
    if (
      !s.overrides ||
      typeof s.overrides !== "object" ||
      Array.isArray(s.overrides) ||
      Object.keys(s.overrides).length > 400
    )
      throw Error("單日設定不正確");
    for (const [d, x] of Object.entries(s.overrides)) {
      if (!date(d)) throw Error("單日日期不正確");
      checkDay(x);
    }
  }
  if (
    s.goals !== undefined &&
    (!Array.isArray(s.goals) ||
      s.goals.length > 200 ||
      s.goals.some(
        (g) =>
          !g ||
          typeof g.id !== "string" ||
          typeof g.title !== "string" ||
          !g.title.trim() ||
          g.title.length > 200 ||
          !["month", "quarter"].includes(g.period) ||
          !date(g.date),
      ))
  )
    throw Error("目標資料不正確");
  const ids = new Set();
  for (const t of s.tasks) {
    if (
      typeof t.id !== "string" ||
      ids.has(t.id) ||
      typeof t.title !== "string" ||
      !t.title.trim() ||
      t.title.length > 200 ||
      !num(t.remaining, 0, 100000) ||
      !num(t.priority, 1, 3) ||
      (t.deadline && !date(t.deadline)) ||
      typeof t.active !== "boolean" ||
      typeof t.done !== "boolean"
    )
      throw Error("任務資料不正確");
    ids.add(t.id);
  }
  for (const t of s.tasks)
    if (t.depends && (!ids.has(t.depends) || t.depends === t.id))
      throw Error("前置任務不正確");
  const taskIndex = new Map(s.tasks.map((t) => [t.id, t]));
  const colors = new Map();
  for (const task of s.tasks) {
    if (colors.get(task.id) === 2) continue;
    const path = [];
    let current = task;
    while (current && colors.get(current.id) !== 2) {
      if (colors.get(current.id) === 1) throw Error("任務存在循環依賴");
      colors.set(current.id, 1);
      path.push(current.id);
      current = current.depends ? taskIndex.get(current.depends) : null;
    }
    for (const id of path) colors.set(id, 2);
  }
  for (const e of s.events)
    if (
      typeof e.title !== "string" ||
      !time(e.start) ||
      !time(e.end) ||
      e.end <= e.start ||
      (!date(e.date) &&
        !(
          Number.isInteger(e.weekday) &&
          e.weekday >= 0 &&
          e.weekday <= 6 &&
          date(e.from) &&
          date(e.until) &&
          e.until >= e.from
        ))
    )
      throw Error("行程資料不正確");
  if (
    s.logs !== undefined &&
    (!Array.isArray(s.logs) ||
      s.logs.length > 10000 ||
      s.logs.some(
        (x) =>
          !x ||
          typeof x.task !== "string" ||
          !date(x.date) ||
          !num(x.minutes, 0, 1440),
      ))
  )
    throw Error("計時紀錄不正確");
  if (
    s.timer !== undefined &&
    s.timer !== null &&
    (!["focus", "rest"].includes(s.timer.mode) ||
      !Number.isFinite(s.timer.until) ||
      (s.timer.mode === "focus" &&
        (!ids.has(s.timer.task) ||
          !Number.isFinite(s.timer.started) ||
          s.timer.until < s.timer.started)))
  )
    throw Error("計時狀態不正確");
  if (
    s.confirmed !== undefined &&
    (!s.confirmed ||
      typeof s.confirmed.at !== "string" ||
      !Array.isArray(s.confirmed.blocks) ||
      s.confirmed.blocks.length > 10000 ||
      s.confirmed.blocks.some(
        (b) =>
          !b ||
          typeof b.title !== "string" ||
          !date(b.date) ||
          !num(b.start, 0, 1439) ||
          !num(b.end, 1, 1440) ||
          b.end <= b.start,
      ))
  )
    throw Error("排程快照不正確");
  return s;
}
