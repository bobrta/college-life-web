import { validate } from "./validation.mjs";
export function freshPlanner() {
  return {
    version: 1,
    settings: { limit: 2, buffer: 20, focus: 50, rest: 10, minBlock: 20 },
    days: Array.from({ length: 7 }, (_, i) => ({
      windows: [{ start: "18:30", end: "22:15" }],
      hours: [4, 2, 2, 2, 4, 4, 4][i],
    })),
    tasks: [],
    events: [],
    goals: [],
    overrides: {},
    logs: [],
    timer: null,
  };
}
export function migratePlanner(input) {
  const value = structuredClone(validate(input));
  value.goals ??= [];
  value.overrides ??= {};
  value.logs ??= [];
  value.timer ??= null;
  value.revision ??= 0;
  value.days = value.days.map((day) => ({
    hours: day.hours,
    windows: day.windows ?? [{ start: day.start, end: day.end }],
  }));
  return value;
}
export function createPlannerStore(
  storage,
  key = "college-capacity-planner-v1",
) {
  let committed = freshPlanner(),
    loadError = null,
    blocked = false,
    lastRaw = null;
  const undoStack = [],
    redoStack = [];
  try {
    lastRaw = storage.getItem(key);
    if (lastRaw) committed = migratePlanner(JSON.parse(lastRaw));
  } catch (e) {
    loadError = e.message;
    blocked = true;
  }
  function write(candidate, { restore = false, history = true } = {}) {
    if (blocked && !restore)
      throw Error("原資料無法讀取，已阻止覆寫；請先匯入有效備份。");
    const next = migratePlanner(candidate);
    next.revision = (committed.revision || 0) + 1;
    const raw = JSON.stringify(next);
    try {
      if (storage.getItem(key) !== lastRaw) throw Error("conflict");
      storage.setItem(key, raw);
    } catch (e) {
      if (e.message === "conflict")
        throw Error("另一個分頁已更新資料；請重新整理後再修改。");
      throw Error("儲存失敗，原保存資料保留。");
    }
    if (history && !committed.timer && !next.timer) {
      undoStack.push(structuredClone(committed));
      if (undoStack.length > 20) undoStack.shift();
      redoStack.length = 0;
    }
    // Timing transitions must not be replayed through undo/redo.
    else if (committed.timer || next.timer) {
      undoStack.length = 0;
      redoStack.length = 0;
    }
    committed = next;
    lastRaw = raw;
    blocked = false;
    loadError = null;
    return structuredClone(committed);
  }
  return {
    get error() {
      return loadError;
    },
    get canUndo() {
      return !committed.timer && undoStack.length > 0;
    },
    get canRedo() {
      return !committed.timer && redoStack.length > 0;
    },
    read() {
      return structuredClone(committed);
    },
    commit: write,
    undo() {
      if (committed.timer || !undoStack.length)
        throw Error("目前沒有可復原的修改");
      const previous = structuredClone(committed),
        target = undoStack.at(-1),
        result = write(target, { history: false });
      undoStack.pop();
      redoStack.push(previous);
      return result;
    },
    redo() {
      if (committed.timer || !redoStack.length)
        throw Error("目前沒有可重做的修改");
      const previous = structuredClone(committed),
        target = redoStack.at(-1),
        result = write(target, { history: false });
      redoStack.pop();
      undoStack.push(previous);
      return result;
    },
  };
}
