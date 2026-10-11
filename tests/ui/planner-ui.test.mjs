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
  await import(
    pathToFileURL(resolve(root, "planner-ui.mjs")) + "?qa=" + caseId
  );
  const $ = (id) => document.getElementById(id),
    submit = (id) => $(id).onsubmit({ preventDefault() {}, target: $(id) }),
    read = () => JSON.parse(data.get(key));
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
  return { $, submit, read, add };
}
test("P44 匯入備份不可靜默丟失進行中計時", async () => {
  const ui = await loadUI(44),
    id = ui.add();
  ui.$("focus-task").value = id;
  ui.$("start").onclick();
  const snapshot = ui.read();
  ui.$("restore").value = "file";
  await ui
    .$("restore")
    .onchange({
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
