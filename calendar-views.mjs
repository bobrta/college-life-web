import { minutes } from "./calendar-schema.mjs";
import {
  activeEvents,
  daySummary,
  summarize,
  weekPlan,
  periodDates,
  shiftDate,
} from "./calendar-planning.mjs";
import { weekDates } from "./calendar.mjs";
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
const hours = (n) =>
  (n / 60).toLocaleString("zh-TW", { maximumFractionDigits: 1 });
const timeText = (n) =>
  String(Math.floor(n / 60)).padStart(2, "0") +
  ":" +
  String(n % 60).padStart(2, "0");
const today = () =>
  new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
export function createCalendarViews({
  api,
  getPlan,
  getLayout,
  card,
  openEditor,
  setView,
  renderPreview,
}) {
  function renderPanoramaTable(container, dates, { printing = false } = {}) {
    const table = create("table", undefined, "cal-panorama");
    const caption = create(
      "caption",
      `${dates[0]} 至 ${dates.at(-1)} 全景作息表`,
    );
    table.append(caption);
    const head = create("thead"),
      hr = create("tr");
    hr.append(create("th", "時段"));
    for (const date of dates) {
      const th = create(
        "th",
        new Date(date + "T12:00:00Z").toLocaleDateString("zh-TW", {
          month: "numeric",
          day: "numeric",
          weekday: "short",
          timeZone: "UTC",
        }),
      );
      th.scope = "col";
      if (date === today()) th.classList.add("cal-today");
      hr.append(th);
    }
    head.append(hr);
    table.append(head);
    const body = create("tbody");
    const slots =
      getLayout() === "timeline" && !printing
        ? Array.from({ length: 24 }, (_, h) => ({
            label: String(h).padStart(2, "0") + ":00",
            start: String(h).padStart(2, "0") + ":00",
            end: h === 23 ? "24:00" : String(h + 1).padStart(2, "0") + ":00",
          }))
        : getPlan().slots;
    const allSlots = [{ label: "全天／截止", start: "", end: "" }, ...slots];
    for (const slot of allSlots) {
      const row = create("tr"),
        th = create("th", slot.label);
      th.scope = "row";
      if (slot.start) th.append(create("small", slot.start + "–" + slot.end));
      row.append(th);
      for (const date of dates) {
        const cell = create("td");
        if (date === today()) cell.classList.add("cal-today");
        const entries = activeEvents(api.getState().events, date).filter((e) =>
          slot.start
            ? e.start &&
              minutes(e.start) < minutes(slot.end) &&
              minutes(e.end) > minutes(slot.start)
            : !e.start,
        );
        for (const e of entries) {
          if (slot.start && minutes(e.start) < minutes(slot.start)) {
            const continuation = printing
              ? create(
                  "span",
                  "↳ " + e.title + " 至 " + e.end,
                  "cal-continuation",
                )
              : button(
                  "↳ " + e.title + " 至 " + e.end,
                  () => openEditor(e, date),
                  "cal-continuation",
                );
            cell.append(continuation);
          } else if (printing) {
            const p = create(
              "p",
              `${e.start ? e.start + "–" + e.end : "全天"} ${e.title}`,
              "cal-print-event",
            );
            if (e.outcome) p.append(create("small", e.outcome));
            if (e.method) p.append(create("small", "方法：" + e.method));
            if (e.notes) p.append(create("small", "備註：" + e.notes));
            if (e.teacher || e.room)
              p.append(
                create(
                  "small",
                  [e.teacher, e.room].filter(Boolean).join(" · "),
                ),
              );
            cell.append(p);
          } else cell.append(card(e, date));
        }
        if (!printing) {
          const add = button(
            "＋",
            () => {
              openEditor(null, date);
              if (slot.start) {
                $("event-start").value = slot.start;
                $("event-end").value =
                  minutes(slot.end) - minutes(slot.start) >= 60
                    ? timeText(minutes(slot.start) + 60)
                    : slot.end;
                if ($("event-end").value === "24:00")
                  $("event-end").value = "23:59";
                renderPreview();
              }
            },
            "cal-cell-add",
          );
          add.setAttribute("aria-label", date + " " + slot.label + " 新增行程");
          cell.append(add);
          const now = new Date().toLocaleTimeString("en-GB", {
            timeZone: "Asia/Taipei",
            hour12: false,
            hour: "2-digit",
            minute: "2-digit",
          });
          if (
            date === today() &&
            slot.start &&
            minutes(now) >= minutes(slot.start) &&
            minutes(now) < minutes(slot.end)
          ) {
            const marker = create("span", "現在 " + now, "cal-now");
            cell.append(marker);
          }
        }
        row.append(cell);
      }
      body.append(row);
    }
    for (const [label, key] of [
      ["學習目標", "target"],
      ["排定學習", "scheduled"],
      ["實際學習", "actual"],
      ["上課", "course"],
      ["休息", "rest"],
      ["主要事項", "majorCount"],
    ]) {
      const row = create("tr", undefined, "cal-table-summary");
      row.append(create("th", label));
      for (const d of dates) {
        const s = daySummary(
          api.getState().events,
          d,
          getPlan().dailyMajorLimit,
        );
        const dailyTarget = weekPlan(getPlan(), d).dailyTargets?.[
          (new Date(d + "T12:00:00Z").getUTCDay() + 6) % 7
        ];
        row.append(
          create(
            "td",
            key === "target"
              ? dailyTarget === null || dailyTarget === undefined
                ? "—"
                : dailyTarget + " h"
              : key === "majorCount"
                ? `${s.majorCount} / ${getPlan().dailyMajorLimit}`
                : hours(s[key] ?? s.byCategory[key] ?? 0) + " h",
          ),
        );
      }
      body.append(row);
    }
    table.append(body);
    container.append(table);
  }
  function renderMonth(container, anchor) {
    const dates = periodDates(anchor, "month"),
      start = weekDates(dates[0])[0],
      grid = create("div", undefined, "cal-month-grid");
    for (const day of ["一", "二", "三", "四", "五", "六", "日"])
      grid.append(create("strong", day, "cal-month-heading"));
    for (let i = 0; i < 42; i++) {
      const date = shiftDate(start, i),
        cell = create("section", undefined, "cal-month-cell");
      if (date.slice(0, 7) !== anchor.slice(0, 7))
        cell.classList.add("cal-muted");
      if (date === today()) cell.classList.add("cal-today");
      cell.append(
        button(
          String(Number(date.slice(8))),
          () => {
            setView("day");
            api.setDate(date);
          },
          "cal-date-button",
        ),
      );
      const list = activeEvents(api.getState().events, date);
      list.slice(0, 3).forEach((e) => cell.append(card(e, date)));
      if (list.length > 3)
        cell.append(
          button(
            `另 ${list.length - 3} 項`,
            () => {
              setView("day");
              api.setDate(date);
            },
            "cal-more-day",
          ),
        );
      grid.append(cell);
    }
    container.append(grid);
  }
  function renderLongPeriod(container, dates) {
    const months = [...new Set(dates.map((d) => d.slice(0, 7)))];
    const grid = create("div", undefined, "cal-period-grid");
    for (const month of months) {
      const subset = dates.filter((d) => d.startsWith(month)),
        s = summarize(api.getState().events, subset, getPlan()),
        section = create("section", undefined, "cal-period-card");
      section.append(
        button(
          month,
          () => {
            setView("month");
            api.setDate(month + "-01");
          },
          "cal-month-title",
        ),
        create("p", `學習 ${hours(s.scheduled)} h · 實際 ${hours(s.actual)} h`),
      );
      const deadlines = subset.flatMap((d) =>
        activeEvents(api.getState().events, d)
          .filter((e) => e.category === "deadline")
          .map((e) => ({ e, d })),
      );
      for (const { e, d } of deadlines.slice(0, 4))
        section.append(
          button(
            d.slice(5) + " " + e.title,
            () => openEditor(e, d),
            "cal-deadline-link",
          ),
        );
      if (deadlines.length > 4)
        section.append(
          create(
            "small",
            `另 ${deadlines.length - 4} 項截止／考試，點月份查看`,
          ),
        );
      const weeks = Object.entries(getPlan().weekly).filter(([day]) =>
        subset.includes(day),
      );
      for (const [day, w] of weeks)
        section.append(create("p", `${day.slice(5)} ${w.title}`));
      grid.append(section);
    }
    container.append(grid);
  }

  return { renderPanoramaTable, renderMonth, renderLongPeriod };
}
