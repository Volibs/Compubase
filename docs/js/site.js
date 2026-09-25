(function () {
  const cfg = window.NEXUS_CONFIG || {};
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));

  /* ---------- download links: always the latest release of this repo ---------- */
  let repo = cfg.repo;
  const m = location.hostname.match(/^([^.]+)\.github\.io$/);
  if (m) repo = m[1] + "/" + (location.pathname.split("/")[1] || m[1] + ".github.io");
  const url = `https://github.com/${repo}/releases/latest/download/Compubase-Setup.exe`;
  $$("[data-download]").forEach((a) => {
    a.href = url;
    a.addEventListener("click", () => {
      const t = $("#thanks");
      if (t) setTimeout(() => t.classList.add("show"), 400);
    });
  });

  /* ---------- the page takes your colour, like the app does ---------- */
  const themes = {
    "Compu Violet": ["#7c6cff", "#22d3ee"], Ocean: ["#3b82f6", "#2dd4bf"], Sunset: ["#f97316", "#ec4899"],
    Emerald: ["#10b981", "#a3e635"], Crimson: ["#ef4444", "#f59e0b"], Sakura: ["#ec4899", "#c4b5fd"],
    Gold: ["#eab308", "#fb923c"], Mono: ["#a1a1aa", "#e4e4e7"]
  };
  function setTheme(name, save) {
    const t = themes[name] || themes["Compu Violet"];
    document.documentElement.style.setProperty("--accent", t[0]);
    document.documentElement.style.setProperty("--accent-2", t[1]);
    $$(".swatch").forEach((s) => s.classList.toggle("on", s.dataset.theme === name));
    const label = $("#theme-name");
    if (label) label.textContent = name;
    if (save) try { localStorage.setItem("nexus-theme", name); } catch (e) { /* ignore */ }
  }
  const sw = $("#swatches");
  if (sw) {
    Object.entries(themes).forEach(([name, [a, b]]) => {
      const btn = document.createElement("button");
      btn.className = "swatch";
      btn.dataset.theme = name;
      btn.title = name;
      btn.setAttribute("aria-label", "Theme " + name);
      btn.style.background = `linear-gradient(135deg, ${a}, ${b})`;
      btn.addEventListener("click", () => setTheme(name, true));
      sw.appendChild(btn);
    });
  }
  let saved = "Compu Violet";
  try { saved = localStorage.getItem("nexus-theme") || saved; } catch (e) { /* ignore */ }
  setTheme(saved, false);

  /* ---------- reveal on scroll & counters ---------- */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add("in");
      if (e.target.dataset.count) countUp(e.target);
      io.unobserve(e.target);
    });
  }, { threshold: 0.15 });
  $$(".reveal, [data-count]").forEach((el) => io.observe(el));
  function countUp(el) {
    const end = parseFloat(el.dataset.count), start = performance.now(), dur = 1100;
    const step = (t) => {
      const k = Math.min(1, (t - start) / dur), v = end * (1 - Math.pow(1 - k, 3));
      el.textContent = Math.round(v);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* ---------- feature tabs ---------- */
  $$(".tabs").forEach((tabs) => {
    const buttons = $$("button", tabs);
    buttons.forEach((b) => b.addEventListener("click", () => {
      buttons.forEach((x) => x.classList.toggle("on", x === b));
      const target = b.dataset.tab;
      $$(`[data-panel-of="${tabs.id}"]`).forEach((p) => p.classList.toggle("on", p.dataset.panel === target));
    }));
  });

  /* ---------- the game ---------- */
  const canvas = $("#flappy");
  if (canvas && window.FlappyNexus) {
    const best = $("#web-best");
    const game = new window.FlappyNexus(canvas, {
      onOver: (score, b) => { if (best) best.textContent = b; }
    });
    if (best) best.textContent = game.best;
    const flap = (e) => { e.preventDefault(); canvas.focus(); game.flap(); };
    canvas.addEventListener("mousedown", flap);
    canvas.addEventListener("touchstart", flap, { passive: false });
    canvas.addEventListener("keydown", (e) => {
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW" || e.code === "Enter") flap(e);
    });
    new IntersectionObserver(([en]) => { game.running = en.isIntersecting; }, { threshold: 0.05 }).observe(canvas);
  }
  const bg = $("#flappy-bg");
  if (bg && window.FlappyNexus) {
    const g = new window.FlappyNexus(bg, { hud: false });
    new IntersectionObserver(([en]) => { g.running = en.isIntersecting; }, { threshold: 0.01 }).observe(bg);
  }

  /* ---------- live leaderboard ---------- */
  const board = $("#board");
  if (board) {
    const state = $("#board-state");
    const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const render = (rows) => {
      if (!rows.length) { board.innerHTML = `<li class="empty">No scores yet. Be the first!</li>`; return; }
      board.innerHTML = rows.map((r, i) => {
        const medal = ["🥇", "🥈", "🥉"][i] || `<span class="rank">${i + 1}</span>`;
        return `<li><span class="pos">${medal}</span><span class="name">${esc(r.name)}</span><span class="score">${r.score}</span></li>`;
      }).join("");
    };
    if (!cfg.leaderboardDb) {
      state.textContent = "Opening soon";
      board.innerHTML = `<li class="empty">The global leaderboard opens very soon.<br>Warm up here, then download Compubase to post your score.</li>`;
    } else {
      const base = cfg.leaderboardDb.replace(/\/$/, "");
      const q = `orderBy=%22score%22&limitToLast=10`;
      const load = () => fetch(`${base}/scores.json?${q}`).then((r) => r.json()).then((data) => {
        const rows = Object.values(data || {}).filter((v) => v && typeof v.score === "number")
          .sort((a, b) => b.score - a.score || (a.ts || 0) - (b.ts || 0));
        render(rows);
        state.textContent = "Live";
        state.classList.add("live");
      }).catch(() => { state.textContent = "Offline"; });
      load();
      let es;
      try {
        es = new EventSource(`${base}/scores.json?${q}`);
        ["put", "patch"].forEach((ev) => es.addEventListener(ev, () => load()));
        es.onerror = () => { es.close(); setInterval(load, 20000); };
      } catch (e) { setInterval(load, 20000); }
    }
  }

  /* ---------- small stuff ---------- */
  const y = $("#year");
  if (y) y.textContent = new Date().getFullYear();
  const menu = $("#menu-toggle");
  if (menu) menu.addEventListener("click", () => document.body.classList.toggle("menu-open"));
  $$(".links a").forEach((a) => a.addEventListener("click", () => document.body.classList.remove("menu-open")));
})();
