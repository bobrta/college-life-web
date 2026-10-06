import {buildCoachPrompt,makeLearningRecord,STUDY_STEPS} from './learning-method.mjs?v=4.0';
import {buildTopicGroups} from './learning-topics.mjs?v=4.0';
import {readable,topicOf} from './study.mjs?v=3.5';

const $=id=>document.getElementById(id);
const el=(tag,text,cls)=>{const item=document.createElement(tag);if(text!==undefined)item.textContent=text;if(cls)item.className=cls;return item;};
const today=()=>new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Taipei'});

export function mountLearningLab({state,save,getUnits,go}){
  state.learningSessions??=[];

  const nav=document.querySelector('nav');
  const navButton=el('button','✦ 學習SOP');navButton.type='button';navButton.dataset.page='learning-lab';navButton.onclick=()=>go('learning-lab');
  nav.querySelector('[data-page="cards"]').after(navButton);

  const page=el('section');page.id='learning-lab';page.className='page learning-lab';page.hidden=true;
  page.innerHTML=`
    <div class="panel learning-intro">
      <p class="eyebrow">COLLEGE OS · 學習流程 4.0</p>
      <h2>每次只攻下一個考點。</h2>
      <p>課程先照老師範圍、投影片、例題和指定題庫走。先自己回想，再補缺口、做題、隔天回測；額外難題等基本要求穩了再加。</p>
      <div class="learning-pills"><span>老師範圍優先</span><span>先答再看</span><span>錯因要修正</span><span>隔天再測</span></div>
      <div class="learning-flow" aria-label="一次學習的流程"><strong>選章節</strong><i>›</i><strong>閉卷診斷</strong><i>›</i><strong>補一個缺口</strong><i>›</i><strong>做題回測</strong></div>
    </div>

    <div class="panel learning-setup">
      <div class="section-heading"><div><p class="eyebrow">01 · 先框定範圍</p><h2>選科目、分類、章節</h2></div><span id="learning-knowledge-count" class="tag"></span></div>
      <p class="learning-help">主題不用打字搜尋：先選上層分類，再從第二個選單選單元。若是你自己的課程，選「我的課程」並貼老師材料即可。</p>
      <div class="form-grid learning-select-grid">
        <label>學習路徑<select id="learning-mode"><option value="課程／考試">課程／考試（預設）</option><option value="知識庫／概念理解">知識庫／概念理解</option><option value="自然語言處理（NLP）">自然語言處理（NLP）</option></select></label>
        <label>課程／科目<input id="learning-subject" maxlength="100" placeholder="例如：管理學、微積分、工業工程概論"></label>
        <label>① 主題分類<select id="learning-group"><option value="">選擇主題分類</option><option value="__course__">我的課程（貼上老師材料）</option></select></label>
        <label>② 單元／章節<select id="learning-topic" disabled><option value="">先選左側主題分類</option></select></label>
        <label>本次節奏<select id="learning-duration"><option value="15">快速複習 · 約 15 分鐘</option><option value="25" selected>標準學習 · 約 25 分鐘</option><option value="40">考前練習 · 約 40 分鐘</option></select></label>
        <label>這次結束時，我要能<input id="learning-goal" maxlength="240" placeholder="例如：不用看筆記，解出老師講義第 4 題"></label>
      </div>
      <p id="learning-topic-status" class="learning-selection-note" role="status">先選主題分類，再選一個單元。也可以直接選「我的課程」。</p>

      <details class="learning-units"><summary>選本次要讀的卡片／題目（最多 5 筆）</summary><p>只把你勾選的內容放進提示詞，不會整包載入題庫。若勾題目，答案會作為核對依據，提示詞會要求 AI 等你作答後再解析；要貼給外部 AI 前請先檢查。</p><div id="learning-unit-list" class="learning-unit-list"></div><div id="learning-units-pager" class="actions learning-units-pager"></div><p id="learning-unit-status" role="status"></p></details>

      <div class="learning-source-grid">
        <label>老師投影片／教材／自己整理的筆記<textarea id="learning-material" maxlength="12000" rows="6" placeholder="優先貼本週範圍、老師畫記、課堂例題、指定題庫。只貼這次要學的一小段，不必整本複製。"></textarea></label>
        <label>卡住的題目或疑問<textarea id="learning-question" maxlength="3000" rows="4" placeholder="例：我知道要用 EOQ 公式，但不會判斷題目裡哪些數字是年需求量、訂購成本。"></textarea></label>
      </div>
      <div class="learning-actions"><button id="learning-start" type="button" class="primary">開始本次學習：先做閉卷診斷</button><span id="learning-start-status" role="status"></span></div>
    </div>

    <div class="panel learning-sop-panel">
      <div class="section-heading"><div><p class="eyebrow">02 · 做完一輪，而不是一直重讀</p><h2>本次學習 SOP</h2></div><span id="learning-step-progress" class="tag">0 / 6 步</span></div>
      <div class="learning-sop-callout"><strong>先別打開 AI。</strong><span>第一步先靠自己寫，這樣才知道是真懂，還是只覺得眼熟。</span></div>
      <div id="learning-steps" class="learning-steps"></div>
      <div class="learning-grid">
        <label>① 閉卷診斷｜我目前會什麼？<textarea id="learning-diagnosis" rows="4" maxlength="2500" placeholder="闔上教材，用 1–3 句寫：這個概念是什麼？我記得哪些步驟？哪一點最不確定？"></textarea></label>
        <label>② 最重要的缺口｜我剛發現不會什麼？<textarea id="learning-gap" rows="4" maxlength="1500" placeholder="例：我會代公式，但不懂需求量要用年還是月。一次先抓一個缺口。"></textarea></label>
        <label>③ 闔上 AI 後｜我能自己重講／重做嗎？<textarea id="learning-reflection" rows="4" maxlength="2500" placeholder="把答案收起來，再用自己的話解釋或重做一題。記下結果，不要貼 AI 原文。"></textarea></label>
        <label>本次掌握程度<select id="learning-score"><option value="0">尚未回測</option><option value="1">1｜看得懂，闔上就想不起來</option><option value="2">2｜能說明，遇到新題會卡</option><option value="3">3｜能閉卷解釋並完成變化題</option></select></label>
        <label>安排下次閉卷複習<input id="learning-review-date" type="date"></label>
      </div>
      <div class="learning-actions"><button id="learning-build-prompt" type="button" class="primary">依我的材料產生 AI 教練提示</button><button id="learning-save" type="button" class="secondary">儲存本次學習紀錄</button></div>
      <p class="privacy-note">AI 提示只在這個頁面產生，不會自動傳送。請先檢查，再自行決定是否複製給外部 AI；含個資或校內限制的內容先刪掉。</p>
      <p id="learning-status" role="status"></p>
      <div id="learning-prompt-wrap" class="learning-prompt-wrap" hidden><label>AI 教練提示詞（可以先檢查）<textarea id="learning-prompt" rows="16" readonly></textarea></label><button type="button" id="learning-copy-prompt" class="secondary">複製提示詞</button><p id="learning-copy-status" role="status"></p></div>
    </div>

    <div class="panel"><div class="section-heading"><div><p class="eyebrow">03 · 用結果調整下一輪</p><h2>待複習與學習紀錄</h2></div><span id="learning-history-summary" class="tag"></span></div><div id="learning-due-list" class="learning-history"></div><details><summary>查看最近紀錄</summary><div id="learning-history-list" class="learning-history"></div></details></div>
    <div class="panel learning-note"><h3>AI 與 NLP 怎麼用才不會變成「看答案」？</h3><p><strong>AI 教練 SOP：</strong>你先嘗試 → AI 只解釋一個缺口並追問 → 你自己修正 → 闔上 AI 重建 → 隔天做不同題。</p><p><strong>NLP 此處指自然語言處理：</strong>可請 AI 把材料拆成術語、概念關係、輸入／輸出與流程，再逐項對照原文。它不是網站內建的自動 NLP 模型；課程事實仍要回到老師材料或正式來源核對。「神經語言程式學」是另一個縮寫用法，本工作台不把它當作已證實的速成學習法。</p></div>`;
  document.querySelector('main footer').before(page);

  let groups=[],selectedUnitIds=new Set(),unitPage=0;
  const unitPageSize=20;
  const topicSelect=$('learning-topic');
  function renderGroups(){
    groups=buildTopicGroups(getUnits());
    const groupSelect=$('learning-group'),selected=groupSelect.value;
    groupSelect.replaceChildren(new Option('選擇主題分類',''),new Option('我的課程（貼上老師材料）','__course__'));
    groups.forEach(group=>groupSelect.add(new Option(`${group.label} · ${group.count} 筆`,group.label)));
    if(groups.some(group=>group.label===selected))groupSelect.value=selected;
    $('learning-knowledge-count').textContent=`知識庫 ${getUnits().length.toLocaleString()} 筆`;
    renderTopics();
  }
  function renderTopics(){
    const group=groups.find(item=>item.label===$('learning-group').value);
    topicSelect.replaceChildren(new Option(group?'選擇單元／章節':'先選左側主題分類',''));
    topicSelect.disabled=!group;
    if(group)group.topics.forEach(topic=>topicSelect.add(new Option(`${topic.label} · ${topic.count} 筆`,topic.category)));
    $('learning-topic-status').textContent=group
      ?`「${group.label}」有 ${group.topics.length} 個單元。選定後只顯示該範圍的概念卡或題目。`
      :$('learning-group').value==='__course__'
        ?'這條路徑不依賴內建知識庫：填課程名稱，貼上老師本週範圍或例題即可。'
        :'先選主題分類，再選一個單元。也可以直接選「我的課程」。';
    renderUnits();
  }
  function renderUnits(){
    const list=$('learning-unit-list'),category=topicSelect.value;
    list.replaceChildren();$('learning-units-pager').replaceChildren();
    if(!category){list.append(el('p','先選上方的主題分類和單元，這裡才會列出小組知識卡。','empty'));return;}
    const rows=getUnits().filter(unit=>topicOf(unit)===category);
    if(!rows.length){list.append(el('p','這個單元目前沒有可選內容。你可以貼上老師教材，或改選其他單元。','empty'));return;}
    const pageCount=Math.max(1,Math.ceil(rows.length/unitPageSize));unitPage=Math.max(0,Math.min(unitPage,pageCount-1));
    rows.slice(unitPage*unitPageSize,(unitPage+1)*unitPageSize).forEach(unit=>{
      const label=el('label',undefined,'learning-unit');
      const check=el('input');check.type='checkbox';check.value=unit.id;check.checked=selectedUnitIds.has(unit.id);
      check.onchange=()=>{if(check.checked){if(selectedUnitIds.size>=5){check.checked=false;$('learning-unit-status').textContent='一輪先選 5 筆內，避免提示詞塞太多內容。';return;}selectedUnitIds.add(unit.id);}else selectedUnitIds.delete(unit.id);$('learning-unit-status').textContent=`已選 ${selectedUnitIds.size} / 5 筆。`;};
      const kindLabel={question:'題庫題目',concept:'概念卡',note:'筆記',research:'研究摘要',formula:'公式／模型',flashcard:'翻讀卡'}[unit.kind]||'知識單元';
      const record=unit.original_record||{};const itemTitle=unit.title||readable(record.question||record.scenario||unit.core_concept).slice(0,90)||'未命名題目';
      label.append(check,el('span',itemTitle),el('small',kindLabel));list.append(label);
    });
    if(rows.length>unitPageSize){const previous=el('button','上一頁','secondary');previous.type='button';previous.disabled=unitPage===0;previous.onclick=()=>{unitPage--;renderUnits();};const next=el('button','下一頁','secondary');next.type='button';next.disabled=unitPage>=pageCount-1;next.onclick=()=>{unitPage++;renderUnits();};$('learning-units-pager').append(previous,el('span',`${unitPage+1} / ${pageCount} · ${rows.length} 筆`),next);}
    $('learning-unit-status').textContent=`已選 ${selectedUnitIds.size} / 5 筆。`;
  }
  $('learning-group').onchange=()=>{
    selectedUnitIds.clear();unitPage=0;
    if($('learning-group').value==='__course__'){
      topicSelect.replaceChildren(new Option('自訂課程：不需選知識庫單元',''));topicSelect.disabled=true;
      $('learning-topic-status').textContent='填課程名稱並貼上老師本週範圍、投影片重點或例題。';
      $('learning-unit-list').replaceChildren(el('p','自訂課程沒有內建卡片；直接貼上老師材料即可。','empty'));
      return;
    }
    const group=groups.find(item=>item.label===$('learning-group').value);
    if(group&&!$('learning-subject').value.trim())$('learning-subject').value=group.label;
    renderTopics();
  };
  topicSelect.onchange=()=>{selectedUnitIds.clear();unitPage=0;renderUnits();};
  document.addEventListener('college-knowledge-changed',renderGroups);
  renderGroups();

  const tomorrow=new Date(Date.now()+86400000).toLocaleDateString('sv-SE',{timeZone:'Asia/Taipei'});
  $('learning-review-date').value=tomorrow;

  const steps=$('learning-steps');
  STUDY_STEPS.forEach(item=>{
    const row=el('label',undefined,'learning-step');
    const check=el('input');check.type='checkbox';check.dataset.step=item.id;check.onchange=updateStepCount;
    const description=el('span',undefined,'learning-step-copy');
    description.append(el('strong',item.title),el('small',item.minutes+' · '+item.why),el('span',item.action));
    row.append(check,description);steps.append(row);
  });
  function updateStepCount(){
    $('learning-step-progress').textContent=`${steps.querySelectorAll('input:checked').length} / 6 步已完成`;
  }
  $('learning-start').onclick=()=>{
    if(!$('learning-subject').value.trim()&&!topicSelect.value&&$('learning-group').value!=='__course__'){
      $('learning-start-status').textContent='先選主題分類和單元，或選「我的課程」並填課程名稱。';$('learning-group').focus();return;
    }
    if($('learning-group').value==='__course__'&&!$('learning-subject').value.trim()){
      $('learning-start-status').textContent='先填課程／科目名稱，例如：管理學。';$('learning-subject').focus();return;
    }
    const first=steps.querySelector('[data-step="diagnose"]');first.checked=true;updateStepCount();
    $('learning-start-status').textContent='先闔上教材，花 2 分鐘寫下你記得的內容，再往下做。';
    $('learning-diagnosis').focus();$('learning-diagnosis').scrollIntoView({behavior:'smooth',block:'center'});
  };
  $('learning-build-prompt').onclick=()=>{
    const chosen=[...selectedUnitIds].map(id=>getUnits().find(unit=>unit.id===id)).filter(Boolean);
    const material=$('learning-material').value.trim();
    if(!material&&!chosen.length){$('learning-status').textContent='先貼一段老師材料，或從知識卡加選本次範圍；這樣 AI 才有根據。';$('learning-material').focus();return;}
    const knowledge=chosen.map(unit=>{
      const record=unit.original_record||{};
      return {kind:unit.kind,title:unit.title,core_concept:readable(unit.core_concept),deep_understanding:readable(unit.deep_understanding),solution_methods:readable(unit.solution_methods),question:readable(record.question||record.scenario||''),options:readable(record.options||''),answer:readable(record.answer||record.correctAnswer||''),explanation:readable(record.explanation||record.detailedExplanation||''),sources:unit.sources};
    });
    $('learning-prompt').value=buildCoachPrompt({mode:$('learning-mode').value,subject:$('learning-subject').value,topic:topicSelect.selectedOptions[0]?.textContent||'',goal:$('learning-goal').value,diagnosis:$('learning-diagnosis').value,question:$('learning-question').value,material,knowledge,duration:$('learning-duration').value});
    $('learning-prompt-wrap').hidden=false;
    $('learning-status').textContent='提示詞已產生。先看有沒有符合老師範圍，再決定要不要複製給 AI。';
    $('learning-prompt').focus();
  };
  $('learning-copy-prompt').onclick=async()=>{
    try{await navigator.clipboard.writeText($('learning-prompt').value);$('learning-copy-status').textContent='複製完成。回到你選擇的 AI 貼上並開始作答。';}
    catch{$('learning-prompt').focus();$('learning-prompt').select();$('learning-copy-status').textContent='瀏覽器未允許剪貼簿；文字已選取，請手動複製。';}
  };
  $('learning-save').onclick=()=>{
    const subject=$('learning-subject').value.trim(),topic=topicSelect.value,diagnosis=$('learning-diagnosis').value.trim(),reviewDate=$('learning-review-date').value;
    if(!subject&&!topic){$('learning-status').textContent='先填課程名稱或選一個知識單元，再儲存紀錄。';return;}
    if(!diagnosis){$('learning-status').textContent='先完成閉卷診斷，再存本次紀錄。';$('learning-diagnosis').focus();return;}
    const record=makeLearningRecord({subject,topic:topicSelect.selectedOptions[0]?.textContent||topic,mode:$('learning-mode').value,goal:$('learning-goal').value,diagnosis,gap:$('learning-gap').value,reflection:$('learning-reflection').value,score:$('learning-score').value,reviewDate,steps:[...steps.querySelectorAll('input')].map(check=>check.checked)});
    state.learningSessions.unshift(record);state.learningSessions=state.learningSessions.slice(0,300);save();
    $('learning-status').textContent='已儲存在這台瀏覽器，也會包含於「匯出完整備份」。';renderHistory();
  };
  function historyRow(record,isDue){
    const card=el('article',undefined,'learning-record');
    card.append(el('strong',`${record.topic||record.subject} · ${record.date}`),el('span',`閉卷自評 ${record.score||0}/3 · ${record.completedSteps?.length||0}/6 步${record.reviewDate?' · 下次 '+record.reviewDate:''}`));
    if(record.gap)card.append(el('p','下次先補：'+record.gap));
    if(isDue){const done=el('button','完成這次回測','secondary');done.type='button';done.onclick=()=>{record.reviewDate='';record.reflection=(record.reflection?record.reflection+'\n':'')+'回測完成 '+today();save();renderHistory();};card.append(done);}
    return card;
  }
  function renderHistory(){
    const rows=state.learningSessions??[],due=rows.filter(record=>record.reviewDate&&record.reviewDate<=today());
    $('learning-history-summary').textContent=`${rows.length} 次學習 · ${due.length} 項到期回測`;
    $('learning-due-list').replaceChildren();
    if(!due.length)$('learning-due-list').append(el('p','還沒有到期項目。完成一輪時排明天回想；想不起來就先補小缺口。','empty'));
    due.slice(0,12).forEach(record=>$('learning-due-list').append(historyRow(record,true)));
    $('learning-history-list').replaceChildren();
    if(!rows.length)$('learning-history-list').append(el('p','每次只記主題、卡點和下次驗證日，方便週末看哪種方法有效。','empty'));
    rows.slice(0,30).forEach(record=>$('learning-history-list').append(historyRow(record,false)));
  }
  renderHistory();
  return {renderGroups,renderHistory};
}
