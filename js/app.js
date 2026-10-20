// Shout Spot v3: English/Japanese, iPad-first, configurable cards & clear voice turn-taking.
import {makeRound} from './engine.js';
import {createSpeech,classifySpeech} from './speech.js';
const $=s=>document.querySelector(s);
const PREVIEW_MS=550, SLIDE_MS=800, TOTAL_ROUNDS=10, MIN_PICTURES=3,MAX_PICTURES=8;
const LANG={en:{short:'EN',label:'英語',locale:'en-US'},ja:{short:'JP',label:'日本語',locale:'ja-JP'}};
const CATEGORIES={all:'ALL PICTURES',animals:'ANIMALS',food:'FOOD',things:'THINGS'};
let mode='missing',round=1,scores=[],players=4,count=6,category='all',language='en',judging='cards',data;
let solved=false,awarded=false,hint=false,voiceMode=false,listening=false,pendingFoul=false;
let phase='lobby'; // lobby, preview, entering, playing, paused, solved
let out=new Set(),timers=new Set(),autoRetry=null,voiceBlocked=false;
const speech=createSpeech({
 onState:voiceState,
 onText:text=>{if(phase==='playing')$('#transcript').textContent=`聞こえた言葉：${text}`;},
 onFinal:(text,alternatives)=>{
  // A finalized utterance matters ONLY after the card entrance has finished.
  if(phase!=='playing'||solved||pendingFoul||$('#settings').open||$('#result').open)return;
  const verdict=classifySpeech(alternatives||[text],data,language,judging);
  if(verdict.type==='ignored'){
   $('#transcript').textContent=`「${text}」は対象外（ゲーム続行）`;
   return; // Single-utterance recognition will close; onend restarts it.
  }
  stopVoice();
  if(verdict.type==='correct')finish();else beginFoul(verdict.spoken||text);
 }
});
function schedule(fn,delay){const id=setTimeout(()=>{timers.delete(id);fn();},delay);timers.add(id);return id;}
function clearScheduled(){for(const id of timers)clearTimeout(id);timers.clear();if(autoRetry!==null){clearTimeout(autoRetry);autoRetry=null;}}
function displayWord(item){return item[language];}
function languageLabel(){return LANG[language].label;}
function setPhase(next){
 phase=next;
 const names={lobby:'READY',preview:'LOOK!',entering:'GET READY',playing:'SHOUT!',paused:'PAUSED',solved:'CORRECT!'};
 const tag=$('#arenaState');tag.textContent=names[next]||'READY';tag.className='live-tag phase-'+next;
 $('#playfield').dataset.phase=next;
}
function voiceState(state){
 listening=['listening','starting'].includes(state);
 $('#micBtn').classList.toggle('listening',listening);
 $('#micBtn').textContent=listening?'■ マイクON・停止':'🎙 マイクを再開';
 const messages={starting:'マイクを準備しています…',listening:`● LIVE！ ${languageLabel()}で答えよう！`,idle:'音声認識を再接続しています…',
  'no-speech':'声を待っています。再接続します…',
  'not-allowed':'マイクが許可されていません。設定を確認するか、絵をタップしてください。',
  'service-not-allowed':'ブラウザーで音声認識が禁止されています。',
  'audio-capture':'マイクが見つかりません。',network:'音声認識の通信に失敗しました。タップで回答できます。',
  unsupported:'このブラウザーは音声認識非対応です。絵のタップで回答できます。',
  failed:'マイクを自動起動できませんでした。「マイクを再開」を押してください。',
  aborted:'マイクを停止しました。タップで回答するかマイクを再開してください。',
  'language-not-supported':`${languageLabel()}の音声認識に対応していません。絵をタップしてください。`};
 if((phase==='preview'||phase==='entering')&&listening){
  $('#micBtn').textContent='🎙 音声を準備中';$('#micStatus').textContent='カードを準備中。２枚そろったら回答受付！';return;
 }
 $('#micStatus').textContent=messages[state]||'マイクを再開して回答してください。';
 if(['not-allowed','service-not-allowed','audio-capture','network','unsupported','failed','language-not-supported'].includes(state))voiceBlocked=true;
 if(phase==='playing'&&voiceMode&&!voiceBlocked&&['idle','no-speech'].includes(state)&&autoRetry===null){
  autoRetry=setTimeout(()=>{autoRetry=null;if(phase==='playing'&&voiceMode&&!listening&&!voiceBlocked)startVoice();},400);
 }
}
function stopVoice(){
 if(autoRetry!==null){clearTimeout(autoRetry);autoRetry=null;}
 speech.stop();listening=false;
 $('#micBtn').classList.remove('listening');$('#micBtn').textContent='🎙 マイクを再開';
}
function startVoice(){
 if(phase==='lobby'||phase==='paused'||phase==='solved'||solved||pendingFoul||!speech.supported)return;
 voiceMode=true;voiceBlocked=false;
 if('speechSynthesis' in window)window.speechSynthesis.cancel();
 speech.start(language);
}
function primeVoiceFromGesture(){
 // Safari/iPad: ask for mic permission in the real PLAY/Next tap gesture.
 // Words spoken before the slide finishes are deliberately ignored by onFinal.
 if(voiceMode&&speech.supported){voiceBlocked=false;startVoice();}
}
function drawCard(id,arr){
 const el=$(id);el.replaceChildren();
 arr.forEach((item,i)=>{
  const angle=i*2*Math.PI/arr.length-Math.PI/2;
  const radius=arr.length<=4?26:arr.length>=7?34:32;
  const btn=document.createElement('button');btn.className='symbol';btn.type='button';
  btn.style.left=(50+Math.cos(angle)*radius)+'%';btn.style.top=(50+Math.sin(angle)*radius)+'%';
  btn.dataset.id=item.id;btn.setAttribute('aria-label',`${item.en} / ${item.ja}`);
  btn.innerHTML=`<span class="emoji" aria-hidden="true">${item.emoji}</span><span class="word">${displayWord(item)}</span>`;
  btn.onclick=()=>{
   if(phase!=='playing'||solved||pendingFoul)return;
   stopVoice();
   if(item.id===data.answer.id)finish();
   else{btn.classList.remove('wrong');void btn.offsetWidth;btn.classList.add('wrong');beginFoul(displayWord(item));}
  };
  el.append(btn);
 });
}
function redrawCurrentCards(){if(!data)return;drawCard('#left',data.left);drawCard('#right',data.right);}
function renderScores(){
 const el=$('#playerScores');el.replaceChildren();el.style.setProperty('--players',Math.min(players,4));
 scores.forEach((score,i)=>{
  const excluded=out.has(i),canAward=solved&&!awarded&&!excluded;
  const b=document.createElement('button');b.className='player-score'+(excluded?' sitting-out':pendingFoul?' foul-choice':'');
  b.style.setProperty('--player-color',['#e87851','#668bba','#80a283','#aa88b3','#caa34e','#5faaa6','#a9785e','#8a8cba'][i]);
  b.disabled=excluded||(!canAward&&!pendingFoul);
  const action=excluded?'この問題はお休み':pendingFoul?'お手つきを確定':canAward?'タップで ＋1':'POINTS';
  b.innerHTML=`<span class="player-name">PLAYER ${i+1}</span><strong>${score}</strong><span class="score-action">${action}</span>`;
  b.setAttribute('aria-label',`プレイヤー ${i+1}、${score}点。${action}`);
  b.onclick=()=>{if(pendingFoul)confirmFoul(i);else award(i);};el.append(b);
 });
 $('#score').textContent=players+' PLAYER'+(players>1?'S':'');
 $('#cancelFoul').hidden=!pendingFoul;$('#manualFoul').disabled=phase!=='playing'||solved||pendingFoul;
}
function award(i){
 if(!solved||awarded||out.has(i))return;
 awarded=true;scores[i]++;renderScores();$('#playerScores').children[i].classList.add('awarded');
 $('#scoreInstruction').textContent=`プレイヤー ${i+1} に１ポイント！`;$('#nextBtn').disabled=false;
}
function beginFoul(text=''){
 if(phase!=='playing'||solved||pendingFoul)return;
 pendingFoul=true;stopVoice();setPhase('paused');$('#stageCue').textContent='PAUSED';$('#micBtn').disabled=true;
 if(text)$('#transcript').textContent=`聞き取った答え：${text}`;
 message(text?`「${text}」でストップ！ お手つきならプレイヤーを選択。`:'お手つきした人を選んでください。','error');
 $('#micStatus').textContent='音声認識を一時停止しています。認識ミスなら取り消せます。';
 $('#scoreInstruction').textContent='間違えた人をタップ → この問題はお休み';renderScores();
}
function confirmFoul(i){
 if(!pendingFoul||solved||out.has(i))return;
 out.add(i);pendingFoul=false;$('#micBtn').disabled=!speech.supported;
 if(out.size===players){
  setPhase('playing');finish();awarded=true;renderScores();
  message(`全員お手つき。答え：${data.answer.emoji} ${displayWord(data.answer)}`,'error');
  $('#micStatus').textContent='得点なし。次の問題から全員復帰！';
  $('#scoreInstruction').textContent='全員お休みのため、この問題は得点なし';$('#nextBtn').disabled=false;
 }else{
  setPhase('playing');$('#stageCue').textContent='SHOUT!';
  message(`プレイヤー ${i+1} はこの問題お休み。残りの人で続けよう。`,'error');
  $('#scoreInstruction').textContent='お休みの人は次の問題で復帰します';renderScores();
  if(voiceMode)startVoice();else $('#micStatus').textContent='残りの人で続けよう。絵のタップでも回答できます。';
 }
}
function cancelFoul(){
 if(!pendingFoul)return;
 pendingFoul=false;setPhase('playing');$('#stageCue').textContent='SHOUT!';
 $('#micBtn').disabled=!speech.supported;renderScores();message('認識ミスを取り消しました。ゲーム再開！');
 $('#scoreInstruction').textContent='正解が出たら、先に言った人をタップ';
 if(voiceMode)startVoice();else $('#micStatus').textContent='マイクまたは絵のタップで回答できます。';
}
function message(text,kind=''){const el=$('#feedback');el.className='feedback '+kind;el.textContent=text;}
function refreshLanguageUI(){
 $('#langQuick').textContent=`🌐 ${LANG[language].short}`;
 $('#langQuick').setAttribute('aria-label',`回答言語：${languageLabel()}。押すと切り替え`);
 $('#language').value=language;
 $('#openingTagline').textContent=language==='ja'?'見つけたら、日本語で叫べ！':'見つけたら、英語で叫べ！';
 $('#hintBtn').textContent=hint?'Aa 単語ヒントを隠す':`Aa ${languageLabel()}のヒントを表示`;
 $('#subtitle').textContent=mode==='missing'?'左にあって、右にない絵はどれ？':'２枚のカードに、共通する絵はどれ？';
}
function setLanguage(next){
 if(!LANG[next]||next===language)return;
 stopVoice();language=next;refreshLanguageUI();redrawCurrentCards();
 if(phase==='playing'&&voiceMode){startVoice();message(`回答言語を${languageLabel()}に変更しました。ゲーム続行！`);}
 else if(phase==='preview'||phase==='entering'){primeVoiceFromGesture();}
 if(phase==='solved'){
  $('#feedback').textContent=`正解！ ${data.answer.emoji} ${displayWord(data.answer)}`;
  document.querySelectorAll('.symbol').forEach(b=>{b.disabled=true;if(Number(b.dataset.id)===data.answer.id)b.classList.add('correct','reveal');});
 }
}
function updateCount(next){
 const value=Math.max(MIN_PICTURES,Math.min(MAX_PICTURES,Number(next)||MIN_PICTURES));
 if(value===count)return;
 count=value;$('#count').value=String(value);$('#countValue').textContent=String(value);
 $('#countMinus').disabled=value===MIN_PICTURES;$('#countPlus').disabled=value===MAX_PICTURES;
 if(phase!=='lobby')message(`絵の数は${value}個。次のカードから適用されます。`);
}
function newRound(){
 clearScheduled();stopVoice();solved=false;awarded=false;pendingFoul=false;out.clear();
 data=makeRound(mode,count,category);redrawCurrentCards();
 $('#roundText').innerHTML=`ROUND <b>${String(round).padStart(2,'0')}</b> / ${TOTAL_ROUNDS}`;
 $('#dots').innerHTML=Array.from({length:TOTAL_ROUNDS},(_,i)=>`<i class="${i<round-1?'done':i===round-1?'current':''}"></i>`).join('');
 $('#nextBtn').disabled=true;$('#nextBtn').innerHTML=round===TOTAL_ROUNDS?'結果を見る <span>→</span>':'次のカード <span>→</span>';
 message(`１枚目を見よう。２枚目が来たら${languageLabel()}で SHOUT!`);
 $('#scoreInstruction').textContent='正解が出たら、先に言った人をタップ';
 $('#pronounce').hidden=true;$('#transcript').textContent=`２枚そろったら${languageLabel()}で叫ぼう！`;
 $('#micBtn').disabled=true;$('#micStatus').textContent='２枚目のカードを準備しています…';
 if(!speech.supported)voiceState('unsupported');renderScores();
 const field=$('#playfield');field.classList.remove('cards-ready');field.classList.add('first-only');
 $('#stageCue').textContent='LOOK AT CARD A';setPhase('preview');
 schedule(()=>{
  if(phase!=='preview')return;
  setPhase('entering');$('#stageCue').textContent='HERE COMES CARD B!';
  field.classList.remove('first-only');field.classList.add('cards-ready');
 },PREVIEW_MS);
 schedule(()=>{
  if(phase!=='entering')return;
  setPhase('playing');$('#stageCue').textContent='SHOUT!';
  $('#micBtn').disabled=!speech.supported;$('#micBtn').textContent=listening?'■ マイクON・停止':'🎙 マイクを再開';
  message(`GAME ON！ ${languageLabel()}で絵の名前を叫ぼう！`);renderScores();
  if(!speech.supported){voiceState('unsupported');return;}
  if(voiceMode){
   if(!listening&&!voiceBlocked)startVoice();else if(listening)$('#micStatus').textContent=`● LIVE！ ${languageLabel()}で答えよう！`;
  }else $('#micStatus').textContent='マイクを再開するか、絵をタップして回答。';
 },PREVIEW_MS+SLIDE_MS);
}
function finish(){
 if(solved||pendingFoul)return;
 solved=true;stopVoice();setPhase('solved');$('#stageCue').textContent='CORRECT!';
 $('#micBtn').disabled=true;$('#micStatus').textContent='ゲーム停止！ 先に答えたプレイヤーは？';
 document.querySelectorAll('.symbol').forEach(b=>{b.disabled=true;if(Number(b.dataset.id)===data.answer.id)b.classList.add('correct','reveal');});
 message(`正解！ ${data.answer.emoji} ${displayWord(data.answer)}`,'success');
 $('#scoreInstruction').textContent='先に言った人のスコアをタップして ＋1';
 $('#pronounce').hidden=!('speechSynthesis' in window);renderScores();
}
function reset(){
 round=1;players=Number($('#players').value);scores=Array(players).fill(0);
 document.body.dataset.players=String(players);
 count=Number($('#count').value);category=$('#category').value;judging=$('#judging').value;
 language=$('#language').value;refreshLanguageUI();
 $('#countValue').textContent=String(count);$('#countMinus').disabled=count===MIN_PICTURES;$('#countPlus').disabled=count===MAX_PICTURES;
 $('#categoryLabel').textContent=CATEGORIES[category];newRound();
}
function launch(){
 if(phase!=='lobby')return;
 $('#gameApp').inert=false;$('#opening').classList.add('leaving');
 voiceMode=true;reset();primeVoiceFromGesture();
 schedule(()=>{$('#opening').hidden=true;},280);
}
$('#playBtn').onclick=launch;
$('#openingSettings').onclick=()=>$('#settings').showModal();
$('#cancelFoul').onclick=cancelFoul;
$('#manualFoul').onclick=()=>{if(phase==='playing')beginFoul();};
$('#micBtn').onclick=()=>{
 if(phase!=='playing')return;
 if(listening){voiceMode=false;stopVoice();voiceState('aborted');}
 else{voiceMode=true;startVoice();}
};
$('#langQuick').onclick=()=>setLanguage(language==='en'?'ja':'en');
$('#countMinus').onclick=()=>updateCount(count-1);
$('#countPlus').onclick=()=>updateCount(count+1);
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{
 if(mode===b.dataset.mode)return;
 mode=b.dataset.mode;document.querySelectorAll('[data-mode]').forEach(x=>x.classList.toggle('selected',x===b));
 $('#leftLabel').textContent=mode==='missing'?'お手本のカード':'１枚目のカード';
 $('#rightLabel').textContent=mode==='missing'?'ひとつ足りないカード':'２枚目のカード';
 refreshLanguageUI();if(phase!=='lobby'){reset();primeVoiceFromGesture();}
});
$('#nextBtn').onclick=()=>{
 if(!awarded)return;
 if(round===TOTAL_ROUNDS){
  stopVoice();const best=Math.max(...scores),winners=scores.map((s,i)=>s===best?i+1:null).filter(Boolean);
  $('#resultScore').textContent=players===1?`${scores[0]} / ${TOTAL_ROUNDS} POINTS`:scores.map((s,i)=>`P${i+1}  ${s} POINTS`).join('\n')+'\n'+(winners.length===1?`プレイヤー ${winners[0]} の勝ち！`:'引き分け！');
  $('#result').showModal();
 }else{round++;newRound();primeVoiceFromGesture();}
};
$('#hintBtn').onclick=()=>{
 hint=!hint;document.body.classList.toggle('show-words',hint);refreshLanguageUI();
 $('#hintBtn').setAttribute('aria-pressed',String(hint));
};
$('#pronounce').onclick=()=>{
 if(!solved||!('speechSynthesis' in window))return;
 stopVoice();window.speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(displayWord(data.answer));
 utterance.lang=LANG[language].locale;utterance.rate=.8;window.speechSynthesis.speak(utterance);
};
$('#settingsBtn').onclick=()=>{stopVoice();$('#settings').showModal();};
$('#settings').addEventListener('close',()=>{
 if(phase==='playing'&&voiceMode&&!solved&&!pendingFoul)startVoice();
});
$('#restart').onclick=()=>{
 $('#settings').close();if(phase==='lobby'){language=$('#language').value;refreshLanguageUI();return;}
 reset();primeVoiceFromGesture();
};
$('#again').onclick=()=>{$('#result').close();reset();primeVoiceFromGesture();};
$('#resultSettings').onclick=()=>{$('#result').close();$('#settings').showModal();};
$('#fullscreen').onclick=async()=>{
 try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else message('Safariの共有から「ホーム画面に追加」で大きく表示できます。');}
 catch{message('Safariの共有から「ホーム画面に追加」でも大きく表示できます。');}
};
document.addEventListener('visibilitychange',()=>{
 if(document.hidden){stopVoice();if(phase==='playing'){voiceMode=false;voiceState('aborted');}}
});
window.addEventListener('pagehide',()=>{clearScheduled();stopVoice();});
$('#gameApp').inert=true;refreshLanguageUI();setPhase('lobby');
