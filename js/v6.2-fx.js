let ac;
function note(hz,delay){
 const o=ac.createOscillator(),g=ac.createGain(),t=ac.currentTime+delay;
 o.type='triangle';
 o.frequency.setValueAtTime(hz,t);
 g.gain.setValueAtTime(.001,t);
 g.gain.exponentialRampToValueAtTime(.04,t+.02);
 g.gain.exponentialRampToValueAtTime(.001,t+.22);
 o.connect(g).connect(ac.destination);
 o.start(t);o.stop(t+.24);
}
window.shoutSpotFx=(correct,player)=>{
 const board=document.querySelector('#table');
 if(!board)return;
 board.querySelectorAll('.fx-layer').forEach(el=>el.remove());
 if(!correct)return;
 if(document.querySelector('#configSound')?.checked){
  try{
   const Audio=window.AudioContext||window.webkitAudioContext;
   if(Audio){
    ac ||= new Audio();
    if(ac.state==='suspended')ac.resume();
    [659,831,988,1319].forEach((f,i)=>note(f,i*.09));
   }
  }catch{}
 }
 const layer=document.createElement('div');
 layer.className='fx-layer win';
 layer.style.setProperty('--origin-x',player===0?'27%':'73%');
 const ring=document.createElement('span');
 ring.className='fx-ring';
 layer.append(ring);
 for(let i=0;i<30;i++){
  const a=i*Math.PI/15,d=100+Math.random()*180;
  const p=document.createElement('span');
  p.className='fx-particle';
  for(const [k,v] of Object.entries({
   '--dx':`${Math.cos(a)*d}px`,
   '--dy':`${Math.sin(a)*d}px`,
   '--spin':`${Math.random()*720-360}deg`,
   '--size':`${7+Math.random()*8}px`,
   '--delay':`${Math.random()*.1}s`,
   '--color':['#fff1a8','#ff906c','#a0ffe5','#d9c0ff'][i%4]
  }))p.style.setProperty(k,v);
  layer.append(p);
 }
 board.append(layer);
 setTimeout(()=>layer.remove(),1250);
};
