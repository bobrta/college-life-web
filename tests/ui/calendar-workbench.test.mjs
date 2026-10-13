import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { mountCalendarWorkbench } from "../../calendar-workbench.mjs";
import { defaultCalendarPlan } from "../../calendar-planning.mjs";
const { parseHTML } = await import(process.env.DOM_QA_MODULE || "linkedom");
const cases = [];
const check = (name, run) => cases.push({ name, run });
const html = fs.readFileSync(
  new URL("../../index.html", import.meta.url),
  "utf8",
);
function setup(initial = {}, mobile = false) {
  const { document, window } = parseHTML(html);
  globalThis.document = document;
  globalThis.window = window;
  window.matchMedia = () => ({ matches: mobile });
  globalThis.confirm = () => true;
  globalThis.setInterval = () => 0;
  Object.defineProperty(window.HTMLSelectElement.prototype, "value", {
    configurable: true,
    get() {
      return (
        this.querySelector("option[selected]")?.value ||
        this.querySelector("option")?.value ||
        ""
      );
    },
    set(v) {
      for (const o of this.querySelectorAll("option"))
        o.toggleAttribute("selected", o.value === String(v));
    },
  });
  Object.defineProperty(window.HTMLInputElement.prototype, "checked", {
    configurable: true,
    get() {
      return this.hasAttribute("checked");
    },
    set(v) {
      this.toggleAttribute("checked", v);
    },
  });
  window.HTMLElement.prototype.showModal = function () {
    this.open = true;
  };
  window.HTMLElement.prototype.close = function () {
    this.open = false;
  };
  window.HTMLElement.prototype.focus = function () {};
  for (const f of document.querySelectorAll("form")) f.reset = () => {};
  let state = {
      events: [],
      calendarPlan: defaultCalendarPlan(),
      ...structuredClone(initial),
    },
    date = "2026-10-12",
    failed = false,
    downloads = [],
    printed = [];
  const ui = mountCalendarWorkbench({
    getState: () => state,
    getDate: () => date,
    getSchedule: () => ({ weeks: [] }),
    setDate: (d) => {
      date = d;
      ui.render();
    },
    commit: (changes) => {
      if (failed) throw Error("保存失敗");
      Object.assign(state, changes);
      ui.render();
    },
    download: (...args) => downloads.push(args),
    print: (...args) => printed.push(args),
  });
  const $ = (id) => document.getElementById(id),
    submit = () => $("event-form").onsubmit({ preventDefault() {} });
  const edit = (eventDate = "2026-10-12") => {
    ui.openEditor(null, eventDate);
    $("event-title").value = "微積分";
    $("event-start").value = "18:55";
    $("event-end").value = "19:55";
    $("event-subject").value = "微積分";
  };
  return {
    document,
    window,
    ui,
    $,
    submit,
    edit,
    get state() {
      return state;
    },
    get date() {
      return date;
    },
    get downloads() {
      return downloads;
    },
    get printed() {
      return printed;
    },
    fail() {
      failed = true;
    },
  };
}
const single = (changes) => ({
  id: "e",
  date: "2026-10-12",
  title: "微積分",
  start: "18:55",
  end: "19:55",
  category: "study",
  status: "confirmed",
  ...changes,
});
const series = (changes) => ({
  id: "s",
  weekday: 1,
  from: "2026-10-12",
  until: "2026-11-02",
  title: "微積分",
  start: "18:55",
  end: "19:55",
  category: "study",
  status: "confirmed",
  ...changes,
});
const clickText = (x, text) => {
  const b = [...x.document.querySelectorAll("button")].find(
    (b) => b.textContent === text,
  );
  assert.ok(b, "button " + text);
  b.onclick();
};
check("桌面預設全景週表", () => {
  const x = setup();
  assert.equal(x.ui.view, "week");
  assert.equal(x.$("week-grid").querySelectorAll("thead th").length, 8);
});
check("手機預設單日避免七欄縮字", () => {
  const x = setup({}, true);
  assert.equal(x.ui.view, "day");
  assert.equal(x.$("week-grid").querySelectorAll("thead th").length, 2);
});
check("工具收起時保留JSON與ICS匯出操作", () => {
  const x = setup();
  assert.equal(x.$("calendar-more").open, undefined);
  assert.ok(x.$("calendar-more").contains(x.$("export-calendar")));
  assert.ok(x.$("calendar-more").contains(x.$("schedule-json-input")));
});
check("日曆編輯表單移入同頁對話框", () => {
  const x = setup();
  assert.ok(x.$("calendar-editor").contains(x.$("event-form")));
  assert.equal(x.$("calendar-editor").open, undefined);
});
check("週月季年切換控制完整", () => {
  const x = setup();
  assert.equal(x.document.querySelectorAll("[data-view]").length, 5);
  for (const view of ["month", "quarter", "year", "week"]) {
    x.document.querySelector(`[data-view="${view}"]`).onclick();
    assert.equal(x.ui.view, view);
  }
});
check("切月份後上一期按月移動", () => {
  const x = setup();
  x.document.querySelector('[data-view="month"]').onclick();
  x.$("prev-week").onclick();
  assert.equal(x.date, "2026-09-01");
});
check("精細時間軸仍保留全天提醒", () => {
  const x = setup();
  x.$("calendar-layout").value = "timeline";
  x.$("calendar-layout").onchange();
  assert.match(x.$("week-grid").textContent, /全天／截止/);
  assert.match(x.$("week-grid").textContent, /23:00/);
});
check("跨時段事件显示續接至結束時間", () => {
  const x = setup({ events: [single({ start: "11:00", end: "14:00" })] });
  assert.match(x.$("week-grid").textContent, /↳ 微積分 至 14:00/);
});
check("取消事件從行程格和統計排除", () => {
  const x = setup({ events: [single({ status: "cancelled" })] });
  assert.equal(x.$("week-grid").querySelectorAll(".cal-event").length, 0);
});
check("成果、老師與教室直接顯示", () => {
  const x = setup({
    events: [single({ outcome: "完成三題", teacher: "王老師", room: "321" })],
  });
  assert.match(x.$("week-grid").textContent, /完成三題/);
  assert.match(x.$("week-grid").textContent, /王老師/);
});
check("新增行程存入有效confirmed狀態", () => {
  const x = setup();
  x.edit();
  x.submit();
  assert.equal(x.state.events.length, 1);
  assert.equal(x.state.events[0].status, "confirmed");
});
check("新增只有開始沒有結束被阻止", () => {
  const x = setup();
  x.edit();
  x.$("event-end").value = "";
  x.submit();
  assert.equal(x.state.events.length, 0);
  assert.match(x.$("event-form-status").textContent, /同時提供/);
});
check("新增空白名稱被阻止", () => {
  const x = setup();
  x.edit();
  x.$("event-title").value = " ";
  x.submit();
  assert.equal(x.state.events.length, 0);
});
check("全天截止行程可保存", () => {
  const x = setup();
  x.edit();
  x.$("event-start").value = "";
  x.$("event-end").value = "";
  x.$("event-category").value = "deadline";
  x.submit();
  assert.equal(x.state.events.length, 1);
  assert.equal(x.state.events[0].start, "");
});
check("編輯保留科目成果方法備註", () => {
  const e = single({
      subject: "數學",
      outcome: "三題",
      method: "重算",
      notes: "不要漏",
    }),
    x = setup({ events: [e] });
  x.ui.openEditor(e, e.date);
  x.$("event-title").value = "更新";
  x.submit();
  assert.equal(x.state.events[0].notes, "不要漏");
  assert.equal(x.state.events[0].method, "重算");
});
check("拒絕保存時保留原行程", () => {
  const x = setup();
  x.edit();
  x.fail();
  x.submit();
  assert.equal(x.state.events.length, 0);
  assert.match(x.$("event-form-status").textContent, /保存失敗/);
});
check("實際學習分鐘保存後與排定分開", () => {
  const x = setup();
  x.edit();
  x.$("event-actual").value = "35";
  x.submit();
  assert.equal(x.state.events[0].actualMinutes, 35);
  assert.match(x.$("week-grid").textContent, /實際學習/);
});
check("新增週期零實際分鐘避免重複記錄", () => {
  const x = setup();
  x.edit();
  x.$("event-repeat").checked = true;
  x.$("event-until").value = "2026-11-02";
  x.$("event-actual").value = "35";
  x.submit();
  assert.equal(x.state.events[0].actualMinutes, 0);
  assert.equal(x.state.events[0].weekday, 1);
});
check("週期預設只編輯當日", () => {
  const s = series(),
    x = setup({ events: [s] });
  x.ui.openEditor(
    { ...s, id: "s@2026-10-19", _seriesId: "s", _occurrenceDate: "2026-10-19" },
    "2026-10-19",
  );
  assert.equal(x.$("event-scope").value, "single");
  assert.equal(x.$("event-repeat").disabled, true);
});
check("改整個週期恢復原起日不截掉歷史", () => {
  const s = series(),
    x = setup({ events: [s] });
  x.ui.openEditor(
    { ...s, id: "s@2026-10-19", _seriesId: "s", _occurrenceDate: "2026-10-19" },
    "2026-10-19",
  );
  x.$("event-scope").value = "series";
  x.$("event-scope").onchange();
  x.$("event-title").value = "更新";
  x.submit();
  assert.equal(x.state.events[0].from, "2026-10-12");
});
check("整週編輯保留排除日期", () => {
  const s = series({ excludedDates: ["2026-10-26"] }),
    x = setup({ events: [s] });
  x.ui.openEditor(
    { ...s, id: "s@2026-10-19", _seriesId: "s", _occurrenceDate: "2026-10-19" },
    "2026-10-19",
  );
  x.$("event-scope").value = "series";
  x.$("event-scope").onchange();
  x.submit();
  assert.deepEqual(x.state.events[0].excludedDates, ["2026-10-26"]);
});
check("只改一天產生獨立事件不改系列", () => {
  const s = series(),
    x = setup({ events: [s] });
  x.ui.openEditor(
    { ...s, id: "s@2026-10-19", _seriesId: "s", _occurrenceDate: "2026-10-19" },
    "2026-10-19",
  );
  x.$("event-title").value = "一天";
  x.submit();
  assert.equal(x.state.events.length, 2);
  assert.deepEqual(x.state.events.find((e) => e.id === "s").excludedDates, [
    "2026-10-19",
  ]);
});
check("刪除當天只新增週期例外", () => {
  const s = series(),
    x = setup({ events: [s] });
  x.ui.openEditor(
    { ...s, id: "s@2026-10-19", _seriesId: "s", _occurrenceDate: "2026-10-19" },
    "2026-10-19",
  );
  clickText(x, "刪除這一天");
  assert.deepEqual(x.state.events[0].excludedDates, ["2026-10-19"]);
});
check("整個週期刪除需明確操作", () => {
  const s = series(),
    x = setup({ events: [s] });
  x.ui.openEditor(
    { ...s, id: "s@2026-10-19", _seriesId: "s", _occurrenceDate: "2026-10-19" },
    "2026-10-19",
  );
  clickText(x, "刪除整個週期");
  assert.equal(x.state.events.length, 0);
});
check("四種圖表空資料仍可切換", () => {
  const x = setup();
  for (const kind of ["bars", "donut", "trend", "heatmap"]) {
    x.$("calendar-chart-kind").value = kind;
    x.$("calendar-chart-kind").onchange();
    assert.ok(x.$("calendar-load-chart").childNodes.length);
  }
});
check("每週目標與容量可保存", () => {
  const x = setup();
  clickText(x, "編輯本週");
  x.$("cal-week-target").value = "3";
  x.$("cal-week-capacity").value = "6";
  x.$("cal-week-title").value = "考前";
  x.$("cal-week-focus").value = "題庫\n訂正";
  x.$("cal-week-mode").value = "exam";
  const f = x.$("cal-week-title").closest("form");
  f.onsubmit({ preventDefault() {} });
  assert.equal(x.state.calendarPlan.weekly["2026-10-12"].targetHours, 3);
});
check("模板先預覽不立即修改行程", () => {
  const x = setup();
  clickText(x, "套用學習模板");
  x.$("cal-template-from").value = "2026-11-09";
  x.$("cal-template-until").value = "2026-11-15";
  x.$("cal-template-from")
    .closest("form")
    .onsubmit({ preventDefault() {} });
  assert.equal(x.state.events.length, 0);
  clickText(x, "確認加入預覽行程");
  assert.equal(x.state.events.length, 11);
});
check("模板預覽後改參數必須重新預覽", () => {
  const x = setup();
  clickText(x, "套用學習模板");
  const f = x.$("cal-template-from").closest("form");
  f.onsubmit({ preventDefault() {} });
  f.oninput();
  const b = [...x.document.querySelectorAll("button")].find(
    (b) => b.textContent === "確認加入預覽行程",
  );
  assert.equal(b.disabled, true);
});
check("JSON匯出包含日曆設定與行程", () => {
  const x = setup({ events: [single()] });
  clickText(x, "匯出日曆 JSON");
  const data = JSON.parse(x.downloads[0][1]);
  assert.equal(data.events.length, 1);
  assert.equal(data.calendarPlan.version, 1);
});
check("全景PDF保留目標時數與科目詳細", () => {
  const x = setup({
    events: [single({ teacher: "王老師", room: "321", outcome: "三題" })],
  });
  const container = x.document.createElement("div");
  x.ui.renderPrintable(container, ["2026-10-12", "2026-10-13"]);
  assert.match(container.textContent, /週目標/);
  assert.match(container.textContent, /王老師/);
  assert.match(container.textContent, /三題/);
  assert.equal(container.querySelectorAll("button").length, 0);
});
assert.equal(cases.length, 30, "UI audit must contain 30 distinct checks");
for (const [i, { name, run }] of cases.entries())
  test(`CAL-${String(i + 71).padStart(3, "0")} ${name}`, run);
export const auditCases = cases.map((x, i) => ({
  number: i + 71,
  name: x.name,
}));
