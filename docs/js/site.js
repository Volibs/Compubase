(function () {
  "use strict";
  const cfg = window.COMPUBASE_CONFIG || {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const NS = "http://www.w3.org/2000/svg";
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const svgEl = (tag, attrs, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  const polar = (a, r) => [100 + r * Math.sin(a * Math.PI / 180), 100 - r * Math.cos(a * Math.PI / 180)];

  /* ---------------- download links: the latest release of this repo ---------------- */
  let repo = cfg.repo || "Volibs/Compubase";
  const gh = location.hostname.match(/^([^.]+)\.github\.io$/);
  if (gh) repo = gh[1] + "/" + (location.pathname.split("/")[1] || gh[1] + ".github.io");
  const dl = `https://github.com/${repo}/releases/latest/download/Compubase-Setup.exe`;
  $$("[data-download]").forEach((a) => {
    a.href = dl;
    a.addEventListener("click", () => { const t = $("#thanks"); if (t) t.hidden = false; });
  });

  /* ---------------- menu ---------------- */
  const menu = $("#menu");
  menu.addEventListener("click", () => {
    const open = document.body.classList.toggle("menu-open");
    menu.setAttribute("aria-expanded", String(open));
  });
  $$("#nav a").forEach((a) => a.addEventListener("click", () => document.body.classList.remove("menu-open")));

  /* ---------------- dials ---------------- */
  // needles use damped spring physics: they overshoot a touch and settle, like a real instrument
  const needles = [];
  function dial(svg, o) {
    const sweep = (v) => o.a0 + (Math.max(o.min, Math.min(o.max, v)) - o.min) / (o.max - o.min) * (o.a1 - o.a0);
    for (const b of o.bands || []) {
      const [x0, y0] = polar(sweep(b[0]), 80), [x1, y1] = polar(sweep(b[1]), 80);
      svgEl("path", { d: `M${x0} ${y0} A80 80 0 0 1 ${x1} ${y1}`, class: b[2], "stroke-width": 5, fill: "none" }, svg);
    }
    for (let v = o.min; v <= o.max + 1e-6; v += o.minor) {
      const major = Math.abs((v - o.min) % o.major) < 1e-6;
      const a = sweep(v), [x0, y0] = polar(a, major ? 70 : 75), [x1, y1] = polar(a, 84);
      svgEl("line", { x1: x0, y1: y0, x2: x1, y2: y1, class: major ? "tick" : "tick minor", "stroke-width": major ? 2.6 : 1.4, "stroke-linecap": "round" }, svg);
      if (major) {
        const [tx, ty] = polar(a, 53);
        svgEl("text", { x: tx, y: ty + 5, "text-anchor": "middle", class: "num" }, svg).textContent = v;
      }
    }
    svgEl("text", { x: 100, y: 156, "text-anchor": "middle", class: "face-label" }, svg).textContent = o.label;
    const val = svgEl("text", { x: 100, y: 173, "text-anchor": "middle", class: "face-value" }, svg);
    const g = svgEl("g", {}, svg);
    svgEl("path", { d: "M97 112 L99 26 L100 20 L101 26 L103 112 Z", class: "needle" }, g);
    svgEl("path", { d: "M97.5 112 L102.5 112 L101.5 132 L98.5 132 Z", fill: "#3a3c42" }, g);
    svgEl("circle", { cx: 100, cy: 100, r: 9, class: "hub", "stroke-width": 1.5 }, svg);
    svgEl("path", { d: "M34 70 A70 70 0 0 1 150 38 A78 78 0 0 0 34 70 Z", class: "glare" }, svg);
    const n = { value: o.min, vel: 0, target: o.min, set(v) { this.target = v; } };
    n.draw = () => {
      g.setAttribute("transform", `rotate(${sweep(n.value).toFixed(2)} 100 100)`);
      val.textContent = o.fmt(Math.max(o.min, n.value));
    };
    needles.push(n);
    return n;
  }

  const gauges = {};
  const svgOf = (name) => $(`[data-gauge="${name}"] svg`);
  gauges.memory = dial(svgOf("memory"), { min: 0, max: 100, a0: -135, a1: 135, major: 20, minor: 5,
    bands: [[0, 20, "band-glow"], [80, 100, "band-amber"]], label: "Compubase · MB", fmt: (v) => `${Math.round(v)} MB` });
  gauges.volume = dial(svgOf("volume"), { min: 0, max: 100, a0: -135, a1: 135, major: 20, minor: 10,
    label: "Ctrl+Alt+↑↓", fmt: (v) => `${Math.round(v)}%` });
  gauges.modules = dial(svgOf("modules"), { min: 0, max: 21, a0: -135, a1: 135, major: 3, minor: 1,
    bands: [[18, 21, "band-amber"]], label: "of 21", fmt: (v) => `${Math.round(v)} on` });

  // Game Mode: an attitude indicator that bobs while things animate, and levels off when Game Mode is on
  (function () {
    const svg = svgOf("horizon");
    const clip = svgEl("clipPath", { id: "hzclip" }, svgEl("defs", {}, svg));
    svgEl("circle", { cx: 100, cy: 100, r: 86 }, clip);
    const world = svgEl("g", { "clip-path": "url(#hzclip)" }, svg);
    const card = svgEl("g", {}, world);
    svgEl("rect", { x: -100, y: -100, width: 400, height: 200, class: "hz-sky" }, card);
    svgEl("rect", { x: -100, y: 100, width: 400, height: 200, class: "hz-ground" }, card);
    svgEl("line", { x1: -100, y1: 100, x2: 300, y2: 100, class: "hz-line", "stroke-width": 2 }, card);
    for (const d of [-20, -10, 10, 20]) {
      const w = Math.abs(d) === 20 ? 24 : 14;
      svgEl("line", { x1: 100 - w, y1: 100 + d * 1.6, x2: 100 + w, y2: 100 + d * 1.6, class: "hz-line", "stroke-width": 1.4, opacity: .7 }, card);
    }
    for (let a = -60; a <= 60; a += 30) {
      const [x0, y0] = polar(a, 78), [x1, y1] = polar(a, 86);
      svgEl("line", { x1: x0, y1: y0, x2: x1, y2: y1, class: "tick", "stroke-width": 2 }, svg);
    }
    svgEl("path", { d: "M58 104 H86 L93 112 M142 104 H114 L107 112", class: "hz-plane", "stroke-width": 4, "stroke-linecap": "round", "stroke-linejoin": "round" }, svg);
    svgEl("circle", { cx: 100, cy: 104, r: 3.5, fill: "var(--amber)" }, svg);
    const txt = svgEl("text", { x: 100, y: 160, "text-anchor": "middle", class: "hz-text" }, svg);
    txt.textContent = "OFF";
    gauges.horizon = { card, txt, bank: 0, pitch: 0 };
  })();

  // local time, like the desktop clock widget
  (function () {
    const svg = svgOf("clock");
    for (let i = 0; i < 60; i++) {
      const major = i % 5 === 0, [x0, y0] = polar(i * 6, major ? 72 : 78), [x1, y1] = polar(i * 6, 84);
      svgEl("line", { x1: x0, y1: y0, x2: x1, y2: y1, class: major ? "tick" : "tick minor", "stroke-width": major ? 2.6 : 1.2 }, svg);
      if (major) { const [tx, ty] = polar(i * 6, 58); svgEl("text", { x: tx, y: ty + 5, "text-anchor": "middle", class: "num" }, svg).textContent = i === 0 ? 12 : i / 5; }
    }
    svgEl("text", { x: 100, y: 132, "text-anchor": "middle", class: "face-label" }, svg).textContent = "Clock widget";
    const h = svgEl("path", { d: "M97 104 L99 56 L101 56 L103 104 Z", class: "needle" }, svg);
    const m = svgEl("path", { d: "M98 106 L99.5 30 L100.5 30 L102 106 Z", class: "needle" }, svg);
    const s = svgEl("line", { x1: 100, y1: 114, x2: 100, y2: 26, stroke: "var(--amber)", "stroke-width": 1.2 }, svg);
    svgEl("circle", { cx: 100, cy: 100, r: 6, class: "hub" }, svg);
    const tick = () => {
      const d = new Date(), sec = d.getSeconds(), min = d.getMinutes() + sec / 60, hr = (d.getHours() % 12) + min / 60;
      h.setAttribute("transform", `rotate(${hr * 30} 100 100)`);
      m.setAttribute("transform", `rotate(${min * 6} 100 100)`);
      s.setAttribute("transform", `rotate(${sec * 6} 100 100)`);
    };
    tick(); setInterval(tick, 1000);
  })();

  // Heading: the compass card doubles as navigation to the module banks
  (function () {
    const svg = svgOf("heading");
    const card = svgEl("g", {}, svg);
    for (let a = 0; a < 360; a += 10) {
      const major = a % 30 === 0, [x0, y0] = polar(a, major ? 74 : 79), [x1, y1] = polar(a, 85);
      svgEl("line", { x1: x0, y1: y0, x2: x1, y2: y1, class: major ? "tick" : "tick minor", "stroke-width": major ? 2 : 1 }, card);
    }
    const labels = [["Gaming", 0], ["Music", 90], ["Desktop", 180], ["Tools", 270]].map(([name, a]) => {
      const [x, y] = polar(a, 58);
      const t = svgEl("text", { x, y: y + 4, "text-anchor": "middle", class: "hd-label", transform: `rotate(${a} ${x} ${y})`, tabindex: 0, role: "link", "aria-label": `Go to ${name} modules` }, card);
      t.textContent = name.toUpperCase();
      t.dataset.a = a; t.dataset.target = "bank-" + name.toLowerCase();
      return t;
    });
    svgEl("path", { d: "M100 70 L104 92 L128 102 L128 108 L104 104 L103 124 L110 130 L110 134 L100 131 L90 134 L90 130 L97 124 L96 104 L72 108 L72 102 L96 92 Z", fill: "var(--amber)", opacity: .9 }, svg);
    let rot = 0, target = 0, v = 0;
    const aim = (a) => { target = -a; labels.forEach((l) => l.classList.toggle("on", +l.dataset.a === a)); };
    labels.forEach((l) => {
      const go = () => { const b = document.getElementById(l.dataset.target); if (b) b.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }); };
      l.addEventListener("mouseenter", () => aim(+l.dataset.a));
      l.addEventListener("focus", () => aim(+l.dataset.a));
      l.addEventListener("click", go);
      l.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
    });
    aim(0);
    gauges.heading = (dt) => {
      if (reduce) rot = target;
      else { v += (target - rot) * 60 * dt; v *= Math.pow(0.004, dt); rot += v * dt; }
      card.setAttribute("transform", `rotate(${rot.toFixed(2)} 100 100)`);
    };
  })();

  /* ---------------- modules: a bank of switches per group ---------------- */
  const MODULES = {
    gaming: [["Game Mode", "Boosts the game, then Compubase goes ultra-light", "Ctrl+Alt+G", 1], ["Flappy Compu", "The arcade game, also a playable wallpaper", "", 1],
      ["Crosshair", "Your own crosshair over any game", "Ctrl+Alt+Shift+C", 1], ["System Monitor", "CPU, RAM and network, plus an in-game overlay", "Ctrl+Alt+O", 1]],
    music: [["Spotify Hotkeys", "Play, skip and Spotify-only volume from anywhere", "Ctrl+Alt+P", 1], ["Soundboard", "Sound pads on hotkeys, even into Discord", "Ctrl+Alt+Shift+X", 0],
      ["Sound Control", "Per-app volume and one-key mic mute", "Ctrl+Alt+Shift+M", 1]],
    desktop: [["Compu Dock", "A magnifying dock and Launchpad for your taskbar", "Ctrl+Alt+Shift+Space", 0], ["Live Wallpaper", "Scenes, videos and GIFs; AI enhance for blurry ones", "Ctrl+Alt+W", 1],
      ["Desktop Widgets", "Clock, weather, PC stats, now playing", "Ctrl+Alt+Shift+W", 1], ["Display", "Night filter and extra dimming", "Ctrl+Alt+Shift+N", 1],
      ["Window Tools", "Pin on top, see-through, force-close", "Ctrl+Alt+T", 0], ["Quick Launch", "Your apps on a radial wheel", "Alt+Q", 0]],
    tools: [["Compu Bar", "One box to open apps and do anything", "Alt+Space", 1], ["Clipboard History", "Search and paste older copies", "Ctrl+Alt+V", 1],
      ["Focus Timer", "Pomodoro and break reminders", "Ctrl+Alt+Shift+F", 0], ["Color Picker", "Copy any colour on screen", "Ctrl+Alt+Shift+P", 0],
      ["Keep Awake", "Stop sleep for downloads and renders", "Ctrl+Alt+Shift+A", 0], ["Power Tools", "Screen off, fix taskbar, clean junk", "Ctrl+Alt+Shift+S", 0],
      ["Speed Test", "Download, upload and ping", "", 0], ["Browser", "Built-in tabs that sleep when unused", "Ctrl+Alt+B", 1]],
  };
  const breakers = $("#breakers");
  const updateCount = () => gauges.modules.set($$("#breakers input:checked").length);
  for (const [key, mods] of Object.entries(MODULES)) {
    const bank = document.createElement("section");
    bank.className = "bank"; bank.id = "bank-" + key;
    bank.innerHTML = `<div class="bank-head">${key}<span>${mods.length} modules</span></div>`;
    for (const [name, desc, keys, on] of mods) {
      const row = document.createElement("label");
      row.className = "brk";
      row.innerHTML = `<input type="checkbox" ${on ? "checked" : ""}><span class="sw" aria-hidden="true"></span>` +
        `<span class="brk-name">${name}<span class="brk-desc">${desc}</span></span>` +
        `<span class="brk-key${keys ? "" : " none"}">${keys || "no key"}</span>`;
      row.querySelector("input").addEventListener("change", updateCount);
      bank.appendChild(row);
    }
    breakers.appendChild(bank);
  }

  /* ---------------- Game Mode: the guarded switch ---------------- */
  const state = { game: false, volume: 70, memory: 60 };
  const gm = $("#gm"), gmState = $("#gm-state"), roMem = $("#ro-mem");
  const lamp = (id, on) => $(`[data-lamp="${id}"]`).classList.toggle("on", on);
  $('[data-lamp="game"]').classList.add("amber");
  function applyGame() {
    const on = state.game;
    gm.setAttribute("aria-checked", String(on));
    gmState.textContent = on ? "On · ultra-light, hotkeys still work" : "Off · flip to try it";
    gauges.memory.set(on ? 10 : state.memory);
    gauges.volume.set(on ? 40 : state.volume);
    gauges.horizon.txt.textContent = on ? "ON" : "OFF";
    lamp("game", on); lamp("wall", !on); lamp("widgets", !on);
    roMem.textContent = on ? "10 MB" : "60 MB";
  }
  gm.addEventListener("click", () => { state.game = !state.game; applyGame(); });
  $$("[data-vol]").forEach((b) => b.addEventListener("click", () => {
    if (state.game) return;
    state.volume = Math.max(0, Math.min(100, state.volume + 10 * +b.dataset.vol));
    gauges.volume.set(state.volume);
  }));

  /* ---------------- one loop drives every needle, the horizon and the compass ---------------- */
  let last = performance.now();
  function frame(t) {
    const dt = Math.min(0.05, (t - last) / 1000); last = t;
    for (const n of needles) {
      if (reduce) { n.value = n.target; n.vel = 0; }
      else { n.vel += (n.target - n.value) * 80 * dt; n.vel *= Math.pow(0.003, dt); n.value += n.vel * dt; }
      n.draw();
    }
    const hz = gauges.horizon;
    const calm = state.game || reduce;
    const bankT = calm ? 0 : Math.sin(t / 1400) * 9, pitchT = calm ? 0 : Math.sin(t / 2100) * 5;
    const k = Math.min(1, dt * 3);
    hz.bank += (bankT - hz.bank) * k; hz.pitch += (pitchT - hz.pitch) * k;
    hz.card.setAttribute("transform", `rotate(${hz.bank.toFixed(2)} 100 100) translate(0 ${hz.pitch.toFixed(2)})`);
    gauges.heading(dt);
    requestAnimationFrame(frame);
  }
  // power-on: the panel lights up and the needles sweep to their readings one after another
  document.body.classList.add("powering");
  requestAnimationFrame(frame);
  const powerOn = () => {
    document.body.classList.remove("powering");
    const d = reduce ? 0 : 1;
    setTimeout(() => gauges.memory.set(state.memory), 200 * d);
    setTimeout(() => gauges.volume.set(state.volume), 450 * d);
    setTimeout(updateCount, 700 * d);
  };
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => setTimeout(powerOn, reduce ? 0 : 250));

  /* ---------------- screens (the multi-function display) ---------------- */
  const SHOTS = {
    home: ["home", "Home · your quick switches and every module at a glance"],
    gamemode: ["gamemode", "Game Mode · detects games, boosts them, goes ultra-light"],
    spotify: ["spotify", "Spotify Hotkeys · favourites on their own keys, on shuffle"],
    wallpaper: ["wallpaper", "Live Wallpaper · scenes, your videos, free HD downloads"],
    search: ["search", "Ctrl+K · find any module, setting or hotkey"],
    modules: ["modules", "Modules · switch features on or off in one click"],
    settings: ["settings", "Appearance · themes, backgrounds, text size, corners"],
  };
  const img = $("#mfd-img"), cap = $("#mfd-cap");
  $$(".sk[data-shot]").forEach((b) => b.addEventListener("click", () => {
    const [file, text] = SHOTS[b.dataset.shot];
    $$(".sk").forEach((x) => x.classList.toggle("on", x === b));
    img.classList.add("swap");
    const next = new Image();
    next.onload = () => { img.src = next.src; img.alt = "Compubase " + text; cap.textContent = text; requestAnimationFrame(() => img.classList.remove("swap")); };
    next.src = `assets/${file}.png`;
  }));

  /* ---------------- Panel lighting: the theme picker ---------------- */
  const THEMES = [["Compu Violet", "#7c6cff", "#22d3ee"], ["Ocean", "#3b82f6", "#2dd4bf"], ["Sunset", "#f97316", "#ec4899"],
    ["Emerald", "#10b981", "#a3e635"], ["Crimson", "#ef4444", "#f59e0b"], ["Sakura", "#ec4899", "#c4b5fd"],
    ["Gold", "#eab308", "#fb923c"], ["Mono", "#a1a1aa", "#e4e4e7"]];
  const knob = $("#knob"), det = $("#detents"), plate = $(".knob-plate");
  const angles = THEMES.map((_, i) => -135 + i * (270 / (THEMES.length - 1)));
  let current = 0;
  const buttons = THEMES.map(([name, a, b], i) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button"; btn.tabIndex = -1;
    btn.innerHTML = `<i style="background:linear-gradient(135deg,${a},${b})"></i>${name}`;
    li.appendChild(btn); det.appendChild(li);
    btn.addEventListener("click", () => setTheme(i, true));
    return btn;
  });
  const place = () => {
    const r = plate.clientWidth / 2 - 44;
    buttons.forEach((b, i) => { const [x, y] = polar(angles[i], r); b.style.left = (x - 100) + "px"; b.style.top = (y - 100) + "px"; });
  };
  function setTheme(i, save) {
    current = (i + THEMES.length) % THEMES.length;
    const [name, a, b] = THEMES[current];
    document.documentElement.style.setProperty("--accent", a);
    document.documentElement.style.setProperty("--accent-2", b);
    knob.style.transform = `rotate(${angles[current]}deg)`;
    knob.setAttribute("aria-valuenow", current); knob.setAttribute("aria-valuetext", name);
    buttons.forEach((x, j) => x.classList.toggle("on", j === current));
    $("#theme-name").textContent = name;
    if (save) try { localStorage.setItem("compubase-theme", name); } catch (e) { /* private mode */ }
  }
  knob.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); setTheme(current + 1, true); }
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); setTheme(current - 1, true); }
  });
  let dragging = false, moved = false;
  const angleAt = (e) => { const r = knob.getBoundingClientRect(); return Math.atan2(e.clientX - (r.left + r.width / 2), -(e.clientY - (r.top + r.height / 2))) * 180 / Math.PI; };
  knob.addEventListener("pointerdown", (e) => { dragging = true; moved = false; knob.setPointerCapture(e.pointerId); });
  knob.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const a = angleAt(e);
    let best = 0; angles.forEach((x, i) => { if (Math.abs(x - a) < Math.abs(angles[best] - a)) best = i; });
    if (best !== current) { moved = true; setTheme(best, true); }
  });
  knob.addEventListener("pointerup", () => { if (dragging && !moved) setTheme(current + 1, true); dragging = false; });
  window.addEventListener("resize", place);
  place();
  let saved = 0;
  try { const i = THEMES.findIndex((t) => t[0] === localStorage.getItem("compubase-theme")); if (i >= 0) saved = i; } catch (e) { /* ignore */ }
  setTheme(saved, false);

  /* ---------------- the game + leaderboard ---------------- */
  const canvas = $("#flappy");
  if (canvas && window.FlappyCompu) {
    const best = $("#web-best");
    const game = new window.FlappyCompu(canvas, { onOver: (s, b) => { best.textContent = b; } });
    best.textContent = game.best;
    const flap = (e) => { e.preventDefault(); canvas.focus(); game.flap(); };
    canvas.addEventListener("mousedown", flap);
    canvas.addEventListener("touchstart", flap, { passive: false });
    canvas.addEventListener("keydown", (e) => { if (["Space", "ArrowUp", "KeyW", "Enter"].includes(e.code)) flap(e); });
    new IntersectionObserver(([en]) => { game.running = en.isIntersecting; }, { threshold: 0.05 }).observe(canvas);
  }
  const board = $("#board"), bstate = $("#board-state");
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  if (!cfg.leaderboardDb) {
    bstate.textContent = "Opening soon";
    board.innerHTML = `<li class="empty">The global board opens very soon. Warm up here, then post your score from the app.</li>`;
  } else {
    const base = cfg.leaderboardDb.replace(/\/$/, ""), q = "orderBy=%22score%22&limitToLast=10";
    const load = () => fetch(`${base}/scores.json?${q}`).then((r) => r.json()).then((data) => {
      const rows = Object.values(data || {}).filter((v) => v && typeof v.score === "number").sort((a, b) => b.score - a.score || (a.ts || 0) - (b.ts || 0));
      board.innerHTML = rows.length ? rows.map((r, i) => `<li><span class="pos">${String(i + 1).padStart(2, "0")}</span><span>${esc(r.name)}</span><span class="score">${r.score}</span></li>`).join("")
        : `<li class="empty">No scores yet. Be the first.</li>`;
      bstate.textContent = "Live"; bstate.classList.add("live");
    }).catch(() => { bstate.textContent = "Offline"; });
    load();
    try {
      const es = new EventSource(`${base}/scores.json?${q}`);
      ["put", "patch"].forEach((ev) => es.addEventListener(ev, load));
      es.onerror = () => { es.close(); setInterval(load, 20000); };
    } catch (e) { setInterval(load, 20000); }
  }
})();
