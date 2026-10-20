// Shout Spot V5 interaction layer for the V4 app. Original scoring, cards and speech remain intact.
const V5=q=>document.querySelector(q);
const v5field=V5('#playfield');
const v5players=V5('#players');
const v5settings=V5('#settings form');
function v5Option(title,id,options){const l=document.createElement('label');l.textContent=title;const s=document.createElement('select');s.id=id;for(const [value,text] of options){const o=document.createElement('option');o.value=value;o.textContent=text;s.append(o);}l.append(s);v5settings.insertBefore(l,V5('#restart'));return s;}
v5Option('回答方法','inputMode',[['tap','タップ（おすすめ）'],['hybrid','タップ＋音声'],['voice','音声のみ']]);
v5Option('お手つき','penaltyV5',[['on','−1点'],['off','減点なし']]);
v5Option('効果音','soundV5',[['on','ON'],['off','OFF']]);
const v5modes=V5('.modes');const v5counts=V5('.picture-control');
const v5modeLabel=document.createElement('label');v5modeLabel.textContent='ゲームの種類';v5modeLabel.append(v5modes);v5settings.insertBefore(v5modeLabel,V5('#restart'));
const v5countLabel=document.createElement('label');v5countLabel.textContent='絵の個数';v5countLabel.append(v5counts);v5settings.insertBefore(v5countLabel,V5('#restart'));
V5('header').insertBefore(V5('.round-status'),V5('.head-actions')); 
const v5rails=[];
for(let i=0;i<2;i++){
 const rail=document.createElement('aside');rail.className='v5-rail v5-player-'+(i+1);rail.setAttribute('aria-label',`プレイヤー${i+1}の回答`);
 rail.innerHTML=`<div class="v5-rail-title">P${i+1} <strong>0</strong></div><div class="v5-rail-choices"></div>`;
 i===0?v5field.prepend(rail):v5field.append(rail);v5rails.push(rail);
}
const v5effect=document.createElement('div');v5effect.id='v5effect';v5field.append(v5effect);
let v5LastIds='',v5RefreshPending=false;
function v5Symbols(){return [...V5('#left').querySelectorAll('.symbol')];}
function v5IsMissing(){return V5('[data-mode="missing"]').classList.contains('selected');}
function v5CorrectId(){const a=v5Symbols().map(el=>el.dataset.id),b=new Set([...V5('#right').querySelectorAll('.symbol')].map(el=>el.dataset.id));return a.find(id=>v5IsMissing()?!b.has(id):b.has(id));}
function v5Sound(correct){if(V5('#soundV5').value==='off')return;try{const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;const ctx=window.__shoutV5Audio ||= new AC();ctx.resume();const now=ctx.currentTime;for(const [f,delay] of (correct?[[660,0],[880,.12],[1090,.24]]:[[220,0],[170,.14]])){const o=ctx.createOscillator(),g=ctx.createGain();o.type=correct?'sine':'sawtooth';o.frequency.value=f;g.gain.setValueAtTime(.0001,now+delay);g.gain.exponentialRampToValueAtTime(.12,now+delay+.02);g.gain.exponentialRampToValueAtTime(.0001,now+delay+.2);o.connect(g).connect(ctx.destination);o.start(now+delay);o.stop(now+delay+.22);}}catch{}}
function v5Flash(text,correct,person){v5effect.textContent=text;v5effect.className='';void v5effect.offsetWidth;v5effect.className=correct?'v5-success':'v5-mistake';const rail=v5rails[person];rail.classList.add(correct?'v5-win':'v5-foul');setTimeout(()=>rail.classList.remove('v5-win','v5-foul'),700);}
function v5Scores(){const ps=V5('#playerScores').children;v5rails.forEach((rail,i)=>{rail.querySelector('strong').textContent=ps[i]?.querySelector('strong')?.textContent||'0';rail.classList.toggle('v5-out',ps[i]?.classList.contains('sitting-out')||false);});}
function v5Tap(id,person,button){if(V5('#arenaState').textContent!=='SHOUT!'||V5('#inputMode').value==='voice'||Number(v5players.value)!==2||V5('#settings').open)return;
 const scoring=V5('#playerScores').children[person];if(!scoring||scoring.classList.contains('sitting-out'))return;
 const target=v5Symbols().find(x=>x.dataset.id===id);if(!target)return;
 const correct=id===v5CorrectId();target.onclick();const after=V5('#playerScores').children[person];if(after&&!after.disabled)after.onclick();v5Sound(correct);v5Flash(correct?`✨ P${person+1} +1 🎉`:`P${person+1} −1`,correct,person);v5Scores();if(!correct){button.classList.add('v5-wrong');setTimeout(()=>button.classList.remove('v5-wrong'),650);}
}
function v5BuildRails(){const ids=v5Symbols().map(el=>el.dataset.id);if(!ids.length)return;const key=ids.join(',');if(key===v5LastIds)return;v5LastIds=key;
 const symbols=v5Symbols();v5rails.forEach((rail,person)=>{const bank=rail.querySelector('.v5-rail-choices');bank.replaceChildren();for(const symbol of symbols){const b=document.createElement('button');b.type='button';b.className='v5-answer';b.dataset.id=symbol.dataset.id;b.innerHTML=`<span>${symbol.querySelector('.emoji').textContent}</span>`;b.setAttribute('aria-label',symbol.getAttribute('aria-label')||'回答');b.onclick=()=>v5Tap(symbol.dataset.id,person,b);bank.append(b);}});
 v5field.classList.remove('v5-live');v5Scores();}
const v5Update=()=>{if(v5RefreshPending)return;v5RefreshPending=true;queueMicrotask(()=>{v5RefreshPending=false;v5BuildRails();});};
new MutationObserver(v5Update).observe(V5('#left'),{childList:true});
new MutationObserver(v5Scores).observe(V5('#playerScores'),{childList:true});
new MutationObserver(()=>{const phase=V5('#arenaState').textContent;if(phase==='SHOUT!'){v5field.classList.add('v5-live');V5('#feedback').textContent='GO! 自分側のアイコンをタップ！';}else if(['STANDBY','LOOK!','READY...'].includes(phase)){v5field.classList.remove('v5-live');v5LastIds='';}}).observe(V5('#arenaState'),{childList:true});
V5('#settings').addEventListener('close',()=>{document.body.dataset.v5Input=V5('#inputMode').value;v5Scores();});
v5players.value='2';document.body.dataset.v5Input='tap';
