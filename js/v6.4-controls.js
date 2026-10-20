(() => {
  const $ = s => document.querySelector(s);
  const first = $('#first');
  const second = $('#second');
  const status = $('#status');

  if (!first || !second || !status) return;

  const label = (num, name) => `
    <span class="v64-face">
      <b>${num}</b>
      <span>${name}</span>
      <span>表示</span>
    </span>
  `;

  first.innerHTML = label('①', '1枚目');
  second.innerHTML = label('②', '2枚目');

  first.setAttribute('aria-label', '1枚目のカードを表示');
  second.setAttribute('aria-label', '2枚目のカードを表示');

  function update() {
    first.classList.toggle('v64-ready', !first.disabled);
    second.classList.toggle('v64-ready', !second.disabled);

    if (!first.disabled) {
      status.textContent = '① 左の点滅ボタンをタップ！';
    } else if (!second.disabled) {
      status.textContent = '② 右の点滅ボタンをタップ！';
    }
  }

  const observer = new MutationObserver(update);

  for (const button of [first, second]) {
    observer.observe(button, {
      attributes: true,
      attributeFilter: ['disabled']
    });
  }

  update();

  let audio;

  function playTapSound() {
    if (!$('#configSound')?.checked) return;

    try {
      const Audio = window.AudioContext ||
                    window.webkitAudioContext;

      if (!Audio) return;

      audio ||= new Audio();

      if (audio.state === 'suspended') audio.resume();

      const start = audio.currentTime;

      [720, 980].forEach((frequency, i) => {
        const time = start + i * 0.085;
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, time);
        oscillator.frequency.exponentialRampToValueAtTime(
          frequency * 1.07, time + 0.105
        );

        gain.gain.setValueAtTime(0.0001, time);
        gain.gain.exponentialRampToValueAtTime(
          0.075, time + 0.012
        );
        gain.gain.exponentialRampToValueAtTime(
          0.0001, time + 0.19
        );

        oscillator.connect(gain);
        gain.connect(audio.destination);

        oscillator.start(time);
        oscillator.stop(time + 0.2);
      });
    } catch {}
  }

  for (const button of [first, second]) {
    button.addEventListener('click', () => {
      if (!button.disabled) playTapSound();
    }, { capture: true });
  }
})();