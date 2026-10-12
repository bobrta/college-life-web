import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const root = process.env.PLANNER_TEST_ROOT
  ? resolve(process.env.PLANNER_TEST_ROOT)
  : resolve(import.meta.dirname, "..");
const { validate } = await import(
  pathToFileURL(resolve(root, "規劃核心/validation.mjs"))
);
const { range, minutes, clock, subtract, mergeIntervals, parseWindows } =
  await import(pathToFileURL(resolve(root, "規劃核心/time.mjs")));
const { plan } = await import(
  pathToFileURL(resolve(root, "規劃核心/scheduler.mjs"))
);
const { capacity } = await import(
  pathToFileURL(resolve(root, "規劃核心/capacity.mjs"))
);
const { conflicts, workloadByDay } = await import(
  pathToFileURL(resolve(root, "calendar.mjs"))
);
const base = () => ({
  version: 1,
  revision: 0,
  settings: { limit: 4, buffer: 0, focus: 50, rest: 10, minBlock: 20 },
  days: Array.from({ length: 7 }, () => ({
    windows: [{ start: "08:00", end: "12:00" }],
    hours: 4,
  })),
  tasks: [
    {
      id: "a",
      title: "A",
      remaining: 60,
      priority: 2,
      active: true,
      done: false,
      deadline: "",
      outcome: "",
      depends: "",
      goal: "",
    },
  ],
  events: [],
  goals: [],
  logs: [],
  overrides: {},
});
const event = () => ({
  id: "e",
  title: "上課",
  date: "2026-10-12",
  start: "09:00",
  end: "10:00",
});
const repeat = () => ({
  id: "e",
  title: "上課",
  weekday: 1,
  from: "2026-10-01",
  until: "2026-10-31",
  start: "09:00",
  end: "10:00",
});
const goal = () => ({
  id: "g",
  title: "目標",
  date: "2026-10-01",
  period: "month",
});
const malformed = [
  [1, "空任務ID讓選單無法選擇", (s) => (s.tasks[0].id = "")],
  [2, "超長任務ID造成資料鍵不受限制", (s) => (s.tasks[0].id = "x".repeat(121))],
  [3, "小數優先級無法對應選單", (s) => (s.tasks[0].priority = 1.5)],
  [4, "null期限繞過日期型別檢查", (s) => (s.tasks[0].deadline = null)],
  [5, "非文字完成條件被接受", (s) => (s.tasks[0].outcome = {})],
  [6, "布林前置任務被當成無依賴", (s) => (s.tasks[0].depends = false)],
  [7, "任務指向不存在的目標", (s) => (s.tasks[0].goal = "missing")],
  [8, "重複目標ID導致整批誤刪", (s) => (s.goals = [goal(), goal()])],
  [9, "空目標ID與未指定目標混淆", (s) => (s.goals = [{ ...goal(), id: "" }])],
  [
    10,
    "目標ID沒有長度上限",
    (s) => (s.goals = [{ ...goal(), id: "x".repeat(121) }]),
  ],
  [
    11,
    "沒有事件ID會誤刪其他無ID事件",
    (s) => {
      const e = event();
      delete e.id;
      s.events = [e];
    },
  ],
  [12, "重複事件ID導致刪除多筆", (s) => (s.events = [event(), event()])],
  [
    13,
    "空白事件名稱仍可保存",
    (s) => (s.events = [{ ...event(), title: "   " }]),
  ],
  [
    14,
    "事件名稱無長度限制",
    (s) => (s.events = [{ ...event(), title: "x".repeat(121) }]),
  ],
  [
    15,
    "單次日期與重複規則混用",
    (s) => (s.events = [{ ...repeat(), date: "2026-10-12" }]),
  ],
  [
    16,
    "排除日期非陣列會讓行程展開失敗",
    (s) => (s.events = [{ ...repeat(), excludedDates: {} }]),
  ],
  [
    17,
    "排除日期含不存在的日期",
    (s) => (s.events = [{ ...repeat(), excludedDates: ["2026-02-30"] }]),
  ],
  [
    18,
    "排除日期超出重複範圍",
    (s) => (s.events = [{ ...repeat(), excludedDates: ["2026-11-02"] }]),
  ],
  [
    19,
    "單次覆寫含非法時間會算錯容量",
    (s) =>
      (s.events = [
        { ...repeat(), overrides: { "2026-10-12": { start: "99:00" } } },
      ]),
  ],
  [
    20,
    "覆寫日期不属于系列卻被接受",
    (s) =>
      (s.events = [
        { ...repeat(), overrides: { "2026-10-13": { title: "錯誤" } } },
      ]),
  ],
  [21, "小數專注長度產生非法日曆時間", (s) => (s.settings.focus = 50.5)],
  [22, "小數休息長度產生非法開始時間", (s) => (s.settings.rest = 10.5)],
  [23, "小數最小區段與分鐘排程不一致", (s) => (s.settings.minBlock = 20.5)],
  [
    24,
    "快照的小數時間无法匯出有效時間",
    (s) =>
      (s.confirmed = {
        at: "now",
        revision: 0,
        blocks: [
          { id: "a", title: "A", date: "2026-10-12", start: 480.5, end: 500 },
        ],
      }),
  ],
  [
    25,
    "文字快照修訂號使變更判斷失真",
    (s) => (s.confirmed = { at: "now", revision: "bad", blocks: [] }),
  ],
  [26, "負修訂號破壞保存版本順序", (s) => (s.revision = -1)],
  [
    27,
    "負計時截止時間會立即觸發",
    (s) => (s.timer = { mode: "rest", until: -1 }),
  ],
  [
    28,
    "超長專注計時超出設定上限",
    (s) =>
      (s.timer = {
        mode: "focus",
        task: "a",
        started: 1000000,
        until: 1000000 + 181 * 60000,
      }),
  ],
  [
    29,
    "已完成任務仍保留運作中計時",
    (s) => {
      s.tasks[0].done = true;
      s.timer = { mode: "focus", task: "a", started: 1000000, until: 1060000 };
    },
  ],
  [
    30,
    "空紀錄任務ID使耗時无法追溯",
    (s) => (s.logs = [{ task: "", date: "2026-10-12", minutes: 1 }]),
  ],
];
for (const [id, label, mutate] of malformed)
  test(`P${String(id).padStart(2, "0")} ${label}`, () => {
    const s = base();
    mutate(s);
    assert.throws(() => validate(s));
  });
test("P31 非法規劃日期不可默默返回空清單", () =>
  assert.throws(() => range("not-a-date", "week")));
test("P32 非法週期不可默默算成月份", () =>
  assert.throws(() => range("2026-10-12", "fortnight")));
test("P33 非法時間字串不可變成可用分鐘", () =>
  assert.throws(() => minutes("99:99")));
test("P34 小數分鐘不可轉成非法時刻", () => assert.throws(() => clock(480.5)));
test("P35 倒序可用區段不可返回負長度區段", () =>
  assert.throws(() => subtract(100, 50, [])));
test("P36 倒序區間不可參與合併", () =>
  assert.throws(() => mergeIntervals([[100, 50]])));
test("P37 超過12段時段需在解析時提示", () =>
  assert.throws(() => parseWindows(Array(13).fill("08:00-09:00").join(","))));
test("P38 重複日期不可重複計算與安排", () => {
  const p = plan(base(), ["2026-10-12", "2026-10-12"]);
  assert.equal(p.days.length, 1);
});
test("P39 亂序日期應按時間安排", () => {
  const p = plan(base(), ["2026-10-13", "2026-10-12"]);
  assert.equal(p.days[0].date, "2026-10-12");
});
test("P40 小數估時需與分鐘排程使用一致需求", () => {
  const s = base();
  s.tasks[0].remaining = 0.2;
  const p = plan(s, ["2026-10-12"]);
  assert.equal(
    p.demand,
    p.scheduled + p.unplaced.reduce((n, t) => n + t.missing, 0),
  );
});
test("P41 緊急子任務需帶動前置任務排序", () => {
  const s = base();
  s.settings.limit = 2;
  s.tasks = [
    { ...s.tasks[0], id: "bulk", remaining: 300 },
    { ...s.tasks[0], id: "parent", remaining: 50 },
    {
      ...s.tasks[0],
      id: "child",
      remaining: 50,
      deadline: "2026-10-12",
      depends: "parent",
    },
  ];
  const p = plan(s, ["2026-10-12"]);
  assert.ok(p.days[0].blocks.some((b) => b.id === "child"));
});
test("P42 尚未確認完成的零估時前置任務不應解鎖後續", () => {
  const s = base();
  s.tasks[0].remaining = 0;
  s.tasks.push({ ...s.tasks[0], id: "child", remaining: 20, depends: "a" });
  const p = plan(s, ["2026-10-12"]);
  assert.equal(p.scheduled, 0);
});
test("P43 相隔五分鐘的時段仍要保留十分鐘休息", () => {
  const s = base();
  s.days[1].windows = [
    { start: "08:00", end: "08:50" },
    { start: "08:55", end: "09:45" },
  ];
  s.tasks[0].remaining = 100;
  const p = plan(s, ["2026-10-12"]);
  const blocks = p.days[0].blocks;
  for (let i = 1; i < blocks.length; i++)
    assert.ok(blocks[i].start - blocks[i - 1].end >= 10);
});
test("P44 匯入規劃狀態時拒絕錯誤行程分類與覆寫欄位", () => {
  for (const invalidEvent of [
    { ...event(), category: "unknown" },
    { ...repeat(), overrides: { "2026-10-05": { category: "unknown" } } },
    { ...repeat(), overrides: { "2026-10-05": { notes: 42 } } },
    { ...event(), status: "maybe" },
  ]) {
    const s = base();
    s.events = [invalidEvent];
    assert.throws(() => validate(s));
  }
});
test("P45 已取消的固定事件不占容量、不計時數或製造衝突", () => {
  const s = base();
  s.events = [{ ...event(), status: "cancelled" }];
  assert.deepEqual(capacity("2026-10-12", s).free, [[480, 720]]);
  assert.equal(workloadByDay(s.events, ["2026-10-12"])[0].total, 0);
  assert.deepEqual(conflicts([{ ...event(), status: "cancelled" }, event()]), []);
});
test("P46 衝突計算對損壞行程回傳明確驗證錯誤", () => {
  assert.throws(() => conflicts([null]), /有效清單/);
});
