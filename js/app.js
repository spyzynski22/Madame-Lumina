/**
 * Madame Lumina's Fortune Machine
 * Interactive 3D fortune-teller cabinet for the Purple Light Lounge.
 * No dependencies — plain JS, CSS 3D transforms and the Web Audio API.
 */
(() => {
  "use strict";

  // ---------- Config ----------
  const STAGE_W = 360; // unscaled stage size (px), see .stage in style.css
  const STAGE_H = 800;
  const MIN_TILT = -20;
  const MAX_TILT = 12;
  const MAX_LUCKY_NUMBER = 33;

  // Points of interest in the seer portrait, as fractions of the image size.
  // Used to place the glowing eyes and crystal ball over the photo.
  const SEER_POINTS = {
    eyeL: [0.4375, 0.2283],
    eyeR: [0.5667, 0.2283],
    orb: [0.4917, 0.77],
  };
  const SEER_FOCUS_Y = 0.3; // matches object-position: 50% 30%

  const MESSAGES = {
    idle: "Insert a quarter to awaken the seer",
    wake1: "Ahh… a seeker. Come closer.",
    wake2: "The light is gathering your message…",
    reveal: "Your fortune has been revealed.",
    goodbye: "Thank you, seeker. Come again.",
  };

  const FORTUNES = window.FORTUNES || [];
  const COLORS = window.LUCKY_COLORS || ["Lavender"];

  // ---------- Elements ----------
  const $ = (id) => document.getElementById(id);
  const el = {
    stage: $("stage"),
    stageBox: $("stageBox"),
    cab: $("cab"),
    crown: $("crown"),
    front: $("front"),
    pilL: $("pilL"),
    pilR: $("pilR"),
    seer: $("seer"),
    seerImg: $("seerImg"),
    eyeL: $("eyeL"),
    eyeR: $("eyeR"),
    orb: $("orb"),
    sign: $("sign"),
    slot: $("slot"),
    cardout: $("cardout"),
    takeCard: $("takeCard"),
    coin: $("coin"),
    spin: $("spin"),
    trayMsg: $("trayMsg"),
    veil: $("veil"),
    again: $("again"),
    close: $("close"),
    fNo: $("fNo"),
    fTitle: $("fTitle"),
    fMsg: $("fMsg"),
    fColor: $("fColor"),
    fNum: $("fNum"),
  };

  // ---------- State ----------
  // "idle" → waiting for a coin, "awake" → reading, "card" → card is out
  let state = "idle";
  let rotY = -20;
  let rotX = -4;
  let lastInteraction = 0;
  let lastFortune = -1;

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const randomInt = (max) => Math.floor(Math.random() * max);
  const easeOutCubic = (k) => 1 - Math.pow(1 - k, 3);

  // ---------- Layout ----------
  function fitStage() {
    const scale = Math.min(1, (window.innerWidth - 32) / STAGE_W);
    el.stage.style.transform = `scale(${scale})`;
    el.stageBox.style.height = `${STAGE_H * scale}px`;
  }

  function placeSeerGlow() {
    const w = el.seer.offsetWidth;
    const h = el.seer.offsetHeight;
    const iw = el.seerImg.naturalWidth;
    const ih = el.seerImg.naturalHeight;
    if (!w || !iw) return;

    // Mirror object-fit: cover with object-position: 50% 30%
    const scale = Math.max(w / iw, h / ih);
    const offsetX = (w - iw * scale) * 0.5;
    const offsetY = (h - ih * scale) * SEER_FOCUS_Y;

    for (const [key, [fx, fy]] of Object.entries(SEER_POINTS)) {
      const node = el[key];
      node.style.left = `${offsetX + fx * iw * scale - node.offsetWidth / 2}px`;
      node.style.top = `${offsetY + fy * ih * scale - node.offsetHeight / 2}px`;
    }
  }

  // ---------- Marquee bulbs ----------
  const bulbs = [];

  function addBulb(parent, x, y) {
    const bulb = document.createElement("span");
    bulb.className = "bulb";
    bulb.style.left = `${x}px`;
    bulb.style.top = `${y}px`;
    parent.appendChild(bulb);
    bulbs.push(bulb);
  }

  function buildBulbs() {
    // Arc of bulbs around the crown
    const crownW = 328;
    const crownH = 100;
    const arcCount = 13;
    for (let i = 0; i < arcCount; i++) {
      const angle = Math.PI * (i / (arcCount - 1));
      addBulb(
        el.crown,
        crownW / 2 - (crownW / 2 - 14) * Math.cos(angle),
        crownH - (crownH - 12) * Math.sin(angle),
      );
    }
    // Columns of bulbs down each pilaster
    for (const pilaster of [el.pilL, el.pilR]) {
      for (let i = 0; i < 14; i++) addBulb(pilaster, 8, 14 + i * 40);
    }
  }

  function startBulbChase() {
    let tick = 0;
    setInterval(() => {
      tick++;
      const fast = state === "awake";
      bulbs.forEach((bulb, i) => {
        const on = fast ? (i + tick) % 3 !== 0 : (i + Math.floor(tick / 4)) % 2 === 0;
        bulb.classList.toggle("on", on);
      });
    }, 120);
  }

  // ---------- Cabinet rotation ----------
  function applyRotation() {
    el.cab.style.setProperty("--ry", `${rotY}deg`);
    el.cab.style.setProperty("--rx", `${rotX}deg`);
  }

  function animateRotation(target, duration, done) {
    const start = rotY;
    const t0 = performance.now();
    (function step(now) {
      const k = Math.min(1, (now - t0) / duration);
      rotY = start + (target - start) * easeOutCubic(k);
      applyRotation();
      if (k < 1) requestAnimationFrame(step);
      else if (done) done();
    })(t0);
  }

  function initRotation() {
    let drag = null;

    el.stage.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button")) return;
      drag = { x: e.clientX, y: e.clientY, rotY, rotX };
      el.stage.classList.add("dragging");
      el.stage.setPointerCapture(e.pointerId);
    });

    el.stage.addEventListener("pointermove", (e) => {
      if (!drag) return;
      rotY = drag.rotY + (e.clientX - drag.x) * 0.45;
      rotX = Math.max(MIN_TILT, Math.min(MAX_TILT, drag.rotX - (e.clientY - drag.y) * 0.2));
      lastInteraction = performance.now();
      applyRotation();
    });

    const endDrag = () => {
      drag = null;
      el.stage.classList.remove("dragging");
    };
    el.stage.addEventListener("pointerup", endDrag);
    el.stage.addEventListener("pointercancel", endDrag);

    el.spin.addEventListener("click", () => {
      lastInteraction = performance.now();
      animateRotation(rotY + 360, 1600, () => {
        rotY %= 360;
        applyRotation();
      });
    });

    // Gentle idle sway while nobody is touching it
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    (function sway(now) {
      if (!reduceMotion && !drag && state !== "awake" && now - lastInteraction > 2500) {
        rotY += Math.sin(now / 1600) * 0.04;
        applyRotation();
      }
      requestAnimationFrame(sway);
    })(0);

    applyRotation();
  }

  // ---------- Sound (synthesized, no audio files) ----------
  let audioCtx = null;

  function getAudio() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();
    } catch {
      return null;
    }
    return audioCtx;
  }

  function tone(freq, duration, type = "sine", volume = 0.15, delay = 0) {
    const ctx = getAudio();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t = ctx.currentTime + delay;
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(volume, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  const sounds = {
    coin() {
      tone(2400, 0.25, "triangle", 0.12);
      tone(3100, 0.2, "triangle", 0.08, 0.06);
      tone(1800, 0.35, "triangle", 0.07, 0.18);
      tone(220, 0.15, "square", 0.04, 0.3);
    },
    hum() {
      tone(110, 3.2, "sawtooth", 0.018);
      tone(165, 3.2, "sawtooth", 0.018);
    },
    chime() {
      [523.25, 659.25, 783.99, 1046.5, 783.99, 1318.5].forEach((f, i) =>
        tone(f, 1.1, "sine", 0.09, i * 0.16),
      );
    },
    whirr() {
      for (let i = 0; i < 14; i++) tone(300 + Math.random() * 80, 0.06, "square", 0.02, i * 0.1);
    },
    card() {
      tone(880, 0.5, "sine", 0.06);
    },
  };

  // ---------- Coin ----------
  function isOverSlot(x, y) {
    const r = el.slot.getBoundingClientRect();
    const pad = 24;
    return x > r.left - pad && x < r.right + pad && y > r.top - pad && y < r.bottom + pad;
  }

  function resetCoinPosition() {
    el.coin.classList.remove("dragging");
    el.coin.style.left = "";
    el.coin.style.top = "";
    el.slot.style.transform = "";
  }

  // Tap/Enter: animate a copy of the coin flying into the slot
  function flyCoinToSlot() {
    if (state !== "idle") return;
    const from = el.coin.getBoundingClientRect();
    const to = el.slot.getBoundingClientRect();
    const ghost = el.coin.cloneNode(true);
    ghost.removeAttribute("id");
    ghost.setAttribute("aria-hidden", "true");
    Object.assign(ghost.style, {
      position: "fixed",
      left: `${from.left}px`,
      top: `${from.top}px`,
      margin: 0,
      zIndex: 60,
      transition: "transform .8s cubic-bezier(.5,0,.3,1), opacity .8s",
    });
    document.body.appendChild(ghost);
    el.coin.classList.add("gone");

    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    requestAnimationFrame(() => {
      ghost.style.transform = `translate(${dx}px, ${dy}px) scale(.35) rotateY(80deg)`;
      ghost.style.opacity = "0.2";
    });
    setTimeout(() => {
      ghost.remove();
      insertCoin();
    }, 800);
  }

  function initCoin() {
    let drag = null;

    el.coin.addEventListener("pointerdown", (e) => {
      if (state !== "idle") return;
      getAudio(); // unlock audio on first gesture
      e.preventDefault();
      const r = el.coin.getBoundingClientRect();
      drag = { dx: e.clientX - r.left, dy: e.clientY - r.top, sx: e.clientX, sy: e.clientY, moved: false };
      el.coin.setPointerCapture(e.pointerId);
    });

    el.coin.addEventListener("pointermove", (e) => {
      if (!drag) return;
      if (!drag.moved) {
        if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 6) return;
        drag.moved = true;
        el.coin.classList.add("dragging");
      }
      el.coin.style.left = `${e.clientX - drag.dx}px`;
      el.coin.style.top = `${e.clientY - drag.dy}px`;
      el.slot.style.transform = isOverSlot(e.clientX, e.clientY) ? "scale(1.08)" : "";
    });

    el.coin.addEventListener("pointerup", (e) => {
      if (!drag) return;
      const { moved } = drag;
      drag = null;
      if (!moved) {
        resetCoinPosition();
        flyCoinToSlot();
        return;
      }
      const hit = isOverSlot(e.clientX, e.clientY);
      resetCoinPosition();
      if (hit) insertCoin();
      else el.trayMsg.textContent = "Almost. Drop it right on the gold coin slot.";
    });

    el.coin.addEventListener("pointercancel", () => {
      drag = null;
      resetCoinPosition();
    });

    el.coin.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && state === "idle") {
        e.preventDefault();
        getAudio();
        flyCoinToSlot();
      }
    });
  }

  // ---------- Reading sequence ----------
  async function typeSign(text) {
    el.sign.textContent = "";
    for (const ch of text) {
      el.sign.textContent += ch;
      await wait(34);
    }
  }

  function pickFortune() {
    if (FORTUNES.length < 2) return 0;
    let i;
    do i = randomInt(FORTUNES.length);
    while (i === lastFortune);
    lastFortune = i;
    return i;
  }

  function fillCard(index) {
    const { title, message } = FORTUNES[index];
    el.fNo.textContent = `No. ${String(index + 1).padStart(2, "0")}`;
    el.fTitle.textContent = title;
    el.fMsg.textContent = message;
    el.fColor.textContent = COLORS[randomInt(COLORS.length)];
    el.fNum.textContent = 1 + randomInt(MAX_LUCKY_NUMBER);
  }

  function setAwake(on) {
    el.front.classList.toggle("awake", on);
    el.stage.classList.toggle("lit", on);
  }

  async function insertCoin() {
    if (state !== "idle") return;
    state = "awake";

    el.coin.classList.add("gone");
    el.slot.classList.remove("hot");
    el.trayMsg.textContent = "The seer is waking…";
    sounds.coin();

    // Swing the machine to face the player
    rotY = ((rotY % 360) + 360) % 360;
    if (rotY > 180) rotY -= 360;
    rotX = -4;
    animateRotation(-8, 900);

    await wait(500);
    setAwake(true);
    sounds.hum();
    await typeSign(MESSAGES.wake1);
    await wait(900);
    await typeSign(MESSAGES.wake2);
    sounds.chime();
    await wait(1500);
    await typeSign(MESSAGES.reveal);
    sounds.whirr();

    fillCard(pickFortune());
    el.cardout.classList.add("out");
    el.takeCard.tabIndex = 0;

    await wait(1600);
    setAwake(false);
    el.trayMsg.textContent = "Take your card from the slot.";
    state = "card";
  }

  // ---------- Fortune card overlay ----------
  function openCard() {
    if (state !== "card") return;
    sounds.card();
    el.veil.hidden = false;
    // Two frames so the flip transition runs after the overlay is shown
    requestAnimationFrame(() => requestAnimationFrame(() => el.veil.classList.add("show")));
    el.again.focus();
  }

  function hideCard() {
    el.veil.classList.remove("show");
    el.veil.hidden = true;
  }

  function resetMachine() {
    hideCard();
    el.cardout.classList.remove("out");
    el.takeCard.tabIndex = -1;
    el.coin.classList.remove("gone");
    el.slot.classList.add("hot");
    el.sign.textContent = MESSAGES.idle;
    el.trayMsg.textContent = "Here's another quarter. Drag it into the slot.";
    state = "idle";
  }

  function initCard() {
    el.takeCard.addEventListener("click", openCard);
    el.again.addEventListener("click", () => {
      resetMachine();
      el.coin.focus();
    });
    el.close.addEventListener("click", () => {
      hideCard();
      el.sign.textContent = MESSAGES.goodbye;
      setTimeout(() => {
        if (state === "card") resetMachine();
      }, 1200);
    });
    el.veil.addEventListener("click", (e) => {
      if (e.target === el.veil) el.close.click();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !el.veil.hidden) el.close.click();
    });
  }

  // ---------- Boot ----------
  function init() {
    el.sign.textContent = MESSAGES.idle;
    fitStage();
    buildBulbs();
    startBulbChase();
    initRotation();
    initCoin();
    initCard();

    if (el.seerImg.complete) placeSeerGlow();
    else el.seerImg.addEventListener("load", placeSeerGlow);

    window.addEventListener("resize", () => {
      fitStage();
      placeSeerGlow();
    });
  }

  init();
})();
