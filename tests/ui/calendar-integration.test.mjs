import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
const { parseHTML } = await import(process.env.DOM_QA_MODULE || "linkedom");
test("日曆主程式整合：啟動、匯入、保存、圖表與列印仍可操作", async () => {
  const root = path.resolve(import.meta.dirname, "../.."),
    { document, window } = parseHTML(
      fs.readFileSync(path.join(root, "index.html"), "utf8"),
    );
  globalThis.document = document;
  globalThis.window = window;
  globalThis.Event = window.Event;
  const data = new Map();
  globalThis.localStorage = {
    getItem: (k) => data.get(k) || null,
    setItem: (k, v) => data.set(k, v),
  };
  globalThis.confirm = () => true;
  globalThis.prompt = () => null;
  const realTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (fn, ms, ...args) =>
    ms > 1000 ? 0 : realTimeout(fn, ms, ...args);
  globalThis.setInterval = () => 0;
  globalThis.clearInterval = () => {};
  globalThis.fetch = async (input) => {
    const file = path.join(
      root,
      String(input).replace(/^\.\//, "").split("?")[0],
    );
    return {
      ok: fs.existsSync(file),
      json: async () => JSON.parse(fs.readFileSync(file, "utf8")),
      text: async () => fs.readFileSync(file, "utf8"),
    };
  };
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
  window.HTMLSelectElement.prototype.add = function (o) {
    this.append(o);
  };
  globalThis.Option = function (text, value) {
    const o = document.createElement("option");
    o.textContent = text;
    o.value = value;
    return o;
  };
  window.HTMLElement.prototype.showModal = function () {
    this.open = true;
  };
  window.HTMLElement.prototype.close = function () {
    this.open = false;
  };
  window.HTMLElement.prototype.scrollIntoView = function () {};
  window.HTMLElement.prototype.focus = function () {};
  const originalCreate = document.createElement.bind(document);
  document.createElement = (tag, ...args) => {
    const el = originalCreate(tag, ...args);
    if (tag === "form") el.reset = () => {};
    return el;
  };
  for (const f of document.querySelectorAll("form")) {
    f.reset = () => {};
    Object.defineProperty(f, "elements", {
      get() {
        return Object.fromEntries(
          [...f.querySelectorAll("[name]")].map((e) => [e.name, e]),
        );
      },
    });
  }
  globalThis.FormData = class {
    constructor(f) {
      this.f = f;
    }
    get(n) {
      return this.f.elements[n]?.value ?? null;
    }
    has(n) {
      return !!this.f.elements[n];
    }
  };
  window.matchMedia = () => ({ matches: false });
  globalThis.location = {
    href: "http://localhost/index.html",
    hash: "",
    reload() {},
  };
  window.print = () => {};
  await import("../../app.js?calendar-integration");
  await new Promise((resolve) => setTimeout(resolve, 50));
  const $ = (id) => document.getElementById(id);
  assert.ok($("calendar-editor"));
  assert.equal(
    document.querySelectorAll("#calendar .cal-navigation").length,
    1,
  );
  assert.equal($("week-grid").querySelectorAll("thead th").length, 8);
  document.querySelector('[data-page="calendar"]').click();
  $("schedule-json-input").value = JSON.stringify({
    events: [
      {
        id: "integration",
        date: "2026-10-12",
        title: "整合測試",
        start: "18:55",
        end: "19:55",
        category: "study",
        notes: "保留",
        subject: "數學",
        outcome: "三題",
      },
    ],
  });
  await $("import-json-text").onclick();
  assert.equal(JSON.parse(data.get("college-os-v1")).events[0].notes, "保留");
  assert.match($("calendar-status").textContent, /已匯入/);
  $("calendar-jump").value = "2026-10-12";
  $("calendar-jump").onchange();
  const card = document.querySelector('[data-event-id="integration"]');
  assert.ok(card);
  card.onclick();
  $("event-title").value = "修改";
  $("event-form").onsubmit({ preventDefault() {} });
  assert.equal(JSON.parse(data.get("college-os-v1")).events[0].notes, "保留");
  $("calendar-print-format").value = "panorama";
  $("print-calendar").onclick();
  assert.ok($("printable-calendar").querySelector(".cal-panorama"));
  window.dispatchEvent(new window.Event("afterprint"));
  assert.equal($("printable-calendar").hidden, true);
});
