import { test } from "node:test";
import assert from "node:assert/strict";
import {
  freshPlanner,
  migratePlanner,
  createPlannerStore,
} from "../規劃核心/store.mjs";
import { beginFocus, finishFocus, advanceTimer } from "../規劃核心/timer.mjs";
const key = "college-capacity-planner-v1";
const memory = () => {
  const data = new Map();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => data.set(k, v),
  };
};
const withTask = () => ({
  ...freshPlanner(),
  tasks: [
    {
      id: "a",
      title: "題庫",
      remaining: 60,
      priority: 2,
      active: true,
      done: false,
      deadline: "",
    },
  ],
});
test("舊版單時段資料遷移且保留任務", () => {
  const old = withTask();
  old.days = old.days.map((d) => ({
    start: "18:00",
    end: "21:00",
    hours: d.hours,
  }));
  const migrated = migratePlanner(old);
  assert.deepEqual(migrated.days[0].windows, [
    { start: "18:00", end: "21:00" },
  ]);
  assert.equal(migrated.tasks[0].id, "a");
  assert.equal(old.days[0].windows, undefined);
});
test("讀取與提交都是獨立副本", () => {
  const st = createPlannerStore(memory());
  const next = withTask();
  st.commit(next);
  next.tasks[0].title = "誤改";
  const read = st.read();
  read.tasks[0].remaining = 0;
  assert.equal(st.read().tasks[0].title, "題庫");
  assert.equal(st.read().tasks[0].remaining, 60);
});
test("無效提交不改已保存資料", () => {
  const storage = memory(),
    st = createPlannerStore(storage);
  st.commit(withTask());
  const raw = storage.getItem(key),
    bad = st.read();
  bad.settings.limit = 0;
  assert.throws(() => st.commit(bad));
  assert.equal(storage.getItem(key), raw);
});
test("儲存失敗不更新已提交狀態", () => {
  const storage = memory(),
    st = createPlannerStore(storage);
  st.commit(withTask());
  storage.setItem = () => {
    throw Error("quota");
  };
  const next = st.read();
  next.tasks[0].remaining = 5;
  assert.throws(() => st.commit(next));
  assert.equal(st.read().tasks[0].remaining, 60);
});
test("損壞資料不能被靜默覆寫，可用備份恢復", () => {
  const storage = memory();
  storage.setItem(key, "bad");
  const st = createPlannerStore(storage);
  assert.ok(st.error);
  assert.throws(() => st.commit(withTask()));
  assert.equal(storage.getItem(key), "bad");
  st.commit(withTask(), { restore: true });
  assert.equal(st.read().tasks.length, 1);
});
test("偵測另一分頁的修改，拒絕舊資料覆寫", () => {
  const storage = memory(),
    a = createPlannerStore(storage),
    b = createPlannerStore(storage);
  a.commit(withTask());
  assert.throws(() => b.commit(freshPlanner()), /另一個分頁/);
  assert.equal(JSON.parse(storage.getItem(key)).tasks.length, 1);
});
test("復原重做保留資料且修訂號持續增加", () => {
  const st = createPlannerStore(memory());
  st.commit(withTask());
  const x = st.read();
  x.tasks[0].remaining = 20;
  st.commit(x);
  const before = st.read().revision;
  assert.equal(st.undo().tasks[0].remaining, 60);
  assert.ok(st.read().revision > before);
  assert.equal(st.redo().tasks[0].remaining, 20);
});
test("開始專注不修改輸入，手動結束記錄一次", () => {
  const s = withTask(),
    start = Date.UTC(2026, 9, 12, 10),
    focused = beginFocus(s, "a", start),
    end = finishFocus(focused, start + 25 * 60000);
  assert.equal(s.timer, null);
  assert.equal(end.tasks[0].remaining, 35);
  assert.equal(end.logs.length, 1);
  assert.equal(end.timer.mode, "rest");
  assert.equal(finishFocus(end, start + 26 * 60000), end);
});
test("延遲返回只記設定的專注長度並保留完整休息", () => {
  const s = withTask(),
    start = Date.UTC(2026, 9, 12, 10),
    focused = beginFocus(s, "a", start),
    returned = advanceTimer(focused, start + 3 * 3600000);
  assert.equal(returned.logs[0].minutes, 50);
  assert.equal(returned.timer.until, start + 3 * 3600000 + 10 * 60000);
  assert.equal(advanceTimer(returned, returned.timer.until).timer, null);
});
test("計時期間不可復原，避免重複記錄耗時", () => {
  const st = createPlannerStore(memory());
  st.commit(withTask());
  st.commit(beginFocus(st.read(), "a", Date.now()));
  assert.equal(st.canUndo, false);
  assert.throws(() => st.undo());
});
test("長依賴鏈可驗證且尾端循環被拒絕", () => {
  const s = withTask();
  s.tasks = Array.from({ length: 1000 }, (_, i) => ({
    id: "t" + i,
    title: "t" + i,
    remaining: 1,
    priority: 2,
    active: true,
    done: false,
    deadline: "",
    depends: i ? "t" + (i - 1) : "",
  }));
  assert.equal(migratePlanner(s).tasks.length, 1000);
  s.tasks[0].depends = "t999";
  assert.throws(() => migratePlanner(s), /循環/);
});
