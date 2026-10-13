import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const { parseHTML } = await import(process.env.DOM_QA_MODULE || "linkedom");
const root = process.env.PLANNER_TEST_ROOT
  ? resolve(process.env.PLANNER_TEST_ROOT)
  : resolve(import.meta.dirname, "../..");
const key = "college-capacity-planner-v1";
async function loadUI(caseId) {
  const { document, window } = parseHTML(
    fs.readFileSync(resolve(root, "planner.html"), "utf8"),
  );
  globalThis.document = document;
  globalThis.window = window;
  const data = new Map();
  globalThis.localStorage = {
    getItem: (k) => data.get(k) || null,
    setItem: (k, v) => data.set(k, v),
  };
  globalThis.confirm = () => true;
  globalThis.prompt = () => null;
  globalThis.setInterval = () => 0;
  globalThis.location = { reload() {} };
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
  window.HTMLSelectElement.prototype.add = function (o) {
    this.append(o);
  };
  globalThis.Option = function (text, value) {
    const x = document.createElement("option");
    x.textContent = text;
    x.value = value;
    return x;
  };
  Object.defineProperty(window.HTMLInputElement.prototype, "checked", {
    configurable: true,
    get() {
      return this.hasAttribute("checked");
    },
    set(v) {
      this.toggleAttribute("checked", v);
    },
  });
  for (const f of document.querySelectorAll("form")) {
    Object.defineProperty(f, "elements", {
      get() {
        return Object.fromEntries(
          [...f.querySelectorAll("[name]")].map((e) => [e.name, e]),
        );
      },
    });
    f.reset = () => {};
    f.scrollIntoView = () => {};
  }
  globalThis.FormData = class {
    constructor(f) {
      this.f = f;
    }
    get(n) {
      return this.f.elements[n]?.value ?? null;
    }
    has(n) {
      const x = this.f.elements[n];
      return !!x && (x.type !== "checkbox" || x.checked);
    }
  };
  if (process.env.PLANNER_UI_STANDALONE) {
    const html = fs.readFileSync(resolve(root, "時間規劃_單檔版.html"), "utf8");
    const script = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
    await import(
      "data:text/javascript;base64," +
        Buffer.from(script + "\n//case=" + caseId).toString("base64")
    );
  } else {
    await import(
      pathToFileURL(resolve(root, "planner-ui.mjs")) + "?qa=" + caseId
    );
  }
  const $ = (id) => document.getElementById(id),
    submit = (id) => $(id).onsubmit({ preventDefault() {}, target: $(id) }),
    read = () => JSON.parse(data.get(key) || "null");
  function add(title = "工作") {
    const f = $("task-form").elements;
    Object.assign(f.title, { value: title });
    f.hours.value = "1";
    f.priority.value = "2";
    f.deadline.value = "";
    f.outcome.value = "完成";
    f.depends.value = "";
    f.goal.value = "";
    f.active.checked = true;
    submit("task-form");
    return read().tasks.at(-1).id;
  }
  return { $, submit, read, add, readStorage: (k) => JSON.parse(data.get(k) || "null"), writeStorage: (k, v) => data.set(k, JSON.stringify(v)) };
}
test("P44 匯入備份不可靜默丟失進行中計時", async () => {
  const ui = await loadUI(44),
    id = ui.add();
  ui.$("focus-task").value = id;
  ui.$("start").onclick();
  const snapshot = ui.read();
  ui.$("restore").value = "file";
  await ui.$("restore").onchange({
    target: {
      files: [{ size: 100, text: async () => JSON.stringify(snapshot) }],
      value: "file",
    },
  });
  assert.equal(ui.read().timer?.mode, "focus");
});
test("P45 零剩餘工時可進入編輯表單", async () => {
  const ui = await loadUI(45),
    input = ui.$("task-form").elements.hours;
  assert.ok(Number(input.getAttribute("min") || 0) <= 0);
});
test("P46 計時後的小數工時可再次編輯", async () => {
  const ui = await loadUI(46),
    input = ui.$("task-form").elements.hours;
  assert.equal(input.getAttribute("step"), "any");
});
test("P47 開始計時後按鈕仍可更新目前任務", async () => {
  const ui = await loadUI(47),
    id = ui.add();
  ui.$("focus-task").value = id;
  ui.$("start").onclick();
  const button = [...ui.$("task-list").querySelectorAll("button")].find(
    (b) => b.textContent === "暫停推進",
  );
  button.onclick();
  assert.equal(ui.read().tasks[0].active, false);
});
test("P48 刪除編輯中的任務後可以重新新增", async () => {
  const ui = await loadUI(48);
  ui.add("舊工作");
  ui.$("task-list").querySelector("button").onclick();
  const button = [...ui.$("task-list").querySelectorAll("button")].find(
    (b) => b.textContent === "刪除",
  );
  button.onclick();
  ui.add("新工作");
  assert.equal(ui.read().tasks.length, 1);
  assert.equal(ui.read().tasks[0].title, "新工作");
});
test("P49 重算排程不可清掉正在編輯的前置選擇", async () => {
  const ui = await loadUI(49),
    parent = ui.add("前置");
  ui.add("後續");
  ui.$("task-list").lastElementChild.querySelector("button").onclick();
  ui.$("depends").value = parent;
  ui.$("replan").onclick();
  assert.equal(ui.$("depends").value, parent);
});
test("P50 操作成功後不可繼續顯示舊錯誤", async () => {
  const ui = await loadUI(50);
  ui.$("start").onclick();
  assert.ok(ui.$("status").textContent);
  ui.add();
  assert.equal(ui.$("status").textContent, "");
});

test("同頁導航保留其他區域與輸入草稿", async () => {
  const ui = await loadUI("hub1");
  ui.$("money-form").elements.note.value = "未保存";
  document.querySelector('[data-tab="tasks"]').onclick();
  for (const id of [
    "overview",
    "tasks",
    "settings",
    "tools",
    "goals",
    "finance-hub",
    "decision-hub",
    "health-hub",
  ])
    assert.equal(ui.$(id).hidden, false);
  assert.equal(ui.$("money-form").elements.note.value, "未保存");
});
function command(ui, text) {
  ui.$("hub-command").value = text;
  ui.$("command-preview").onclick();
  ui.$("command-apply").onclick();
}
test("行程加費用指令原子保存兩筆關聯資料", async () => {
  const ui = await loadUI("hub2");
  command(ui, "/cal 2026-10-15 14:00-15:00 [報告] $150");
  const s = ui.read();
  assert.equal(s.events.length, 1);
  assert.equal(s.hub.transactions.length, 1);
  assert.equal(s.hub.transactions[0].eventId, s.events[0].id);
  assert.equal(s.hub.transactions[0].status, "planned");
});
test("不合法行程不留下費用或事件", async () => {
  const ui = await loadUI("hub3");
  command(ui, "/cal 2026-10-15 23:00-22:00 [錯誤] $150");
  assert.ok(ui.$("hub-status").textContent);
  assert.equal(ui.read(), null);
});
test("指令修改後必須重新預覽", async () => {
  const ui = await loadUI("hub4");
  ui.$("hub-command").value = "/fin -150 #餐費";
  ui.$("command-preview").onclick();
  ui.$("hub-command").value = "/fin -200 #餐費";
  ui.$("hub-command").oninput();
  ui.$("command-apply").onclick();
  assert.equal(ui.read(), null);
  assert.ok(ui.$("hub-status").textContent);
});
test("第四件進行中事项保存失敗保留前三件", async () => {
  const ui = await loadUI("hub5");
  for (let i = 0; i < 4; i++) command(ui, `/task [事項${i}] 1h -> doing`);
  assert.equal(ui.read().hub.decisions.length, 3);
  assert.equal(ui.read().tasks.length, 3);
  assert.match(ui.$("hub-status").textContent, /上限/);
});
test("想做事項可原地開始並確認完成", async () => {
  const ui = await loadUI("hub6");
  command(ui, "/task [報告] 2h -> want");
  assert.equal(ui.read().tasks[0].active, false);
  const find = (label) =>
    [...ui.$("decision-list").querySelectorAll("button")].find(
      (b) => b.textContent === label,
    );
  find("開始推進").onclick();
  assert.equal(ui.read().tasks[0].active, true);
  find("確認完成").onclick();
  assert.equal(ui.read().tasks[0].done, true);
  assert.equal(ui.read().hub.decisions[0].pool, "done");
});
test("預定轉實際保留一筆記帳", async () => {
  const ui = await loadUI("hub7");
  command(ui, "/fin -150 #餐費 !預定");
  const b = [...ui.$("money-list").querySelectorAll("button")].find(
    (b) => b.textContent === "今天已收／付",
  );
  b.onclick();
  assert.equal(ui.read().hub.transactions.length, 1);
  assert.equal(ui.read().hub.transactions[0].status, "actual");
});
test("四區圖表可切換而不清除未保存表單", async () => {
  const ui = await loadUI("hub8");
  command(ui, "/task [報告] 2h -> want");
  command(ui, "/fin -150 #餐費");
  command(ui, "/fit 20m #walk [散步]");
  ui.$("money-form").elements.note.value = "草稿";
  for (const id of [
    "time-chart-kind",
    "money-chart-kind",
    "decision-chart-kind",
    "health-chart-kind",
  ])
    for (const value of ["bars", "donut", "line", "table"]) {
      ui.$(id).value = value;
      ui.$(id).onchange();
    }
  assert.equal(ui.$("money-form").elements.note.value, "草稿");
  assert.equal(ui.$("hub-status").textContent, "");
});
test("年範圍可操作且表單預算依範圍保存", async () => {
  const ui = await loadUI("hub9");
  ui.$("period").value = "year";
  ui.$("period").onchange();
  assert.match(ui.$("range").textContent, /01-01.*12-31/);
  const f = ui.$("money-settings").elements;
  f.opening.value = "1000";
  f.reserve.value = "100";
  f.budget.value = "200";
  ui.submit("money-settings");
  assert.ok(
    Object.keys(ui.read().hub.budgets).some(
      (k) => k.includes("01-01") && k.includes("12-31"),
    ),
  );
});
test("日視圖與日期前後按鈕可切換且顯示固定行程", async () => {
  const ui = await loadUI("day-navigation");
  command(ui, "/cal 2026-10-15 14:00-15:00 [固定行程]");
  ui.$("period").value = "day";
  ui.$("anchor").value = "2026-10-15";
  ui.$("period").onchange();
  assert.equal(ui.$("schedule").querySelectorAll(".day").length, 1);
  assert.match(ui.$("schedule").textContent, /固定行程/);
  ui.$("next-period").onclick();
  assert.equal(ui.$("anchor").value, "2026-10-16");
  ui.$("previous-period").onclick();
  assert.equal(ui.$("anchor").value, "2026-10-15");
});
test("週視圖保留完整七天並標記已過日期", async () => {
  const ui = await loadUI("week-seven-days");
  ui.$("period").value = "week";
  ui.$("anchor").value = "2000-01-04";
  ui.$("period").onchange();
  const days = [...ui.$("schedule").querySelectorAll(".day")];
  assert.equal(days.length, 7);
  assert.equal(days[0].querySelector("h3").textContent, "2000-01-03");
  assert.match(days[0].textContent, /已過日期/);
  assert.equal(days[1].querySelector("h3").textContent, "2000-01-04");
});
test("點週曆日期可查看過去固定行程，點行程可編輯", async () => {
  const ui = await loadUI("calendar-drilldown");
  command(ui, "/cal 2000-01-03 14:00-15:00 [過去行程]");
  ui.$("anchor").value = "2000-01-03";
  ui.$("period").value = "week";
  ui.$("period").onchange();
  ui.$("schedule").querySelector(".calendar-date").onclick();
  assert.equal(ui.$("period").value, "day");
  assert.match(ui.$("schedule").textContent, /過去行程/);
  ui.$("schedule").querySelector(".event-open").onclick();
  assert.equal(ui.$("event-form").elements.title.value, "過去行程");
  assert.equal(ui.$("event-cancel-edit").hidden, false);
});
test("修改行程保留 ID、備註和關聯費用，取消編輯不寫入", async () => {
  const ui = await loadUI("calendar-edit-linked");
  command(ui, "/cal 2026-10-15 14:00-15:00 [報告] $150");
  const original = ui.read();
  original.events[0].notes = "準備資料";
  await ui.$("restore").onchange({target: {files: [{size: 100, text: async () => JSON.stringify(original)}], value: "file"}});
  const edit = () => [...ui.$("events").querySelectorAll("button")].find(b => b.textContent === "編輯事件").onclick();
  edit();
  const form = ui.$("event-form").elements;
  form.title.value = "報告練習";
  form.start.value = "16:00";
  form.end.value = "17:00";
  ui.submit("event-form");
  const updated = ui.read();
  assert.equal(updated.events.length, 1);
  assert.equal(updated.events[0].id, original.events[0].id);
  assert.equal(updated.events[0].title, "報告練習");
  assert.equal(updated.events[0].notes, "準備資料");
  assert.equal(updated.hub.transactions[0].eventId, original.events[0].id);
  edit();
  form.title.value = "未保存草稿";
  ui.$("replan").onclick();
  assert.equal(form.title.value, "未保存草稿");
  ui.$("event-cancel-edit").onclick();
  assert.deepEqual(ui.read(), updated);
  ui.$("undo").onclick();
  assert.equal(ui.read().events[0].title, "報告");
});
test("編輯每週系列保留日期範圍、排除日期與單次覆寫", async () => {
  const ui = await loadUI("calendar-edit-series");
  command(ui, "/cal 2026-10-15 14:00-15:00 [補課]");
  const snapshot = ui.read();
  const event = snapshot.events[0];
  delete event.date;
  Object.assign(event, {weekday: 4, from: "2026-10-01", until: "2027-01-28", excludedDates: ["2026-10-22"], overrides: {"2026-10-29": {start: "13:00", end: "14:00"}}});
  await ui.$("restore").onchange({target: {files: [{size: 100, text: async () => JSON.stringify(snapshot)}], value: "file"}});
  ui.$("period").value = "day";
  ui.$("anchor").value = "2026-10-15";
  ui.$("period").onchange();
  ui.$("schedule").querySelector(".event-open").onclick();
  assert.match(ui.$("event-edit-note").textContent, /整個每週系列/);
  const form = ui.$("event-form").elements;
  assert.equal(form.repeat.disabled, true);
  assert.equal(form.date.readOnly, true);
  form.title.value = "微積分補課";
  form.start.value = "16:00";
  form.end.value = "17:00";
  ui.submit("event-form");
  assert.deepEqual(ui.read().events[0], {...event, title: "微積分補課", start: "16:00", end: "17:00"});
});
test("拒絕切換行程時保留未保存草稿", async () => {
  const ui = await loadUI("calendar-edit-draft");
  command(ui, "/cal 2026-10-15 14:00-15:00 [原行程]");
  ui.$("event-form").elements.title.value = "新行程草稿";
  const originalConfirm = globalThis.confirm;
  try {
    globalThis.confirm = () => false;
    [...ui.$("events").querySelectorAll("button")].find(b => b.textContent === "編輯事件").onclick();
    assert.equal(ui.$("event-form").elements.title.value, "新行程草稿");
    assert.equal(ui.$("event-cancel-edit").hidden, true);
    assert.equal(ui.read().events[0].title, "原行程");
  } finally { globalThis.confirm = originalConfirm; }
});
test("固定行程同步雙向合併並保留主日曆其他資料", async () => {
  const ui = await loadUI("calendar-safe-sync");
  ui.writeStorage("college-os-v1", {
    tasks: { keep: [{ title: "保留任務" }] },
    events: [{ id: "course-1", title: "微積分補課", date: "2026-10-15", start: "08:00", end: "09:30", category: "course", status: "confirmed", custom: "保留" }],
  });
  command(ui, "/cal 2026-10-16 14:00-15:00 [規劃工作台行程]");
  ui.$("import-existing").onclick();
  const main = ui.readStorage("college-os-v1");
  assert.equal(main.tasks.keep[0].title, "保留任務");
  assert.ok(main.events.some((e) => e.title === "規劃工作台行程"));
  assert.ok(ui.read().events.some((e) => e.title === "微積分補課"));
  assert.match(ui.$("status").textContent, /日曆已合併/);
});
test("生活紀錄匯入保留財務與健康", async () => {
  const ui = await loadUI("hub10");
  command(ui, "/fin -150 #餐費");
  command(ui, "/fit 20m #walk");
  const saved = ui.read();
  await ui.$("restore").onchange({
    target: {
      files: [{ size: 100, text: async () => JSON.stringify(saved) }],
      value: "file",
    },
  });
  assert.equal(ui.read().hub.transactions[0].cents, 15000);
  assert.equal(ui.read().hub.health[0].minutes, 20);
});
test("日曆匯出包含固定行程，快照分開選擇", async () => {
  const ui = await loadUI("hub11");
  command(ui, "/cal 2026-10-15 14:00-15:00 [固定行程]");
  ui.$("anchor").value = "2026-10-15";
  ui.$("period").value = "week";
  ui.$("period").onchange();
  let blob;
  const original = URL.createObjectURL;
  try {
    URL.createObjectURL = (b) => ((blob = b), "blob:qa");
    ui.$("export-ics").onclick();
    assert.ok(blob);
    const text = await blob.text();
    assert.match(text, /SUMMARY:固定行程/);
    assert.match(text, /20261015T140000/);
    ui.$("export-plan-source").value = "confirmed";
    ui.$("export-ics").onclick();
    assert.match(ui.$("status").textContent, /快照/);
  } finally {
    URL.createObjectURL = original;
  }
});
test("列印結束後恢復原本收合狀態", async () => {
  const ui = await loadUI("hub12");
  const details = [...document.querySelectorAll("details")];
  details[0].open = false;
  window.print = () => window.dispatchEvent(new window.Event("afterprint"));
  ui.$("print").onclick();
  assert.equal(details[0].open, false);
});
test("未來活動紀錄不冒充實際完成", async () => {
  const ui = await loadUI("hub13");
  command(ui, "/fit 2099-10-15 20m #walk");
  assert.equal(ui.read(), null);
  assert.match(ui.$("hub-status").textContent, /已發生/);
});
test("資源與財務設定草稿不被重算清掉", async () => {
  const ui = await loadUI("hub14");
  ui.$("resource-form").elements.resources.value = "兩本微積分";
  ui.$("money-settings").elements.opening.value = "1234";
  ui.$("replan").onclick();
  assert.equal(ui.$("resource-form").elements.resources.value, "兩本微積分");
  assert.equal(ui.$("money-settings").elements.opening.value, "1234");
});
