import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSchedule, toICS } from "../calendar.mjs";
import { financialOverview } from "../finance.mjs";
import { validateDecision, rankOptions, quadrant, decisionStage } from "../management.mjs";
import { moneySummary, validateBackup } from "../life.mjs";
import { createCloudClient } from "../cloud.mjs";
import { summarizeWrongAnalysis } from "../quiz-analysis.mjs";
import { validateHub } from "../規劃核心/lifestyle.mjs";
import { loadKnowledgeFile, readLimited } from "../knowledge-loader.mjs";

const validEvent = () => ({
  id: "e1",
  title: "上課",
  date: "2026-10-12",
  start: "09:00",
  end: "10:00",
});
const validDecision = () => ({
  id: "d1",
  title: "準備考試",
  next: "做一題",
  criterion: "完成一回",
  reviewDate: "2026-10-20",
  planned: 60,
  importance: 4,
  urgency: 3,
});
const validMoney = () => ({
  date: "2026-10-12",
  type: "expense",
  cents: 100,
  category: "午餐",
});
const rejectsSchedule = mutation => {
  const data = { events: [validEvent()] };
  mutation(data.events[0], data);
  assert.throws(() => parseSchedule(JSON.stringify(data)));
};

const calendarCases = [
  ...["2026-02-29", "2026-04-31", "2026-13-01", "2026-00-10", "26-10-12", "2026/10/12", "2026-10-1", "2026-10-12T00:00", "2026-02-30", "99999-01-01"].map(value => e => { e.date = value; }),
  ...["24:00", "9:00", "09:60", "-1:00", "09:0", "0900", 900, null, " ", "10:75"].map(value => e => { e.start = value; }),
  ...["24:00", "9:00", "10:60", "08:00", "09:00", "10:99", 1000, null, " ", "10:0"].map(value => e => { e.end = value; }),
  e => { e.title = "   "; },
  e => { e.title = "x".repeat(121); },
  e => { e.id = " "; },
  e => { e.id = "x".repeat(121); },
  e => { e.category = "unexpected"; },
  e => { e.status = "maybe"; },
  e => { e.source = "x".repeat(301); },
  e => { e.notes = "x".repeat(2001); },
  (e, d) => { d.events.push({ ...e }); },
  (e, d) => { d.weeks = {}; },
  (e, d) => { d.events = "events"; },
  (e, d) => { d.events = Array(1001).fill(e); },
  (e, d) => { d.events = [{ ...e, weekday: 1, from: "2026-10-12", until: "2026-10-20" }]; },
  (e, d) => { d.events = [{ ...e, weekday: 8, date: undefined, from: "2026-10-12", until: "2026-10-20" }]; },
  (e, d) => { d.events = [{ ...e, date: undefined, weekday: 1, from: "2026-10-20", until: "2026-10-12" }]; },
  (e, d) => { d.events = [{ ...e, date: undefined, weekday: 1, from: "2026-10-12", until: "2026-10-20", excludedDates: ["2026-10-13"] }]; },
  (e, d) => { d.events = [{ ...e, date: undefined, weekday: 1, from: "2026-10-12", until: "2026-10-20", overrides: { "2026-10-13": { title: "改期" } } }]; },
  (e, d) => { d.events = [{ ...e, start: "09:00", end: "", date: "2026-10-12" }]; },
  (e, d) => { d.events = [{ ...e, start: "10:00", end: "09:00" }]; },
];

test("行程匯入邊界案例拒絕損壞或會丟資料的輸入", () => {
  assert.equal(calendarCases.length, 49);
  calendarCases.forEach((mutation, index) => assert.doesNotThrow(() => rejectsSchedule(mutation), `calendar case ${index + 1}`));
});

const financeCases = [
  ...["2026-1", "2026-00", "2026-13", "26-10", "2026/10", "2026-10-01", "", null, 202610, "2026-99"].map(month => () => financialOverview([], month)),
  ...["2026-02-29", "2026-04-31", "2026-13-01", "2026-00-10", "x", "2026-10-1", "2026/10/12", "2026-10-12T00:00", null, 20261012].map(date => () => financialOverview([], "2026-10", 0, date)),
  ...[-1, 0.5, Number.MAX_SAFE_INTEGER + 1, "100", null].map(budget => () => financialOverview([], "2026-10", budget)),
  ...["2026-02-30", "2026-13-01", "x", "2026-10-1", "2026/10"].map(date => () => financialOverview([{ ...validMoney(), date }], "2026-10")),
  ...["gain", "Expense", "", null, 0].map(type => () => financialOverview([{ ...validMoney(), type }], "2026-10")),
  ...[-1, 0.5, Number.MAX_SAFE_INTEGER + 1, "100", null].map(cents => () => financialOverview([{ ...validMoney(), cents }], "2026-10")),
];
test("財務參數與交易資料邊界拒絕錯誤值", () => {
  assert.equal(financeCases.length, 40);
  financeCases.forEach((run, index) => assert.throws(run, `finance case ${index + 1}`));
});

const decisionCases = [
  d => { d.id = ""; }, d => { d.id = " "; }, d => { d.id = "x".repeat(121); },
  d => { d.title = ""; }, d => { d.title = "   "; }, d => { d.title = "x".repeat(201); },
  d => { d.next = null; }, d => { d.next = "x".repeat(301); },
  d => { d.criterion = 3; }, d => { d.criterion = "x".repeat(501); },
  d => { d.reviewDate = "2026-02-30"; }, d => { d.reviewDate = "2026-13-01"; },
  d => { d.planned = 1.5; }, d => { d.planned = 0; }, d => { d.planned = 1441; },
  d => { d.importance = 1.5; }, d => { d.importance = 0; }, d => { d.importance = 6; },
  d => { d.urgency = 1.5; }, d => { d.urgency = 0; }, d => { d.urgency = 6; },
  d => { d.taskId = 1; }, d => { d.taskId = " "; },
  d => { d.review = { outcome: "other", actual: 2, rule: "x", at: "2026-10-12" }; },
  d => { d.review = { outcome: "met", actual: 1.5, rule: "x", at: "2026-10-12" }; },
];
test("25 個決策紀錄邊界案例拒絕不完整或超限資料", () => {
  assert.equal(decisionCases.length, 25);
  decisionCases.forEach((mutation, index) => {
    const decision = validDecision(); mutation(decision);
    assert.equal(validateDecision(decision), false, `decision case ${index + 1}`);
  });
});

test("10 個跨模組財務安全邊界保留特殊分類並阻止統計溢位", () => {
  const names = ["__proto__", "constructor", "toString", "prototype", "hasOwnProperty"];
  for (const category of names) {
    const result = moneySummary([{ ...validMoney(), category }], "2026-10");
    assert.equal(Object.hasOwn(result.categories, category), true);
    assert.equal(result.categories[category], 100);
  }
  assert.throws(() => moneySummary([], "2026-1"));
  assert.throws(() => moneySummary([{ ...validMoney(), date: "2026-13-01" }], "2026-10"));
  assert.throws(() => moneySummary([{ ...validMoney(), cents: Number.MAX_SAFE_INTEGER }, { ...validMoney(), cents: 1 }], "2026-10"));
  assert.throws(() => moneySummary([], "2026-10", Number.MAX_SAFE_INTEGER + 1));
  assert.throws(() => moneySummary([null], "2026-10"));
});

test("ICS 匯出保留週期、全天結束日與換行注入防護", () => {
  const recurring = toICS([{ id: "series", title: "補課", weekday: 2, from: "2026-10-12", until: "2026-10-31", start: "08:00", end: "09:00" }]);
  assert.match(recurring, /RRULE:FREQ=WEEKLY;BYDAY=TU/);
  const allDay = toICS([{ id: "all-day", title: "休息", date: "2026-10-12" }]);
  assert.match(allDay, /DTEND;VALUE=DATE:20261013/);
  assert.doesNotMatch(toICS([{ id: "a", title: "標題\r\nBEGIN:VEVENT", date: "2026-10-12" }]), /\r\nBEGIN:VEVENT\r\nBEGIN:VEVENT/);
  const allDayRepeat = toICS([{ id: "all-day-repeat", title: "每週休息", weekday: 1, from: "2026-10-12", until: "2026-10-31" , excludedDates: ["2026-10-19"]}]);
  assert.match(allDayRepeat, /RRULE:[^\r\n]*UNTIL=20261031(?:\r\n|$)/);
  assert.match(allDayRepeat, /EXDATE;VALUE=DATE:20261019/);
  assert.doesNotMatch(allDayRepeat, /EXDATE;TZID/);
  assert.doesNotMatch(toICS([{ id: "cr", title: "有\r注入", date: "2026-10-12" }]), /\rBEGIN:VEVENT/);
});

test("備份與分析資料保留合法高進度和特殊字串分類", () => {
  const backup = validateBackup(JSON.stringify({ tasks: {}, plans: [{ title: "完成 30 項", due: "2026-10-20", target: 2, current: 30 }] }));
  assert.equal(backup.plans[0].current, 30);
  const analysis = summarizeWrongAnalysis([{ reason: "__proto__" }], [{ domain: "constructor", correct: true }]);
  assert.equal(analysis.reasons.__proto__, 1);
  assert.equal(analysis.topics[0].topic, "constructor");
});

test("決策圖拒絕越界評分並安全處理不完整任務狀態", () => {
  assert.throws(() => quadrant(0, 5));
  assert.throws(() => quadrant(4, 5.5));
  assert.throws(() => decisionStage({}, { tasks: null }));
  assert.equal(decisionStage({ taskId: "x" }, { tasks: { today: null } }), "plan");
});

test("期間預算必須使用剛好兩個有效日期", () => {
  const base = { version: 1, opening: 0, reserve: 0, budget: 0, resources: "", wipLimit: 3, transactions: [], decisions: [], health: [], budgets: {} };
  for (const key of ["2026-10-01/2026-10-31/extra", "2026-10-01", "2026-10-31/2026-10-01"]) {
    assert.throws(() => validateHub({ ...base, budgets: { [key]: 100 } }));
  }
  assert.doesNotThrow(() => validateHub({ ...base, budgets: { "2026-10-01/2026-10-31": 100 } }));
});

test("知識資料串流有大小上限且 gzip 內容可正常讀取", async () => {
  await assert.rejects(loadKnowledgeFile("../private.json", async () => { throw Error("不應發出請求"); }), /檔名/);
  await assert.rejects(readLimited(new Blob([new Uint8Array(5)]).stream(), 4, "測試資料"), /大小上限/);
  const source = '{"id":"unit-1"}\n{"id":"unit-2"}\n';
  const compressed = await new Response(new Blob([source]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer();
  const loaded = await loadKnowledgeFile("sample.json.gz", async () => new Response(compressed));
  assert.deepEqual(loaded, [{ id: "unit-1" }, { id: "unit-2" }]);
});

test("密碼重設無法驗證服務端身份時不安裝工作階段", async () => {
  const stored = new Map();
  const client = createCloudClient({ enabled: true, url: "https://example.invalid", publishableKey: "public" }, async () => ({ ok: false, status: 401 }), { setItem: (k, v) => stored.set(k, v), getItem: k => stored.get(k), removeItem: k => stored.delete(k) });
  await assert.rejects(client.recoverFromHash("#access_token=bad&refresh_token=bad"));
  assert.equal(stored.size, 0);
  await assert.rejects(client.recoverFromHash("#access_token=bad&refresh_token=bad&expires_at=nope"), /期限格式/);
  await assert.rejects(client.recoverFromHash("#access_token=bad&refresh_token=bad&expires_in=0"), /期限格式/);
  assert.equal(stored.size, 0);
});

test("比較計分拒絕空選項、越界分數與失效權重", () => {
  assert.throws(() => rankOptions([{ name: "" }, { name: "B", impact: 3, confidence: 3, effort: 3 }]));
  assert.throws(() => rankOptions([{ name: "A", impact: 6, confidence: 3, effort: 3 }, { name: "B", impact: 3, confidence: 3, effort: 3 }]));
  assert.throws(() => rankOptions([{ name: "A", impact: 3, confidence: 3, effort: 3 }, { name: "B", impact: 3, confidence: 3, effort: 3 }], { impact: -1, confidence: 0, effort: 0 }));
});
