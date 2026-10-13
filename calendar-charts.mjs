import { minutes } from "./calendar-schema.mjs";
import { activeEvents, weekPlan } from "./calendar-planning.mjs";
import { weekDates } from "./calendar.mjs";
const $ = (id) => document.getElementById(id);
const labels = {
  course: "上課",
  study: "學習",
  rest: "休息",
  deadline: "截止／考試",
  personal: "生活",
};
const create = (tag, text, cls) => {
  const x = document.createElement(tag);
  if (text !== undefined) x.textContent = text;
  if (cls) x.className = cls;
  return x;
};
const hours = (n) =>
  (n / 60).toLocaleString("zh-TW", { maximumFractionDigits: 1 });
function svgNode(tag, attrs) {
  const x = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs)) x.setAttribute(k, String(v));
  return x;
}
export function createCalendarCharts({
  getSummary,
  getPlan,
  getDate,
  getEvents,
}) {
  function renderChart() {
    const currentSummary = getSummary(),
      chart = document.getElementById("calendar-load-chart");
    if (!currentSummary) return;
    chart.replaceChildren();
    const s = currentSummary,
      kind = $("calendar-chart-kind").value;
    if (!s.days.length) {
      chart.append(create("p", "尚無資料。"));
      return;
    }
    const max = Math.max(
      60,
      ...s.days.map((d) =>
        Object.values(d.byCategory).reduce((a, b) => a + b, 0),
      ),
    );
    const colors = {
      course: "#79a8e3",
      study: "#7eae94",
      rest: "#b8bfc8",
      personal: "#b39bd2",
      deadline: "#d7a27b",
    };
    if (kind === "bars") {
      const chartDays =
        s.days.length > 31
          ? Object.values(
              s.days.reduce((acc, d) => {
                const key = d.date.slice(0, 7);
                acc[key] ??= {
                  date: key,
                  byCategory: {
                    course: 0,
                    study: 0,
                    rest: 0,
                    personal: 0,
                    deadline: 0,
                  },
                };
                for (const [k, v] of Object.entries(d.byCategory))
                  acc[key].byCategory[k] += v;
                return acc;
              }, {}),
            )
          : s.days;
      const top = Math.max(
        60,
        ...chartDays.map((d) =>
          Object.values(d.byCategory).reduce((a, b) => a + b, 0),
        ),
      );
      for (const d of chartDays) {
        const row = create("div", undefined, "cal-chart-row");
        row.append(create("small", d.date.slice(5) || d.date));
        const track = create("div", undefined, "cal-chart-track");
        for (const [key, value] of Object.entries(d.byCategory)) {
          if (!value) continue;
          const bar = create("span");
          bar.style.width = (value / top) * 100 + "%";
          bar.style.background = colors[key];
          bar.title = labels[key] + " " + hours(value) + " h";
          track.append(bar);
        }
        row.append(
          track,
          create(
            "small",
            hours(Object.values(d.byCategory).reduce((a, b) => a + b, 0)) +
              " h",
          ),
        );
        chart.append(row);
      }
    } else if (kind === "donut") {
      const total = Object.values(s.totals).reduce((a, b) => a + b, 0);
      if (!total) {
        chart.append(create("p", "目前範圍沒有已排時數。"));
        return;
      }
      let cursor = 0;
      const parts = [];
      const legend = create("div", undefined, "cal-chart-legend");
      for (const [key, n] of Object.entries(s.totals)) {
        const end = cursor + (n / total) * 100;
        parts.push(`${colors[key]} ${cursor}% ${end}%`);
        cursor = end;
        legend.append(create("p", labels[key] + " " + hours(n) + " h"));
      }
      const donut = create("div", undefined, "cal-donut");
      donut.style.background = `conic-gradient(${parts.join(",")})`;
      donut.setAttribute("role", "img");
      donut.setAttribute("aria-label", "排定時間分類比例，旁邊提供時數明細");
      donut.append(create("span", hours(total) + " h"));
      chart.append(donut, legend);
    } else if (kind === "trend") {
      const svg = svgNode("svg", {
        viewBox: "0 0 600 180",
        role: "img",
        "aria-label": "累積排定、實際學習與本週目標比較",
      });
      let planned = 0,
        actual = 0;
      const pp = [],
        ap = [];
      const weekly = s.days.length === 7;
      const target = weekly
        ? weekPlan(getPlan(), getDate()).targetHours * 60
        : null;
      const top = Math.max(s.scheduled, s.actual, target ?? 0, 60);
      s.days.forEach((d, i) => {
        planned += d.scheduled;
        actual += d.actual;
        const x = 25 + (i / Math.max(1, s.days.length - 1)) * 550;
        pp.push(`${x},${155 - (planned / top) * 130}`);
        ap.push(`${x},${155 - (actual / top) * 130}`);
      });
      for (const [points, color] of [
        [pp, "#79a8e3"],
        [ap, "#7eae94"],
      ])
        svg.append(
          svgNode("polyline", {
            points: points.join(" "),
            fill: "none",
            stroke: color,
            "stroke-width": 3,
          }),
        );
      if (target !== null)
        svg.append(
          svgNode("line", {
            x1: 25,
            x2: 575,
            y1: 155 - (target / top) * 130,
            y2: 155 - (target / top) * 130,
            stroke: "#959ca5",
            "stroke-dasharray": "5 5",
          }),
        );
      chart.append(
        svg,
        create(
          "p",
          `藍：累積排定 ${hours(s.scheduled)} h · 綠：實際 ${hours(s.actual)} h` +
            (target !== null
              ? ` · 虛線：本週目標 ${hours(target)} h`
              : " · 長期目標由各週設定，未假定固定工時"),
        ),
      );
    } else {
      const heat = create("div", undefined, "cal-heatmap");
      heat.append(create("small", "日／時"));
      for (let h = 0; h < 24; h++) heat.append(create("small", String(h)));
      const dates = weekDates(getDate());
      for (const date of dates) {
        heat.append(create("small", date.slice(5)));
        for (let h = 0; h < 24; h++) {
          const n = activeEvents(getEvents(), date)
            .filter((e) => e.category === "study" && e.start)
            .reduce(
              (sum, e) =>
                sum +
                Math.max(
                  0,
                  Math.min(minutes(e.end), (h + 1) * 60) -
                    Math.max(minutes(e.start), h * 60),
                ),
              0,
            );
          const cell = create("span");
          cell.style.background = n
            ? `rgba(71,133,95,${Math.min(1, n / 60)})`
            : "#f0f1f3";
          cell.title = `${date} ${h}:00 排定學習${n}分鐘`;
          cell.setAttribute("role", "img");
          cell.setAttribute("aria-label", cell.title);
          heat.append(cell);
        }
      }
      chart.append(
        create("p", "目前所選週的排定學習時段；重疊分鐘另由衝突提醒顯示。"),
        heat,
      );
    }
    if (kind === "bars")
      chart.append(
        create(
          "p",
          "藍：上課 · 綠：學習 · 灰：休息 · 紫：生活 · 棕：截止／考試",
          "cal-chart-legend",
        ),
      );
  }

  return renderChart;
}
