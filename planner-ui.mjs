import {
  plan,
  range,
  clock,
  pert,
  validate,
  parseWindows,
} from "./planner-core.mjs";
import { parseSchedule, toICS } from "./calendar.mjs";
import { createPlannerStore } from "./規劃核心/store.mjs";
import { beginFocus, finishFocus, advanceTimer } from "./規劃核心/timer.mjs";
import { renderSchedule } from "./規劃介面/schedule.mjs";
const $ = (id) => document.getElementById(id),
  key = "college-capacity-planner-v1",
  today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" }),
  weekdays = ["日", "一", "二", "三", "四", "五", "六"];
const store = createPlannerStore(localStorage, key);
let editing = null,
  revision = 0;
let state = store.read();
if (store.error) $("status").textContent = "原資料未覆寫：" + store.error;
let planCache = null;
function nowCutoff() {
  const d = new Date();
  return {
    date: d.toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" }),
    minute:
      Number(
        d
          .toLocaleTimeString("en-GB", {
            timeZone: "Asia/Taipei",
            hour12: false,
          })
          .slice(0, 2),
      ) *
        60 +
      Number(
        d
          .toLocaleTimeString("en-GB", {
            timeZone: "Asia/Taipei",
            hour12: false,
          })
          .slice(3, 5),
      ),
  };
}
function currentPlan() {
  const now = nowCutoff(),
    dates = range($("anchor").value || today, $("period").value).filter(
      (d) => d >= now.date,
    ),
    key = JSON.stringify([
      dates,
      now,
      state.settings,
      state.days,
      state.overrides,
      state.events,
      state.tasks,
    ]);
  if (planCache?.key === key) return planCache.value;
  const value = plan(state, dates, now);
  planCache = { key, value };
  return value;
}
function save(options) {
  state = store.commit(state, options);
  revision = state.revision;
}
function safe(fn) {
  return (...args) => {
    try {
      fn(...args);
    } catch (e) {
      state = store.read();
      revision = state.revision || 0;
      render();
      $("status").textContent = e.message;
    }
  };
}
function node(tag, text, cls) {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  if (cls) n.className = cls;
  return n;
}
function btn(text, fn) {
  const b = node("button", text);
  b.type = "button";
  b.onclick = safe(fn);
  return b;
}
const hours = (n) => (n / 60).toFixed(1) + " 小時";
revision = state.revision || 0;
const initial = new Date(today + "T12:00:00Z");
if (initial.getUTCDay() === 0) initial.setUTCDate(initial.getUTCDate() + 1);
$("anchor").value = initial.toISOString().slice(0, 10);
document.querySelector("[name=date]").value = today;
for (const b of document.querySelectorAll("[data-tab]"))
  b.onclick = () => {
    for (const s of ["overview", "tasks", "settings", "tools", "goals"])
      $(s).hidden = s !== b.dataset.tab;
    for (const n of document.querySelectorAll("[data-tab]")) {
      n.classList.toggle("active", n === b);
      n.setAttribute("aria-pressed", String(n === b));
    }
  };
function render() {
  const confirmed = state.confirmed;
  $("confirmed-note").textContent = confirmed
    ? `確認於 ${confirmed.at}。${confirmed.revision === revision ? "設定與任務未變更。" : "資料已變更，請重新檢查建議排程；原確認紀錄保留。"}`
    : "尚未確認排程。";
  $("confirmed").replaceChildren();
  if (confirmed)
    for (const b of confirmed.blocks)
      $("confirmed").append(
        node(
          "div",
          `${b.date} ${clock(b.start)}–${clock(b.end)} ${b.title}`,
          "block",
        ),
      );
  const dates = range($("anchor").value || today, $("period").value),
    p = currentPlan();
  $("range").textContent =
    `${dates[0]} ～ ${dates.at(-1)} · 僅安排今天起的時段；月／季為容量預估`;
  $("metrics").replaceChildren();
  for (const [label, value] of [
    ["可承諾容量", hours(p.capacity)],
    ["工作需求", hours(p.demand)],
    ["建議已排", hours(p.scheduled)],
    [
      "容量利用率",
      p.capacity
        ? ((100 * p.demand) / p.capacity).toFixed(0) + "%"
        : "無可排時間",
    ],
  ]) {
    const x = node("article", undefined, "metric");
    x.append(node("span", label), node("strong", value));
    $("metrics").append(x);
  }
  $("warnings").replaceChildren();
  if (!p.unplaced.length)
    $("warnings").append(
      node(
        "p",
        state.tasks.some((t) => t.active && !t.done)
          ? "目前選取工作可排入。"
          : "先加入工作與確認可用時段，再計算。",
      ),
    );
  for (const t of p.unplaced)
    $("warnings").append(
      node(
        "div",
        `${t.title} · 缺 ${hours(t.missing)} · ${t.deadline || "期限待確認"}`,
        "warning",
      ),
    );
  renderSchedule($("schedule"), p, {
    period: $("period").value,
    limit: state.settings.limit,
    onFocus: (id) => {
      $("focus-task").value = id;
      $("start").onclick();
      $("timer").scrollIntoView?.({ behavior: "smooth" });
    },
  });
  $("undo").disabled = !store.canUndo;
  $("redo").disabled = !store.canRedo;
  renderGoals();
  $("task-list").replaceChildren();
  $("depends").replaceChildren(new Option("無前置任務", ""));
  const selected = $("focus-task").value;
  $("focus-task").replaceChildren(new Option("選擇要記錄的工作", ""));
  for (const t of state.tasks) {
    if (t.id !== editing) $("depends").add(new Option(t.title, t.id));
    if (!t.done) $("focus-task").add(new Option(t.title, t.id));
    const x = node("article", undefined, "panel task"),
      content = node("div", undefined, "content");
    content.append(
      node("h3", t.title),
      node(
        "p",
        `剩餘 ${hours(t.remaining)} · ${t.deadline || "期限待確認"} · ${t.done ? "已完成" : t.active ? "參與排程" : "暫存"}`,
      ),
      node("p", t.outcome || "完成條件待補充"),
    );
    x.append(
      content,
      btn("編輯工作", () => {
        editing = t.id;
        render();
        const f = $("task-form");
        for (const k of [
          "title",
          "deadline",
          "priority",
          "outcome",
          "depends",
          "goal",
        ])
          f.elements[k].value = t[k] || "";
        f.elements.hours.value = t.remaining / 60;
        f.elements.active.checked = t.active;
        $("task-submit").textContent = "保存修改";
        $("cancel-edit").hidden = false;
        f.scrollIntoView({ behavior: "smooth" });
      }),
      btn(t.active ? "暫停推進" : "開始推進", () => {
        t.active = !t.active;
        save();
        render();
      }),
      btn(t.done ? "重新開啟" : "確認完成", () => {
        t.done = !t.done;
        save();
        render();
      }),
      btn("刪除", () => {
        if (state.timer?.task === t.id) throw Error("請先結束這件工作的計時");
        if (!confirm("刪除此工作？")) return;
        if (state.tasks.some((x) => x.depends === t.id))
          throw Error("其他工作依賴此任務，請先移除依賴");
        state.tasks = state.tasks.filter((x) => x.id !== t.id);
        save();
        render();
      }),
    );
    $("task-list").append(x);
  }
  if (state.tasks.some((t) => t.id === selected))
    $("focus-task").value = selected;
  $("events").replaceChildren();
  for (const e of state.events)
    $("events").append(
      node(
        "p",
        `${e.title} · ${e.date || "每週" + weekdays[e.weekday]} ${e.start}–${e.end}`,
      ),
      btn("移除事件", () => {
        state.events = state.events.filter((x) => x.id !== e.id);
        save();
        render();
      }),
    );
}
$("task-form").onsubmit = safe((e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const item = {
    id: editing || crypto.randomUUID(),
    title: f.get("title").trim(),
    remaining: Number(f.get("hours")) * 60,
    deadline: f.get("deadline"),
    priority: Number(f.get("priority")),
    outcome: f.get("outcome"),
    goal: f.get("goal"),
    depends: f.get("depends"),
    active: f.has("active"),
    done: editing ? state.tasks.find((t) => t.id === editing).done : false,
  };
  const next = {
    ...state,
    tasks: editing
      ? state.tasks.map((t) => (t.id === editing ? item : t))
      : [...state.tasks, item],
  };
  validate(next);
  state = next;
  save();
  editing = null;
  e.target.reset();
  $("task-submit").textContent = "加入工作";
  $("cancel-edit").hidden = true;
  render();
});
$("days").replaceChildren();
state.days.forEach((d, i) => {
  const x = node("div", undefined, "form-grid");
  x.append(node("strong", "週" + weekdays[i]));
  const l = node("label", "可用時段（可多段；空白不排）"),
    input = node("input");
  input.name = `day-${i}-windows`;
  input.value = (d.windows ?? [{ start: d.start, end: d.end }])
    .map((w) => w.start + "-" + w.end)
    .join(",");
  input.placeholder = "08:00-10:00,18:30-22:15";
  l.append(input);
  x.append(l);
  const h = node("label", "每日淨工時上限"),
    n = node("input");
  n.name = `day-${i}-hours`;
  n.type = "number";
  n.value = d.hours;
  n.min = 0;
  n.max = 24;
  n.step = 0.25;
  n.required = true;
  h.append(n);
  x.append(h);
  $("days").append(x);
});
for (const k of ["limit", "buffer", "focus", "rest", "minBlock"])
  document.querySelector(`[name=${k}]`).value = state.settings[k];
$("settings-form").onsubmit = safe((e) => {
  e.preventDefault();
  const next = structuredClone(state),
    f = new FormData(e.target);
  for (const k of ["limit", "buffer", "focus", "rest", "minBlock"])
    next.settings[k] = Number(f.get(k));
  next.days.forEach((d, i) => {
    d.windows = parseWindows(f.get(`day-${i}-windows`));
    d.hours = Number(f.get(`day-${i}-hours`));
  });
  validate(next);
  state = next;
  save();
  render();
  $("status").textContent = "已保存。建議排程已重新計算。";
});
$("event-form").onsubmit = safe((e) => {
  e.preventDefault();
  const f = new FormData(e.target),
    date = f.get("date"),
    item = {
      id: crypto.randomUUID(),
      title: f.get("title").trim(),
      date,
      start: f.get("start"),
      end: f.get("end"),
    };
  if (item.end <= item.start)
    throw Error("結束需晚於開始；跨午夜請拆成兩個事件");
  if (f.has("repeat")) {
    item.weekday = new Date(date + "T12:00:00Z").getUTCDay();
    item.from = date;
    item.until = range(date, "quarter").at(-1);
    delete item.date;
  }
  const next = { ...state, events: [...state.events, item] };
  validate(next);
  state = next;
  save();
  render();
  e.target.reset();
  e.target.elements.date.value = today;
});
for (const id of ["period", "anchor"]) $(id).onchange = safe(render);
$("replan").onclick = safe(render);
$("print").onclick = () => {
  for (const d of document.querySelectorAll("details")) {
    d.open = true;
    d.dispatchEvent(new Event("toggle"));
  }
  window.print();
};
$("backup").onclick = safe(() => {
  const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: "application/json",
    }),
    u = URL.createObjectURL(blob),
    a = node("a");
  a.href = u;
  a.download = `時間規劃備份-${today}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
});
$("restore").onchange = async (e) => {
  try {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 2e6) throw Error("檔案不可超過2MB");
    const next = validate(JSON.parse(await f.text()));
    if (!confirm("以備份取代目前規劃？建議先匯出目前資料。")) return;
    next.timer = null;
    state = next;
    save({ restore: true });
    location.reload();
  } catch (err) {
    $("status").textContent = err.message;
  } finally {
    e.target.value = "";
  }
};
$("calculate").onclick = safe(() => {
  const [a, b, c] = ["a", "b", "c"].map((id) => Number($(id).value));
  if (![a, b, c].every(Number.isFinite) || [a, b, c].some((x) => x < 0))
    throw Error("請輸入非負數字");
  const type = $("calc-type").value;
  let result;
  if (type === "pert")
    result = `( ${a} + 4 × ${b} + ${c} ) ÷ 6 = ${pert(a, b, c).toFixed(2)} 小時`;
  if (type === "video") {
    if (b <= 0) throw Error("倍速需大於零");
    result = `${a} ÷ ${b} + ${c} = ${(a / b + c).toFixed(1)} 分鐘`;
  }
  if (type === "quiz")
    result = `${a} × ${b} + ${c} = ${(a * b + c).toFixed(1)} 分鐘`;
  if (type === "saving")
    result = `${a} × ${b} − ${c} = ${(a * b - c).toFixed(1)} 分鐘淨節省`;
  $("calc-result").textContent = result;
});
function tick() {
  const next = advanceTimer(state, Date.now());
  if (next !== state) {
    try {
      state = next;
      save();
      render();
    } catch (e) {
      state = store.read();
      $("status").textContent = e.message;
    }
  }
  const current = state.timer;
  $("start").disabled = !!current;
  $("stop").disabled = !current || current.mode === "rest";
  const seconds = current
    ? Math.max(0, Math.ceil((current.until - Date.now()) / 1000))
    : 0;
  $("timer").textContent = current
    ? `${current.mode === "focus" ? "專注" : "休息"} ${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`
    : "準備開始";
}
$("start").onclick = safe(() => {
  if (state.timer) return;
  state = beginFocus(state, $("focus-task").value, Date.now());
  save();
  tick();
});
$("stop").onclick = safe(() => {
  if (state.timer?.mode !== "focus") return;
  state = finishFocus(state, Date.now());
  save();
  render();
  tick();
});
render();
tick();
setInterval(tick, 1000);

$("cancel-edit").onclick = () => {
  editing = null;
  $("task-form").reset();
  $("task-submit").textContent = "加入工作";
  $("cancel-edit").hidden = true;
  render();
};
$("import-existing").onclick = safe(() => {
  const old = JSON.parse(localStorage.getItem("college-os-v1") || "{}");
  const events = parseSchedule(
    JSON.stringify({
      events: (old.events || []).filter(
        (e) => e.category !== "study" && e.start && e.end,
      ),
    }),
  ).events;
  if (!events.length) throw Error("此瀏覽器沒有可讀取的原日曆固定事件");
  const map = new Map(state.events.map((e) => [e.id, e]));
  let added = 0;
  for (const e of events)
    if (!map.has(e.id)) {
      map.set(e.id, e);
      added++;
    }
  const next = { ...state, events: [...map.values()] };
  validate(next);
  state = next;
  save();
  render();
  $("status").textContent = `已讀取 ${added} 個固定事件；重複ID保留目前版本。`;
});
$("confirm-plan").onclick = safe(() => {
  const p = currentPlan();
  state.confirmed = {
    at: new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" }),
    revision: revision + 1,
    blocks: p.days.flatMap((d) => d.blocks),
  };
  save();
  render();
  $("status").textContent =
    `已保存排程快照。${p.unplaced.length} 件工作仍有未排入時間，保留在缺口清單。`;
});

function renderGoals() {
  const old = $("task-goal").value;
  $("task-goal").replaceChildren(new Option("未指定目標", ""));
  $("goal-list").replaceChildren();
  for (const g of state.goals || []) {
    $("task-goal").add(new Option(g.title, g.id));
    const tasks = state.tasks.filter((t) => t.goal === g.id),
      done = tasks.filter((t) => t.done).length,
      x = node("article", undefined, "panel");
    x.append(
      node("h3", g.title),
      node(
        "p",
        `${g.period === "month" ? "月" : "季"}目標 · ${g.date} · 完成 ${done}/${tasks.length} 件${tasks.length ? "（" + Math.round((done / tasks.length) * 100) + "%）" : ""} · 剩餘 ${hours(tasks.filter((t) => !t.done).reduce((n, t) => n + t.remaining, 0))}`,
      ),
      btn("刪除目標", () => {
        if (!confirm("刪除目標？其任務會保留。")) return;
        state.goals = state.goals.filter((x) => x.id !== g.id);
        state.tasks.forEach((t) => {
          if (t.goal === g.id) t.goal = "";
        });
        save();
        render();
      }),
    );
    $("goal-list").append(x);
  }
  if ((state.goals || []).some((g) => g.id === old)) $("task-goal").value = old;
  $("overrides").replaceChildren();
  for (const [date, d] of Object.entries(state.overrides || {}).sort())
    $("overrides").append(
      node(
        "p",
        `${date} · ${d.windows.map((w) => w.start + "–" + w.end).join("、") || "不排工作"} · 上限 ${d.hours} 小時`,
      ),
      btn("恢復每週設定", () => {
        delete state.overrides[date];
        save();
        render();
      }),
    );
  const logs = state.logs || [];
  $("log-summary").textContent =
    `累計 ${logs.length} 段，實際投入 ${hours(logs.reduce((n, l) => n + l.minutes, 0))}。以下顯示最近20段。`;
  $("log-list").replaceChildren();
  for (const l of logs.slice(-20).reverse())
    $("log-list").append(
      node(
        "p",
        `${l.date} · ${state.tasks.find((t) => t.id === l.task)?.title || "已刪除工作"} · ${l.minutes.toFixed(1)} 分鐘`,
      ),
    );
}
$("goal-form").elements.date.value = today;
$("override-form").elements.date.value = today;
$("goal-form").onsubmit = safe((e) => {
  e.preventDefault();
  const f = new FormData(e.target),
    next = {
      ...state,
      goals: [
        ...(state.goals || []),
        {
          id: crypto.randomUUID(),
          title: f.get("title").trim(),
          date: f.get("date"),
          period: f.get("period"),
        },
      ],
    };
  validate(next);
  state = next;
  save();
  render();
  e.target.reset();
  e.target.elements.date.value = today;
});
$("override-form").onsubmit = safe((e) => {
  e.preventDefault();
  const f = new FormData(e.target),
    next = {
      ...state,
      overrides: {
        ...(state.overrides || {}),
        [f.get("date")]: {
          windows: parseWindows(f.get("windows")),
          hours: Number(f.get("hours")),
        },
      },
    };
  validate(next);
  state = next;
  save();
  render();
  $("status").textContent = "單日例外已保存，不影響其他星期。";
});
function download(content, name, type) {
  const url = URL.createObjectURL(new Blob([content], { type })),
    a = node("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$("export-ics").onclick = safe(() => {
  const p = currentPlan(),
    blocks = p.days.flatMap((d) => d.blocks);
  if (!blocks.length) throw Error("尚無可匯出的工作區段");
  const events = blocks.map((b) => ({
    id: `planner-${b.id}-${b.date}-${b.start}`,
    title: b.title,
    date: b.date,
    start: clock(b.start),
    end: clock(b.end),
    notes: state.tasks.find((t) => t.id === b.id)?.outcome || "",
    source: "College OS 時間規劃",
  }));
  download(
    toICS(events),
    "時間規劃-" + $("anchor").value + ".ics",
    "text/calendar",
  );
  $("status").textContent = "已匯出目前建議。ICS 是單次匯入，不會持續同步。";
});

$("undo").onclick = safe(() => {
  state = store.undo();
  revision = state.revision;
  syncSettings();
  render();
  tick();
  $("status").textContent = "已復原上一項修改。";
});
$("redo").onclick = safe(() => {
  state = store.redo();
  revision = state.revision;
  syncSettings();
  render();
  tick();
  $("status").textContent = "已重做。";
});
const calculatorLabels = {
  pert: ["樂觀時間（小時）", "最可能時間（小時）", "悲觀時間（小時）"],
  video: ["影片長度（分鐘）", "播放倍速", "理解與練習（分鐘）"],
  quiz: ["題數", "每題作答（分鐘）", "訂正總時間（分鐘）"],
  saving: ["使用次數", "每次節省（分鐘）", "建置與維護（分鐘）"],
};
$("calc-type").onchange = () => {
  calculatorLabels[$("calc-type").value].forEach(
    (text, i) =>
      ($("calc-" + ["a", "b", "c"][i] + "-label").textContent = text),
  );
  $("calc-result").textContent = "";
};

function syncSettings() {
  state.days.forEach((d, i) => {
    document.querySelector(`[name="day-${i}-windows"]`).value = d.windows
      .map((w) => w.start + "-" + w.end)
      .join(",");
    document.querySelector(`[name="day-${i}-hours"]`).value = d.hours;
  });
  for (const k of ["limit", "buffer", "focus", "rest", "minBlock"])
    document.querySelector(`[name=${k}]`).value = state.settings[k];
}
