import {
  freshHub,
  hubMoney,
  hubFinance,
  hubDecisionRows,
  parseHubCommand,
} from "../規劃核心/lifestyle.mjs";

export function mountLifestyle({ getState, commit, getPlan, getDates }) {
  const doc = document,
    by = (id) => doc.getElementById(id),
    money = (n) =>
      new Intl.NumberFormat("zh-TW", {
        style: "currency",
        currency: "TWD",
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(n / 100);
  const todayDate = () =>
    new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
  const hub = () => getState().hub || freshHub();
  let moneyHydration = null,
    resourceHydration = null;
  function hydrate(form, values, previous) {
    const next = { ...previous };
    for (const [key, value] of Object.entries(values)) {
      const text = String(value);
      if (
        !previous ||
        form.elements[key].value === previous[key] ||
        form.elements[key].value === text
      ) {
        form.elements[key].value = text;
        next[key] = text;
      }
    }
    return next;
  }
  const make = (tag, text, cls) => {
    const e = doc.createElement(tag);
    if (text !== undefined) e.textContent = text;
    if (cls) e.className = cls;
    return e;
  };
  const button = (text, fn) => {
    const e = make("button", text);
    e.type = "button";
    e.onclick = guard(fn);
    return e;
  };
  const guard =
    (fn) =>
    (...args) => {
      try {
        by("hub-status").textContent = "";
        fn(...args);
      } catch (error) {
        by("hub-status").textContent = error.message;
      }
    };
  function persist(next) {
    const candidate = structuredClone(next),
      tasks = candidate.tasks;
    if (candidate.hub)
      for (const row of candidate.hub.decisions)
        if (tasks.find((t) => t.id === row.taskId)?.done) row.pool = "done";
    commit(candidate);
  }
  function updateHub(change) {
    const next = structuredClone(getState());
    next.hub = change(structuredClone(hub()));
    persist(next);
  }
  const fval = (form, name) => form.elements[name].value;
  const number = (form, name) => Number(fval(form, name));
  const uid = () => crypto.randomUUID();
  function appendRecord(key, row) {
    if (key === "health" && row.date > todayDate())
      throw Error("活動紀錄只能填已發生的日期；未來運動請加入行程");
    updateHub((h) => {
      h[key].push({ id: uid(), ...row });
      return h;
    });
  }
  function addDecision(input) {
    const next = structuredClone(getState());
    next.hub = structuredClone(hub());
    for (const row of next.hub.decisions)
      if (next.tasks.find((t) => t.id === row.taskId)?.done) row.pool = "done";
    const taskId = uid(),
      row = {
        id: uid(),
        taskId,
        title: String(input.title).trim(),
        pool: input.pool,
        hours: Number(input.hours),
        cents: hubMoney(input.cost || "0"),
        importance: Number(input.importance),
        urgency: Number(input.urgency),
        deadline: input.deadline || "",
      };
    next.hub.decisions.push(row);
    next.tasks.push({
      id: taskId,
      title: row.title,
      remaining: row.hours * 60,
      deadline: row.deadline,
      priority: row.importance >= 4 ? 3 : row.importance >= 2 ? 2 : 1,
      outcome: "",
      depends: "",
      goal: "",
      active: row.pool === "doing",
      done: false,
    });
    persist(next);
  }
  function applyCommand(obj) {
    if (obj.kind === "cal") {
      const next = structuredClone(getState()),
        eventId = uid();
      next.events.push({
        id: eventId,
        title: String(obj.title || "").trim(),
        date: obj.date,
        start: obj.start,
        end: obj.end,
        category: obj.category || "personal",
      });
      const cents = hubMoney(obj.cost || "0");
      if (cents) {
        next.hub = structuredClone(hub());
        next.hub.transactions.push({
          id: uid(),
          date: obj.date,
          type: "expense",
          status: "planned",
          cents,
          category: "行程費用",
          note: obj.title,
          eventId,
        });
      }
      persist(next);
    } else if (obj.kind === "fin")
      appendRecord("transactions", {
        date: obj.date,
        type: obj.type,
        status: obj.status || "actual",
        cents: hubMoney(obj.amount),
        category: String(obj.category || "其他").trim(),
        note: String(obj.note || ""),
      });
    else if (obj.kind === "task") addDecision(obj);
    else if (obj.kind === "fit")
      appendRecord("health", {
        date: obj.date,
        kind: obj.activity,
        minutes: Number(obj.minutes),
        sleep: Number(obj.sleep || 0),
        fatigue: Number(obj.fatigue || 3),
        note: String(obj.note || ""),
      });
  }
  let pendingCommand = null;
  by("command-preview").onclick = guard(() => {
    pendingCommand = null;
    by("command-apply").disabled = true;
    pendingCommand = parseHubCommand(by("hub-command").value, todayDate());
    by("command-result").textContent = JSON.stringify(pendingCommand, null, 2);
    by("command-apply").disabled = false;
  });
  by("hub-command").oninput = () => {
    pendingCommand = null;
    by("command-apply").disabled = true;
    by("command-result").textContent = "內容已修改，請重新預覽";
  };
  by("command-apply").onclick = guard(() => {
    if (!pendingCommand) throw Error("請先預覽");
    applyCommand(pendingCommand);
    pendingCommand = null;
    by("command-apply").disabled = true;
    by("command-result").textContent = "已加入並保存";
  });
  doc.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      by("hub-command").focus();
      by("hub-command").scrollIntoView?.({
        behavior: "smooth",
        block: "center",
      });
    }
  });
  by("money-settings").onsubmit = guard((e) => {
    e.preventDefault();
    const f = e.target;
    updateHub((h) => ({
      ...h,
      opening: hubMoney(fval(f, "opening")),
      reserve: hubMoney(fval(f, "reserve")),
      budgets: {
        ...(h.budgets || {}),
        [getDates()[0] + "/" + getDates().at(-1)]: hubMoney(fval(f, "budget")),
      },
    }));
    by("hub-status").textContent =
      "財務設定已保存；期初餘額應為記帳開始前的金額";
  });
  by("money-form").onsubmit = guard((e) => {
    e.preventDefault();
    const f = e.target;
    appendRecord("transactions", {
      date: fval(f, "date"),
      type: fval(f, "type"),
      status: fval(f, "status"),
      cents: hubMoney(fval(f, "amount")),
      category: fval(f, "category").trim(),
      note: fval(f, "note").trim(),
    });
    f.elements.amount.value = "";
    f.elements.note.value = "";
  });
  by("resource-form").onsubmit = guard((e) => {
    e.preventDefault();
    updateHub((h) => ({
      ...h,
      resources: fval(e.target, "resources"),
      wipLimit: number(e.target, "wipLimit"),
    }));
  });
  by("decision-form").onsubmit = guard((e) => {
    e.preventDefault();
    const f = e.target;
    addDecision({
      title: fval(f, "title"),
      pool: fval(f, "pool"),
      hours: fval(f, "hours"),
      cost: fval(f, "cost"),
      importance: fval(f, "importance"),
      urgency: fval(f, "urgency"),
      deadline: fval(f, "deadline"),
    });
    f.elements.title.value = "";
  });
  by("health-form").onsubmit = guard((e) => {
    e.preventDefault();
    const f = e.target;
    appendRecord("health", {
      date: fval(f, "date"),
      kind: fval(f, "kind"),
      minutes: number(f, "minutes"),
      sleep: number(f, "sleep"),
      fatigue: number(f, "fatigue"),
      note: fval(f, "note").trim(),
    });
    f.elements.note.value = "";
  });
  for (const id of ["money-form", "health-form"])
    by(id).elements.date.value = todayDate();
  for (const id of [
    "time-chart-kind",
    "money-chart-kind",
    "decision-chart-kind",
    "health-chart-kind",
  ])
    by(id).onchange = guard(renderHub);
  for (const b of doc.querySelectorAll("[data-hub-jump]"))
    b.onclick = () =>
      by(b.dataset.hubJump).scrollIntoView?.({
        behavior: "smooth",
        block: "start",
      });

  function chart(container, rows, kind, unit = "") {
    container.replaceChildren();
    const data = rows.filter((r) => Number.isFinite(r.value));
    if (!data.length || data.every((r) => r.value === 0)) {
      container.append(make("p", "此範圍尚無可分析的數據。"));
      return;
    }
    const max = Math.max(1, ...data.map((r) => Math.abs(r.value))),
      table = make("table", undefined, "hub-table"),
      head = make("tr");
    head.append(make("th", "項目"), make("th", "數值" + unit));
    table.append(head);
    const fmt = (v) =>
      unit === "元" ? money(v) : `${Math.round(v * 10) / 10}${unit}`;
    for (const row of data) {
      const tr = make("tr");
      tr.append(make("td", row.label), make("td", fmt(row.value)));
      table.append(tr);
    }
    if (kind === "table") {
      container.append(table);
      return;
    }
    if (kind === "bars" || kind === "heat") {
      const group = make(
        "div",
        undefined,
        kind === "heat" ? "hub-heat" : "hub-bars",
      );
      for (const row of data) {
        const item = make("div", undefined, "hub-chart-row");
        item.append(make("span", row.label), make("strong", fmt(row.value)));
        const track = make("div", undefined, "hub-track"),
          fill = make("span");
        fill.style.width = (Math.abs(row.value) / max) * 100 + "%";
        fill.style.background = row.value < 0 ? "#ae4c51" : "#347a68";
        track.append(fill);
        item.append(track);
        if (kind === "heat")
          item.style.background = `rgba(52,122,104,${0.06 + (0.2 * Math.abs(row.value)) / max})`;
        group.append(item);
      }
      container.append(group);
    } else if (kind === "donut") {
      const positive = data.filter((r) => r.value > 0),
        total = positive.reduce((n, r) => n + r.value, 0);
      if (total === 0) {
        container.append(make("p", "沒有可呈現比例的正數資料。"));
      } else {
        let at = 0;
        const colors = ["#347a68", "#668cb2", "#bc9154", "#9881a8", "#b86975"];
        const ring = make("div", undefined, "hub-donut");
        ring.style.background =
          "conic-gradient(" +
          positive
            .map((r, i) => {
              const end = at + (r.value / total) * 360,
                s = `${colors[i % colors.length]} ${at}deg ${end}deg`;
              at = end;
              return s;
            })
            .join(",") +
          ")";
        ring.setAttribute("role", "img");
        ring.setAttribute(
          "aria-label",
          positive.map((r) => `${r.label} ${fmt(r.value)}`).join("，"),
        );
        container.append(ring);
      }
    } else if (kind === "line") {
      const svg = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 600 180");
      svg.setAttribute("role", "img");
      svg.setAttribute("aria-label", "依明細順序的數值趨勢");
      const low = Math.min(0, ...data.map((r) => r.value)),
        high = Math.max(1, ...data.map((r) => r.value)),
        span = high - low;
      const axis = doc.createElementNS(svg.namespaceURI, "line");
      axis.setAttribute("x1", "20");
      axis.setAttribute("x2", "580");
      axis.setAttribute("y1", String(160 - ((0 - low) / span) * 140));
      axis.setAttribute("y2", axis.getAttribute("y1"));
      axis.setAttribute("stroke", "#a6b9ae");
      svg.append(axis);
      const path = doc.createElementNS(svg.namespaceURI, "polyline");
      path.setAttribute(
        "points",
        data
          .map(
            (r, i) =>
              `${20 + (i / Math.max(1, data.length - 1)) * 560},${160 - ((r.value - low) / span) * 140}`,
          )
          .join(" "),
      );
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", "#347a68");
      path.setAttribute("stroke-width", "3");
      svg.append(path);
      container.append(svg);
    }
    const details = make("details");
    details.append(make("summary", "查看數字明細"), table);
    container.append(details);
  }
  function metric(container, label, value) {
    const e = make("article", undefined, "metric");
    e.append(make("span", label), make("strong", value));
    container.append(e);
  }
  const kindLabels = {
    walk: "散步",
    run: "跑步",
    strength: "肌力",
    stretch: "伸展",
    rest: "恢復",
  };
  function renderHub() {
    const h = hub(),
      dates = getDates(),
      dateSet = new Set(dates),
      asOf = todayDate(),
      p = getPlan(),
      financial = hubFinance(h, asOf, dates),
      decisions = hubDecisionRows(h, getState().tasks);
    by("hub-summary").textContent =
      `目前餘額 ${money(financial.balance)} · 選定範圍可排 ${(p.capacity / 60).toFixed(1)} 小時 · 進行中 ${decisions.filter((r) => r.pool === "doing").length}/${h.wipLimit} 件`;
    moneyHydration = hydrate(
      by("money-settings"),
      {
        opening: h.opening / 100,
        reserve: h.reserve / 100,
        budget: (h.budgets?.[dates[0] + "/" + dates.at(-1)] || 0) / 100,
      },
      moneyHydration,
    );
    resourceHydration = hydrate(
      by("resource-form"),
      { resources: h.resources, wipLimit: h.wipLimit },
      resourceHydration,
    );
    by("money-metrics").replaceChildren();
    for (const [label, value] of [
      ["截至今天實際餘額", financial.balance],
      ["扣除儲備及本期承諾費用", financial.available],
      ["本期實際支出", financial.expense],
      ["本期預算剩餘", financial.budgetRemaining],
    ])
      metric(by("money-metrics"), label, money(value));
    const low = financial.forecast.find((r) => r.value < h.reserve);
    by("money-warning").textContent = [
      financial.overdue.length
        ? `${financial.overdue.length}筆預定收支已過期，請核對是否支付或取消。`
        : "",
      low ? `${low.date}預測餘額低於儲備金。` : "",
      "預定收入仍有不確定性；儲備金與承諾費用應分開設定。",
    ].join(" ");
    const mk = by("money-chart-kind").value;
    chart(
      by("money-chart"),
      mk === "donut" || mk === "bars"
        ? financial.categories
        : financial.forecast.map((r) => ({ label: r.date, value: r.value })),
      mk,
      "元",
    );
    by("money-list").replaceChildren();
    for (const row of h.transactions
      .filter(
        (r) =>
          dateSet.has(r.date) || (r.status === "planned" && r.date <= asOf),
      )
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 100)) {
      const item = make("div", undefined, "hub-record");
      item.append(
        make(
          "span",
          `${row.date} · ${row.status === "planned" ? "預定" : "實際"} · ${row.category} ${row.type === "income" ? "+" : "−"}${money(row.cents)} ${row.note}${row.eventId && row.status === "planned" && !getState().events.some((e) => e.id === row.eventId) ? " · 原行程已刪除，請核對費用" : ""}`,
        ),
      );
      if (row.status === "planned")
        item.append(
          button("今天已收／付", () =>
            updateHub((x) => {
              const r = x.transactions.find((t) => t.id === row.id);
              r.status = "actual";
              r.date = todayDate();
              return x;
            }),
          ),
        );
      item.append(
        button(row.status === "planned" ? "取消" : "刪除", () => {
          if (confirm("移除此收支紀錄？"))
            updateHub((x) => ({
              ...x,
              transactions: x.transactions.filter((t) => t.id !== row.id),
            }));
        }),
      );
      by("money-list").append(item);
    }
    by("decision-list").replaceChildren();
    for (const [pool, title] of [
      ["must", "一定要做"],
      ["want", "想做"],
      ["doing", "正在做"],
      ["done", "已完成"],
    ]) {
      const col = make("div", undefined, "hub-pool");
      col.append(make("h3", title));
      for (const row of decisions.filter((r) => r.pool === pool)) {
        const item = make("div", undefined, "hub-record");
        item.append(
          make(
            "span",
            `${row.title} · ${row.hours}h · ${money(row.cents)} · ${row.deadline || "期限待確認"}`,
          ),
        );
        for (const [target, label] of pool === "done"
          ? [["want", "重新開啟"]]
          : pool === "doing"
            ? [
                ["want", "暫停"],
                ["done", "確認完成"],
              ]
            : [["doing", "開始推進"]])
          item.append(
            button(label, () => {
              const next = structuredClone(getState());
              next.hub = structuredClone(hub());
              const d = next.hub.decisions.find((r) => r.id === row.id),
                t = next.tasks.find((t) => t.id === row.taskId);
              if (!t) throw Error("关联任務已刪除，請移除此決策後重新新增");
              if (next.timer?.task === t.id && target === "done")
                throw Error("請先結束這件工作的計時");
              for (const x of next.hub.decisions)
                if (next.tasks.find((t) => t.id === x.taskId)?.done)
                  x.pool = "done";
              d.pool = target;
              t.active = target === "doing";
              t.done = target === "done";
              if (target === "doing" && t.remaining === 0)
                throw Error("請先在任務區修正剩餘估時");
              persist(next);
            }),
          );
        item.append(
          button("移除決策", () => {
            if (confirm("移除此決策？已建立的任務仍保留在任務區。"))
              updateHub((x) => ({
                ...x,
                decisions: x.decisions.filter((r) => r.id !== row.id),
              }));
          }),
        );
        col.append(item);
      }
      by("decision-list").append(col);
    }
    const doing = decisions.filter((r) => r.pool === "doing"),
      required = doing.reduce(
        (n, r) =>
          n +
          (getState().tasks.find((t) => t.id === r.taskId)?.remaining || 0) /
            60,
        0,
      ),
      cost = doing.reduce((n, r) => n + r.cents, 0);
    by("resource-summary").textContent =
      `進行中剩餘估時 ${required.toFixed(1)}h / 本期容量 ${(p.capacity / 60).toFixed(1)}h；預估成本 ${money(cost)}。${required * 60 > p.capacity ? "時間不足，先縮小或暫停工作。" : ""}${cost > Math.max(0, financial.available) ? "預估成本超過自由可用金額。" : ""} 評分只是你設定的優先順序，並非客觀結論。`;
    const dk = by("decision-chart-kind").value;
    chart(
      by("decision-chart"),
      dk === "donut"
        ? ["must", "want", "doing", "done"].map((pool, i) => ({
            label: ["必做", "想做", "進行中", "完成"][i],
            value: decisions.filter((r) => r.pool === pool).length,
          }))
        : decisions
            .filter((r) => r.pool !== "done")
            .sort((a, b) => b.score - a.score)
            .map((r) => ({
              label: r.title,
              value: dk === "heat" ? r.hours : r.score,
            })),
      dk,
      dk === "heat" ? "h" : "",
    );
    const health = h.health.filter((r) => dateSet.has(r.date)),
      hk = by("health-chart-kind").value;
    const daily = new Map();
    for (const row of health)
      daily.set(
        row.date,
        (daily.get(row.date) || 0) + (row.kind === "rest" ? 0 : row.minutes),
      );
    const hs =
      hk === "donut"
        ? Object.entries(kindLabels).map(([key, label]) => ({
            label,
            value: health
              .filter((r) => r.kind === key && key !== "rest")
              .reduce((n, r) => n + r.minutes, 0),
          }))
        : hk === "line"
          ? [
              ...new Map(
                health.filter((r) => r.sleep > 0).map((r) => [r.date, r]),
              ).values(),
            ]
              .sort((a, b) => a.date.localeCompare(b.date))
              .map((r) => ({ label: r.date, value: r.sleep }))
          : [...daily]
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([label, value]) => ({ label, value }));
    chart(by("health-chart"), hs, hk, hk === "line" ? "h" : "分鐘");
    const tired = health.some((r) => r.date === asOf && r.fatigue >= 4);
    by("health-summary").textContent =
      `本期記錄 ${health.length} 筆；活動 ${[...daily.values()].reduce((n, v) => n + v, 0)} 分鐘。${tired ? "今天有較疲勞的紀錄，可以縮小工作與運動安排。" : ""} 未記錄代表未知；沒有精力加分或健康診斷。`;
    by("health-list").replaceChildren();
    for (const row of health
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 50)) {
      const item = make("div", undefined, "hub-record");
      item.append(
        make(
          "span",
          `${row.date} · ${kindLabels[row.kind]} ${row.minutes}分鐘 · 睡眠${row.sleep}h · 疲勞${row.fatigue}/5 · ${row.note}`,
        ),
        button("刪除", () => {
          if (confirm("刪除此活動紀錄？"))
            updateHub((x) => ({
              ...x,
              health: x.health.filter((r) => r.id !== row.id),
            }));
        }),
      );
      by("health-list").append(item);
    }
    const classifications = new Map(),
      classNames = {
        study: "學習",
        work: "報告／工作",
        exercise: "運動",
        personal: "生活",
      };
    for (const d of p.days)
      for (const b of d.blocks) {
        const category =
          getState().tasks.find((t) => t.id === b.id)?.category || "study";
        classifications.set(
          category,
          (classifications.get(category) || 0) + (b.end - b.start) / 60,
        );
      }
    const tk = by("time-chart-kind").value;
    const logs = getState().logs.filter((r) => dateSet.has(r.date)),
      timeRows =
        tk === "donut"
          ? [...classifications].map(([category, value]) => ({
              label: classNames[category] || category,
              value,
            }))
          : tk === "line"
            ? dates.map((date) => ({
                label: date,
                value:
                  logs
                    .filter((r) => r.date === date)
                    .reduce((n, r) => n + r.minutes, 0) / 60,
              }))
            : p.days.map((d) => ({ label: d.date, value: d.used / 60 }));
    chart(by("time-chart"), timeRows, tk, "h");
  }
  renderHub();
  return { render: renderHub };
}
