export function beginFocus(state, taskId, now) {
  if (state.timer) throw Error("先完成目前專注或休息。");
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task || task.done) throw Error("先選擇未完成的任務");
  const next = structuredClone(state);
  next.timer = {
    mode: "focus",
    task: taskId,
    started: now,
    until: now + state.settings.focus * 60000,
  };
  return next;
}
export function finishFocus(state, now) {
  if (state.timer?.mode !== "focus") return state;
  const next = structuredClone(state),
    timer = state.timer,
    minutes = Math.max(0, Math.min(now, timer.until) - timer.started) / 60000;
  next.logs ??= [];
  next.logs.push({
    task: timer.task,
    date: new Date(timer.started).toLocaleDateString("sv-SE", {
      timeZone: "Asia/Taipei",
    }),
    minutes,
  });
  const task = next.tasks.find((t) => t.id === timer.task);
  if (task) task.remaining = Math.max(0, task.remaining - minutes);
  // Start a full protected rest when returning, even if the tab was suspended.
  next.timer = { mode: "rest", until: now + state.settings.rest * 60000 };
  return next;
}
export function advanceTimer(state, now) {
  if (!state.timer || now < state.timer.until) return state;
  if (state.timer.mode === "focus") return finishFocus(state, now);
  const next = structuredClone(state);
  next.timer = null;
  return next;
}
