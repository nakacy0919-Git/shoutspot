// Shout Spot bilingual speech recognition. No external dependencies.
// Recognition works on final transcripts only. Interims never award or penalize.
const aliases={dog:['dogs'],cat:['cats'],rabbit:['rabbits','bunny'],lion:['lions'],panda:['pandas'],frog:['frogs'],monkey:['monkeys'],penguin:['penguins'],turtle:['turtles','tortoise'],butterfly:['butterflies'],elephant:['elephants'],giraffe:['giraffes'],dolphin:['dolphins'],octopus:['octopuses'],bee:['bees'],pig:['pigs'],apple:['apples'],banana:['bananas'],strawberry:['strawberries'],grapes:['grape'],watermelon:['watermelons'],lemon:['lemons'],cherries:['cherry'],pineapple:['pineapples'],carrot:['carrots'],pizza:['pizzas'],hamburger:['burger','burgers','hamburgers'],donut:['doughnut','donuts','doughnuts'],'ice cream':['icecream'],cookie:['cookies','biscuit','biscuits'],bread:['loaf of bread'],car:['cars'],bicycle:['bike','bikes','bicycles'],airplane:['plane','planes','aeroplane','airplanes'],rocket:['rockets'],'soccer ball':['football','ball','soccer balls'],guitar:['guitars'],books:['book'],clock:['alarm clock','clocks'],key:['keys'],umbrella:['umbrellas'],balloon:['balloons'],crown:['crowns'],present:['gift','gifts','presents'],'teddy bear':['bear','teddy','teddy bears'],diamond:['diamonds'],shoe:['shoes','sneaker','sneakers']};
const jaAliases={dog:['いぬ','イヌ','わんちゃん'],cat:['ねこ','ネコ'],rabbit:['うさぎ'],lion:['らいおん'],panda:['ぱんだ'],frog:['かえる'],monkey:['さる'],penguin:['ぺんぎん'],turtle:['かめ'],butterfly:['ちょう','ちょうちょ'],elephant:['ぞう'],giraffe:['きりん'],dolphin:['いるか'],octopus:['たこ'],bee:['はち'],pig:['ぶた'],apple:['りんご'],banana:['ばなな'],strawberry:['いちご'],grapes:['ぶどう'],watermelon:['すいか'],lemon:['れもん'],cherries:['さくらんぼ'],pineapple:['ぱいなっぷる'],carrot:['にんじん'],broccoli:['ぶろっこりー'],pizza:['ぴざ'],hamburger:['はんばーがー','はんばーぐ'],donut:['どーなつ'], 'ice cream':['あいす','あいすくりーむ'],cookie:['くっきー'],bread:['ぱん'],car:['くるま','じどうしゃ'],bicycle:['じてんしゃ','ちゃりんこ'],airplane:['ひこうき'],rocket:['ろけっと'], 'soccer ball':['さっかーぼーる','ぼーる'],guitar:['ぎたー'],books:['ほん','ほんのやま','しょせき'],clock:['とけい','めざましどけい'],key:['かぎ'],umbrella:['かさ'],balloon:['ふうせん'],crown:['おうかん'],present:['ぷれぜんと','おくりもの'], 'teddy bear':['ぬいぐるみ','くま','くまのぬいぐるみ'],diamond:['だいや','だいやもんど'],shoe:['くつ','しゅーず']};
export const normalize=s=>String(s||'').toLowerCase().replace(/[’']/g,'').replace(/[^a-z\s]/g,' ').replace(/\s+/g,' ').trim();
export function normalizeJapanese(s){
 // Match kana across hiragana/katakana, preserve kanji and long vowel marks.
 return String(s||'').normalize('NFKC').toLowerCase().replace(/[\u30a1-\u30f6]/g,c=>String.fromCharCode(c.charCodeAt(0)-96))
  .replace(/[\s　、。，．!！?？「」『』（）()\-]/g,'').trim();
}
export function stripEnglish(s){return normalize(s).replace(/^(?:(?:i (?:see|found)|it is|its|the answer is|this is|there is) )?/,'').replace(/^(?:a|an|the) /,'').replace(/ (?:please)$/,'');}
function stripJapanese(s){return normalizeJapanese(s).replace(/^(?:こたえは|答えは|みつけた|見つけた|これは|それは|あれは|わたしは|えは)/,'').replace(/(?:です|だよ|ですね)$/,'');}
export function matchesAnswer(text,en){const s=stripEnglish(text);return [en,...(aliases[en]||[])].some(x=>normalize(x)===s);}
export function matchesSpoken(text,item,language='en'){
 if(!item)return false;
 if(language==='ja'){
  const s=stripJapanese(text);
  return !!s&&[item.ja,...(jaAliases[item.en]||[])].some(x=>normalizeJapanese(x)===s);
 }
 return matchesAnswer(text,item.en);
}
/** Return one of correct, wrong, ignored. For card-only mode other conversation is ignored. */
export function classifySpeech(transcripts,round,language='en',judging='cards'){
 const choices=Array.isArray(transcripts)?transcripts:[transcripts];
 if(choices.some(s=>matchesSpoken(s,round.answer,language)))return {type:'correct'};
 const visible=[...round.left,...round.right];
 for(const s of choices){
  const item=visible.find(x=>matchesSpoken(s,x,language));
  if(item)return {type:'wrong',spoken:s,item};
 }
 if(judging==='all'){
  const utterance=choices.map(s=>String(s||'').trim()).find(Boolean);
  if(utterance)return {type:'wrong',spoken:utterance};
 }
 return {type:'ignored'};
}
export function createSpeech({onState,onText,onFinal}){
 const API=globalThis.SpeechRecognition||globalThis.webkitSpeechRecognition;
 let recognition=null,generation=0;
 return {
  supported:!!API,
  stop(){generation++;if(recognition){recognition.onend=null;recognition.onerror=null;recognition.onresult=null;try{recognition.abort();}catch{}recognition=null;}},
  start(language='en'){
   this.stop();if(!API){onState('unsupported');return;}
   const token=generation,rec=recognition=new API();
   rec.lang=language==='ja'?'ja-JP':'en-US';rec.continuous=false;rec.interimResults=true;rec.maxAlternatives=3;
   let errored=false;
   rec.onstart=()=>{if(token===generation)onState('listening');};
   rec.onresult=e=>{
    if(token!==generation)return;
    for(let i=e.resultIndex;i<e.results.length;i++){
     const result=e.results[i];if(!result?.length)continue;
     onText(result[0].transcript,result.isFinal);
     if(result.isFinal){
      onFinal(result[0].transcript,Array.from(result,x=>x.transcript));
      return; // one final utterance per recognition session
     }
    }
   };
   rec.onerror=e=>{if(token!==generation)return;errored=true;onState(e.error);};
   rec.onend=()=>{if(token!==generation)return;recognition=null;if(!errored)onState('idle');};
   try{onState('starting');rec.start();}catch{recognition=null;onState('failed');}
  }
 };
}
