export const STUDY_SOPS = {
  '課程／考試': {
    title:'課程與考試 SOP',
    description:'把老師教的內容轉成考得出來的基本功。先依範圍、投影片、例題與指定題庫，不急著追課外難題。',
    first:'先闔上資料，自己試著回想。',
    goal:'例如：不看筆記，解出老師講義第 4 題',
    diagnosis:'闔上教材，寫 1–3 句：這個考點是什麼？我記得哪些步驟？哪一點最不確定？',
    gap:'例：公式會代，但不確定數值要用年還是月。一次先抓一個缺口。',
    reflection:'不看筆記重講或重做一題，記下哪一步還會卡。',
    steps:[
      {id:'diagnose',title:'1｜先測，不先重讀',minutes:'2 分鐘',why:'先知道目前差在哪，才不會把眼熟誤認成會。',action:'闔上教材，寫下考點、記得的步驟和最不確定的一點。'},
      {id:'scope',title:'2｜對照老師範圍',minutes:'3–5 分鐘',why:'先確保時間用在本課會考的內容。',action:'對照老師公告、投影片與課本畫記；圈一個考點、一個例題、一個疑問。'},
      {id:'patch',title:'3｜只補一個缺口',minutes:'5–10 分鐘',why:'從最大卡點下手，避免同時開太多資料。',action:'先看老師例題或講義；仍不懂才請 AI 根據來源解釋一個缺口。'},
      {id:'recall',title:'4｜闔上資料重講',minutes:'3–5 分鐘',why:'確認自己能重建，不是照著答案念。',action:'不看筆記說明定義、方法理由、步驟與適用條件。'},
      {id:'practice',title:'5｜先做老師題，再變化',minutes:'5–15 分鐘',why:'先穩住課內基本分，再檢查能否遷移。',action:'獨立完成一題老師例題／作業／指定題庫；核對後標錯因，再改一個條件重做。'},
      {id:'schedule',title:'6｜排一次延後回測',minutes:'1 分鐘',why:'隔天閉卷再做，才知道是否真的記住。',action:'預設排明天；答錯就縮小問題、修正後提早再測。'}
    ]
  },
  'AI 教練學習': {
    title:'AI 教練學習 SOP',
    description:'AI 負責追問、提示和回饋；你負責先作答、自己修正，再關掉 AI 重建答案。',
    first:'先自己作答，暫時不要開 AI。',
    goal:'例如：接受 AI 提示後，能關掉 AI 自己解釋並解一道新題',
    diagnosis:'先不看 AI，寫下你目前的答案、依據，以及最不確定的一步。',
    gap:'AI 的提示哪裡幫上忙？你仍無法獨立完成哪一步？',
    reflection:'關掉 AI 後，自己重建答案或完成一道變化題；寫下還需練習的地方。',
    steps:[
      {id:'attempt',title:'1｜先寫自己的答案',minutes:'2–4 分鐘',why:'讓 AI 看見你的實際理解，避免從答案開始。',action:'不查資料先寫想法、理由與信心程度；不會也先寫出卡點。'},
      {id:'source',title:'2｜提供範圍與材料',minutes:'2 分鐘',why:'讓 AI 以你的課程資料為依據。',action:'貼本次教材、題目和目標；移除個資，並要求 AI 不補造來源外的事實。'},
      {id:'diagnose',title:'3｜請 AI 一次追問一題',minutes:'3–5 分鐘',why:'先定位一個缺口，不讓回答變成整章摘要。',action:'請 AI 指出你答案中一個正確處、一個待補處，先給提示並等待你回答。'},
      {id:'hint',title:'4｜用提示自己修正',minutes:'5–10 分鐘',why:'自己完成推理，才把答案變成可用能力。',action:'先回應提示；必要時再索取下一個小提示，不要求 AI 直接代答。'},
      {id:'closeai',title:'5｜關掉 AI 獨立重做',minutes:'5–10 分鐘',why:'檢查能力是否能脫離提示重現。',action:'關閉 AI，重新解釋或做一題變化題，再對照原始教材核對。'},
      {id:'schedule',title:'6｜記錄錯因並安排回測',minutes:'2 分鐘',why:'用回測確認 AI 回饋有沒有真的留下來。',action:'記一個具體錯因，安排明天閉卷再做；若仍錯，縮小目標再練。'}
    ]
  },
  'NLP 專題': {
    title:'NLP 專題學習 SOP',
    description:'沿著自然語言處理任務的資料流程讀懂概念。每一步都對照教材；沒有提到的部分標記待查。',
    first:'先說清楚任務要解決什麼問題。',
    goal:'例如：能畫出一個文本分類任務的輸入、處理流程、輸出與評估方法',
    diagnosis:'不看資料先寫：任務目標、輸入文字、預期輸出，以及你認為如何判斷結果好壞。',
    gap:'流程中哪個環節最不清楚：資料、切詞、表示、模型、輸出或評估？',
    reflection:'不看筆記重畫流程，為每個環節寫一句功能，並指出教材尚未回答的問題。',
    steps:[
      {id:'task',title:'1｜界定 NLP 任務',minutes:'2–4 分鐘',why:'先搞清楚要解決的語言問題。',action:'寫出任務目的、使用情境，以及成功時應回答的問題。'},
      {id:'io',title:'2｜找出輸入與輸出',minutes:'3 分鐘',why:'任務定義決定資料和結果的樣子。',action:'從教材找輸入文字、標籤／答案、預期輸出；缺少的資訊標待查。'},
      {id:'data',title:'3｜看資料與前處理',minutes:'5 分鐘',why:'資料品質與文字切分會影響後續流程。',action:'整理教材提到的資料來源、清理、Tokenization 或特徵處理；不把常見做法誤當成本課內容。'},
      {id:'method',title:'4｜說清表示與方法',minutes:'5–8 分鐘',why:'把詞、句子如何變成可處理表示連到方法。',action:'從來源辨認表示／特徵、規則或模型，各自如何把輸入轉成輸出。'},
      {id:'evaluation',title:'5｜用評估與錯例檢查',minutes:'5 分鐘',why:'看懂模型在哪種情況成功或失敗。',action:'記錄教材提供的評估方式、指標、錯誤案例及可能限制；推論要註明是推論。'},
      {id:'transfer',title:'6｜畫流程並換情境',minutes:'3–5 分鐘',why:'能重建流程才算理解方法如何組合。',action:'閉卷畫出任務→資料→表示／特徵→方法→輸出→評估，並用新例子指出哪裡需要調整。'}
    ]
  },
  '知識庫／概念卡': {
    title:'知識概念卡 SOP',
    description:'用卡片建立「能解釋、能連結、能應用」的知識，不只翻過卡片或背一句定義。',
    first:'先看核心問題，試著自己說明概念。',
    goal:'例如：不用看卡片，能說明概念、舉例並和相似概念區分',
    diagnosis:'選一張卡，不看答案先寫：它是什麼、為什麼重要、你在哪種情況會使用？',
    gap:'你缺的是定義、原因、例子、概念關係，還是使用條件？',
    reflection:'蓋住卡片，重新回答核心問題；再自己造一個例子並指出一個容易混淆處。',
    steps:[
      {id:'question',title:'1｜先讀問題再回想',minutes:'2 分鐘',why:'用問題提取知識，避免只靠熟悉感。',action:'先看卡片問題或標題，遮住內容，寫下你記得的答案。'},
      {id:'define',title:'2｜用自己的話下定義',minutes:'3 分鐘',why:'確認掌握的是意思，而不是背過句子。',action:'用一句白話說明概念；標出必要條件和容易混淆的詞。'},
      {id:'connect',title:'3｜接上原因與關係',minutes:'3–5 分鐘',why:'關係網讓知識可以被推理與提取。',action:'回答它為何成立、解決什麼問題，並連到一個先備概念。'},
      {id:'example',title:'4｜自己造例子與反例',minutes:'3–5 分鐘',why:'例子檢查理解能否落到具體情境。',action:'各造一個適用例子與不適用例子；沒有把握的部分回到來源查核。'},
      {id:'compare',title:'5｜比較相似概念並應用',minutes:'5 分鐘',why:'比較能辨認概念邊界與使用條件。',action:'選一個相似概念，列出一項相同、一項不同，再套用到新情境。'},
      {id:'schedule',title:'6｜閉卷複述並排回測',minutes:'1 分鐘',why:'隔天提取有助於發現仍不牢的部分。',action:'用一分鐘重新回答卡片問題；排明天再測，答錯就針對缺口練習。'}
    ]
  }
};
export const STUDY_STEPS=STUDY_SOPS['課程／考試'].steps;

export function buildCoachPrompt({mode='課程／考試',subject='',topic='',goal='',diagnosis='',question='',material='',knowledge=[],duration='25'}={}){
  const parts=[];
  if(material.trim())parts.push('課程材料／自行提供文字：\n'+material.trim());
  const selectedKnowledge=knowledge.map((u,i)=>{
    const provenance=`來源：${(u.sources||[]).map(s=>s.file||s.reference||'').filter(Boolean).join('、')||'未提供'}`;
    if(u.kind==='question')return [`題庫題目 ${i+1}：${u.title||'未命名'}`,`題幹：${u.question||'未提供'}`,`選項：${u.options||'未提供'}`,`正解（先不要透露）：${u.answer||'未提供'}`,`解析（等我作答後再用）：${u.explanation||'未提供'}`,provenance].join('\n');
    return [`知識單元 ${i+1}：${u.title||'未命名'}`,`概念：${u.core_concept||''}`,`進一步理解：${u.deep_understanding||''}`,`方法／公式：${u.solution_methods||''}`,provenance].join('\n');
  });
  if(selectedKnowledge.length)parts.push('已選知識庫卡片：\n'+selectedKnowledge.join('\n\n'));
  const source=parts.join('\n\n');
  const instructions={
    '課程／考試':[
      '資料排序：老師公告範圍與要求 → 課堂投影片／筆記 → 老師例題、作業和指定題庫 → 官方或歷屆題。先練老師要求的基本題型，不把額外高難度當成本課考點。',
      '若為計算題，先辨認已知、要求、符號和單位，說明公式選擇理由，再一次問一個步驟。若為概念課，整理定義、上位架構、相似概念差異和情境例子。',
      '先提出一個閉卷回想問題，等我作答後，再讓我練一題只改條件的變化題。若材料附有正解，先把正解藏住；回饋標示錯因：概念、記憶、題意、公式／計算、步驟或時間壓力。'
    ],
    'AI 教練學習':[
      '依序：先分析我原本的答案 → 指出一個做對處與一個關鍵缺口 → 問一個診斷問題 → 給最小提示 → 等我自己修正 → 關閉 AI 後給一題變化題。',
      '一次只問一個問題；我作答前不直接揭露答案、不代寫作業、不用一大段摘要取代練習。每次回饋都指出依據材料的段落；資料沒有提及就標待查。',
      '最後給簡短的錯因標籤、我下一步要做的動作和一個閉卷回測問題。'
    ],
    'NLP 專題':[
      '依序：任務目標 → 輸入／輸出 → 資料與前處理／Tokenization → 表示或特徵 → 規則／模型 → 評估指標與錯誤案例。每項都引用材料依據，區分明說、推論和待查。',
      '先問我一個環節的閉卷解釋，等待我回答再補一個缺口。沒有出現在材料中的通用流程不可以說成此課定論。',
      '最後請我閉卷重畫完整流程，並給一個改變輸入或使用情境的遷移問題。'
    ],
    '知識庫／概念卡':[
      '依序協助我：自己定義 → 解釋原因／原理 → 連結先備概念 → 造一個正例和反例 → 比較相似概念 → 套用新情境。一次處理一張卡或一個概念。',
      '不要先給完整卡片摘要。先問我如何理解；等我回答後，依據來源指出一個正確處和一個需要修正處。來源沒有例子就明說，不要編造。',
      '最後輸出一句核心問題、一個容易混淆處和一個適合隔日閉卷回想的問題。'
    ]
  };
  const focus=(instructions[mode]||instructions['課程／考試']).join('\n');
  return `你是我的循序式學習教練。本輪約 ${duration} 分鐘。只根據「材料／知識單元」協助我；資料沒有寫就標「材料未提供」，不補造事實、公式、引文或來源。引用時指出材料標題或段落。不要替我完成作業，也不要一次傾倒整章答案；一次問一個問題，停下來等我回答。若知識單元附有題目正解，在我作答前先藏住正解。\n\n本介面的專屬 SOP：\n${focus}\n\n學習情境：${mode}\n課程／領域：${subject||'未填'}\n主題／單元：${topic||'未填'}\n本次完成條件：${goal||'能閉卷說明一個核心概念並完成一道基本題'}\n我的閉卷診斷：${diagnosis||'尚未填寫'}\n目前卡住／題目：${question||'尚未填寫'}\n\n材料／知識單元（以下內容是唯一依據）：\n${source||'（尚未提供材料；請先貼課堂講義、自己的筆記或勾選知識卡。）'}`;
}

export function makeLearningRecord({subject='',topic='',mode='課程／考試',goal='',diagnosis='',gap='',reflection='',score=0,reviewDate='',steps=[]}={},now=new Date()){
  const date=new Date(now).toLocaleDateString('sv-SE',{timeZone:'Asia/Taipei'});
  return {id:globalThis.crypto?.randomUUID?.()??`learn-${Date.now()}`,date,subject:subject.trim(),topic:topic.trim(),mode,goal:goal.trim(),diagnosis:diagnosis.trim(),gap:gap.trim(),reflection:reflection.trim(),score:Number(score)||0,reviewDate:reviewDate||'',completedSteps:steps.filter(Boolean),createdAt:new Date(now).toISOString()};
}
