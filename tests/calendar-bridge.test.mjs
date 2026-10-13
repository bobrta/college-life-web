import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeCalendarEvents } from "../規劃核心/calendar-bridge.mjs";

const event = (id, title, date = "2026-10-15") => ({
  id, title, date, start: "14:00", end: "15:00", category: "personal",
});

test("日曆合併只新增缺少的事件並保留主日曆欄位", () => {
  const old = { ...event("same", "主日曆版本"), custom: "保留" };
  const result = mergeCalendarEvents([old], [event("same", "規劃工作台版本"), event("new", "新增")]);
  assert.equal(result.added, 1);
  assert.equal(result.conflicts, 1);
  assert.equal(result.events.find((x) => x.id === "same").title, "主日曆版本");
  assert.equal(result.events.find((x) => x.id === "same").custom, "保留");
  assert.equal(result.events.find((x) => x.id === "new").title, "新增");
});

test("日曆合併遇到損壞資料時拒絕並保留輸入", () => {
  const original = { ...event("bad", "壞資料"), start: "25:00" };
  assert.throws(() => mergeCalendarEvents([original], []));
  assert.equal(original.start, "25:00");
});
