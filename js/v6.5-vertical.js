(() => {
  const $ = (s) => document.querySelector(s);

  function makeVerticalChars(text) {
    const frag = document.createDocumentFragment();
    for (const ch of [...text]) {
      const span = document.createElement("span");
      span.textContent = ch;
      frag.appendChild(span);
    }
    return frag;
  }

  function setVerticalButton(button, text, side, mark = "") {
    if (!button || button.querySelector(".v65-vertical-wrap")) return;

    const wrap = document.createElement("span");
    wrap.className = "v65-vertical-wrap";

    const stack = document.createElement("span");
    stack.className = "v65-vertical-stack";

    if (mark) {
      const markSpan = document.createElement("span");
      markSpan.className = "v65-mark";
      markSpan.textContent = mark;
      stack.appendChild(markSpan);
    }

    const body = document.createElement("span");
    body.className = "v65-body";
    body.appendChild(makeVerticalChars(text));
    stack.appendChild(body);

    wrap.appendChild(stack);
    button.replaceChildren(wrap);
    button.dataset.v65Side = side;
  }

  function refreshMainButtons() {
    const first = $("#first");
    const second = $("#second");

    if (first) {
      setVerticalButton(first, "1枚目を表示", "left", "①");
      first.setAttribute("aria-label", "1枚目を表示");
    }
    if (second) {
      setVerticalButton(second, "2枚目を表示", "right", "②");
      second.setAttribute("aria-label", "2枚目を表示");
    }
  }

  function refreshBonusButtons() {
    const read = $("#bonusRead");
    const skip = $("#bonusSkip");

    if (read) {
      const side = read.closest(".side-one") ? "left" : "right";
      setVerticalButton(read, "読む", side, "🎤");
      read.setAttribute("aria-label", "読む");
    }

    if (skip) {
      const side = skip.closest(".side-one") ? "left" : "right";
      setVerticalButton(skip, "スキップ", side, "");
      skip.setAttribute("aria-label", "スキップ");
    }
  }

  let audio;
  function playCuteTap() {
    if (!$("#configSound")?.checked) return;

    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;

      audio ||= new Audio();
      if (audio.state === "suspended") audio.resume();

      const start = audio.currentTime;
      [
        { f: 740, d: 0.00, type: "sine" },
        { f: 990, d: 0.08, type: "triangle" }
      ].forEach(note => {
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        const t = start + note.d;

        osc.type = note.type;
        osc.frequency.setValueAtTime(note.f, t);
        osc.frequency.exponentialRampToValueAtTime(note.f * 1.05, t + 0.10);

        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.055, t + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);

        osc.connect(gain);
        gain.connect(audio.destination);
        osc.start(t);
        osc.stop(t + 0.2);
      });
    } catch {}
  }

  function bindTapSound(button) {
    if (!button || button.dataset.v65SoundBound === "1") return;
    button.dataset.v65SoundBound = "1";
    button.addEventListener("click", () => {
      if (!button.disabled) playCuteTap();
    }, { capture: true });
  }

  function refreshAll() {
    refreshMainButtons();
    refreshBonusButtons();

    bindTapSound($("#first"));
    bindTapSound($("#second"));
    bindTapSound($("#bonusRead"));
    bindTapSound($("#bonusSkip"));
  }

  const observer = new MutationObserver(() => refreshAll());

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      refreshAll();
      observer.observe(document.body, { childList: true, subtree: true });
    }, { once: true });
  } else {
    refreshAll();
    observer.observe(document.body, { childList: true, subtree: true });
  }
})();