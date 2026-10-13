function database() {
  if (!globalThis.indexedDB)
    return Promise.reject(Error("此瀏覽器無法開啟本機知識資料庫。"));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("college-os-knowledge", 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("packages"))
        request.result.createObjectStore("packages");
    };
    request.onerror = () => reject(request.error ?? Error("知識資料庫開啟失敗。"));
    request.onblocked = () => reject(Error("知識資料庫正在升級；請關閉其他 College OS 分頁後重試。"));
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
  });
}

function validateScope(scope) {
  if (typeof scope !== "string" || !scope.trim() || scope.length > 200)
    throw Error("知識資料範圍不正確。");
}

export async function readKnowledge(scope) {
  validateScope(scope);
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("packages", "readonly"),
        request = tx.objectStore("packages").get(scope);
      let value;
      request.onsuccess = () => {
        value = request.result ?? [];
      };
      request.onerror = () => reject(request.error ?? Error("本機知識資料讀取失敗。"));
      tx.oncomplete = () => {
        if (!Array.isArray(value)) reject(Error("本機知識資料格式不正確；原資料仍保留。"));
        else resolve(value);
      };
      tx.onabort = () => reject(tx.error ?? Error("本機知識資料讀取中斷。"));
      tx.onerror = () => reject(tx.error ?? Error("本機知識資料讀取失敗。"));
    });
  } finally {
    db.close();
  }
}

export async function writeKnowledge(scope, units) {
  validateScope(scope);
  if (!Array.isArray(units)) throw Error("知識資料必須是清單。");
  const db = await database();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction("packages", "readwrite");
      tx.objectStore("packages").put(units, scope);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error ?? Error("知識資料保存失敗。"));
      tx.onabort = () => reject(tx.error ?? Error("知識資料保存中斷。"));
    });
  } finally {
    db.close();
  }
}

export async function commitKnowledgeChange({ write, previous, next, commit, rollback }) {
  if (typeof write !== "function" || typeof commit !== "function")
    throw Error("知識資料保存流程不完整。");
  await write(next);
  try {
    if ((await commit()) === false) throw Error("本機紀錄未保存。");
    return next;
  } catch (error) {
    rollback?.();
    try {
      await write(previous);
    } catch (rollbackError) {
      throw Error("本機紀錄未保存，且知識包回復失敗：" + rollbackError.message);
    }
    throw error;
  }
}
