/* SHOUT SPOT 6.3: tabletop controls and optional English pronunciation bonus. */
(() => {
  const $ = (selector) => document.querySelector(selector);
  let active = null;
  let recognition = null;
  let session = 0;
  let finishTimer = null;
  let soundContext = null;

  function stopListening() {
    session++;
    if (recognition) {
      recognition.onresult = recognition.onerror = recognition.onend = null;
      try { recognition.abort(); } catch {}
      recognition = null;
    }
  }
  function clearBonus() {
    stopListening();
    clearTimeout(finishTimer);
    finishTimer = null;
    active = null;
    $('#bonusPanel')?.remove();
    document.querySelectorAll('.bonus-side-controls').forEach(node => node.remove());
    $('#answerReveal')?.remove();
  }
  window.shoutSpotBonusCancel = clearBonus;
  window.shoutSpotBonusPause = () => { stopListening(); if ($('#bonusRead') && active && !active.scored) $('#bonusRead').disabled=false; };
  window.shoutSpotClearReveal = () => { $('#answerReveal')?.remove(); };

  function reveal(word, japanese) {
    let el = $('#answerReveal');
    if (!el) {
      el = document.createElement('div');
      el.id = 'answerReveal';
      $('.table').append(el);
    }
    el.textContent = `正解：${japanese} · ${word}`;
  }
  window.shoutSpotShowWord = reveal;

  function successSound() {
    if (!$('#configSound')?.checked) return;
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      soundContext ||= new Audio();
      if (soundContext.state === 'suspended') soundContext.resume();
      const t0 = soundContext.currentTime;
      [523,659,784,1047,1319,1568].forEach((freq,i)=>{
        const t = t0 + i * .09;
        const oscillator = soundContext.createOscillator();
        const gain = soundContext.createGain();
        oscillator.type = i % 2 ? 'triangle' : 'sine';
        oscillator.frequency.setValueAtTime(freq,t);
        gain.gain.setValueAtTime(.0001,t);
        gain.gain.exponentialRampToValueAtTime(.14,t+.018);
        gain.gain.exponentialRampToValueAtTime(.0001,t+.28);
        oscillator.connect(gain).connect(soundContext.destination);
        oscillator.start(t);oscillator.stop(t+.29);
      });
    } catch {}
  }

  // Compare single English vocabulary answers while allowing articles, plurals and a few common variants.
  const variants = {
    'bicycle':['bike'], 'airplane':['plane','aeroplane'], 'donut':['doughnut'],
    'soccer ball':['football'], 'chili pepper':['chilli pepper'],
    'present':['gift'], 'books':['book'], 'cherries':['cherry'],
    'grapes':['grape'], 'shoe':['shoes'], 'sneaker':['shoe'],
    'sailboat':['sailing boat'], 'teddy bear':['teddy'],
    'ice cream':['icecream'], 'hamburger':['burger']
  };
  const normalize = (str) => String(str).toLowerCase().replace(/[^a-z\s]/g,' ')
    .replace(/\s+/g,' ').trim()
    .replace(/^(?:(?:i see|i found|it is|this is|the answer is|there is)\s+)+/, '')
    .replace(/^(?:a|an|the)\s+/,'').replace(/\s+please$/,'');
  const singular = (s) => s.endsWith('ies') ? s.slice(0,-3)+'y' : s.endsWith('s') && !s.endsWith('ss') ? s.slice(0,-1) : s;
  function matches(transcript, word) {
    const heard = normalize(transcript);
    const acceptable = [word,...(variants[word]||[])].map(normalize);
    return acceptable.some(w => heard === w || singular(heard) === singular(w));
  }

  function renderStatus(value, positive=false) {
    const el = $('#bonusTranscript');
    if (el) {
      el.textContent = value;
      el.classList.toggle('passed',positive);
    }
  }

  function finishBonus() {
    if (!active) return;
    const {done} = active;
    clearBonus();
    done();
  }

  function startReading() {
    const round = active;
    if (!round || round.scored) return;
    const API = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!API) {
      renderStatus('このブラウザーでは音声認識を使えません。スキップしてください。');
      return;
    }
    stopListening();
    const token = session;
    const rec = recognition = new API();
    rec.lang = 'en-US';
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 3;
    const read = $('#bonusRead');
    if (read) read.disabled = true;
    renderStatus('🎙 聞き取り中… 英語で言ってください');
    let processed = false;
    rec.onresult = e => {
      if (token !== session || round !== active || processed) return;
      const result = e.results[e.resultIndex];
      if (!result) return;
      const spoken = result[0].transcript.trim();
      renderStatus(`認識結果：${spoken}`);
      if (!result.isFinal) return;
      processed = true;
      const correct = Array.from(result).some(a => matches(a.transcript,round.answer.en));
      stopListening();
      if (round !== active) return;
      if (correct) {
        round.scored = true;
        round.award();
        renderStatus(`🌟 PERFECT! +1点　認識：${spoken}`,true);
        const panel = $('#bonusPanel');
        if (panel) panel.classList.add('success');
        const rail = $('#player'+round.player);
        rail?.classList.add('win');
        setTimeout(()=>rail?.classList.remove('win'),850);
        successSound();
        window.shoutSpotFx?.(true,round.player);
        $('#bonusRead')?.setAttribute('disabled','');
        $('#bonusSkip')?.setAttribute('disabled','');
        finishTimer = setTimeout(finishBonus,1700);
      } else {
        renderStatus(`認識結果：${spoken}　もう一度挑戦！`);
        if (read) read.disabled = false;
      }
    };
    rec.onerror = e => {
      if (token !== session || round !== active) return;
      renderStatus(`マイク：${e.error || 'エラー'}。再挑戦かスキップを選んでください。`);
      if (read) read.disabled = false;
    };
    rec.onend = () => {
      if (token !== session || round !== active) return;
      recognition = null;
      if (!processed && read) {
        read.disabled = false;
        renderStatus('聞き取れませんでした。もう一度「読む」を押してください。');
      }
    };
    try {rec.start();}
    catch { stopListening(); if (read) read.disabled=false;renderStatus('マイクを開始できません。再挑戦かスキップを選んでください。'); }
  }

  window.shoutSpotBonus = (round) => {
    clearBonus();
    active = {...round,scored:false};
    const el = document.createElement('div');
    el.id = 'bonusPanel';
    el.innerHTML = `<div class="bonus-eyebrow">ENGLISH BONUS · P${round.player+1}</div><div class="bonus-word"></div><div class="bonus-japanese"></div><div id="bonusTranscript" aria-live="polite">🎤「読む」を押して英語で発音！ 正解で +1点</div>`;
    el.querySelector('.bonus-word').textContent = round.answer.en;
    el.querySelector('.bonus-japanese').textContent = round.answer.ja;
    $('.table').append(el);
    const rail = document.createElement('div');
    rail.className = 'bonus-side-controls';
    rail.innerHTML = `<button type="button" id="bonusRead" class="bonus-rail-button"><span>🎤 読む</span></button><button type="button" id="bonusSkip" class="bonus-rail-button skip"><span>スキップ →</span></button>`;
    $('#player'+round.player).append(rail);
    $('#bonusRead').addEventListener('click',startReading);
    $('#bonusSkip').addEventListener('click',finishBonus);
  };
  function initialize() {
    for (const [id,number,title] of [['first','①','1枚目'],['second','②','2枚目']]) {
      const button = $('#'+id);
      if (button) button.innerHTML = `<span class="v63-button-face"><b>${number}</b><span>${title}</span></span>`;
    }
    const settings = $('.settings-grid');
    if (settings && !$('#configBonus')) {
      const label = document.createElement('label');
      label.className = 'checkline';
      label.innerHTML = `<input id="configBonus" type="checkbox">英語チャレンジ（発音正解で+1点）`;
      settings.append(label);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',initialize,{once:true});
  else initialize();
  window.addEventListener('pagehide',clearBonus);
})();
