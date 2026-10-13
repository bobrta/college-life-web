import { createCalendarViews } from "./calendar-views.mjs";
import { createCalendarCharts } from "./calendar-charts.mjs";
import {
  eventsOn,
  parseSchedule,
  excludeOccurrence,
  detachOccurrence,
  weekDates,
} from "./calendar.mjs";
import { calendarDate, minutes } from "./calendar-schema.mjs";
import {
  defaultCalendarPlan,
  validateCalendarPlan,
  periodDates,
  shiftDate,
  shiftPeriod,
  activeEvents,
  daySummary,
  weekPlan,
  summarize,
  proposalImpact,
  updateSeries,
  generateStudyTemplate,
} from "./calendar-planning.mjs";
const $ = (id) => document.getElementById(id);
const create = (tag, text, cls) => {
  const x = document.createElement(tag);
  if (text !== undefined) x.textContent = text;
  if (cls) x.className = cls;
  return x;
};
const button = (text, action, cls = "secondary") => {
  const x = create("button", text, cls);
  x.type = "button";
  x.onclick = action;
  return x;
};
const stableKey = (text) => {
  let hash = 2166136261;
  for (const char of text)
    hash = Math.imul(hash ^ char.codePointAt(0), 16777619);
  return (hash >>> 0).toString(36);
};
const hours = (n) =>
  (n / 60).toLocaleString("zh-TW", { maximumFractionDigits: 1 });
const labels = {
  course: "上課",
  study: "學習",
  rest: "休息",
  deadline: "截止／考試",
  personal: "生活",
};
const today = () =>
  new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
const safe = (fn) => () => {
  try {
    fn();
  } catch (e) {
    $("calendar-status").textContent = e.message;
  }
};
function openDialog(dialog) {
  if (!dialog.open) dialog.showModal();
}
function field(label, id, type = "text", max) {
  const l = create("label", label),
    input = create(type === "textarea" ? "textarea" : "input");
  input.id = id;
  if (type !== "textarea") input.type = type;
  if (max) input.maxLength = max;
  l.append(input);
  return l;
}
function selectField(label, id, options) {
  const l = create("label", label),
    s = create("select");
  s.id = id;
  for (const [v, t] of options) {
    const o = create("option", t);
    o.value = v;
    s.append(o);
  }
  l.append(s);
  return l;
}
function heading(text, sub) {
  const x = create("div", undefined, "cal-section-heading");
  x.append(create("h3", text));
  if (sub) x.append(create("p", sub));
  return x;
}
export function mountCalendarWorkbench(api) {
  const page = $("calendar"),
    panel = page.querySelector(".panel");
  page.classList.add("cal-workbench");
  let view = window.matchMedia?.("(max-width:700px)").matches ? "day" : "week",
    layout = "panorama",
    editing = null,
    previousFocus = null,
    currentSummary = null;
  let plan;
  try {
    plan = validateCalendarPlan(
      api.getState().calendarPlan ?? defaultCalendarPlan(),
    );
  } catch (e) {
    plan = defaultCalendarPlan();
    $("calendar-status").textContent =
      "原日曆設定無法讀取：" + e.message + "。請先匯出備份，再重設日曆設定。";
  }
  let planInvalid =
    api.getState().calendarPlan !== undefined &&
    !(() => {
      try {
        validateCalendarPlan(api.getState().calendarPlan);
        return true;
      } catch {
        return false;
      }
    })();
  const getPlan = () => {
    try {
      return validateCalendarPlan(api.getState().calendarPlan ?? plan);
    } catch {
      return plan;
    }
  };
  const transact = (changes) => api.commit(changes);
  // Reuse original controls and IDs; existing import/export actions remain accessible.
  const oldToolbar = panel.querySelector(".toolbar");
  const tools = create("details", undefined, "cal-more");
  tools.id = "calendar-more";
  tools.append(create("summary", "更多 · 匯入與匯出"));
  const toolsContent = create("div", undefined, "cal-more-content");
  tools.append(toolsContent);
  const navigation = create("div", undefined, "cal-navigation");
  const paging = create("div", undefined, "cal-period-controls");
  navigation.append(paging);
  panel.prepend(navigation);
  paging.append(
    $("prev-week"),
    $("calendar-range"),
    $("next-week"),
    $("calendar-today"),
  );
  $("prev-week").onclick = safe(() =>
    api.setDate(
      shiftPeriod(api.getDate(), view === "semester" ? "week" : view, -1),
    ),
  );
  $("next-week").onclick = safe(() =>
    api.setDate(
      shiftPeriod(api.getDate(), view === "semester" ? "week" : view, 1),
    ),
  );
  $("calendar-today").textContent = "今天";
  $("calendar-today").onclick = () => api.setDate(today());
  $("prev-week").setAttribute("aria-label", "上一期");
  $("next-week").setAttribute("aria-label", "下一期");
  const switcher = create("div", undefined, "segmented");
  switcher.setAttribute("role", "group");
  switcher.setAttribute("aria-label", "日曆檢視");
  for (const [key, text] of [
    ["day", "日"],
    ["week", "週"],
    ["month", "月"],
    ["quarter", "季"],
    ["year", "年"],
  ]) {
    const b = button(text, () => {
      view = key;
      render();
    });
    b.dataset.view = key;
    switcher.append(b);
  }
  const actions = create("div", undefined, "cal-actions");
  actions.append(
    button("＋ 新增", () => openEditor(null, api.getDate()), "primary"),
    tools,
  );
  navigation.append(paging, switcher, actions);
  panel.prepend(navigation);
  oldToolbar.classList.add("cal-utility-grid");
  toolsContent.append(oldToolbar, $("schedule-json-editor"));
  toolsContent.prepend(field("跳到日期", "calendar-jump", "date"));
  $("calendar-jump").onchange = safe(() => {
    if (!calendarDate($("calendar-jump").value)) throw Error("請選有效日期。");
    api.setDate($("calendar-jump").value);
  });
  toolsContent.append(
    button("查看已取消行程", () => {
      const cancelled = api
        .getState()
        .events.filter((e) => e.status === "cancelled");
      if (!cancelled.length) {
        $("calendar-status").textContent = "沒有已取消的行程。";
        return;
      }
      canvas.replaceChildren(
        heading("已取消行程", "不計入排程與時數，可點選恢復。"),
      );
      for (const e of cancelled) canvas.append(card(e, e.date ?? e.from));
      tools.open = false;
    }),
    button("查看完整學期", () => {
      view = "semester";
      tools.open = false;
      render();
    }),
    button(
      "匯出日曆 JSON",
      safe(() =>
        api.download(
          "日曆行程.json",
          JSON.stringify(
            {
              timezone: "Asia/Taipei",
              events: api.getState().events,
              weeks: api.getSchedule()?.weeks ?? [],
              calendarPlan: getPlan(),
            },
            null,
            2,
          ),
          "application/json",
        ),
      ),
    ),
    button("套用學習模板", () => {
      tools.open = false;
      openDialog(templateDialog);
    }),
    button("編輯時段與科目讀法", () => {
      tools.open = false;
      openSettings();
    }),
  );
  if(api.downloadOriginal)toolsContent.append(button('下載原始本機資料',safe(api.downloadOriginal)));
  const printFormat = selectField("PDF 版型", "calendar-print-format", [
    ["panorama", "全景作息表"],
    ["detail", "行程明細"],
  ]);
  oldToolbar.append(printFormat);
  for (const [value, label] of [
    ["quarter", "該季"],
    ["year", "該年"],
  ]) {
    const o = create("option", label);
    o.value = value;
    $("print-range").append(o);
  }
  const quickPrint = button("匯出目前範圍 PDF", () => {
    const mode = view === "day" ? "week" : view;
    $("print-range").value = mode;
    $("report-date").value = api.getDate();
    $("print-range").onchange();
    $("print-calendar").click();
  });
  toolsContent.append(quickPrint);
  const intro = panel.querySelector("#week-note");
  intro.classList.add("cal-week-note");
  const privacy = intro.nextElementSibling;
  if (privacy?.tagName === "P") {
    privacy.className = "cal-footnote";
    toolsContent.append(privacy);
  }
  const guide = panel.querySelector(".planning-guide");
  if (guide) toolsContent.append(guide);
  const summary = create("section", undefined, "cal-overview");
  summary.setAttribute("aria-label", "本週計畫與負荷");
  navigation.after(summary);
  const warnings = create("details", undefined, "cal-warnings");
  warnings.append(create("summary"));
  const warningBody = create("div");
  warnings.append(warningBody);
  summary.after(warnings);
  const layoutBar = create("div", undefined, "cal-layout-bar");
  const layoutSelect = selectField("週表版型", "calendar-layout", [
    ["panorama", "全景大格子"],
    ["timeline", "精細時間軸"],
  ]);
  layoutBar.append(layoutSelect);
  warnings.after(layoutBar);
  $("calendar-layout").onchange = () => {
    layout = $("calendar-layout").value;
    render();
  };
  const calendarScroll = panel.querySelector(".calendar-scroll");
  const canvas = $("week-grid");
  const analyses = panel.querySelector(".load-chart-section");
  analyses.className = "cal-analysis";
  analyses.replaceChildren();
  const analysisHeader = create("div", undefined, "cal-analysis-heading");
  analysisHeader.append(
    heading("時間分析", "排定與實際分開；休息不計入學習時數。"),
    selectField("圖表", "calendar-chart-kind", [
      ["bars", "每日分類時數"],
      ["donut", "時間分配"],
      ["trend", "目標與實際趨勢"],
      ["heatmap", "學習時段熱圖"],
    ]),
  );
  analyses.append(analysisHeader);
  const chart = create("div", undefined, "cal-chart");
  chart.id = "calendar-load-chart";
  analyses.append(chart);
  $("calendar-chart-kind").onchange = () => renderChart();
  const detailSummary = create("details", undefined, "cal-fold");
  detailSummary.append(create("summary", "每日清單、必做與彈性事項"));
  const dailyList = create("div", undefined, "cal-daily-list");
  detailSummary.append(dailyList);
  calendarScroll.after(detailSummary);
  const methods = create("details", undefined, "cal-fold");
  methods.append(create("summary", "科目讀法與本週回顧"));
  const methodsBody = create("div");
  methods.append(methodsBody);
  analyses.after(methods);
  // Event editor is a native modal drawer. No route changes or always-visible long form.
  const eventPanel = $("event-form").closest(".panel");
  const editor = create("dialog", undefined, "cal-editor");
  editor.id = "calendar-editor";
  editor.setAttribute("aria-labelledby", "cal-editor-heading");
  const editorHeader = create("div", undefined, "cal-editor-header");
  const editorTitle = create("h2", "新增行程");
  editorTitle.id = "cal-editor-heading";
  editorHeader.append(
    editorTitle,
    button("關閉", () => closeEditor()),
  );
  editor.append(editorHeader);
  editor.append(eventPanel);
  page.append(editor);
  eventPanel.querySelector("h2").hidden = true;
  const form = $("event-form");
  form.className = "cal-editor-form";
  const extras = create("details", undefined, "cal-fold");
  extras.append(create("summary", "科目、成果與詳細設定"));
  const fields = create("div", undefined, "cal-fields");
  for (const [label, id, type, max] of [
    ["科目／主要事項", "event-subject", "text", 80],
    ["成果要求", "event-outcome", "text", 300],
    ["老師", "event-teacher", "text", 80],
    ["教室／地點", "event-room", "text", 120],
    ["學習方法", "event-method", "textarea", 1000],
    ["備註", "event-notes", "textarea", 2000],
  ])
    fields.append(field(label, id, type, max));
  fields.append(
    selectField("安排性質", "event-commitment", [
      ["flexible", "可調整"],
      ["fixed", "固定／保護時段"],
    ]),
    selectField("狀態", "event-status", [
      ["confirmed", "已確認"],
      ["draft", "待確認"],
      ["done", "已完成"],
      ["cancelled", "已取消"],
    ]),
    field("實際學習分鐘（此日）", "event-actual", "number"),
  );
  extras.append(fields);
  form.insertBefore(extras, form.querySelector("button"));
  $("event-date").required = true;
  $("event-title").required = true;
  $("event-actual").min = "0";
  $("event-actual").max = "1440";
  $("event-actual").step = "1";
  extras.append(fields);
  form.insertBefore(extras, form.querySelector("button"));
  const scope = selectField("修改範圍", "event-scope", [
    ["single", "只修改這一天"],
    ["series", "整個週期"],
  ]);
  form.prepend(scope);
  scope.hidden = true;
  $("event-scope").onchange = () => {
    const whole = $("event-scope").value === "series";
    const source = whole
      ? api.getState().events.find((e) => e.id === editing?._seriesId)
      : editing;
    if (!source) return;
    for (const key of [
      "title",
      "start",
      "end",
      "category",
      "subject",
      "outcome",
      "teacher",
      "room",
      "method",
      "notes",
    ])
      $("event-" + key).value = source[key] ?? "";
    $("event-date").value = whole ? source.from : editing._occurrenceDate;
    $("event-status").value = source.status ?? "confirmed";
    $("event-commitment").value = source.commitment ?? "flexible";
    $("event-repeat").disabled = !whole;
    $("event-repeat").checked = whole;
    $("event-until").parentElement.hidden = !whole;
    $("event-actual").disabled = whole;
    $("event-actual").value = whole ? "0" : String(editing?.actualMinutes ?? 0);
    renderPreview();
  };
  const preview = create("div", undefined, "cal-preview");
  preview.id = "calendar-impact";
  preview.setAttribute("role", "status");
  form.append(preview);
  const eventActions = create("div", undefined, "cal-editor-actions");
  eventActions.append(
    button("此行程 PDF", () => {
      if (!editing) return;
      api.print(editing.title, [
        ["日期", $("event-date").value],
        ["時間", `${editing.start || "全天"} ${editing.end || ""}`],
        ["成果", editing.outcome || ""],
        ["科目", editing.subject || ""],
        [
          "老師／教室",
          [editing.teacher, editing.room].filter(Boolean).join(" · "),
        ],
        ["方法", editing.method || ""],
        ["備註", editing.notes || ""],
      ]);
    }),
    button("複製成新行程", () => {
      if (!editing) return;
      const copy = { ...editing, id: undefined, _seriesId: undefined };
      openEditor(copy, $("event-date").value, true);
    }),
    button(
      "刪除這一天",
      safe(() => deleteEvent(false)),
      "cal-danger",
    ),
    button(
      "刪除整個週期",
      safe(() => deleteEvent(true)),
      "cal-danger",
    ),
  );
  form.append(eventActions);
  form.oninput = () => renderPreview();
  $("event-repeat").onchange = () => {
    const recurring = $("event-repeat").checked;
    const label = $("event-until").parentElement;
    label.hidden = !recurring;
    if (recurring && !$("event-until").value)
      $("event-until").value = api.getDate();
    renderPreview();
  };
  $("cancel-event-edit").textContent = "取消";
  $("cancel-event-edit").onclick = () => closeEditor();
  editor.addEventListener("cancel", () => {
    editing = null;
  });
  editor.addEventListener("close", () => {
    previousFocus?.focus?.();
  });
  form.onsubmit = (e) => {
    e.preventDefault();
    try {
      const candidate = readCandidate();
      let events;
      if (editing?._seriesId && $("event-scope").value === "single") {
        events = detachOccurrence(
          api.getState().events,
          editing._seriesId,
          editing._occurrenceDate ?? editing.date,
          candidate,
        );
      } else events = updateSeries(api.getState().events, candidate);
      // Preview every affected occurrence, rather than assuming the first day is safe.
      const dates = periodDates(candidate.date ?? candidate.from, "week");
      const impact = summarize(events, dates, getPlan());
      if (
        impact.conflictCount &&
        !confirm(`儲存後這週有 ${impact.conflictCount} 組重疊，仍要保存？`)
      )
        return;
      transact({ events });
      api.setDate(candidate.date ?? candidate.from);
      closeEditor();
      $("calendar-status").textContent =
        "已保存行程；實際完成時間依你的紀錄計算。";
    } catch (error) {
      $("event-form-status").textContent = error.message;
    }
  };
  function readCandidate() {
    const date = $("event-date").value,
      repeat = $("event-repeat").checked;
    const item = {
      id:
        editing && !editing._seriesId && editing.id
          ? editing.id
          : editing?._seriesId && $("event-scope").value === "series"
            ? editing._seriesId
            : crypto.randomUUID(),
      title: $("event-title").value,
      date,
      start: $("event-start").value,
      end: $("event-end").value,
      category: $("event-category").value,
      status: $("event-status").value,
      commitment: $("event-commitment").value,
      source: editing?.source ?? "自行新增",
      notes: $("event-notes").value,
    };
    for (const key of ["subject", "outcome", "teacher", "room", "method"])
      item[key] = $("event-" + key).value;
    const actual = $("event-actual").value;
    item.actualMinutes = actual === "" ? 0 : Number(actual);
    if (repeat) {
      item.weekday = new Date(date + "T12:00:00Z").getUTCDay();
      item.from = date;
      item.until = $("event-until").value;
      item.actualMinutes = 0;
      delete item.date;
    }
    return parseSchedule(JSON.stringify({ events: [item] })).events[0];
  }
  function renderPreview() {
    try {
      const candidate = readCandidate(),
        base =
          editing?._seriesId && $("event-scope").value === "single"
            ? excludeOccurrence(
                api.getState().events,
                editing._seriesId,
                editing._occurrenceDate,
              )
            : api.getState().events;
      const p = proposalImpact(
        base,
        candidate,
        getPlan(),
        editing?.id ?? editing?._seriesId,
      );
      preview.textContent =
        `占用 ${p.duration} 分鐘 · 當週學習容量剩 ${hours(p.remainingStudyMinutes)} 小時 · 當日主要事項 ${p.majorCount} 項` +
        (p.conflicts.length ? ` · ${p.conflicts.length} 處重疊` : "") +
        (p.restConflicts.length ? " · 占用休息，請先調整" : "");
    } catch (e) {
      preview.textContent = e.message;
    }
  }
  function closeEditor() {
    editor.close();
    editing = null;
  }
  function openEditor(item, date, newCopy = false) {
    if (item?.weekday !== undefined && !item._seriesId && !newCopy) {
      while (
        new Date(date + "T12:00:00Z").getUTCDay() !== item.weekday &&
        date <= item.until
      )
        date = shiftDate(date, 1);
      if (date > item.until) throw Error("此週期範圍內沒有可編輯日期。");
      item = {
        ...item,
        id: item.id + "@" + date,
        _seriesId: item.id,
        _occurrenceDate: date,
      };
    }
    previousFocus = document.activeElement;
    editing = newCopy ? null : item;
    form.reset();
    $("event-form-status").textContent = "";
    editorTitle.textContent = item && !newCopy ? "編輯行程" : "新增行程";
    $("event-title").value = item?.title ?? "";
    $("event-date").value = date;
    $("event-start").value = item?.start ?? "";
    $("event-end").value = item?.end ?? "";
    $("event-category").value = item?.category ?? "study";
    for (const key of [
      "subject",
      "outcome",
      "teacher",
      "room",
      "method",
      "notes",
    ])
      $("event-" + key).value = item?.[key] ?? "";
    $("event-commitment").value =
      item?.commitment ??
      (["course", "rest", "deadline"].includes(item?.category)
        ? "fixed"
        : "flexible");
    $("event-status").value = item?.status ?? "confirmed";
    $("event-actual").value = String(item?.actualMinutes ?? 0);
    $("event-actual").disabled = false;
    const series = !!item?._seriesId;
    scope.hidden = !series;
    $("event-scope").value = "single";
    $("event-repeat").checked = false;
    $("event-repeat").disabled = series;
    $("event-until").value = item?.until ?? date;
    $("event-until").parentElement.hidden = true;
    eventActions.hidden = !editing;
    eventActions.lastElementChild.hidden = !series;
    openDialog(editor);
    $("event-title").focus();
    renderPreview();
  }
  function deleteEvent(whole) {
    if (!editing) return;
    if (!confirm(whole ? "刪除整個週期及其例外？" : "刪除此日行程？")) return;
    let events = api.getState().events;
    if (editing._seriesId && !whole)
      events = excludeOccurrence(
        events,
        editing._seriesId,
        editing._occurrenceDate,
      );
    else
      events = events.filter((e) => e.id !== (editing._seriesId ?? editing.id));
    transact({ events });
    closeEditor();
    render();
  }
  // Weekly plan and review.
  const weeklyDialog = create("dialog", undefined, "cal-settings-dialog");
  weeklyDialog.setAttribute("aria-label", "本週計畫");
  const weeklyForm = create("form", undefined, "cal-fields");
  weeklyDialog.append(heading("本週計畫"), weeklyForm);
  page.append(weeklyDialog);
  weeklyForm.append(
    field("本週主題", "cal-week-title", "text", 120),
    field("本週重點（最多三行）", "cal-week-focus", "textarea", 600),
    selectField("本週模式", "cal-week-mode", [
      ["normal", "平時週"],
      ["exam", "考前週"],
      ["report", "報告週"],
      ["holiday", "假期"],
    ]),
    field("學習目標（淨小時）", "cal-week-target", "number"),
    field("學習容量上限（淨小時）", "cal-week-capacity", "number"),
    field("週回顧：成果、困難、下週調整", "cal-week-review", "textarea", 2000),
  );
  for (const id of ["cal-week-target", "cal-week-capacity"]) {
    $(id).min = "0";
    $(id).max = "168";
    $(id).step = "0.25";
  }
  const dailyTargets = create("div", undefined, "cal-daily-targets");
  for (let i = 0; i < 7; i++) {
    dailyTargets.append(
      field(
        "週" + ["一", "二", "三", "四", "五", "六", "日"][i] + "學習目標(h)",
        "cal-target-" + i,
        "number",
      ),
    );
  }
  weeklyForm.append(dailyTargets);
  for (let i = 0; i < 7; i++) {
    $("cal-target-" + i).min = "0";
    $("cal-target-" + i).max = "24";
    $("cal-target-" + i).step = "0.25";
  }
  const weeklyStatus = create("p");
  weeklyStatus.setAttribute("role", "status");
  weeklyForm.append(button("取消", () => weeklyDialog.close()));
  const weekSave = create("button", "保存本週計畫", "primary");
  weeklyForm.append(weekSave, weeklyStatus);
  weeklyForm.onsubmit = (e) => {
    e.preventDefault();
    try {
      const p = getPlan(),
        week = {
          title: $("cal-week-title").value,
          focus: $("cal-week-focus")
            .value.split("\n")
            .filter((x) => x.trim()),
          mode: $("cal-week-mode").value,
          targetHours: Number($("cal-week-target").value),
          capacityHours: Number($("cal-week-capacity").value),
          review: $("cal-week-review").value,
          dailyTargets: Array.from({ length: 7 }, (_, i) =>
            $("cal-target-" + i).value === ""
              ? null
              : Number($("cal-target-" + i).value),
          ),
        };
      const next = validateCalendarPlan({
        ...p,
        weekly: { ...p.weekly, [weekDates(api.getDate())[0]]: week },
      });
      if (
        planInvalid &&
        !confirm(
          "原日曆設定格式不正確。保存將以目前有效設定取代，請先保留備份。",
        )
      )
        return;
      transact({ calendarPlan: next });
      planInvalid = false;
      weeklyDialog.close();
      render();
    } catch (e) {
      weeklyStatus.textContent = e.message;
    }
  };
  function openWeek() {
    const w = weekPlan(getPlan(), api.getDate());
    $("cal-week-title").value = w.title;
    $("cal-week-focus").value = w.focus.join("\n");
    $("cal-week-mode").value = w.mode;
    $("cal-week-target").value = w.targetHours;
    $("cal-week-capacity").value = w.capacityHours;
    $("cal-week-review").value = w.review;
    for (let i = 0; i < 7; i++)
      $("cal-target-" + i).value = w.dailyTargets?.[i] ?? "";
    weeklyStatus.textContent = "";
    openDialog(weeklyDialog);
  }
  // Slot editor and subject methods use structured controls, no executable formulas.
  const settingsDialog = create("dialog", undefined, "cal-settings-dialog");
  settingsDialog.setAttribute("aria-label", "時段與讀法");
  const settingsForm = create("form", undefined, "cal-fields");
  const slotFields = create("div", undefined, "cal-slot-fields");
  settingsDialog.append(heading("時段與科目讀法"), settingsForm);
  page.append(settingsDialog);
  settingsForm.append(
    slotFields,
    field("每日主要事項上限", "cal-major-limit", "number"),
    field("科目名稱", "cal-method-subject", "text", 80),
    field("該科讀法／SOP", "cal-method-text", "textarea", 2000),
  );
  $("cal-major-limit").min = "1";
  $("cal-major-limit").max = "4";
  const settingStatus = create("p");
  settingStatus.setAttribute("role", "status");
  const settingSave = create("button", "保存設定", "primary");
  settingsForm.append(
    button("取消", () => settingsDialog.close()),
    settingSave,
    settingStatus,
  );
  settingsForm.onsubmit = (e) => {
    e.preventDefault();
    try {
      const p = getPlan(),
        slots = [...slotFields.children].map((row) => ({
          label: row.querySelector('[data-slot="label"]').value,
          start: row.querySelector('[data-slot="start"]').value,
          end: row.querySelector('[data-slot="end"]').value,
        })),
        subjects = { ...p.subjects };
      const subject = $("cal-method-subject").value.trim();
      if (subject) subjects[subject] = $("cal-method-text").value;
      const next = validateCalendarPlan({
        ...p,
        slots,
        subjects,
        dailyMajorLimit: Number($("cal-major-limit").value),
      });
      transact({ calendarPlan: next });
      planInvalid = false;
      settingsDialog.close();
      render();
    } catch (e) {
      settingStatus.textContent = e.message;
    }
  };
  function openSettings() {
    slotFields.replaceChildren();
    for (const [i, s] of getPlan().slots.entries()) {
      const row = create("div", undefined, "cal-slot-row");
      for (const key of ["label", "start", "end"]) {
        const l = field(
          key === "label" ? "時段名稱" : key === "start" ? "開始" : "結束",
          `cal-slot-${i}-${key}`,
        );
        const input = l.querySelector("input");
        input.value = s[key];
        input.dataset.slot = key;
        if (key !== "label") {
          input.placeholder = "HH:mm";
          input.pattern = "(?:[01][0-9]|2[0-3]):[0-5][0-9]|24:00";
        }
        row.append(l);
      }
      slotFields.append(row);
    }
    $("cal-major-limit").value = getPlan().dailyMajorLimit;
    $("cal-method-subject").value = "";
    $("cal-method-text").value = "";
    settingStatus.textContent = "最後結束請填24:00；時段需連續涵蓋全天。";
    openDialog(settingsDialog);
  }
  // Template staging. Stage first; explicit button applies the concrete proposal.
  const templateDialog = create("dialog", undefined, "cal-settings-dialog");
  templateDialog.setAttribute("aria-label", "學習模板");
  const templateForm = create("form", undefined, "cal-fields");
  templateDialog.append(
    heading("學習模板", "預留時間包含休息，淨學習另計。"),
    templateForm,
  );
  page.append(templateDialog);
  templateForm.append(
    field("起日", "cal-template-from", "date"),
    field("迄日", "cal-template-until", "date"),
    field("科目", "cal-template-subject", "text", 80),
    selectField("模式", "cal-template-mode", [
      ["normal", "正常週：每週5小時20分學習＋40分休息"],
      ["exam", "考前週：每週3小時學習＋20分休息"],
      ["report", "報告週：每週3小時學習＋20分休息"],
    ]),
  );
  $("cal-template-from").value = api.getDate();
  $("cal-template-until").value = shiftDate(api.getDate(), 27);
  $("cal-template-subject").value = "微積分";
  const templatePreview = create("div");
  templatePreview.setAttribute("role", "status");
  const applyTemplate = button(
    "確認加入預覽行程",
    safe(() => {
      if (!staged) throw Error("請先預覽模板。");
      const merged = new Map(api.getState().events.map((e) => [e.id, e]));
      for (const e of staged) merged.set(e.id, e);
      transact({
        events: parseSchedule(JSON.stringify({ events: [...merged.values()] }))
          .events,
      });
      staged = null;
      applyTemplate.disabled = true;
      templateDialog.close();
      render();
    }),
    "primary",
  );
  applyTemplate.disabled = true;
  let staged = null;
  const stageTemplate = create("button", "預覽時數與衝突", "primary");
  templateForm.append(
    stageTemplate,
    templatePreview,
    applyTemplate,
    button("取消", () => templateDialog.close()),
  );
  templateForm.oninput = () => {
    staged = null;
    applyTemplate.disabled = true;
    templatePreview.textContent = "資料已修改，請重新預覽。";
  };
  templateForm.onsubmit = (e) => {
    e.preventDefault();
    try {
      staged = generateStudyTemplate({
        from: $("cal-template-from").value,
        until: $("cal-template-until").value,
        subject: $("cal-template-subject").value,
        mode: $("cal-template-mode").value,
        prefix: "template-" + stableKey($("cal-template-subject").value.trim()),
      });
      const dates = [];
      for (
        let d = $("cal-template-from").value;
        d <= $("cal-template-until").value;
        d = shiftDate(d, 1)
      )
        dates.push(d);
      const map = new Map(api.getState().events.map((x) => [x.id, x]));
      for (const x of staged) map.set(x.id, x);
      const s = summarize(staged, dates, getPlan()),
        combined = summarize([...map.values()], dates, getPlan());
      templatePreview.textContent = `${staged.length} 段行程 · 學習 ${hours(s.totals.study)} 小時 · 休息 ${hours(s.totals.rest)} 小時 · 合併後 ${combined.conflictCount} 組衝突。相同模板ID會更新；其他原行程保留，請先處理重疊。`;
      applyTemplate.disabled = !staged.length;
    } catch (e) {
      staged = null;
      applyTemplate.disabled = true;
      templatePreview.textContent = e.message;
    }
  };
  function card(event, date) {
    const b = button(
      "",
      () => openEditor(event, date),
      "cal-event " + (event.category ?? "personal"),
    );
    b.dataset.eventId = event.id;
    b.append(
      create(
        "small",
        (event.start ? `${event.start}–${event.end}` : "全天提醒") +
          " · " +
          (event.commitment === "fixed"
            ? "固定"
            : event.commitment === "flexible"
              ? "彈性"
              : (labels[event.category] ?? "生活")),
      ),
      create("strong", event.title),
    );
    if (event.outcome) b.append(create("span", event.outcome, "cal-outcome"));
    if (event.teacher || event.room)
      b.append(
        create(
          "small",
          [event.teacher, event.room].filter(Boolean).join(" · "),
        ),
      );
    if (event.status === "draft")
      b.append(create("span", "待確認", "cal-badge"));
    if (event.status === "done")
      b.append(create("span", "✓ 已完成", "cal-badge"));
    return b;
  }
  function render() {
    const p = getPlan(),
      anchor = api.getDate();
    let dates;
    if (view === "semester") {
      const sch = api.getSchedule(),
        from = sch?.weeks?.[0]?.start || $("semester-start").value || anchor,
        to =
          sch?.weeks?.at(-1)?.end ||
          $("semester-end").value ||
          shiftDate(from, 125);
      if (
        !calendarDate(from) ||
        !calendarDate(to) ||
        to < from ||
        shiftDate(from, 365) < to
      ) {
        $("calendar-status").textContent = "學期日期不正確或超過一年。";
        return;
      }
      dates = [];
      for (let d = from; d <= to; d = shiftDate(d, 1)) dates.push(d);
    } else dates = periodDates(anchor, view);
    $("calendar-range").textContent =
      view === "year"
        ? anchor.slice(0, 4) + " 年"
        : view === "quarter"
          ? anchor.slice(0, 4) +
            " 年 第 " +
            (Math.floor((Number(anchor.slice(5, 7)) - 1) / 3) + 1) +
            " 季"
          : view === "month"
            ? anchor.slice(0, 7)
            : dates[0] + " — " + dates.at(-1);
    $("calendar-jump").value = anchor;
    $("report-date").value = anchor;
    for (const b of switcher.children) {
      const chosen = b.dataset.view === view;
      b.classList.toggle("selected", chosen);
      b.setAttribute("aria-pressed", String(chosen));
    }
    layoutBar.hidden = !["week", "day"].includes(view);
    intro.hidden = view !== "week";
    const schWeek = api
      .getSchedule()
      ?.weeks?.find((w) => w.start <= anchor && w.end >= anchor);
    intro.textContent = schWeek ? `${schWeek.title} · ${schWeek.focus}` : "";
    const w = weekPlan(p, anchor),
      ws = summarize(api.getState().events, weekDates(anchor), p);
    summary.replaceChildren();
    const top = create("div", undefined, "cal-overview-heading");
    top.append(create("div"));
    top.firstChild.append(
      create(
        "small",
        { normal: "平時週", exam: "考前週", report: "報告週", holiday: "假期" }[
          w.mode
        ],
      ),
      create("h2", w.title),
    );
    top.append(button("編輯本週", () => openWeek()));
    summary.append(top);
    const chips = create("div", undefined, "cal-focus-chips");
    for (const t of w.focus) chips.append(create("span", t));
    summary.append(chips);
    const metrics = create("div", undefined, "cal-metrics");
    for (const [label, value, sub] of [
      ["本週目標", w.targetHours + " h", "淨學習目標，可調整"],
      [
        "已排學習",
        hours(ws.scheduled) + " h",
        "休息另計 " + hours(ws.totals.rest) + " h",
      ],
      ["實際學習", hours(ws.actual) + " h", "逐日填寫的學習紀錄"],
      [
        "剩餘容量",
        hours(w.capacityHours * 60 - ws.scheduled) + " h",
        "本週上限 " + w.capacityHours + " h",
      ],
    ]) {
      const m = create("div");
      m.append(
        create("small", label),
        create("strong", value),
        create("small", sub),
      );
      metrics.append(m);
    }
    summary.append(metrics);
    warningBody.replaceChildren();
    const problems = [];
    for (const d of ws.days) {
      if (d.conflicts.length)
        problems.push(`${d.date} 有 ${d.conflicts.length} 組重疊`);
      if (d.overLimit)
        problems.push(
          `${d.date} 有 ${d.majorCount} 項主要事項，超過 ${p.dailyMajorLimit} 項`,
        );
      for (const [a, b] of d.conflicts) {
        const ea = d.entries.find((e) => e.id === a),
          eb = d.entries.find((e) => e.id === b);
        if (ea?.category === "rest" || eb?.category === "rest")
          problems.push(`${d.date} 休息被占用：${ea?.title}／${eb?.title}`);
      }
    }
    if (ws.scheduled > w.capacityHours * 60)
      problems.push("本週排定學習已超出容量，請先減少或移動事項。");
    warnings.hidden = !problems.length;
    warnings.firstElementChild.textContent = `本週有 ${problems.length} 項需要調整`;
    for (const text of problems) warningBody.append(create("p", text));
    canvas.replaceChildren();
    if (view === "week" || view === "day") renderPanoramaTable(canvas, dates);
    else if (view === "month") renderMonth(canvas, anchor);
    else renderLongPeriod(canvas, dates);
    calendarScroll.classList.toggle(
      "cal-long-view",
      ["quarter", "year", "semester"].includes(view),
    );
    currentSummary = summarize(api.getState().events, dates, p);
    dailyList.replaceChildren();
    const listDates = dates.length > 7 ? weekDates(anchor) : dates;
    for (const date of listDates) {
      const d = daySummary(api.getState().events, date, p.dailyMajorLimit),
        section = create("section");
      section.append(
        create("h4", date),
        create("p", `學習 ${hours(d.scheduled)} h · 實際 ${hours(d.actual)} h`),
      );
      for (const kind of ["fixed", "flexible"]) {
        section.append(
          create("small", kind === "fixed" ? "固定／必做" : "彈性／可調整"),
        );
        const entries = d.entries.filter(
          (e) =>
            (e.commitment ??
              (["course", "rest", "deadline"].includes(e.category)
                ? "fixed"
                : "flexible")) === kind,
        );
        for (const e of entries)
          section.append(
            button(
              (e.start ?? "全天") +
                " " +
                e.title +
                (e.outcome ? " · " + e.outcome : ""),
              () => openEditor(e, date),
              "cal-list-event",
            ),
          );
        if (!entries.length)
          section.append(create("p", "尚無事項", "cal-muted"));
      }
      dailyList.append(section);
    }
    methodsBody.replaceChildren();
    for (const [subject, method] of Object.entries(p.subjects)) {
      methodsBody.append(
        create("h4", subject),
        create("p", method, "cal-prewrap"),
      );
    }
    methodsBody.append(
      create("h4", "本週回顧"),
      create(
        "p",
        w.review || "本週完成了什麼？哪些安排太滿？下週要刪減或調整什麼？",
        "cal-prewrap",
      ),
      button("編輯回顧與重點", () => openWeek()),
    );
    renderChart();
  }
  function renderPrintable(container, dates) {
    container.replaceChildren(
      create("h1", "全景作息表"),
      create(
        "p",
        `${dates[0]} 至 ${dates.at(-1)} · Asia/Taipei · 排定與實際分開計算`,
      ),
    );
    for (let i = 0; i < dates.length; i += 7) {
      const subset = dates.slice(i, i + 7),
        section = create("section", undefined, "cal-print-week"),
        w = weekPlan(getPlan(), subset[0]),
        s = summarize(api.getState().events, subset, getPlan());
      section.append(
        create("h2", w.title),
        create("p", w.focus.join(" · ")),
        create(
          "p",
          `週目標 ${w.targetHours} h · 本頁排定 ${hours(s.scheduled)} h · 實際 ${hours(s.actual)} h · 休息 ${hours(s.totals.rest)} h`,
        ),
      );
      renderPanoramaTable(section, subset, { printing: true });
      const checklist = create("div", undefined, "cal-print-checklist");
      for (const d of subset) {
        const entries = activeEvents(api.getState().events, d).filter(
          (e) => e.commitment === "fixed" || e.outcome,
        );
        if (entries.length)
          checklist.append(
            create(
              "p",
              d +
                "：" +
                entries
                  .map(
                    (e) => e.title + (e.outcome ? "（" + e.outcome + "）" : ""),
                  )
                  .join("；"),
            ),
          );
      }
      section.append(checklist);
      if (w.review) section.append(create("p", "週回顧：" + w.review));
      container.append(section);
    }
    if (Object.keys(getPlan().subjects).length) {
      container.append(create("h2", "科目讀法"));
      for (const [subject, method] of Object.entries(getPlan().subjects))
        container.append(create("h3", subject), create("p", method));
    }
  }
  document.addEventListener("college-calendar-rendered", render);
  // Refresh every minute only while visible; no persistent timer is needed for time calculations.
  const tick = setInterval(() => {
    if (!page.hidden && !document.hidden && ["week", "day"].includes(view))
      render();
  }, 60000);
  window.addEventListener?.("pagehide", () => clearInterval(tick), {
    once: true,
  });
  const { renderPanoramaTable, renderMonth, renderLongPeriod } =
    createCalendarViews({
      api,
      getPlan,
      getLayout: () => layout,
      card,
      openEditor,
      renderPreview,
      setView: (value) => {
        view = value;
      },
    });
  const renderChart = createCalendarCharts({
    getSummary: () => currentSummary,
    getPlan,
    getDate: api.getDate,
    getEvents: () => api.getState().events,
  });
  render();
  return {
    render,
    openEditor,
    renderPrintable,
    get view() {
      return view;
    },
  };
}
