import { test } from "node:test";
import assert from "node:assert/strict";
import { validDate, amountCents, moneySummary, validateKnowledge } from "../life.mjs";
import { validateDecision } from "../management.mjs";
import { parseSchedule } from "../calendar.mjs";
import { freshPlanner } from "../規劃核心/store.mjs";
import { validate as validatePlanner } from "../規劃核心/validation.mjs";

const checks = [];
const add = (label, run) => checks.push([`ARC-${String(checks.length + 1).padStart(3, "0")} ${label}`, run]);
const rejects = (label, run) => add(label, () => assert.throws(run, undefined, label));
const decision = () => ({
  id: "d1", title: "準備考試", next: "做一題", criterion: "完成一回",
  reviewDate: "2026-10-20", planned: 60, importance: 4, urgency: 3,
});
const unit = () => ({ id: "u1", title: "概念", kind: "note", sources: [], original_record: {} });
const event = () => ({ id: "e1", title: "上課", date: "2026-10-13", start: "09:00", end: "10:00" });
const schedule = (item = event()) => parseSchedule(JSON.stringify({ events: [item] }));
const plannerCase = mutate => { const state = structuredClone(freshPlanner()); mutate(state); return () => validatePlanner(state); };

for (const value of ["", null, 42, [], {}, "2026-02-29", "2026-04-31", "2026-13-01", "2026-00-10", "2026-10-1", "2026/10/13", "2026-10-13T00:00:00Z", "2026-02-30", "0000-00-00", "2026-13-99"]) {
  add(`日期格式拒絕 ${String(value)}`, () => assert.equal(validDate(value), false));
}
for (const value of ["0", "-1", "+1", "1.001", "1e3", "NaN", "Infinity", ".50", "1.", "1,000", "1000000001", null]) {
  rejects(`金額格式拒絕 ${String(value)}`, () => amountCents(value));
}
for (const mutate of [
  d => d.id = "", d => d.id = " ", d => d.id = "x".repeat(121),
  d => d.title = "", d => d.title = "x".repeat(201),
  d => d.next = null, d => d.next = "x".repeat(301),
  d => d.criterion = 1, d => d.criterion = "x".repeat(501),
  d => d.reviewDate = "2026-02-30", d => d.planned = 1.5,
  d => d.importance = 0, d => d.urgency = 6,
  d => d.review = { outcome: "other", actual: 1, rule: "x", at: "2026-10-13" },
]) {
  add("決策資料邊界不合法", () => { const candidate = decision(); mutate(candidate); assert.equal(validateDecision(candidate), false); });
}
for (const mutate of [
  x => x.id = "", x => x.id = "x".repeat(121), x => x.title = " ",
  x => x.title = "x".repeat(1001), x => x.kind = "unknown", x => x.sources = {},
  x => x.original_record = null, x => x.original_record = [],
  x => x.evidence_status = "verified", x => x.metadata = [],
  x => x.relationships = [], x => x.relationships = { related: "u2" },
  x => x.relationships = { related: ["u2", "u2"] },
  x => { x.kind = "flashcard"; x.original_record = { front: "題目" }; },
  x => x.relationships = { related: [""] },
]) {
  rejects("知識單元欄位驗證", () => { const candidate = unit(); mutate(candidate); validateKnowledge([candidate]); });
}
for (const mutate of [
  x => x.title = "", x => x.title = "x".repeat(121), x => x.date = "2026-02-30",
  x => x.id = " ", x => x.start = "24:00", x => x.end = "08:00",
  x => x.start = "", x => x.end = "", x => x.category = "misc",
  x => x.status = "pending", x => x.notes = "x".repeat(2001),
  x => { x.weekday = 7; delete x.date; x.from = "2026-10-12"; x.until = "2026-10-31"; },
  x => { x.weekday = 1; delete x.date; x.from = "2026-10-12"; x.until = "2026-10-31"; x.excludedDates = ["2026-10-20"]; },
  x => { x.weekday = 1; delete x.date; x.from = "2026-10-12"; x.until = "2026-10-31"; x.overrides = { "2026-10-19": { color: "red" } }; },
  x => x.start = "09:61", x => x.source = 42,
  x => x.status = "personal", x => x.date = null,
  x => x.id = "e".repeat(121),
]) {
  rejects("日曆事件／匯入結構驗證", () => { const candidate = event(); mutate(candidate); schedule(candidate); });
}
for (const mutate of [
  s => s.version = 2,
  s => s.settings.limit = 0,
  s => s.settings.focus = 0,
  s => s.settings.rest = 0,
  s => s.settings.buffer = 81,
  s => s.days = s.days.slice(1),
  s => s.days[0].windows = [{ start: "23:00", end: "25:00" }],
  s => s.tasks = [{ id: "a", title: "A", remaining: 10, priority: 1, active: true, done: false }, { id: "a", title: "B", remaining: 10, priority: 1, active: true, done: false }],
  s => s.tasks = [{ id: "a", title: "A", remaining: 10, priority: 1, active: true, done: false, depends: "missing" }],
  s => s.tasks = [{ id: "a", title: "A", remaining: 10, priority: 1, active: true, done: false }, { id: "b", title: "B", remaining: 10, priority: 1, active: true, done: false, depends: "a" }].map((t, i, a) => ({ ...t, depends: a[1-i].id })),
  s => s.events = [{ id: "e", title: "X", date: "2026-10-13", start: "09:00", end: "08:00" }],
  s => s.overrides = { "2026-02-30": { hours: 1 } },
  s => s.timer = { mode: "focus", task: "missing", started: 1, until: 2 },
  s => s.settings.minBlock = s.settings.focus + 1,
  s => s.events = Array(1001).fill({ id: "e", title: "X", date: "2026-10-13", start: "09:00", end: "10:00" }),
]) {
  rejects("排程器輸入與資源上限", plannerCase(mutate));
}
for (const row of [null, { ...event(), cents: 1 }, { ...event(), date: "2026-02-30", type: "expense", cents: 10, category: "餐費" }, { ...event(), date: "2026-10-13", type: "gift", cents: 10, category: "餐費" }, { ...event(), date: "2026-10-13", type: "expense", cents: -1, category: "餐費" }, { ...event(), date: "2026-10-13", type: "expense", cents: 1.5, category: "餐費" }, { ...event(), date: "2026-10-13", type: "expense", cents: 10, category: "" }, { ...event(), date: "2026-10-13", type: "expense", cents: Number.MAX_SAFE_INTEGER + 1, category: "餐費" }, { ...event(), date: "2026-10-13", type: "expense", cents: Number.MAX_SAFE_INTEGER, category: "餐費" }]) {
  rejects("財務統計拒絕無效交易或合計溢位", () => moneySummary([row, row], "2026-10"));
}
add("正常的小額交易仍能正確計算", () => assert.equal(moneySummary([{ date: "2026-10-13", type: "expense", cents: 100, category: "餐費" }], "2026-10").balance, -100));

test("100 個跨模組資料邊界檢查", () => {
  assert.equal(checks.length, 100, `應有100項檢查，實際${checks.length}項`);
  for (const [label, run] of checks) {
    try { run(); } catch (error) { throw new Error(`${label}：${error.message}`, { cause: error }); }
  }
});
