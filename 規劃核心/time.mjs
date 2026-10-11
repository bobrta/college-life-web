import { validPlannerDate } from "./validation.mjs";
export function minutes(t) {
  if (typeof t !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(t))
    throw Error("時間需為00:00～23:59");
  return Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
}
export function clock(n) {
  if (!Number.isInteger(n) || n < 0 || n >= 1440)
    throw Error("時刻需為有效整數分鐘");
  return `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
}
export function range(anchor, period) {
  if (
    !validPlannerDate(anchor) ||
    !["week", "month", "quarter", "year"].includes(period)
  )
    throw Error("規劃日期或週期不正確");
  const d = new Date(anchor + "T12:00:00Z");
  if (period === "week")
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  else d.setUTCDate(1);
  if (period === "quarter") d.setUTCMonth(Math.floor(d.getUTCMonth() / 3) * 3);
  if (period === "year") d.setUTCMonth(0);
  const end = new Date(d);
  if (period === "week") end.setUTCDate(end.getUTCDate() + 7);
  else
    end.setUTCMonth(
      end.getUTCMonth() +
        (period === "year" ? 12 : period === "quarter" ? 3 : 1),
    );
  const out = [];
  for (; d < end; d.setUTCDate(d.getUTCDate() + 1))
    out.push(d.toISOString().slice(0, 10));
  return out;
}
export function subtract(start, end, blocks) {
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < 0 ||
    end > 1440 ||
    end < start
  )
    throw Error("可用區間不正確");
  mergeIntervals(blocks);
  let free = start === end ? [] : [[start, end]];
  for (const [a, b] of blocks)
    free = free.flatMap(([s, e]) =>
      b <= s || a >= e
        ? [[s, e]]
        : [
            [s, Math.min(a, e)],
            [Math.max(b, s), e],
          ].filter(([x, y]) => y > x),
    );
  return free;
}
export function mergeIntervals(intervals) {
  if (
    !Array.isArray(intervals) ||
    intervals.some(
      (x) =>
        !Array.isArray(x) ||
        x.length !== 2 ||
        !x.every(Number.isFinite) ||
        x[0] < 0 ||
        x[1] > 1440 ||
        x[1] < x[0],
    )
  )
    throw Error("區間格式或順序不正確");
  const sorted = intervals.map((x) => [...x]).sort((a, b) => a[0] - b[0]),
    out = [];
  for (const x of sorted) {
    const last = out.at(-1);
    if (last && x[0] <= last[1]) last[1] = Math.max(last[1], x[1]);
    else out.push(x);
  }
  return out;
}
export function parseWindows(text) {
  if (typeof text !== "string") throw Error("請輸入文字時段");
  if (!text.trim()) return [];
  if (text.split(/[,，\n]/).length > 12) throw Error("每天最多12個時段");
  return text.split(/[,，\n]/).map((part) => {
    const match = part
      .trim()
      .match(/^([0-2]\d:[0-5]\d)\s*[-–]\s*([0-2]\d:[0-5]\d)$/);
    if (
      !match ||
      minutes(match[1]) >= 1440 ||
      minutes(match[2]) >= 1440 ||
      match[2] <= match[1]
    )
      throw Error("時段格式：08:00-10:00,18:30-22:15；跨午夜請拆分");
    return { start: match[1], end: match[2] };
  });
}
