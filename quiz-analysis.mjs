export const WRONG_REASONS=['尚未分析','概念不熟','題意看錯','選項混淆','公式／計算','記憶提取失敗','粗心／時間壓力','其他'];
export function summarizeWrongAnalysis(rows,attempts=[]){
 const mistakes=rows.filter(x=>x.reason&&x.reason!=='尚未分析');
 const reasons={};for(const row of rows)reasons[row.reason||'尚未分析']=(reasons[row.reason||'尚未分析']??0)+1;
 const topics={};for(const a of attempts){const topic=a.domain||'未分類';const item=topics[topic]??={total:0,correct:0};item.total++;if(a.correct)item.correct++;}
 return {total:rows.length,pending:rows.filter(x=>!x.reason||x.reason==='尚未分析'||!x.next).length,reviewed:mistakes.length,reasons,topics:Object.entries(topics).map(([topic,x])=>({topic,...x,accuracy:x.total?Math.round(100*x.correct/x.total):0})).sort((a,b)=>a.accuracy-b.accuracy||b.total-a.total)};
}
