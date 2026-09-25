/* Flappy Compu for the web: the same game as in the Compubase app (same physics, same look). */
(function () {
  const W = 400, H = 600, GROUND = 70, BIRD_X = 110, BIRD_R = 15;
  const GRAVITY = 1500, FLAP = -430, MAX_FALL = 720, PIPE_W = 64, PIPE_SPACING = 215;
  const MEDALS = [[40, "Platinum", "#e5e7eb"], [25, "Gold", "#fbbf24"], [15, "Silver", "#cbd5e1"], [5, "Bronze", "#d97706"]];

  function accent() {
    const cs = getComputedStyle(document.documentElement);
    return [cs.getPropertyValue("--accent").trim() || "#7c6cff", cs.getPropertyValue("--accent-2").trim() || "#22d3ee"];
  }
  function shade(hex, f) {               // f < 1 darker, > 1 lighter
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = Math.min(255, Math.round(r * f)); g = Math.min(255, Math.round(g * f)); b = Math.min(255, Math.round(b * f));
    return `rgb(${r},${g},${b})`;
  }
  function rgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  function rand(seed) {                   // small seeded RNG so the skyline is the same every time
    let s = seed >>> 0;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  }

  class Game {
    constructor(canvas, opts = {}) {
      this.c = canvas;
      this.ctx = canvas.getContext("2d");
      this.showHud = opts.hud !== false;
      this.onOver = opts.onOver || (() => {});
      const r = rand(7);
      this.stars = Array.from({ length: 90 }, () => [r() * 3000, r() * (H - GROUND) * 0.8, 0.6 + r() * 1.2]);
      this.skyline = Array.from({ length: 40 }, (_, i) => [i * 46, 40 + r() * 130, 30 + r() * 16]);
      this.best = +(localStorage.getItem("flappy-best") || 0);
      this.reset();
      this.last = performance.now();
      this.running = true;
      const loop = (t) => {
        const dt = Math.min(0.1, (t - this.last) / 1000);
        this.last = t;
        if (this.running && !document.hidden) {
          let left = dt;
          while (left > 0) { this.step(Math.min(left, 1 / 60)); left -= 1 / 60; }
          this.draw();
        }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }
    reset() {
      this.state = "ready"; this.y = H * 0.5; this.vy = 0; this.t = 0; this.playTime = 0;
      this.score = 0; this.pipes = []; this.scroll = 0; this.particles = []; this.flashA = 0;
      this.deadT = 0; this.newBest = false; this.wing = 0;
    }
    speed() { return Math.min(235, 150 + this.score * 2.2); }
    gap() { return Math.max(128, 168 - this.score * 1.1); }
    flap() {
      if (this.state === "dead") { if (this.deadT > 0.6) this.reset(); return; }
      if (this.state === "ready") this.state = "play";
      this.vy = FLAP; this.wing = 1;
      for (let i = 0; i < 6; i++) {
        const a = Math.PI * 0.5 + (Math.random() - 0.5) * 1.6;
        this.particles.push([BIRD_X - 8, this.y + 6, Math.cos(a) * 60 - 60, Math.sin(a) * 90, 0.5]);
      }
    }
    spawn(x) {
      const m = 70, g = this.gap();
      this.pipes.push([x, m + g / 2 + Math.random() * (H - GROUND - 2 * m - g), g, false]);
    }
    step(dt) {
      this.t += dt;
      this.wing = Math.max(0, this.wing - dt * 5);
      this.flashA = Math.max(0, this.flashA - dt * 2.5);
      for (const p of this.particles) { p[0] += p[2] * dt; p[1] += p[3] * dt; p[4] -= dt; }
      this.particles = this.particles.filter((p) => p[4] > 0);
      if (this.state === "ready") {
        // hop in place in the middle until the player clicks or presses Space
        this.vy = Math.min(MAX_FALL, this.vy + GRAVITY * 0.6 * dt); this.y += this.vy * dt;
        if (this.y > H * 0.52 && this.vy > 0) { this.vy = -290; this.wing = 1; }
        this.scroll += 90 * dt;
        return;
      }
      if (this.state === "dead") {
        this.deadT += dt;
        if (this.y < H - GROUND - BIRD_R) {
          this.vy = Math.min(MAX_FALL, this.vy + GRAVITY * dt);
          this.y = Math.min(H - GROUND - BIRD_R, this.y + this.vy * dt);
        }
        return;
      }
      this.playTime += dt;
      this.vy = Math.min(MAX_FALL, this.vy + GRAVITY * dt);
      this.y += this.vy * dt;
      const sp = this.speed();
      this.scroll += sp * dt;
      for (const p of this.pipes) p[0] -= sp * dt;
      const edge = this.edge || 0;
      this.pipes = this.pipes.filter((p) => p[0] > -edge - PIPE_W - 10);
      const right = W + edge + 40;
      if (!this.pipes.length) this.spawn(right);
      else if (this.pipes[this.pipes.length - 1][0] < right - PIPE_SPACING) this.spawn(this.pipes[this.pipes.length - 1][0] + PIPE_SPACING);
      for (const p of this.pipes) {
        if (!p[3] && p[0] + PIPE_W < BIRD_X) { p[3] = true; this.score++; }
      }
      if (this.hit()) {
        this.state = "dead"; this.deadT = 0; this.flashA = 1; this.vy = Math.min(this.vy, 0) - 120;
        if (this.score > this.best && this.showHud) {
          this.best = this.score; this.newBest = true;
          try { localStorage.setItem("flappy-best", String(this.best)); } catch (e) { /* private mode */ }
        }
        this.onOver(this.score, this.best);
      }
    }
    hit() {
      if (this.y + BIRD_R >= H - GROUND || this.y - BIRD_R < -40) return true;
      const r = BIRD_R * 0.82;
      for (const [x, gy, gap] of this.pipes) {
        if (x - r < BIRD_X && BIRD_X < x + PIPE_W + r) {
          const top = gy - gap / 2, bottom = gy + gap / 2;
          const cx = Math.min(Math.max(BIRD_X, x), x + PIPE_W);
          for (const [a, b] of [[-1000, top], [bottom, H]]) {
            const cy = Math.min(Math.max(this.y, a), b);
            if ((BIRD_X - cx) ** 2 + (this.y - cy) ** 2 < r * r) return true;
          }
        }
      }
      return false;
    }
    draw() {
      const c = this.c, ctx = this.ctx;
      const dpr = window.devicePixelRatio || 1;
      const cw = c.clientWidth, ch = c.clientHeight;
      if (c.width !== Math.round(cw * dpr) || c.height !== Math.round(ch * dpr)) {
        c.width = Math.round(cw * dpr); c.height = Math.round(ch * dpr);
      }
      const scale = (c.height) / H;
      const worldW = c.width / scale, ox = (worldW - W) / 2;
      this.edge = Math.max(0, ox);
      const [a1, a2] = accent();
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, "#07061a"); sky.addColorStop(0.6, shade(a1, 0.24)); sky.addColorStop(1, shade(a2, 0.26));
      ctx.fillStyle = sky; ctx.fillRect(0, 0, worldW, H);
      for (const [sx, sy, s] of this.stars) {
        const x = ((sx - this.scroll * 0.05) % (worldW + 20) + worldW + 20) % (worldW + 20);
        ctx.fillStyle = `rgba(255,255,255,${0.6 * (0.55 + 0.45 * Math.sin(this.t * 2 + sx))})`;
        ctx.beginPath(); ctx.arc(x, sy, s * 0.6, 0, 7); ctx.fill();
      }
      const moon = ctx.createRadialGradient(worldW * 0.78, 90, 0, worldW * 0.78, 90, 60);
      moon.addColorStop(0, "rgba(255,255,255,0.86)"); moon.addColorStop(0.35, rgba(a2, 0.47)); moon.addColorStop(1, rgba(a2, 0));
      ctx.fillStyle = moon; ctx.beginPath(); ctx.arc(worldW * 0.78, 90, 60, 0, 7); ctx.fill();
      const span = 46 * this.skyline.length;
      [[0.18, 0.33, 0.78], [0.4, 0.45, 1]].forEach(([speed, f, alpha], layer) => {
        ctx.fillStyle = shade(a1, f); ctx.globalAlpha = alpha;
        for (const [bx, bh, bw] of this.skyline) {
          const x = (((bx + layer * 23 - this.scroll * speed) % span) + span) % span - 46;
          if (x > worldW) continue;
          const h = bh * (layer === 0 ? 0.7 : 0.5);
          ctx.fillRect(x, H - GROUND - h, bw, h);
          if (layer === 1) {
            ctx.fillStyle = rgba(a2, 0.35);
            for (let wy = H - GROUND - h + 8; wy < H - GROUND - 6; wy += 14) if ((Math.floor(bx) + Math.floor(wy)) % 3 === 0) ctx.fillRect(x + 6, wy, 5, 6);
            ctx.fillStyle = shade(a1, f);
          }
        }
        ctx.globalAlpha = 1;
      });
      ctx.save(); ctx.translate(ox, 0);
      for (const [x, gy, gap] of this.pipes) {
        for (const [top, bottom] of [[-20, gy - gap / 2], [gy + gap / 2, H - GROUND]]) {
          const g = ctx.createLinearGradient(x, 0, x + PIPE_W, 0);
          g.addColorStop(0, shade(a1, 0.7)); g.addColorStop(0.45, a1); g.addColorStop(1, shade(a2, 0.6));
          ctx.fillStyle = g; ctx.strokeStyle = "rgba(255,255,255,0.2)"; ctx.lineWidth = 1.5;
          roundRect(ctx, x, top, PIPE_W, bottom - top, 8); ctx.fill(); ctx.stroke();
          ctx.fillStyle = shade(a2, 1.1);
          roundRect(ctx, x - 5, top < 0 ? bottom - 22 : top, PIPE_W + 10, 22, 7); ctx.fill(); ctx.stroke();
        }
      }
      ctx.restore();
      const gg = ctx.createLinearGradient(0, H - GROUND, 0, H);
      gg.addColorStop(0, "#141226"); gg.addColorStop(1, "#07060f");
      ctx.fillStyle = gg; ctx.fillRect(0, H - GROUND, worldW, GROUND);
      ctx.strokeStyle = rgba(a2, 0.63); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, H - GROUND); ctx.lineTo(worldW, H - GROUND); ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      const off = this.scroll % 28;
      ctx.beginPath();
      for (let i = -1; i < worldW / 28 + 2; i++) { ctx.moveTo(i * 28 - off, H - GROUND + 12); ctx.lineTo(i * 28 - off + 14, H - GROUND + 12); }
      ctx.stroke();
      ctx.save(); ctx.translate(ox, 0);
      for (const [x, y, , , life] of this.particles) {
        ctx.fillStyle = rgba(a2, Math.min(1, life * 2)); ctx.beginPath(); ctx.arc(x, y, 2.4, 0, 7); ctx.fill();
      }
      this.drawBird(ctx, a1, a2);
      ctx.restore();
      if (this.flashA > 0) { ctx.fillStyle = `rgba(255,255,255,${0.63 * this.flashA})`; ctx.fillRect(0, 0, worldW, H); }
      this.hud(ctx, worldW);
    }
    drawBird(ctx, a1, a2) {
      const tilt = this.state !== "ready" ? Math.max(-25, Math.min(70, this.vy / 10)) : Math.max(-15, Math.min(15, this.vy / 25));
      ctx.save(); ctx.translate(BIRD_X, this.y); ctx.rotate(tilt * Math.PI / 180);
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, BIRD_R * 2.6);
      glow.addColorStop(0, rgba(a1, 0.43)); glow.addColorStop(1, rgba(a1, 0));
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, BIRD_R * 2.6, 0, 7); ctx.fill();
      const body = ctx.createLinearGradient(-BIRD_R, -BIRD_R, BIRD_R, BIRD_R);
      body.addColorStop(0, a1); body.addColorStop(1, a2);
      ctx.fillStyle = body; ctx.strokeStyle = "rgba(255,255,255,0.67)"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 0, BIRD_R, 0, 7); ctx.fill(); ctx.stroke();
      const flapping = this.wing > 0 || this.state === "ready";
      const wy = flapping && Math.floor(this.t * 14) % 2 ? -4 : 4;
      ctx.fillStyle = "rgba(255,255,255,0.86)";
      ctx.beginPath(); ctx.moveTo(-6, 0); ctx.quadraticCurveTo(-18, wy - 6, -20, wy + 2); ctx.quadraticCurveTo(-12, wy + 6, -2, 4); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(6, -5, 5, 0, 7); ctx.fill();
      ctx.fillStyle = "#0b0b16"; ctx.beginPath(); ctx.arc(7.5, -5, 2.3, 0, 7); ctx.fill();
      ctx.fillStyle = "#fbbf24"; ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(22, 3); ctx.lineTo(12, 7); ctx.fill();
      ctx.restore();
    }
    hud(ctx, worldW) {
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      if (!this.showHud) return;
      if (this.state !== "ready") {
        ctx.font = "900 52px 'Segoe UI', Inter, system-ui, sans-serif";
        ctx.fillStyle = "rgba(0,0,0,0.47)"; ctx.fillText(this.score, worldW / 2 + 2, 69);
        ctx.fillStyle = "#fff"; ctx.fillText(this.score, worldW / 2, 66);
      }
      if (this.state === "ready") this.panel(ctx, worldW, "Flappy Compu", ["Click, tap or Space to flap", `Best: ${this.best}`], null, 0.24);
      else if (this.state === "dead" && this.deadT > 0.35) {
        const m = MEDALS.find(([need]) => this.score >= need);
        const lines = [`Score ${this.score}  ·  Best ${this.best}`];
        if (this.newBest) lines.push("★ New best!");
        if (m) lines.push(`${m[1]} medal`);
        lines.push("Tap to play again");
        this.panel(ctx, worldW, "Game over", lines, m ? m[2] : null, 0.36);
      }
    }
    panel(ctx, worldW, title, lines, col, top) {
      const pw = 280, ph = 90 + 26 * lines.length, x = (worldW - pw) / 2, y = H * top - ph / 2;
      ctx.fillStyle = "rgba(10,10,22,0.84)"; ctx.strokeStyle = "rgba(255,255,255,0.16)"; ctx.lineWidth = 1.2;
      roundRect(ctx, x, y, pw, ph, 18); ctx.fill(); ctx.stroke();
      ctx.font = "700 28px 'Segoe UI', Inter, system-ui, sans-serif"; ctx.fillStyle = col || "#fff";
      ctx.fillText(title, worldW / 2, y + 36);
      ctx.font = "600 15px 'Segoe UI', Inter, system-ui, sans-serif";
      lines.forEach((l, i) => {
        ctx.fillStyle = l.startsWith("★") ? accent()[1] : "#e6e8f0";
        ctx.fillText(l, worldW / 2, y + 76 + i * 26);
      });
    }
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  window.FlappyCompu = Game;
})();
