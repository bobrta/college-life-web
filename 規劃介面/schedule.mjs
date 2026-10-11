import { clock, range } from "../規劃核心/time.mjs";
export function renderSchedule(container, result, { period, limit, onFocus }) {
  const doc = container.ownerDocument;
  const make = (tag, text, cls) => {
    const e = doc.createElement(tag);
    if (text !== undefined) e.textContent = text;
    if (cls) e.className = cls;
    return e;
  };
  const h = (n) => (n / 60).toFixed(1) + "h";
  function dayCard(day) {
    const article = make("article", undefined, "day");
    article.append(
      make("h3", day.date),
      make(
        "p",
        `已排 ${h(day.used)} / 可排 ${h(day.budget)} · ${day.ids.size}/${limit} 件`,
      ),
    );
    for (const block of day.blocks) {
      const row = make("div", undefined, "block");
      row.append(
        make(
          "span",
          `${clock(block.start)}–${clock(block.end)}　${block.title}`,
        ),
      );
      const b = make("button", "開始");
      b.type = "button";
      b.onclick = () => onFocus(block.id);
      row.append(b);
      article.append(row);
    }
    if (!day.blocks.length) article.append(make("p", "未排工作"));
    return article;
  }
  container.replaceChildren();
  if (!result.days.length) {
    container.append(make("p", "所選週期已結束，請切換日期。"));
    return;
  }
  if (period === "week") {
    for (const day of result.days) {
      const panel = dayCard(day);
      panel.classList.add("panel");
      container.append(panel);
    }
    return;
  }
  const weeks = new Map();
  for (const day of result.days) {
    const key = range(day.date, "week")[0];
    if (!weeks.has(key)) weeks.set(key, []);
    weeks.get(key).push(day);
  }
  let first = true;
  for (const days of weeks.values()) {
    const details = make("details", undefined, "panel schedule-week"),
      used = days.reduce((n, d) => n + d.used, 0),
      budget = days.reduce((n, d) => n + d.budget, 0);
    details.append(
      make(
        "summary",
        `${days[0].date} ～ ${days.at(-1).date}　已排 ${h(used)} / 可排 ${h(budget)}`,
      ),
    );
    if (first && used > 0) details.open = true;
    first = false;
    let drawn = false;
    details.addEventListener("toggle", () => {
      if (details.open && !drawn) {
        for (const day of days) details.append(dayCard(day));
        drawn = true;
      }
    });
    if (details.open) {
      for (const day of days) details.append(dayCard(day));
      drawn = true;
    }
    container.append(details);
  }
}
