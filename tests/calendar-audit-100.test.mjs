import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseSchedule,
  eventsOn,
  toICS,
  excludeOccurrence,
  detachOccurrence,
} from "../calendar.mjs";
import { eventDetails, minutes, calendarDate } from "../calendar-schema.mjs";
import {
  defaultCalendarPlan,
  validateCalendarPlan,
  periodDates,
  shiftDate,
  shiftPeriod,
  duration,
  occupiedMinutes,
  daySummary,
  summarize,
  proposalImpact,
  mergeSchedule,
  updateSeries,
  generateStudyTemplate,
} from "../calendar-planning.mjs";
const e = (changes = {}) => ({
  id: "e",
  date: "2026-10-12",
  title: "微積分",
  start: "18:55",
  end: "19:55",
  category: "study",
  status: "confirmed",
  subject: "微積分",
  ...changes,
});
const series = (changes = {}) => ({
  id: "series",
  weekday: 1,
  from: "2026-10-12",
  until: "2026-11-02",
  title: "微積分",
  start: "18:55",
  end: "19:55",
  category: "study",
  status: "confirmed",
  subject: "微積分",
  ...changes,
});
const parse = (event) =>
  parseSchedule(JSON.stringify({ events: [event] })).events[0];
const plan = () => defaultCalendarPlan();
const dates = () => periodDates("2026-10-12", "week");
const cases = [];
const check = (name, run) => cases.push({ name, run });
// 1–18: data contract and hostile input.
check("科目、成果、老師、教室與方法匯入後保留", () => {
  const x = parse(
    e({ teacher: "老師", room: "321", outcome: "三題", method: "白紙重算" }),
  );
  assert.equal(x.method, "白紙重算");
  assert.equal(x.teacher, "老師");
});
check("實際分鐘0合法", () =>
  assert.equal(parse(e({ actualMinutes: 0 })).actualMinutes, 0),
);
check("實際分鐘1440上限合法", () =>
  assert.equal(parse(e({ actualMinutes: 1440 })).actualMinutes, 1440),
);
check("負實際分鐘拒絕", () =>
  assert.throws(() => parse(e({ actualMinutes: -1 }))),
);
check("小數實際分鐘拒絕", () =>
  assert.throws(() => parse(e({ actualMinutes: 1.5 }))),
);
check("超過一天實際分鐘拒絕", () =>
  assert.throws(() => parse(e({ actualMinutes: 1441 }))),
);
check("週期實際分鐘不得複製到每一天", () =>
  assert.throws(() => parse(series({ actualMinutes: 30 }))),
);
check("週期零實際分鐘合法", () =>
  assert.equal(parse(series({ actualMinutes: 0 })).actualMinutes, 0),
);
check("固定與彈性標記受限", () =>
  assert.throws(() => parse(e({ commitment: "mandatory" }))),
);
check("方法長度限制", () =>
  assert.throws(() => parse(e({ method: "x".repeat(1001) }))),
);
check("科目型別限制", () =>
  assert.throws(() => parse(e({ subject: { name: "數學" } }))),
);
check("未知日曆規劃版本拒絕", () =>
  assert.throws(() => validateCalendarPlan({ ...plan(), version: 2 })),
);
check("重複時段名稱拒絕", () => {
  const p = plan();
  p.slots[1].label = p.slots[0].label;
  assert.throws(() => validateCalendarPlan(p));
});
check("時段中間有缺口拒絕", () => {
  const p = plan();
  p.slots[1].start = "08:35";
  assert.throws(() => validateCalendarPlan(p));
});
check("時段未涵蓋全天拒絕", () => {
  const p = plan();
  p.slots.at(-1).end = "23:59";
  assert.throws(() => validateCalendarPlan(p));
});
check("週計畫不得使用週二日期", () => {
  const p = plan();
  p.weekly["2026-10-13"] = {};
  assert.throws(() => validateCalendarPlan(p));
});
check("週重點超過三項拒絕", () => {
  const p = plan();
  p.weekly["2026-10-12"] = {
    title: "本週",
    focus: ["1", "2", "3", "4"],
    mode: "normal",
    targetHours: 3,
    capacityHours: 4,
  };
  assert.throws(() => validateCalendarPlan(p));
});
check("特殊科目名稱不覆寫原型", () => {
  const p = plan();
  p.subjects = JSON.parse('{"__proto__":"安全方法","constructor":"另一方法"}');
  const x = validateCalendarPlan(p);
  assert.equal(Object.getPrototypeOf(x.subjects), null);
  assert.equal(x.subjects.__proto__, "安全方法");
});
// 19–30: date and period boundaries.
check("台灣日期週一開始", () =>
  assert.deepEqual(periodDates("2026-10-13", "week").slice(0, 2), [
    "2026-10-12",
    "2026-10-13",
  ]),
);
check("跨年週不截斷", () =>
  assert.equal(periodDates("2027-01-01", "week")[0], "2026-12-28"),
);
check("閏年二月29天", () =>
  assert.equal(periodDates("2028-02-10", "month").length, 29),
);
check("平年二月28天", () =>
  assert.equal(periodDates("2027-02-10", "month").length, 28),
);
check("第一季範圍正確", () =>
  assert.deepEqual(
    [
      periodDates("2026-02-10", "quarter")[0],
      periodDates("2026-02-10", "quarter").at(-1),
    ],
    ["2026-01-01", "2026-03-31"],
  ),
);
check("第四季跨月92天", () =>
  assert.equal(periodDates("2026-10-13", "quarter").length, 92),
);
check("閏年年視圖366天", () =>
  assert.equal(periodDates("2028-10-13", "year").length, 366),
);
check("月末切下一月不跳月", () =>
  assert.equal(shiftPeriod("2026-01-31", "month", 1), "2026-02-01"),
);
check("季切換可跨年", () =>
  assert.equal(shiftPeriod("2026-10-13", "quarter", 1), "2027-01-01"),
);
check("低年份不被Date.UTC轉成1900年代", () =>
  assert.equal(periodDates("0099-02-01", "month")[0], "0099-02-01"),
);
check("不合法日期拒絕", () =>
  assert.throws(() => periodDates("2026-02-30", "week")),
);
check("日期位移不得超過9999年", () =>
  assert.throws(() => shiftPeriod("9999-10-13", "year", 1)),
);
// 31–44: real workload arithmetic.
check("全天提醒不占用整天時數", () =>
  assert.equal(duration(e({ start: "", end: "" })), 0),
);
check("部分時間缺漏拒絕", () => assert.throws(() => duration(e({ end: "" }))));
check("反向時間拒絕", () => assert.throws(() => duration(e({ end: "18:30" }))));
check("分鐘計算保留18:55", () => assert.equal(minutes("18:55"), 1135));
check("取消事件不計入學習", () =>
  assert.equal(
    daySummary([e({ status: "cancelled" })], "2026-10-12").scheduled,
    0,
  ),
);
check("取消事件不計入衝突", () =>
  assert.equal(
    daySummary([e({ status: "cancelled" }), e({ id: "e2" })], "2026-10-12")
      .conflicts.length,
    0,
  ),
);
check("兩個重疊行程占用時間取聯集", () =>
  assert.equal(
    occupiedMinutes([e(), e({ id: "b", start: "19:25", end: "20:25" })]),
    90,
  ),
);
check("緊接時段不算重疊", () =>
  assert.equal(
    daySummary(
      [e(), e({ id: "b", start: "19:55", end: "20:55" })],
      "2026-10-12",
    ).conflicts.length,
    0,
  ),
);
check("休息不計入學習", () =>
  assert.equal(
    summarize(
      [e(), e({ id: "r", category: "rest", start: "20:00", end: "20:10" })],
      dates(),
      plan(),
    ).scheduled,
    60,
  ),
);
check("排定不冒充實際完成", () =>
  assert.equal(daySummary([e()], "2026-10-12").actual, 0),
);
check("同科分段只算一項主要事項", () =>
  assert.equal(
    daySummary(
      [
        e(),
        e({
          id: "b",
          title: "訂正",
          subject: "微積分",
          start: "20:00",
          end: "21:00",
        }),
      ],
      "2026-10-12",
    ).majorCount,
    1,
  ),
);
check("零計畫完成率回傳null", () =>
  assert.equal(summarize([], dates(), plan()).completionRate, null),
);
check("實際超過計畫如實顯示不裁掉", () =>
  assert.equal(
    summarize([e({ actualMinutes: 90 })], dates(), plan()).completionRate,
    1.5,
  ),
);
check("新行程占用休息可預覽", () =>
  assert.equal(
    proposalImpact([e({ id: "r", category: "rest" })], e({ id: "new" }), plan())
      .restConflicts.length,
    1,
  ),
);
// 45–54: recurrence edits and preservation.
check("編輯系列保留原備註", () =>
  assert.equal(
    updateSeries(
      [series({ notes: "重要備註" })],
      series({ title: "新名稱" }),
    )[0].notes,
    "重要備註",
  ),
);
check("編輯系列保留排除日期", () =>
  assert.deepEqual(
    updateSeries(
      [series({ excludedDates: ["2026-10-19"] })],
      series({ title: "新名稱" }),
    )[0].excludedDates,
    ["2026-10-19"],
  ),
);
check("編輯系列保留單次覆寫", () =>
  assert.equal(
    updateSeries(
      [series({ overrides: { "2026-10-19": { title: "特殊" } } })],
      series({ title: "新名稱" }),
    )[0].overrides["2026-10-19"].title,
    "特殊",
  ),
);
check("縮短系列移除範圍外例外", () =>
  assert.deepEqual(
    updateSeries(
      [series({ excludedDates: ["2026-11-02"] })],
      series({ until: "2026-10-26" }),
    )[0].excludedDates,
    [],
  ),
);
check("系列轉單次移除週期欄位", () =>
  assert.equal(
    updateSeries([series()], e({ id: "series" }))[0].weekday,
    undefined,
  ),
);
check("只改一天不破壞前後事件", () => {
  const x = detachOccurrence(
    [series()],
    "series",
    "2026-10-19",
    e({ id: "detached", date: "2026-10-20", actualMinutes: 30 }),
  );
  assert.equal(eventsOn(x, "2026-10-12").length, 1);
  assert.equal(eventsOn(x, "2026-10-19").length, 0);
  assert.equal(eventsOn(x, "2026-10-20")[0].actualMinutes, 30);
});
check("單次例外實際分鐘保留", () =>
  assert.equal(
    eventsOn(
      [parse(series({ overrides: { "2026-10-19": { actualMinutes: 40 } } }))],
      "2026-10-19",
    )[0].actualMinutes,
    40,
  ),
);
check("單次例外不接受負實際分鐘", () =>
  assert.throws(() =>
    parse(series({ overrides: { "2026-10-19": { actualMinutes: -1 } } })),
  ),
);
check("不匹配星期的系列提案找到首次發生日期", () =>
  assert.equal(
    proposalImpact([], series({ from: "2026-10-13" }), plan()).date,
    "2026-10-19",
  ),
);
check("無符合星期的系列提案拒絕", () =>
  assert.throws(() =>
    proposalImpact(
      [],
      series({ from: "2026-10-13", until: "2026-10-14" }),
      plan(),
    ),
  ),
);
// 55–62: merge, backup and export contract.
check("重複匯入相同ID不增加筆數", () =>
  assert.equal(mergeSchedule([e()], { events: [e()] }).events.length, 1),
);
check("更新相同ID保留其他事件", () => {
  const x = mergeSchedule([e(), e({ id: "b" })], {
    events: [e({ title: "更新" })],
  }).events;
  assert.equal(x.length, 2);
  assert.equal(x.find((e) => e.id === "e").title, "更新");
});
check("匯入合併超過1000筆拒絕", () =>
  assert.throws(() =>
    mergeSchedule(
      Array.from({ length: 1000 }, (_, i) => e({ id: "e" + i })),
      { events: [e({ id: "new" })] },
    ),
  ),
);
check("ICS輸出包含成果與教室", () => {
  const text = toICS([e({ outcome: "三題", room: "321" })]);
  assert.match(text, /成果/);
  assert.match(text, /321/);
});
check("ICS取消單次覆寫帶CANCELLED狀態", () =>
  assert.match(
    toICS([series({ overrides: { "2026-10-19": { status: "cancelled" } } })]),
    /STATUS:CANCELLED/,
  ),
);
check("ICS待確認不冒充已確認", () =>
  assert.match(toICS([e({ status: "draft" })]), /STATUS:TENTATIVE/),
);
check("ICS描述換行不能注入事件", () => {
  const text = toICS([e({ notes: "x\rBEGIN:VEVENT" })]);
  assert.equal(text.split("\r\nBEGIN:VEVENT").length, 2);
});
check("規劃設定驗證不修改輸入物件", () => {
  const x = plan(),
    before = JSON.stringify(x);
  validateCalendarPlan(x);
  assert.equal(JSON.stringify(x), before);
});
// 63–70: staged templates and weekly limits.
const template = (changes) =>
  generateStudyTemplate({
    from: "2026-11-09",
    until: "2026-11-15",
    subject: "微積分",
    ...changes,
  });
check("正常模板淨學習320分鐘", () =>
  assert.equal(
    summarize(template(), periodDates("2026-11-09", "week"), plan()).scheduled,
    320,
  ),
);
check("正常模板休息40分鐘", () =>
  assert.equal(
    summarize(template(), periodDates("2026-11-09", "week"), plan()).totals
      .rest,
    40,
  ),
);
check("考前模板淨學習180分鐘", () =>
  assert.equal(
    summarize(
      template({ mode: "exam" }),
      periodDates("2026-11-09", "week"),
      plan(),
    ).scheduled,
    180,
  ),
);
check("模板不產生日期範圍外事件", () =>
  assert.ok(
    template({ until: "2026-11-13" }).every((e) => e.date <= "2026-11-13"),
  ),
);
check("模板名稱長度邊界可用", () =>
  assert.ok(template({ subject: "數".repeat(80) }).length),
);
check("模板範圍超過一年拒絕", () =>
  assert.throws(() => template({ until: "2028-11-15" })),
);
check("每日主要事項上限不得超過四項", () =>
  assert.throws(() => validateCalendarPlan({ ...plan(), dailyMajorLimit: 5 })),
);
check("容量不足的提案顯示負餘額", () => {
  const p = plan();
  p.defaultCapacityHours = 0.5;
  assert.equal(proposalImpact([], e(), p).remainingStudyMinutes, -30);
});
assert.equal(cases.length, 70, "Core audit must contain 70 distinct checks");
for (const [i, { name, run }] of cases.entries())
  test(`CAL-${String(i + 1).padStart(3, "0")} ${name}`, run);
export const auditCases = cases.map((x, i) => ({
  number: i + 1,
  name: x.name,
}));
