import {topicOf} from './study.mjs?v=3.5';

function splitCategory(category){
  const parts=String(category||'未分類').split('｜').map(x=>x.trim()).filter(Boolean);
  if(parts[0]==='使用者提供教材'){
    return {group:parts[1]||'課程教材',topic:parts.slice(2).join(' ')||'全部單元'};
  }
  if(parts[0]==='使用者提供題庫'){
    return {group:parts[1]||'使用者題庫',topic:parts.slice(2).join('／')||'全部題目'};
  }
  if(parts[0].startsWith('iPAS')){
    return {group:parts[0],topic:parts.slice(1).join('／')||'全部單元'};
  }
  return {group:parts[0]||'未分類',topic:parts.slice(1).join('／')||'全部單元'};
}

export function buildTopicGroups(units=[]){
  const groups=new Map();
  for(const unit of units){
    if(!unit)continue;
    const category=topicOf(unit)||'未分類';
    const {group,topic}=splitCategory(category);
    if(!groups.has(group))groups.set(group,new Map());
    const topics=groups.get(group);
    if(!topics.has(topic))topics.set(topic,{label:topic,category,count:0});
    topics.get(topic).count++;
  }
  return [...groups].map(([label,topics])=>({
    label,
    count:[...topics.values()].reduce((sum,item)=>sum+item.count,0),
    topics:[...topics.values()].sort((a,b)=>a.label.localeCompare(b.label,'zh-Hant'))
  })).sort((a,b)=>a.label.localeCompare(b.label,'zh-Hant'));
}
