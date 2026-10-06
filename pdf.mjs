const printableValue = value => {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
};

export function createItemPdfExporter({documentRef = globalThis.document, windowRef = globalThis.window} = {}) {
  return function exportItemPdf(title, fields) {
    const root = documentRef.getElementById('printable-item');
    if (!root) throw new Error('找不到單筆 PDF 匯出區。');
    root.replaceChildren();
    const make = (tag, text, className) => {
      const node = documentRef.createElement(tag);
      if (text !== undefined) node.textContent = text;
      if (className) node.className = className;
      return node;
    };
    root.append(
      make('p', 'COLLEGE OS · 個人資料', 'eyebrow'),
      make('h1', title || '單筆資料'),
      make('p', `匯出時間：${new Date().toLocaleString('zh-TW', {timeZone: 'Asia/Taipei'})}`)
    );
    for (const [label, value] of fields ?? []) {
      if (value === null || value === undefined || value === '') continue;
      const section = make('section', undefined, 'pdf-field');
      section.append(make('h2', label), make('pre', printableValue(value)));
      root.append(section);
    }

    const oldTitle = documentRef.title;
    const safeTitle = String(title || 'College OS 資料').replace(/[\\/:*?"<>|]/g, ' ').trim();
    documentRef.title = `${safeTitle} - College OS`;
    documentRef.body.classList.add('print-item-mode');
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      documentRef.body.classList.remove('print-item-mode');
      documentRef.title = oldTitle;
      windowRef.removeEventListener?.('afterprint', cleanup);
    };
    try {
      windowRef.addEventListener?.('afterprint', cleanup, {once: true});
      windowRef.print();
    } catch (error) {
      cleanup();
      throw error;
    }
  };
}
