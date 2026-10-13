import { validateHub } from "./lifestyle.mjs";
export function validPlannerDate(value) {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !isNaN(Date.parse(value)) &&
    new Date(value + "T12:00:00Z").toISOString().slice(0, 10) === value
  );
}
export function validate(s) {
  const record = (x) => !!x && typeof x === "object" && !Array.isArray(x),
    num = (n, a, b) => Number.isFinite(n) && n >= a && n <= b,
    int = (n, a, b) => Number.isInteger(n) && num(n, a, b),
    id = (x) =>
      typeof x === "string" &&
      x.trim() === x &&
      x.length > 0 &&
      x.length <= 120,
    text = (x, max) => typeof x === "string" && !!x.trim() && x.length <= max,
    time = (t) => typeof t === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(t),
    date = validPlannerDate;
  if (
    !record(s) ||
    s.version !== 1 ||
    !Array.isArray(s.tasks) ||
    s.tasks.length > 1000 ||
    !Array.isArray(s.events) ||
    s.events.length > 1000 ||
    !Array.isArray(s.days) ||
    s.days.length !== 7
  )
    throw Error("備份格式不正確");
  if (s.revision !== undefined && !int(s.revision, 0, Number.MAX_SAFE_INTEGER))
    throw Error("修訂號不正確");
  if (
    !record(s.settings) ||
    !int(s.settings.focus, 5, 180) ||
    !int(s.settings.rest, 1, 60) ||
    !int(s.settings.minBlock, 5, 180) ||
    !num(s.settings.buffer, 0, 80) ||
    !int(s.settings.limit, 1, 10) ||
    s.settings.minBlock > s.settings.focus
  )
    throw Error("專注、休息與最小區段需為有效整數分鐘");
  const checkDay = (d) => {
    if (!record(d) || !num(d.hours, 0, 24)) throw Error("工時上限不正確");
    if (d.windows !== undefined) {
      if (
        !Array.isArray(d.windows) ||
        d.windows.length > 12 ||
        d.windows.some(
          (w) =>
            !record(w) || !time(w.start) || !time(w.end) || w.end <= w.start,
        )
      )
        throw Error("可用時段不正確");
    } else if (!time(d.start) || !time(d.end) || d.end <= d.start)
      throw Error("可用時段不正確");
  };
  s.days.forEach(checkDay);
  if (s.overrides !== undefined) {
    if (!record(s.overrides) || Object.keys(s.overrides).length > 400)
      throw Error("單日設定不正確");
    for (const [d, x] of Object.entries(s.overrides)) {
      if (!date(d)) throw Error("單日日期不正確");
      checkDay(x);
    }
  }
  const goalIds = new Set();
  if (s.goals !== undefined) {
    if (!Array.isArray(s.goals) || s.goals.length > 200)
      throw Error("目標資料不正確");
    for (const g of s.goals) {
      if (
        !record(g) ||
        !id(g.id) ||
        goalIds.has(g.id) ||
        !text(g.title, 200) ||
        !["month", "quarter"].includes(g.period) ||
        !date(g.date)
      )
        throw Error("目標名稱、ID或日期不正確");
      goalIds.add(g.id);
    }
  }
  const ids = new Set();
  for (const t of s.tasks) {
    if (
      !record(t) ||
      !id(t.id) ||
      ids.has(t.id) ||
      !text(t.title, 200) ||
      !num(t.remaining, 0, 100000) ||
      !int(t.priority, 1, 3) ||
      (t.category !== undefined &&
        !["study", "work", "exercise", "personal"].includes(t.category)) ||
      (t.deadline !== undefined && t.deadline !== "" && !date(t.deadline)) ||
      typeof t.active !== "boolean" ||
      typeof t.done !== "boolean" ||
      (t.outcome !== undefined &&
        (typeof t.outcome !== "string" || t.outcome.length > 300)) ||
      (t.depends !== undefined && typeof t.depends !== "string") ||
      (t.goal !== undefined &&
        (typeof t.goal !== "string" || (t.goal !== "" && !goalIds.has(t.goal))))
    )
      throw Error("任務名稱、ID、期限、優先級或關聯不正確");
    ids.add(t.id);
  }
  for (const t of s.tasks)
    if (t.depends && (!ids.has(t.depends) || t.depends === t.id))
      throw Error("前置任務不正確");
  const index = new Map(s.tasks.map((t) => [t.id, t])),
    colors = new Map();
  for (const task of s.tasks) {
    if (colors.get(task.id) === 2) continue;
    const path = [];
    let current = task;
    while (current && colors.get(current.id) !== 2) {
      if (colors.get(current.id) === 1) throw Error("任務存在循環依賴");
      colors.set(current.id, 1);
      path.push(current.id);
      current = current.depends ? index.get(current.depends) : null;
    }
    for (const x of path) colors.set(x, 2);
  }
  const eventIds = new Set();
  for (const e of s.events) {
    if (
      !record(e) ||
      !id(e.id) ||
      eventIds.has(e.id) ||
      !text(e.title, 120) ||
      (e.category !== undefined &&
        !["course", "study", "rest", "deadline", "personal"].includes(e.category)) ||
      (e.status !== undefined &&
        !["draft", "confirmed", "done", "cancelled"].includes(e.status)) ||
      (e.notes !== undefined &&
        (typeof e.notes !== "string" || e.notes.length > 2000)) ||
      !time(e.start) ||
      !time(e.end) ||
      e.end <= e.start
    )
      throw Error("行程名稱、ID或時間不正確");
    eventIds.add(e.id);
    const series = e.weekday !== undefined;
    if (series) {
      if (
        e.date !== undefined ||
        !int(e.weekday, 0, 6) ||
        !date(e.from) ||
        !date(e.until) ||
        e.until < e.from
      )
        throw Error("重複行程規則不正確");
    } else if (!date(e.date)) throw Error("行程日期不正確");
    const inSeries = (d) =>
      series &&
      date(d) &&
      d >= e.from &&
      d <= e.until &&
      new Date(d + "T12:00:00Z").getUTCDay() === e.weekday;
    if (
      e.excludedDates !== undefined &&
      (!Array.isArray(e.excludedDates) ||
        e.excludedDates.length > 400 ||
        e.excludedDates.some((d) => !inSeries(d)))
    )
      throw Error("排除日期必須屬於重複行程");
    if (e.overrides !== undefined) {
      if (!record(e.overrides) || Object.keys(e.overrides).length > 400)
        throw Error("行程覆寫格式不正確");
      for (const [d, o] of Object.entries(e.overrides)) {
        if (
          !inSeries(d) ||
          !record(o) ||
          Object.keys(o).some(
            (k) =>
              ![
                "title",
                "start",
                "end",
                "category",
                "notes",
                "status",
              ].includes(k),
          ) ||
          (o.title !== undefined && !text(o.title, 120)) ||
          (o.category !== undefined &&
            !["course", "study", "rest", "deadline", "personal"].includes(o.category)) ||
          (o.status !== undefined &&
            !["draft", "confirmed", "done", "cancelled"].includes(o.status)) ||
          (o.notes !== undefined &&
            (typeof o.notes !== "string" || o.notes.length > 2000)) ||
          !time(o.start ?? e.start) ||
          !time(o.end ?? e.end) ||
          (o.end ?? e.end) <= (o.start ?? e.start)
        )
          throw Error("覆寫日期或時間不正確");
      }
    }
  }
  if (
    s.logs !== undefined &&
    (!Array.isArray(s.logs) ||
      s.logs.length > 10000 ||
      s.logs.some(
        (x) =>
          !record(x) ||
          !id(x.task) ||
          !date(x.date) ||
          !num(x.minutes, 0, 1440),
      ))
  )
    throw Error("計時紀錄不正確");
  if (s.timer !== undefined && s.timer !== null) {
    const t = s.timer;
    if (
      !record(t) ||
      !["focus", "rest"].includes(t.mode) ||
      !num(t.until, 0, 8640000000000000) ||
      (t.mode === "focus" &&
        (!ids.has(t.task) ||
          index.get(t.task).done ||
          !num(t.started, 0, 8640000000000000) ||
          t.until < t.started ||
          t.until - t.started > 180 * 60000))
    )
      throw Error("計時狀態不正確");
  }
  if (s.confirmed !== undefined) {
    const c = s.confirmed;
    if (
      !record(c) ||
      typeof c.at !== "string" ||
      (c.revision !== undefined &&
        !int(c.revision, 0, Number.MAX_SAFE_INTEGER)) ||
      !Array.isArray(c.blocks) ||
      c.blocks.length > 10000 ||
      c.blocks.some(
        (b) =>
          !record(b) ||
          !text(b.title, 200) ||
          !date(b.date) ||
          !int(b.start, 0, 1439) ||
          !int(b.end, 1, 1439) ||
          b.end <= b.start,
      )
    )
      throw Error("排程快照不正確");
  }
  if (s.hub !== undefined) validateHub(s.hub);
  return s;
}
