const scoreKeys = ["impact", "confidence", "effort"];
export function rankOptions(options, weights = { impact: 3, confidence: 2, effort: 2 }) {
  if (!Array.isArray(options) || options.length < 2 || options.length > 4)
    throw Error("比較時請填 2 至 4 個選項。");
  if (!weights || typeof weights !== "object" || Array.isArray(weights) || scoreKeys.some(k => !Number.isFinite(weights[k]) || weights[k] < 0) || scoreKeys.reduce((sum,k)=>sum+weights[k],0)<=0)
    throw Error("權重需為非負數，且至少一項大於零。");
  const total = scoreKeys.reduce((sum,k)=>sum+weights[k],0);
  return options.map(option => {
    if (!option || typeof option.name !== "string" || !option.name.trim() || option.name.length > 120 || scoreKeys.some(k => !Number.isInteger(option[k]) || option[k] < 1 || option[k] > 5))
      throw Error("選項名稱與 1–5 整數評估需完整。");
    return {...option,score:Math.round((option.impact*weights.impact+option.confidence*weights.confidence+(6-option.effort)*weights.effort)/total*100)/100};
  }).sort((a,b)=>b.score-a.score);
}
export function quadrant(importance,urgency){if(!Number.isInteger(importance)||importance<1||importance>5||!Number.isInteger(urgency)||urgency<1||urgency>5)throw Error('重要度與急迫度需為 1–5 整數。');return importance>=4?(urgency>=4?'now':'plan'):(urgency>=4?'simplify':'later');}
export function decisionStage(d,state){if(!state||typeof state!=='object'||!state.tasks||typeof state.tasks!=='object'||Array.isArray(state.tasks))throw Error('任務狀態格式不正確。');if(d?.review)return 'act';const task=Object.values(state.tasks).filter(Array.isArray).flat().find(t=>t&&t.id===d?.taskId);return task?(task.done?'check':'do'):'plan';}
export function planningFeedback(planned,actual,outcome){if(!Number.isFinite(planned)||planned<0||!Number.isFinite(actual)||actual<0||!['met','partial','missed'].includes(outcome))throw Error('計畫回饋資料不正確。');const delta=actual-planned;return {delta,text:outcome==='met'?(delta>planned*.25?'成果達成，但時間超出估計；下次用這次實際時間作為起點。':'成果達成，可保留這個做法，再觀察是否穩定。'):outcome==='partial'?'先找出已完成的部分，下一次只調整一個步驟。':'先記錄阻礙與可控制的部分，再決定縮小、延後或換方法。'};}
function realDate(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const date=new Date(value+'T00:00:00Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;}
export function validateDecision(d){return !!d&&typeof d.id==='string'&&!!d.id.trim()&&d.id.length<=120&&typeof d.title==='string'&&!!d.title.trim()&&d.title.length<=200&&typeof d.next==='string'&&d.next.length<=300&&typeof d.criterion==='string'&&d.criterion.length<=500&&typeof d.reviewDate==='string'&&realDate(d.reviewDate)&&Number.isInteger(d.planned)&&d.planned>=1&&d.planned<=1440&&Number.isInteger(d.importance)&&d.importance>=1&&d.importance<=5&&Number.isInteger(d.urgency)&&d.urgency>=1&&d.urgency<=5&&(d.taskId===undefined||typeof d.taskId==='string'&&(d.taskId===''||!!d.taskId.trim()))&&(!d.review||(['met','partial','missed'].includes(d.review.outcome)&&Number.isInteger(d.review.actual)&&d.review.actual>=0&&d.review.actual<=1440&&typeof d.review.rule==='string'&&!!d.review.rule.trim()&&d.review.rule.length<=500&&typeof d.review.at==='string'&&Number.isFinite(Date.parse(d.review.at))));}
