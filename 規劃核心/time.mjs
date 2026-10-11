export const minutes = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
export const clock = (n) =>
  `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
export function range(anchor, period) {
  const d = new Date(anchor + "T12:00:00Z");
  if (period === "week")
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  else d.setUTCDate(1);
  if (period === "quarter") d.setUTCMonth(Math.floor(d.getUTCMonth() / 3) * 3);
  const end = new Date(d);
  if (period === "week") end.setUTCDate(end.getUTCDate() + 7);
  else end.setUTCMonth(end.getUTCMonth() + (period === "quarter" ? 3 : 1));
  const out = [];
  for (; d < end; d.setUTCDate(d.getUTCDate() + 1))
    out.push(d.toISOString().slice(0, 10));
  return out;
}
export function subtract(start, end, blocks) {
  let free = [[start, end]];
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
  if (!text.trim()) return [];
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
