export function answerKeys(record) {
  const answer = record.answer ?? record.correctAnswer ?? [];
  return (Array.isArray(answer) ? answer : [answer]).map(String).sort();
}
export function options(record) {
  if (Array.isArray(record.options)) return record.options.map((value,index) => {
    const match=String(value).match(/^([A-Z])[.、：:\s]/);
    return [match?.[1] ?? String.fromCharCode(65+index),String(value)];
  });
  return Object.entries(record.options ?? {});
}
export function grade(record, selected) {
  const expected=answerKeys(record);
  if (!expected.length) return null;
  return JSON.stringify([...new Set(selected)].sort())===JSON.stringify(expected);
}
export function filterUnits(units,query,kind='all') {
  const needle=query.trim().toLocaleLowerCase();
  return units.filter(unit=>(kind==='all'||unit.kind===kind)&&(!needle||JSON.stringify(unit).toLocaleLowerCase().includes(needle)));
}
export function addTask(tasks,title) {
  if (tasks.length>=4) throw new Error('今天最多四個主要任務。先完成或移除一項。');
  const text=title.trim();if(!text)throw new Error('請輸入任務。');
  return [...tasks,{id:crypto.randomUUID(),title:text,done:false}];
}
export function decision(situation,energy,goal) {
  const hints=['每次','總是','永遠','故意','不在乎','自私','蠢','看不起'].filter(word=>situation.includes(word));
  return {truth_status:'unknown',hints,steps:[energy==='low'?'先休息或降低工作量；非急迫的衝突先約時間再談。':'先記錄時間、可觀察行為、來源及目前影響。','列出仍不知道的事情，用一個具體問題核對。',goal.trim()?`目標：${goal.trim()}。選一個你現在能完成的最小行動。`:'寫下希望達成的結果，再選一個可完成的最小行動。','執行後記錄結果；若與預期不同，調整做法。']};
}
