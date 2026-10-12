export const WRONG_REASONS=['尚未分析','概念不熟','題意看錯','選項混淆','公式／計算','記憶提取失敗','粗心／時間壓力','其他'];
export function summarizeWrongAnalysis(rows,attempts=[]){
 const mistakes=rows.filter(x=>x.reason&&x.reason!=='尚未分析');
 const reasons=new Map();for(const row of rows){const reason=row.reason||'尚未分析';reasons.set(reason,(reasons.get(reason)||0)+1);}
 const topics=new Map();for(const a of attempts){const topic=a.domain||'未分類';const item=topics.get(topic)??{total:0,correct:0};item.total++;if(a.correct)item.correct++;topics.set(topic,item);}
 return {total:rows.length,pending:rows.filter(x=>!x.reason||x.reason==='尚未分析'||!x.next).length,reviewed:mistakes.length,reasons:Object.fromEntries(reasons),topics:[...topics].map(([topic,x])=>({topic,...x,accuracy:x.total?Math.round(100*x.correct/x.total):0})).sort((a,b)=>a.accuracy-b.accuracy||b.total-a.total)};
}
