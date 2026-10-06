import {options,answerKeys} from './models.mjs?v=3.5';
export const typeNames={concept:'概念',flashcard:'翻讀卡',question:'題目',note:'筆記',research:'研究摘要',formula:'公式／模型'};
export function readable(value){if(value===null||value===undefined)return '';if(Array.isArray(value))return value.map(readable).filter(Boolean).join('\n');if(typeof value==='object')return Object.entries(value).map(([key,v])=>`${key}：${readable(v)}`).join('\n');return String(value);}
export function topicOf(unit){return readable(unit.category).trim()||'未分類';}
export function studyCard(unit){const r=unit.original_record??{};return {...unit,category:topicOf(unit),front:unit.kind==='flashcard'?r.front:unit.kind==='question'?((r.question||unit.title)+'\n\n'+options(r).map(([key,value])=>`${key}. ${readable(value)}`).join('\n')):`請用自己的話解釋：${unit.title}`,back:unit.kind==='flashcard'?r.back:unit.kind==='question'?`答案：${answerKeys(r).join('、')}\n\n${readable(r.explanation)||'此題尚無解析。'}`:[unit.core_concept,unit.deep_understanding,unit.solution_methods,r.explanation,r.analysis,r.findings,r.pipeline,r.back,r.items].map(readable).filter(Boolean).join('\n\n')||readable(r)};}
export function mergeKnowledge(builtin,personal){const map=new Map(builtin.map(u=>[u.id,u]));for(const u of personal)map.set(u.id,u);return [...map.values()];}
export function topicCounts(units){const map=new Map();for(const u of units){const key=topicOf(u);if(!map.has(key))map.set(key,{topic:key,total:0,questions:0});const row=map.get(key);row.total++;if(u.kind==='question')row.questions++;}return [...map.values()].sort((a,b)=>b.total-a.total);}
export function nextReview(previous,outcome,now=Date.now()){const streak=outcome==='known'?(previous?.streak??0)+1:0;const days=outcome==='known'?[1,3,7,14,30][Math.min(streak-1,4)]:0;return {streak,due:new Date(now+(days?days*86400000:600000)).toISOString(),last:new Date(now).toISOString()};}

export function quizThemeOf(unit){
 const category=topicOf(unit),parts=category.split('｜'),provider=unit.metadata?.provider;
 if(category.startsWith('iPAS AI'))return 'iPAS AI';
 if(category.startsWith('使用者提供題庫｜典籍情境｜'))return '典籍情境';
 if(category.startsWith('使用者提供題庫｜'))return parts[1]||'使用者題庫';
 if(provider==='user-provided-course-material')return category==='計算機概論'?'計算機概論':'AI 課程';
 return category;
}
export function quizBankLabel(category){
 if(category.startsWith('iPAS AI 應用規劃師｜'))return category.slice('iPAS AI 應用規劃師｜'.length).replaceAll('｜',' · ');
 if(category.startsWith('使用者提供題庫｜典籍情境｜'))return category.slice('使用者提供題庫｜典籍情境｜'.length);
 if(category.startsWith('使用者提供題庫｜'))return category.split('｜').slice(2).join(' · ');
 return category;
}
