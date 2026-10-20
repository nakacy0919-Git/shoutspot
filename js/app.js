// Shout Spot v2: animated opening, one-card preview -> sliding second card -> automatic listening.
// Correct and incorrect FINAL transcripts pause the game for human confirmation.
import {makeRound} from './engine.js';
import {createSpeech,matchesAnswer} from './speech.js';
const $=s=>document.querySelector(s);
const PREVIEW_MS=550;
const SLIDE_MS=800;
let mode='missing',round=1,scores=[],players=4,count=6,category='all',data;
let solved=false,awarded=false,hint=false,voiceMode=false,listening=false,pendingFoul=false;
let phase='lobby'; // lobby, preview, entering, playing, paused, solved
let out=new Set(),timers=new Set(),autoRetry=null,voiceBlocked=false;
const speech=createSpeech({
 onState:voiceState,
 onText:text=>{if(phase==='playing')$('#transcript').textContent=`聞こえた言葉：${text}`;},
 onFinal:text=>{
  if(phase!=='playing'||solved||pendingFoul||$('#settings').open||$('#result').open)return;
  // Handle only finalized speech; stop immediately so the next phrase is not scored twice.
  stopVoice();
  if(matchesAnswer(text,data.answer.en))finish();else beginFoul(text);
 }
});
function schedule(fn,delay){const id=setTimeout(()=>{timers.delete(id);fn();},delay);timers.add(id);return id;}
function clearScheduled(){for(const id of timers)clearTimeout(id);timers.clear();if(autoRetry!==null){clearTimeout(autoRetry);autoRetry=null;}}
function setPhase(next){
 phase=next;
 const states={lobby:'READY',preview:'LOOK!',entering:'GET READY',playing:'SHOUT!',paused:'PAUSED',solved:'CORRECT!'};
 const tag=$('#arenaState');tag.textContent=states[next]||'READY';tag.className='live-tag phase-'+next;
 const field=$('#playfield');field.dataset.phase=next;
}
function voiceState(state){
 listening=['listening','starting'].includes(state);
 $('#micBtn').classList.toggle('listening',listening);
 $('#micBtn').textContent=listening?'■ マイクON・停止':'🎙 マイクを再開';
 const messages={starting:'マイクを準備しています…',listening:'● LIVE！ 英語で答えよう！',idle:'音声認識を再接続しています…',
  'no-speech':'声を待っています。再接続します…',
  'not-allowed':'マイクの使用が許可されていません。設定を確認するか、絵をタップしてください。',
  'service-not-allowed':'ブラウザーで音声認識が禁止されています。マイク設定をご確認ください。',
  'audio-capture':'マイクが見つかりません。接続を確認してください。',
  network:'音声認識の通信に失敗しました。マイクをタップして再試行してください。',
  unsupported:'このブラウザーは音声認識非対応です。絵をタップして回答できます。',
  failed:'自動開始できませんでした。「マイクを再開」を押してください。',
  aborted:'マイクを停止しました。マイクボタンで再開できます。',
  'language-not-supported':'英語の音声認識に対応していません。絵をタップしてください。'};
 if((phase==='preview'||phase==='entering')&&listening){$('#micBtn').textContent='🎙 音声を準備中';$('#micStatus').textContent='カードを準備中。２枚そろったら SHOUT！';return;}
 $('#micStatus').textContent=messages[state]||'マイクを再開して回答してください。';
 if(['not-allowed','service-not-allowed','audio-capture','network','unsupported','failed','language-not-supported'].includes(state))voiceBlocked=true;
 // Browsers often stop single-utterance recognition after silence. Continue listening automatically.
 if(phase==='playing'&&voiceMode&&!voiceBlocked&&['idle','no-speech'].includes(state)&&autoRetry===null){
  autoRetry=setTimeout(()=>{autoRetry=null;if(phase==='playing'&&voiceMode&&!listening&&!voiceBlocked)startVoice();},350);
 }
}
function stopVoice(){
 if(autoRetry!==null){clearTimeout(autoRetry);autoRetry=null;}
 speech.stop();listening=false;$('#micBtn').classList.remove('listening');$('#micBtn').textContent='🎙 マイクを再開';
}
function startVoice(){
 if(phase==='lobby'||phase==='paused'||phase==='solved'||solved||pendingFoul||!speech.supported)return;
 voiceMode=true;voiceBlocked=false;
 if('speechSynthesis' in window)window.speechSynthesis.cancel();
 speech.start();
}
function primeVoiceFromGesture(){
 // Important for Safari: start recognition in the actual PLAY/Next click gesture.
 // Responses arriving while the new card animates are intentionally ignored.
 if(voiceMode&&speech.supported){voiceBlocked=false;startVoice();}
}
function drawCard(id,arr){
 const el=$(id);el.replaceChildren();
 arr.forEach((item,i)=>{
  const angle=i*2*Math.PI/arr.length-Math.PI/2,radius=arr.length<=4?26:32;
  const btn=document.createElement('button');btn.className='symbol';
  btn.style.left=(50+Math.cos(angle)*radius)+'%';btn.style.top=(50+Math.sin(angle)*radius)+'%';
  btn.dataset.id=item.id;btn.setAttribute('aria-label',item.en+' / '+item.ja);
  btn.innerHTML=`<span class="emoji" aria-hidden="true">${item.emoji}</span><span class="word">${item.en}</span>`;
  btn.onclick=()=>{
   if(phase!=='playing'||solved||pendingFoul)return;
   if(item.id===data.answer.id){stopVoice();finish();}
   else{btn.classList.remove('wrong');void btn.offsetWidth;btn.classList.add('wrong');stopVoice();beginFoul(item.en);}
  };
  el.append(btn);
 });
}
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
 $('#cancelFoul').hidden=!pendingFoul;
 $('#manualFoul').disabled=phase!=='playing'||solved||pendingFoul;
}
function award(i){
 if(!solved||awarded||out.has(i))return;
 awarded=true;scores[i]++;renderScores();$('#playerScores').children[i].classList.add('awarded');
 $('#scoreInstruction').textContent=`プレイヤー ${i+1} に１ポイント！`;
 $('#nextBtn').disabled=false;
}
function beginFoul(text=''){
 if(phase!=='playing'||solved||pendingFoul)return;
 pendingFoul=true;stopVoice();setPhase('paused');$('#stageCue').textContent='PAUSED';$('#micBtn').disabled=true;
 if(text)$('#transcript').textContent=`聞き取った答え：${text}`;
 message(text?`「${text}」は不正解。言った人を選んで確認。`:'お手つきした人を選んでください。','error');
 $('#micStatus').textContent='一時停止中。認識ミスの場合は「取り消して続ける」。';
 $('#scoreInstruction').textContent='間違えた人をタップ → この問題はお休み';renderScores();
}
function confirmFoul(i){
 if(!pendingFoul||solved||out.has(i))return;
 out.add(i);pendingFoul=false;$('#micBtn').disabled=!speech.supported;
 if(out.size===players){
  setPhase('playing');finish();awarded=true;renderScores();
  message(`全員お手つき。答え：${data.answer.emoji} ${data.answer.en}（${data.answer.ja}）`,'error');
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
 $('#micBtn').disabled=!speech.supported;renderScores();
 message('認識ミスを取り消しました。ゲーム再開！');
 $('#scoreInstruction').textContent='正解が出たら、先に言った人をタップ';
 if(voiceMode)startVoice();else $('#micStatus').textContent='マイクまたは絵のタップで回答できます。';
}
function message(text,kind=''){const el=$('#feedback');el.className='feedback '+kind;el.textContent=text;}
function newRound(){
 clearScheduled();stopVoice();solved=false;awarded=false;pendingFoul=false;out.clear();
 data=makeRound(mode,count,category);drawCard('#left',data.left);drawCard('#right',data.right);
 $('#roundText').innerHTML=`ROUND <b>${String(round).padStart(2,'0')}</b> / 10`;
 $('#dots').innerHTML=Array.from({length:10},(_,i)=>`<i class="${i<round-1?'done':i===round-1?'current':''}"></i>`).join('');
 $('#nextBtn').disabled=true;$('#nextBtn').innerHTML=round===10?'結果を見る <span>→</span>':'次のカード <span>→</span>';
 message('１枚目を見よう。次のカードが来たら英語で SHOUT!');
 $('#scoreInstruction').textContent='正解が出たら、先に言った人をタップ';
 $('#pronounce').hidden=true;$('#transcript').textContent='２枚そろったら英語で叫ぼう！';
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
  message('GAME ON！ 見つけた単語を英語で叫ぼう！');renderScores();
  if(!speech.supported){voiceState('unsupported');return;}
  if(voiceMode){
   // If Safari ended the primed session during the animation, reconnect now.
   if(!listening&&!voiceBlocked)startVoice();else if(listening)$('#micStatus').textContent='● LIVE！ 英語で答えよう！';
  }else $('#micStatus').textContent='🎙 マイクを再開を押すか、絵をタップして回答。';
 },PREVIEW_MS+SLIDE_MS);
}
function finish(){
 if(solved||pendingFoul)return;
 solved=true;stopVoice();setPhase('solved');$('#stageCue').textContent='CORRECT!';
 $('#micBtn').disabled=true;$('#micStatus').textContent='ゲーム停止！ 先に言ったプレイヤーは？';
 document.querySelectorAll('.symbol').forEach(b=>{b.disabled=true;if(Number(b.dataset.id)===data.answer.id)b.classList.add('correct','reveal');});
 message(`正解！ ${data.answer.emoji} ${data.answer.en}（${data.answer.ja}）`,'success');
 $('#scoreInstruction').textContent='先に言った人のスコアをタップして ＋1';
 $('#pronounce').hidden=!('speechSynthesis' in window);renderScores();
}
function reset(){
 round=1;players=Number($('#players').value);scores=Array(players).fill(0);
 count=Number($('#count').value);category=$('#category').value;
 $('#categoryLabel').textContent={all:'ALL PICTURES',animals:'ANIMALS',food:'FOOD',things:'THINGS'}[category];
 newRound();
}
function launch(){
 if(phase!=='lobby')return;
 $('#gameApp').inert=false;
 $('#opening').classList.add('leaving');
 voiceMode=true;reset();primeVoiceFromGesture();
 schedule(()=>{$('#opening').hidden=true;},280);
}
$('#playBtn').onclick=launch;
$('#openingSettings').onclick=()=>{$('#settings').showModal();};
$('#cancelFoul').onclick=cancelFoul;
$('#manualFoul').onclick=()=>{if(phase==='playing')beginFoul();};
$('#micBtn').onclick=()=>{
 if(phase!=='playing')return;
 if(listening){voiceMode=false;stopVoice();voiceState('aborted');}
 else{voiceMode=true;startVoice();}
};
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{
 if(mode===b.dataset.mode)return;
 mode=b.dataset.mode;
 document.querySelectorAll('[data-mode]').forEach(x=>x.classList.toggle('selected',x===b));
 $('#subtitle').textContent=mode==='missing'?'左にあって、右にない絵はどれ？':'２枚のカードに、共通する絵はどれ？';
 $('#leftLabel').textContent=mode==='missing'?'お手本のカード':'１枚目のカード';
 $('#rightLabel').textContent=mode==='missing'?'ひとつ足りないカード':'２枚目のカード';
 if(phase!=='lobby'){reset();primeVoiceFromGesture();}
});
$('#nextBtn').onclick=()=>{
 if(!awarded)return;
 if(round===10){
  stopVoice();const best=Math.max(...scores),winners=scores.map((s,i)=>s===best?i+1:null).filter(Boolean);
  $('#resultScore').textContent=players===1?`${scores[0]} / 10 POINTS`:scores.map((s,i)=>`P${i+1}  ${s} POINTS`).join('\n')+'\n'+(winners.length===1?`プレイヤー ${winners[0]} の勝ち！`:'引き分け！');
  $('#result').showModal();
 }else{round++;newRound();primeVoiceFromGesture();}
};
$('#hintBtn').onclick=()=>{
 hint=!hint;document.body.classList.toggle('show-words',hint);
 $('#hintBtn').textContent=hint?'Aa ヒント：英単語を隠す':'Aa ヒント：英単語を表示';
 $('#hintBtn').setAttribute('aria-pressed',String(hint));
};
$('#pronounce').onclick=()=>{
 if(!solved||!('speechSynthesis' in window))return;
 stopVoice();window.speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(data.answer.en);
 utterance.lang='en-US';utterance.rate=.8;window.speechSynthesis.speak(utterance);
};
$('#settingsBtn').onclick=()=>{stopVoice();$('#settings').showModal();};
// Closing Settings with Esc or the X should also restore automatic listening.
if(typeof $('#settings').addEventListener==='function')$('#settings').addEventListener('close',()=>{if(phase==='playing'&&voiceMode&&!solved&&!pendingFoul)startVoice();});
$('#restart').onclick=()=>{
 $('#settings').close();
 if(phase==='lobby'){/* Save settings without skipping the opening PLAY action. */return;}
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
// Keep the game hidden behind the opening, with no card or mic activity before PLAY.
$('#gameApp').inert=true;setPhase('lobby');
