function monthKey(date){return date.toISOString().slice(0,7);}
function sum(rows,type){return rows.filter(t=>t.type===type).reduce((n,t)=>addCents(n,t.cents),0);}
function addCents(left,right){const total=left+right;if(!Number.isSafeInteger(total))throw Error('收支合計超出安全範圍，請拆分期間或檢查匯入資料。');return total;}
export function financialOverview(transactions,month,budgetCents=0,asOf=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Taipei'})){
 if(typeof month!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw Error('月份格式錯誤，請使用 YYYY-MM。');
 if(!Array.isArray(transactions)||!Number.isSafeInteger(budgetCents)||budgetCents<0)throw Error('收支或預算資料格式錯誤。');
 if(typeof asOf!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(asOf)||new Date(asOf+'T12:00:00Z').toISOString().slice(0,10)!==asOf)throw Error('統計日期格式錯誤。');
 const [year,mon]=month.split('-').map(Number);
 for(const row of transactions)if(!row||typeof row.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(row.date)||new Date(row.date+'T12:00:00Z').toISOString().slice(0,10)!==row.date||!['income','expense'].includes(row.type)||!Number.isSafeInteger(row.cents)||row.cents<0)throw Error('收支紀錄資料格式錯誤。');
 const months=[];for(let i=5;i>=0;i--){const d=new Date(Date.UTC(year,mon-1-i,1));const key=monthKey(d),rows=transactions.filter(t=>t.date.startsWith(key)),income=sum(rows,'income'),expense=sum(rows,'expense');months.push({month:key,income,expense,net:addCents(income,-expense)});}
 const monthRows=transactions.filter(t=>t.date.startsWith(month)),income=sum(monthRows,'income'),expense=sum(monthRows,'expense'),days=[];const lastDate=new Date(Date.UTC(year,mon,0)).getUTCDate();
 const endDay=asOf.slice(0,7)===month?Math.min(lastDate,Number(asOf.slice(8,10))):lastDate;
 for(let day=Math.max(1,endDay-6);day<=endDay;day++){const date=`${month}-${String(day).padStart(2,'0')}`,rows=monthRows.filter(t=>t.date===date);days.push({date,income:sum(rows,'income'),expense:sum(rows,'expense')});}
 const categories=new Map();for(const t of monthRows)if(t.type==='expense'){if(typeof t.category!=='string'||t.category.length>100)throw Error('收支分類不正確。');categories.set(t.category,addCents(categories.get(t.category)??0,t.cents));}
 const net=addCents(income,-expense),budgetRemaining=addCents(budgetCents,-expense);
 return {month,income,expense,net,savingsRate:income?Math.round(net/income*100):null,budgetCents,budgetUsed:budgetCents?Math.round(expense/budgetCents*100):null,budgetRemaining,months,days,categories:[...categories].map(([category,cents])=>({category,cents,share:expense?Math.round(cents/expense*100):0})).sort((a,b)=>b.cents-a.cents)};
}
