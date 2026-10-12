// Pure local-first calculations. Money is always stored as integer cents.
export function hubDate(value) {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value + "T12:00:00Z").toISOString().slice(0, 10) === value
  );
}
export function hubMoney(value) {
  const text = String(value).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(text))
    throw Error("金額需為非負數，最多兩位小數");
  const [whole, fraction = ""] = text.split("."),
    cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents > 1e11) throw Error("金額超出範圍");
  return cents;
}
export function freshHub() {
  return {
    version: 1,
    opening: 0,
    reserve: 0,
    budget: 0,
    resources: "",
    budgets: {},
    wipLimit: 3,
    transactions: [],
    decisions: [],
    health: [],
  };
}
export function validateHub(hub) {
  const money = (n) => Number.isSafeInteger(n) && n >= 0 && n <= 1e11;
  if (
    !hub ||
    hub.version !== 1 ||
    ![hub.opening, hub.reserve, hub.budget].every(money) ||
    typeof hub.resources !== "string" ||
    hub.resources.length > 2000 ||
    !Number.isInteger(hub.wipLimit) ||
    hub.wipLimit < 1 ||
    hub.wipLimit > 4
  )
    throw Error("生活工作台設定不正確");
  if (
    hub.budgets !== undefined &&
    (!hub.budgets ||
      typeof hub.budgets !== "object" ||
      Array.isArray(hub.budgets) ||
      Object.entries(hub.budgets).some(
        ([key, value]) => {
          const [start, end] = key.split("/");
          return !hubDate(start) || !hubDate(end) || end < start || !money(value);
        },
      ))
  )
    throw Error("期間預算不正確");
  const ids = new Set();
  for (const key of ["transactions", "decisions", "health"]) {
    if (!Array.isArray(hub[key]) || hub[key].length > 5000)
      throw Error("生活紀錄格式或筆數不正確");
    for (const row of hub[key]) {
      if (
        !row ||
        typeof row.id !== "string" ||
        !row.id.trim() ||
        row.id.length > 120 ||
        ids.has(row.id)
      )
        throw Error("生活紀錄ID不正確或重複");
      ids.add(row.id);
    }
  }
  for (const row of hub.transactions)
    if (
      !hubDate(row.date) ||
      !["income", "expense"].includes(row.type) ||
      !["actual", "planned"].includes(row.status) ||
      !money(row.cents) ||
      row.cents === 0 ||
      typeof row.category !== "string" ||
      !row.category.trim() ||
      row.category.length > 60 ||
      typeof row.note !== "string" ||
      row.note.length > 300 ||
      (row.eventId !== undefined && typeof row.eventId !== "string")
    )
      throw Error("收支資料不正確");
  for (const row of hub.decisions)
    if (
      typeof row.title !== "string" ||
      !row.title.trim() ||
      row.title.length > 200 ||
      !["must", "want", "doing", "done"].includes(row.pool) ||
      !Number.isFinite(row.hours) ||
      row.hours <= 0 ||
      row.hours > 1000 ||
      !money(row.cents) ||
      ![row.importance, row.urgency].every(
        (n) => Number.isInteger(n) && n >= 1 && n <= 5,
      ) ||
      (row.deadline !== "" && !hubDate(row.deadline)) ||
      (row.taskId !== undefined && (typeof row.taskId !== "string" || !row.taskId.trim()))
    )
      throw Error("決策資料不正確");
  if (hub.decisions.filter((r) => r.pool === "doing").length > hub.wipLimit)
    throw Error("進行中工作超過設定上限，請先暫停一件");
  for (const row of hub.health)
    if (
      !hubDate(row.date) ||
      !["walk", "run", "strength", "stretch", "rest"].includes(row.kind) ||
      !Number.isInteger(row.minutes) ||
      row.minutes < 0 ||
      row.minutes > 600 ||
      !Number.isFinite(row.sleep) ||
      row.sleep < 0 ||
      row.sleep > 24 ||
      !Number.isInteger(row.fatigue) ||
      row.fatigue < 1 ||
      row.fatigue > 5 ||
      typeof row.note !== "string" ||
      row.note.length > 300
    )
      throw Error("運動與恢復紀錄不正確");
  return hub;
}
export function hubFinance(hub, asOf, dates) {
  validateHub(hub);
  if (!hubDate(asOf) || !Array.isArray(dates) || dates.some((d) => !hubDate(d)))
    throw Error("財務日期不正確");
  const signed = (r) => (r.type === "income" ? r.cents : -r.cents);
  const actual = hub.transactions.filter(
    (r) => r.status === "actual" && r.date <= asOf,
  );
  const balance = actual.reduce((n, r) => n + signed(r), hub.opening);
  const pending = hub.transactions.filter((r) => r.status === "planned");
  const overdue = pending.filter((r) => r.date < asOf);
  const future = hub.transactions.filter(
    (r) => r.status === "planned" || r.date > asOf,
  );
  const horizon = [...new Set(dates.filter((d) => d >= asOf))].sort();
  const forecast = horizon.map((date) => ({
    date,
    value: future
      .filter((r) => r.date <= date)
      .reduce((n, r) => n + signed(r), balance),
  }));
  const set = new Set(dates),
    rows = actual.filter((r) => set.has(r.date)),
    income = rows
      .filter((r) => r.type === "income")
      .reduce((n, r) => n + r.cents, 0),
    expense = rows
      .filter((r) => r.type === "expense")
      .reduce((n, r) => n + r.cents, 0);
  const categories = new Map();
  for (const r of rows)
    if (r.type === "expense")
      categories.set(r.category, (categories.get(r.category) || 0) + r.cents);
  const last = horizon.at(-1) || asOf,
    committed = pending
      .filter((r) => r.type === "expense" && r.date <= last)
      .reduce((n, r) => n + r.cents, 0);
  return {
    balance,
    income,
    expense,
    committed,
    available: balance - hub.reserve - committed,
    forecast,
    overdue,
    categories: [...categories].map(([label, value]) => ({ label, value })),
    budgetRemaining:
      (hub.budgets?.[dates[0] + "/" + dates.at(-1)] || 0) - expense,
  };
}
export function hubDecisionRows(hub, taskList) {
  return hub.decisions.map((row) => ({
    ...row,
    pool: taskList.find((t) => t.id === row.taskId)?.done ? "done" : row.pool,
    score: (row.importance * 3 + row.urgency * 2) / 5,
  }));
}
export function parseHubCommand(text, baseDate) {
  if (typeof text !== "string" || text.length > 10000 || !hubDate(baseDate))
    throw Error("指令或日期不正確");
  if (text.trim().startsWith("{")) {
    const obj = JSON.parse(text);
    if (
      !obj ||
      typeof obj !== "object" ||
      Array.isArray(obj) ||
      !["cal", "fin", "task", "fit"].includes(obj.kind)
    )
      throw Error("JSON需要kind：cal、fin、task或fit");
    return obj;
  }
  const source = text.trim(),
    title = source.match(/\[([^\]]+)\]/)?.[1],
    day = source.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0] || baseDate;
  if (source.startsWith("/cal ")) {
    const times = source.match(/\b([0-2]\d:[0-5]\d)-([0-2]\d:[0-5]\d)\b/),
      cost = source.match(/\$(\d+(?:\.\d{1,2})?)(?![\d.])/);
    if (!title || !times)
      throw Error("行程格式：/cal 2026-10-15 14:00-15:00 [寫報告] $150");
    const result={
      kind: "cal",
      date: day,
      start: times[1],
      end: times[2],
      title,
      cost: cost ? cost[1] : "0",
    };
    if(!hubDate(day)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(result.start)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(result.end)||result.end<=result.start)throw Error("行程日期或時段不正確");
    return result;
  }
  if (source.startsWith("/fin ")) {
    const amount = source.match(/^\/fin\s+([+-])(\d+(?:\.\d{1,2})?)(?=\s|$)/),
      category = source.match(/#([^\s\[]+)/)?.[1] || "其他";
    if (!amount) throw Error("記帳格式：/fin -150 #餐費 [午餐]");
    if(!hubDate(day))throw Error("收支日期不正確");
    return {
      kind: "fin",
      date: day,
      type: amount[1] === "+" ? "income" : "expense",
      amount: amount[2],
      category,
      note: title || "",
      status: source.includes("!預定") ? "planned" : "actual",
    };
  }
  if (source.startsWith("/task ")) {
    if (!title) throw Error("任務格式：/task [管理學報告] 2h -> must");
    return {
      kind: "task",
      title,
      hours: Number(source.match(/\b(\d+(?:\.\d+)?)h\b/)?.[1] || 1),
      pool: source.match(/->\s*(must|want|doing)\b/)?.[1] || "want",
      cost: source.match(/\$(\d+(?:\.\d{1,2})?)/)?.[1] || "0",
      importance: 3,
      urgency: 3,
      deadline: "",
    };
  }
  if (source.startsWith("/fit ")) {
    const minutes = source.match(/\b(\d+)m\b/);
    if (!minutes) throw Error("運動格式：/fit 20m #walk [散步]");
    if(!hubDate(day))throw Error("活動日期不正確");
    return {
      kind: "fit",
      date: day,
      minutes: Number(minutes[1]),
      activity:
        source.match(/#(walk|run|strength|stretch|rest)\b/)?.[1] || "walk",
      sleep: 0,
      fatigue: 3,
      note: title || "",
    };
  }
  throw Error(
    "請使用/cal、/fin、/task、/fit，或貼上JSON。日期須為YYYY-MM-DD；匯入前可先預覽",
  );
}
