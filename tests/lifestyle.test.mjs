import { test } from "node:test";
import assert from "node:assert/strict";
import {
  freshHub,
  hubMoney,
  hubFinance,
  validateHub,
  parseHubCommand,
  hubDecisionRows,
} from "../規劃核心/lifestyle.mjs";
import { freshPlanner, createPlannerStore } from "../規劃核心/store.mjs";
import { range } from "../規劃核心/time.mjs";
const tx = (id, date, cents, status = "actual", type = "expense") => ({
  id,
  date,
  cents,
  status,
  type,
  category: "生活",
  note: "",
});
test("金額定點精確且拒絕三位小數與負數", () => {
  assert.equal(hubMoney("0.29"), 29);
  assert.equal(hubMoney("100.01"), 10001);
  assert.throws(() => hubMoney("1.999"));
  assert.throws(() => hubMoney("-1"));
});
test("目前餘額只含截至今天的實際交易", () => {
  const h = freshHub();
  h.opening = 10000;
  h.transactions = [
    tx("a", "2026-10-11", 1000),
    tx("b", "2026-10-12", 2000),
    tx("c", "2026-10-11", 500, "planned"),
  ];
  assert.equal(hubFinance(h, "2026-10-11", ["2026-10-11"]).balance, 9000);
});
test("預測包含今天預定、過期預定和未來交易各一次", () => {
  const h = freshHub();
  h.opening = 10000;
  h.transactions = [
    tx("a", "2026-10-10", 1000, "planned"),
    tx("b", "2026-10-11", 500, "planned"),
    tx("c", "2026-10-12", 2000, "planned"),
  ];
  const r = hubFinance(h, "2026-10-11", ["2026-10-11", "2026-10-12"]);
  assert.deepEqual(
    r.forecast.map((x) => x.value),
    [8500, 6500],
  );
  assert.equal(r.overdue.length, 1);
});
test("預定转實際不会重複扣款", () => {
  const h = freshHub();
  h.opening = 10000;
  h.transactions = [tx("a", "2026-10-11", 1000, "planned")];
  assert.equal(
    hubFinance(h, "2026-10-11", ["2026-10-11"]).forecast[0].value,
    9000,
  );
  h.transactions[0].status = "actual";
  const r = hubFinance(h, "2026-10-11", ["2026-10-11"]);
  assert.equal(r.balance, 9000);
  assert.equal(r.forecast[0].value, 9000);
  assert.equal(r.committed, 0);
});
test("期間預算分開計算", () => {
  const h = freshHub();
  h.budgets["2026-10-11/2026-10-11"] = 10000;
  h.transactions = [tx("a", "2026-10-11", 1000)];
  assert.equal(
    hubFinance(h, "2026-10-11", ["2026-10-11"]).budgetRemaining,
    9000,
  );
  assert.equal(hubFinance(h, "2026-10-11", ["2026-10-12"]).budgetRemaining, 0);
});
test("支出與儲備均扣除自由可用額", () => {
  const h = freshHub();
  h.opening = 10000;
  h.reserve = 2000;
  h.transactions = [tx("a", "2026-10-12", 3000, "planned")];
  assert.equal(
    hubFinance(h, "2026-10-11", ["2026-10-11", "2026-10-12"]).available,
    5000,
  );
});
test("進行中上限阻止第四件工作", () => {
  const h = freshHub();
  h.decisions = Array.from({ length: 4 }, (_, i) => ({
    id: String(i),
    title: "事項",
    pool: "doing",
    hours: 1,
    cents: 0,
    importance: 3,
    urgency: 3,
    deadline: "",
  }));
  assert.throws(() => validateHub(h));
  h.wipLimit = 4;
  assert.doesNotThrow(() => validateHub(h));
});
test("已完成关联任務反映到決策狀態", () => {
  const h = freshHub();
  h.decisions = [
    {
      id: "d",
      taskId: "t",
      title: "A",
      pool: "doing",
      hours: 1,
      cents: 0,
      importance: 3,
      urgency: 3,
      deadline: "",
    },
  ];
  assert.equal(hubDecisionRows(h, [{ id: "t", done: true }])[0].pool, "done");
});
test("非法健康、交易与重複ID被拒絕", () => {
  const h = freshHub();
  h.health = [
    {
      id: "h",
      date: "2026-02-30",
      kind: "walk",
      minutes: 20,
      sleep: 7,
      fatigue: 3,
      note: "",
    },
  ];
  assert.throws(() => validateHub(h));
  h.health = [];
  h.transactions = [tx("a", "2026-10-11", 10), tx("a", "2026-10-11", 20)];
  assert.throws(() => validateHub(h));
});
test("指令保留行程與費用資料", () => {
  const r = parseHubCommand(
    "/cal 2026-10-15 14:00-15:00 [報告] $150",
    "2026-10-11",
  );
  assert.deepEqual(r, {
    kind: "cal",
    date: "2026-10-15",
    start: "14:00",
    end: "15:00",
    title: "報告",
    cost: "150",
  });
});
test("收支指令明確区分預定与實際", () => {
  assert.equal(
    parseHubCommand("/fin -150 #餐費 [午餐]", "2026-10-11").status,
    "actual",
  );
  assert.equal(
    parseHubCommand("/fin -150 #餐費 !預定", "2026-10-11").status,
    "planned",
  );
  assert.throws(() => parseHubCommand("/fin -1.999 #餐費", "2026-10-11"));
});
test("不完整指令與不支援JSON有可讀錯誤", () => {
  assert.throws(() => parseHubCommand("明天運動", "2026-10-11"), /請使用/);
  assert.throws(() => parseHubCommand("/cal [工作]", "2026-10-11"), /行程格式/);
  assert.throws(
    () => parseHubCommand('{"kind":"execute"}', "2026-10-11"),
    /JSON需要/,
  );
});
test("年範圍完整支援閏年與跨年邊界", () => {
  const r = range("2028-10-11", "year");
  assert.equal(r.length, 366);
  assert.equal(r[0], "2028-01-01");
  assert.equal(r.at(-1), "2028-12-31");
  assert.equal(range("2026-01-01", "year").length, 365);
});
test("生活資料隨規劃器保存及復原，舊備份仍可讀", () => {
  const data = new Map(),
    storage = {
      getItem: (k) => data.get(k) || null,
      setItem: (k, v) => data.set(k, v),
    },
    store = createPlannerStore(storage);
  const s = freshPlanner();
  s.hub = freshHub();
  s.hub.opening = 10000;
  store.commit(s);
  assert.equal(createPlannerStore(storage).read().hub.opening, 10000);
  store.undo();
  assert.equal(store.read().hub, undefined);
});
