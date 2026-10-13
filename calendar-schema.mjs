// Shared data contract. No DOM or storage dependencies.
export const EVENT_TEXT_FIELDS = Object.freeze({
  subject: 80,
  teacher: 80,
  room: 120,
  outcome: 300,
  method: 1000,
});
export const OVERRIDE_FIELDS = Object.freeze([
  "title",
  "start",
  "end",
  "category",
  "notes",
  "status",
  ...Object.keys(EVENT_TEXT_FIELDS),
  "commitment",
  "actualMinutes",
]);
export const DEFAULT_SLOTS = Object.freeze(
  [
    ["晨間", "00:00", "08:30"],
    ["上午", "08:30", "12:00"],
    ["午間", "12:00", "13:30"],
    ["下午", "13:30", "17:30"],
    ["傍晚", "17:30", "18:30"],
    ["夜間", "18:30", "22:15"],
    ["睡前", "22:15", "24:00"],
  ].map(([label, start, end]) => Object.freeze({ label, start, end })),
);
const record = (x) => !!x && typeof x === "object" && !Array.isArray(x);
export const calendarDate = (x) =>
  typeof x === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(x) &&
  Number.isFinite(Date.parse(x + "T12:00:00Z")) &&
  new Date(x + "T12:00:00Z").toISOString().slice(0, 10) === x;
export const calendarTime = (x) =>
  typeof x === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(x);
export function minutes(value) {
  if (value === "24:00") return 1440;
  if (!calendarTime(value)) throw Error("時間格式不正確。");
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
}
export function eventDetails(item, { series = false } = {}) {
  const result = {};
  for (const [key, max] of Object.entries(EVENT_TEXT_FIELDS))
    if (item[key] !== undefined) {
      if (typeof item[key] !== "string" || item[key].length > max)
        throw Error("行程詳細欄位不正確：" + key);
      result[key] = item[key].trim();
    }
  if (item.commitment !== undefined) {
    if (!["fixed", "flexible"].includes(item.commitment))
      throw Error("行程固定／彈性標記不正確。");
    result.commitment = item.commitment;
  }
  if (item.actualMinutes !== undefined) {
    if (
      !Number.isInteger(item.actualMinutes) ||
      item.actualMinutes < 0 ||
      item.actualMinutes > 1440 ||
      (series && item.actualMinutes !== 0)
    )
      throw Error("實際時間須為0–1440分鐘，週期事件請逐日記錄。");
    result.actualMinutes = item.actualMinutes;
  }
  return result;
}
export function defaultCalendarPlan() {
  return {
    version: 1,
    weekly: {},
    subjects: {},
    slots: DEFAULT_SLOTS.map((x) => ({ ...x })),
    dailyMajorLimit: 4,
    defaultTargetHours: 20,
    defaultCapacityHours: 32.5,
  };
}
export function validateCalendarPlan(input) {
  if (!record(input) || input.version !== 1)
    throw Error("日曆規劃版本不支援。");
  if (
    !Number.isInteger(input.dailyMajorLimit) ||
    input.dailyMajorLimit < 1 ||
    input.dailyMajorLimit > 4
  )
    throw Error("每日主要事項上限為1–4。");
  for (const key of ["defaultTargetHours", "defaultCapacityHours"])
    if (!Number.isFinite(input[key]) || input[key] < 0 || input[key] > 168)
      throw Error("週時數須在0–168小時。");
  if (
    !Array.isArray(input.slots) ||
    input.slots.length < 1 ||
    input.slots.length > 12
  )
    throw Error("時段須有1–12段。");
  let end = 0;
  const labels = new Set();
  for (const slot of input.slots) {
    if (
      !record(slot) ||
      typeof slot.label !== "string" ||
      !slot.label.trim() ||
      slot.label.length > 20 ||
      labels.has(slot.label) ||
      !calendarTime(slot.start) ||
      (!calendarTime(slot.end) && slot.end !== "24:00") ||
      minutes(slot.start) !== end ||
      minutes(slot.end) <= end
    )
      throw Error("時段須由00:00起連續排列，名稱不可重複。");
    labels.add(slot.label);
    end = minutes(slot.end);
  }
  if (end !== 1440) throw Error("時段須完整涵蓋一天，最後結束為24:00。");
  if (!record(input.weekly) || Object.keys(input.weekly).length > 260)
    throw Error("週計畫最多260週。");
  const weekly = Object.create(null);
  for (const [day, week] of Object.entries(input.weekly)) {
    if (
      !calendarDate(day) ||
      new Date(day + "T12:00:00Z").getUTCDay() !== 1 ||
      !record(week)
    )
      throw Error("週計畫需使用週一日期。");
    for (const key of ["targetHours", "capacityHours"])
      if (!Number.isFinite(week[key]) || week[key] < 0 || week[key] > 168)
        throw Error("週目標與容量須為0–168小時。");
    if (
      !["normal", "exam", "report", "holiday"].includes(week.mode) ||
      typeof week.title !== "string" ||
      week.title.length > 120 ||
      !Array.isArray(week.focus) ||
      week.focus.length > 3 ||
      week.focus.some((x) => typeof x !== "string" || x.length > 200) ||
      typeof (week.review ?? "") !== "string" ||
      (week.review ?? "").length > 2000
    )
      throw Error("週重點或回顧格式不正確。");
    if (
      week.dailyTargets !== undefined &&
      (!Array.isArray(week.dailyTargets) ||
        week.dailyTargets.length !== 7 ||
        week.dailyTargets.some(
          (n) => n !== null && (!Number.isFinite(n) || n < 0 || n > 24),
        ))
    )
      throw Error("每日目標須為七天的0–24小時，未分配請留空。");
    weekly[day] = {
      title: week.title.trim(),
      focus: week.focus.map((x) => x.trim()).filter(Boolean),
      mode: week.mode,
      targetHours: week.targetHours,
      capacityHours: week.capacityHours,
      review: week.review ?? "",
      ...(week.dailyTargets === undefined
        ? {}
        : { dailyTargets: [...week.dailyTargets] }),
    };
  }
  if (!record(input.subjects) || Object.keys(input.subjects).length > 30)
    throw Error("科目讀法最多30科。");
  const subjects = Object.create(null);
  for (const [subject, method] of Object.entries(input.subjects)) {
    if (
      !subject.trim() ||
      subject.length > 80 ||
      typeof method !== "string" ||
      method.length > 2000
    )
      throw Error("科目讀法格式不正確。");
    subjects[subject] = method;
  }
  return {
    ...input,
    weekly,
    subjects,
    slots: input.slots.map((x) => ({ ...x })),
  };
}
