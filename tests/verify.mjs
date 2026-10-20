import assert from 'node:assert/strict';
import {items,makeRound} from '../js/engine.js';
import {matchesAnswer,matchesSpoken,classifySpeech,createSpeech} from '../js/speech.js';

// Word recognition and stale callbacks are the existing engine's contracts.
for(const a of items){
 assert(matchesAnswer(a.en,a.en));assert(matchesAnswer(`It's a ${a.en}!`,a.en));
 for(const b of items)if(a.id!==b.id)assert(!matchesAnswer(b.en,a.en),`${b.en} accepted as ${a.en}`);
}
assert(matchesAnswer('a bike','bicycle'));
assert(matchesAnswer('doughnut','donut'));
assert(!matchesAnswer('not a cat','cat'));
assert(!matchesAnswer('cat or dog','cat'));
for(const item of items){assert(matchesSpoken(item.ja,item,'ja'),`${item.ja} match failed`);}
assert(matchesSpoken('いぬ',items.find(x=>x.en==='dog'),'ja'));
assert(matchesSpoken('犬です',items.find(x=>x.en==='dog'),'ja'));
assert(matchesSpoken('答えはリンゴです',items.find(x=>x.en==='apple'),'ja'));
assert(!matchesSpoken('猫',items.find(x=>x.en==='dog'),'ja'));
for(let n=3;n<=8;n++){for(const category of ['all','animals','food','things']){for(const mode of ['missing','common']){
 const r=makeRound(mode,n,category);assert.equal(r.left.length,n);assert.equal(r.right.length,mode==='missing'?n-1:n);
 const overlap=r.left.filter(x=>r.right.includes(x));assert.equal(overlap.length,mode==='missing'?n-1:1);
 assert(r.left.includes(r.answer));
}}}
const sample={left:[items[0],items[1]],right:[items[1]],answer:items[0]};
assert.equal(classifySpeech('犬',sample,'ja','cards').type,'correct');
assert.equal(classifySpeech('猫',sample,'ja','cards').type,'wrong');
assert.equal(classifySpeech('こんにちは',sample,'ja','cards').type,'ignored');
assert.equal(classifySpeech('こんにちは',sample,'ja','all').type,'wrong');
assert.equal(classifySpeech(['こんにちは','犬'],sample,'ja','cards').type,'correct');

let current;
class FakeSpeech{
 constructor(){current=this;this.started=false;}
 start(){this.started=true;this.onstart?.();}
 abort(){this.started=false;this.onend?.();}
}
globalThis.SpeechRecognition=FakeSpeech;
let finals=[],states=[];
const adapter=createSpeech({onState:x=>states.push(x),onText:()=>{},onFinal:x=>finals.push(x)});
adapter.start('ja');assert.equal(current.lang,'ja-JP');let result=[{transcript:'cat'}];result.isFinal=false;
current.onresult({resultIndex:0,results:[result]});assert.equal(finals.length,0);
result.isFinal=true;current.onresult({resultIndex:0,results:[result]});assert.deepEqual(finals,['cat']);
const stale=current.onresult;adapter.stop();stale({resultIndex:0,results:[result]});assert.equal(finals.length,1);
adapter.start();current.onerror({error:'not-allowed'});current.onend();assert.equal(states.at(-1),'not-allowed');

// Deterministic timers simulate a one-card preview and a sliding second card.
let clock=0,nextTimer=1;const pending=new Map();
globalThis.setTimeout=(fn,delay)=>{const id=nextTimer++;pending.set(id,{due:clock+delay,fn});return id;};
globalThis.clearTimeout=(id)=>pending.delete(id);
function advance(ms){
 const until=clock+ms;
 while(true){
  const jobs=[...pending].filter(([,job])=>job.due<=until).sort((a,b)=>a[1].due-b[1].due);
  if(!jobs.length)break;
  const [id,job]=jobs[0];pending.delete(id);clock=job.due;job.fn();
 }
 clock=until;
}
class Element{
 constructor(){
  this.children=[];this.style={setProperty(){}};this.dataset={};this.value='';
  this.disabled=false;this.open=false;this.hidden=false;this.inert=false;this.className='';
  const set=new Set();this.classList={add:(...names)=>names.forEach(n=>set.add(n)),remove:(...names)=>names.forEach(n=>set.delete(n)),contains:n=>set.has(n),toggle:(n,on)=>{if(on===undefined)on=!set.has(n);on?set.add(n):set.delete(n);}};
 }
 set innerHTML(s){this.html=s;}get innerHTML(){return this.html||'';}
 replaceChildren(){this.children=[];}append(x){this.children.push(x);}
 setAttribute(){}addEventListener(){}showModal(){this.open=true;}close(){this.open=false;}
}
const els={};const ids=[
 'players','count','category','micBtn','micStatus','transcript','left','right','roundText','dots','nextBtn','feedback',
 'scoreInstruction','pronounce','playerScores','score','categoryLabel','hintBtn','settings','result','settingsBtn',
 'restart','again','resultSettings','fullscreen','subtitle','leftLabel','rightLabel','resultScore','cancelFoul',
 'manualFoul','playBtn','openingSettings','opening','gameApp','arenaState','playfield','stageCue',
 'language','judging','langQuick','countValue','countMinus','countPlus','openingTagline'
];
ids.forEach(id=>els['#'+id]=new Element());
els['#players'].value='4';els['#count'].value='6';els['#category'].value='all';els['#language'].value='en';els['#judging'].value='cards';
const modes=['missing','common'].map(mode=>{const e=new Element();e.dataset.mode=mode;return e;});
globalThis.document={
 querySelector:s=>els[s],
 querySelectorAll:s=>s==='[data-mode]'?modes:s==='.symbol'?[...els['#left'].children,...els['#right'].children]:[],
 createElement:()=>new Element(),body:new Element(),addEventListener(){},
};
globalThis.window={addEventListener(){}};
await import('../js/app.js');

assert.equal(els['#arenaState'].textContent,'READY');
assert(els['#gameApp'].inert,'opening holds the game inactive');
assert.equal(els['#left'].children.length,0,'cards are not pre-rendered before play');
assert.equal(els['#micBtn'].classList.contains('listening'),false,'the game microphone is not started before PLAY');
els['#openingSettings'].onclick();assert(els['#settings'].open);
els['#restart'].onclick();assert(!els['#settings'].open);
assert.equal(els['#arenaState'].textContent,'READY');

els['#playBtn'].onclick();
assert.equal(els['#arenaState'].textContent,'LOOK!');
assert(els['#playfield'].classList.contains('first-only'));
assert.equal(els['#left'].children.length,6);
assert.equal(els['#right'].children.length,5);
assert(current.started,'auto voice recognition was primed by PLAY gesture');
assert(!els['#gameApp'].inert);
// Speech and taps during animation must not count, even for correct answer.
let correct=els['#left'].children.find(x=>!els['#right'].children.some(y=>y.dataset.id===x.dataset.id));
const previewResult=[{transcript:items.find(x=>x.id===correct.dataset.id).en}];previewResult.isFinal=true;
current.onresult({resultIndex:0,results:[previewResult]});
correct.onclick();assert.equal(els['#arenaState'].textContent,'LOOK!');
advance(280);assert(els['#opening'].hidden);
advance(270);assert.equal(els['#arenaState'].textContent,'GET READY');
assert(els['#playfield'].classList.contains('cards-ready'));
advance(800);assert.equal(els['#arenaState'].textContent,'SHOUT!');
assert(els['#micBtn'].classList.contains('listening'));
assert(els['#playerScores'].children.every(x=>x.disabled));

function speak(word){const r=[{transcript:word}];r.isFinal=true;current.onresult({resultIndex:0,results:[r]});}
function advanceToLive(){advance(550);assert.equal(els['#arenaState'].textContent,'GET READY');advance(800);assert.equal(els['#arenaState'].textContent,'SHOUT!');}
function correctWord(){
 const left=els['#left'].children,right=els['#right'].children;
 const match=left.find(x=>!right.some(y=>y.dataset.id===x.dataset.id));
 return items.find(x=>x.id===match.dataset.id).en;
}
// Correct result pauses recognition and requires manual identification of the first player.
els['#langQuick'].onclick();assert.equal(els['#language'].value,'ja');assert.equal(current.lang,'ja-JP');
const jpAnswer=items.find(x=>x.en===correctWord()).ja;
speak(jpAnswer);assert.equal(els['#arenaState'].textContent,'CORRECT!');
els['#langQuick'].onclick();assert.equal(els['#language'].value,'en');
assert(!els['#micBtn'].classList.contains('listening'));
assert(els['#nextBtn'].disabled);
els['#playerScores'].children[2].onclick();assert(!els['#nextBtn'].disabled);
assert(els['#playerScores'].children[2].html.includes('<strong>1</strong>'));
const awardedHtml=els['#playerScores'].children[2].html;
els['#playerScores'].children[2].onclick();assert.equal(els['#playerScores'].children[2].html,awardedHtml);
els['#nextBtn'].onclick();assert.equal(els['#arenaState'].textContent,'LOOK!');
assert(current.started,'next round starts voice recognition inside Next click gesture');
advanceToLive();
els['#countPlus'].onclick();assert.equal(els['#countValue'].textContent,'7');
assert.equal(els['#left'].children.length,6,'count changes from the next card, not mid-answer');
// Incorrect spoken English always PAUSES; no penalty until human confirms.
let bad=els['#left'].children.find(x=>els['#right'].children.some(y=>y.dataset.id===x.dataset.id));
speak(items.find(x=>x.id===bad.dataset.id).en);
assert.equal(els['#arenaState'].textContent,'PAUSED');
assert(!els['#micBtn'].classList.contains('listening'));
assert(!els['#cancelFoul'].hidden);
assert(els['#feedback'].textContent.includes('ストップ'));
assert(!els['#feedback'].textContent.includes('答え：'));
els['#cancelFoul'].onclick();
assert.equal(els['#arenaState'].textContent,'SHOUT!');
assert(els['#micBtn'].classList.contains('listening'));
// Manual foul: selected person sits out, the others continue automatically.
els['#manualFoul'].onclick();assert.equal(els['#arenaState'].textContent,'PAUSED');
els['#playerScores'].children[0].onclick();assert.equal(els['#arenaState'].textContent,'SHOUT!');
assert(els['#playerScores'].children[0].disabled);
speak(correctWord());els['#playerScores'].children[0].onclick();assert(els['#nextBtn'].disabled);
els['#playerScores'].children[1].onclick();assert(!els['#nextBtn'].disabled);
els['#nextBtn'].onclick();assert.equal(els['#arenaState'].textContent,'LOOK!');advanceToLive();
assert.equal(els['#left'].children.length,7,'card count changed next round');
assert(!els['#playerScores'].children[0].html.includes('この問題はお休み'));

for(let r=3;r<=10;r++){
 speak(correctWord());els['#playerScores'].children[2].onclick();
 assert(!els['#nextBtn'].disabled);els['#nextBtn'].onclick();
 if(r<10)advanceToLive();
}
assert(els['#result'].open);assert(els['#resultScore'].textContent.includes('プレイヤー 3 の勝ち'));
els['#again'].onclick();assert(!els['#result'].open);
assert.equal(els['#arenaState'].textContent,'LOOK!');advanceToLive();

// 1-player all-out case stays skip-able, no score increment.
els['#players'].value='1';els['#restart'].onclick();advanceToLive();
els['#manualFoul'].onclick();els['#playerScores'].children[0].onclick();
assert(!els['#nextBtn'].disabled);
assert(els['#feedback'].textContent.includes('全員お手つき'));
assert(els['#playerScores'].children[0].html.includes('<strong>0</strong>'));
els['#nextBtn'].onclick();advanceToLive();assert(!els['#playerScores'].children[0].html.includes('この問題はお休み'));

// Browser recognition ends from silence: it reconnects without requiring a mic click.
const ended=current;ended.onend();advance(400);assert(current!==ended);assert(current.started);
console.log('PASS: bilingual vocabulary, adjustable 3-8 pictures, judging policy, opening PLAY, single-card preview, sliding card, gesture mic activation, ignored early speech, auto-listen, voice pauses, wrong answer confirmation, score, 10 rounds, reset, solo, silent reconnect.');
