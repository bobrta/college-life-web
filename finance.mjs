function monthKey(date){return date.toISOString().slice(0,7);}
function sum(rows,type){return rows.filter(t=>t.type===type).reduce((n,t)=>n+t.cents,0);}
export function financialOverview(transactions,month,budgetCents=0,asOf=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Taipei'})){
 const [year,mon]=month.split('-').map(Number);if(!year||mon<1||mon>12)throw Error('月份格式錯誤。');
 const months=[];for(let i=5;i>=0;i--){const d=new Date(Date.UTC(year,mon-1-i,1));const key=monthKey(d),rows=transactions.filter(t=>t.date.startsWith(key));months.push({month:key,income:sum(rows,'income'),expense:sum(rows,'expense'),net:sum(rows,'income')-sum(rows,'expense')});}
 const monthRows=transactions.filter(t=>t.date.startsWith(month)),income=sum(monthRows,'income'),expense=sum(monthRows,'expense'),days=[];const lastDate=new Date(Date.UTC(year,mon,0)).getUTCDate();
 const endDay=asOf.slice(0,7)===month?Math.min(lastDate,Number(asOf.slice(8,10))):lastDate;
 for(let day=Math.max(1,endDay-6);day<=endDay;day++){const date=`${month}-${String(day).padStart(2,'0')}`,rows=monthRows.filter(t=>t.date===date);days.push({date,income:sum(rows,'income'),expense:sum(rows,'expense')});}
 const categories={};for(const t of monthRows)if(t.type==='expense')categories[t.category]=(categories[t.category]??0)+t.cents;
 return {month,income,expense,net:income-expense,savingsRate:income?Math.round((income-expense)/income*100):null,budgetCents,budgetUsed:budgetCents?Math.round(expense/budgetCents*100):null,budgetRemaining:budgetCents-expense,months,days,categories:Object.entries(categories).map(([category,cents])=>({category,cents,share:expense?Math.round(cents/expense*100):0})).sort((a,b)=>b.cents-a.cents)};
}
