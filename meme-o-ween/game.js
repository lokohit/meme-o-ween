/* =========================================================
   EASTER EGG: Candy Rush
   Opens from any [data-game] element, or by typing "boo".
   ========================================================= */
(function candyRush() {
  const $ = (id) => document.getElementById(id);
  const modal = $("game");
  const stage = $("game-stage");
  const canvas = $("game-canvas");
  const ctx = canvas.getContext("2d");
  const ui = {
    score: $("g-score"), lives: $("g-lives"), drops: $("g-drops"), overTitle: $("g-over-title"), best: $("g-best"),
    start: $("g-start"), over: $("g-over"), final: $("g-final"), newBest: $("g-newbest"),
    play: $("g-play"), again: $("g-again"), share: $("g-share"), close: $("game-close"),
  };

  const MAX_LIVES = 3;
  const DROPS_PER_LIFE = 5; // every 5th dropped candy also costs a life
  const PLAYER_SIZE = 64;
  const ITEM_SIZE = 38;
  const GOOD = [
    { e: "🍬", pts: 1, w: 34 },
    { e: "🍭", pts: 1, w: 26 },
    { e: "🍫", pts: 2, w: 16 },
    { e: "🪙", pts: 5, w: 6 },
    { e: "🧪", power: "slow", w: 3 },
  ];
  const GOOD_TOTAL = GOOD.reduce((n, i) => n + i.w, 0);
  const SKULL = { e: "💀", bad: true };

  let W = 0, H = 0, dpr = 1, bg = null;
  let player, items, pops, score, lives, drops, best, t, spawnIn, slowUntil, shake, flash;
  let playing = false, raf = 0, lastTs = 0;
  const keys = { left: false, right: false };

  best = readBest();
  ui.best.textContent = best;

  /* ---------- Emoji sprites (drawn once, reused every frame) ---------- */
  const spriteCache = new Map();
  function sprite(emoji, size) {
    const key = emoji + size;
    if (spriteCache.has(key)) return spriteCache.get(key);
    const c = document.createElement("canvas");
    const px = Math.ceil(size * dpr * 1.25);
    c.width = c.height = px;
    const g = c.getContext("2d");
    g.font = `${size * dpr}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(emoji, px / 2, px / 2 + size * dpr * 0.06);
    spriteCache.set(key, c);
    return c;
  }
  function drawSprite(emoji, size, x, y, rot = 0) {
    const s = sprite(emoji, size);
    const d = size * 1.25;
    if (rot) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.drawImage(s, -d / 2, -d / 2, d, d);
      ctx.restore();
    } else {
      ctx.drawImage(s, x - d / 2, y - d / 2, d, d);
    }
  }

  /* ---------- Layout ---------- */
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = stage.clientWidth;
    H = Math.round(Math.min(620, Math.max(360, window.innerHeight - 150), W * 1.25));
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    spriteCache.clear();
    bg = paintBackground();
    if (player) player.y = H - 46;
  }

  function paintBackground() {
    const c = document.createElement("canvas");
    c.width = W * dpr;
    c.height = H * dpr;
    const g = c.getContext("2d");
    g.scale(dpr, dpr);
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#2a1045");
    sky.addColorStop(0.7, "#140a24");
    sky.addColorStop(1, "#0b0614");
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);
    // moon
    const mx = W * 0.78, my = H * 0.16, mr = Math.min(W, H) * 0.11;
    const glow = g.createRadialGradient(mx, my, mr * 0.6, mx, my, mr * 3);
    glow.addColorStop(0, "rgba(255,190,90,0.35)");
    glow.addColorStop(1, "rgba(255,190,90,0)");
    g.fillStyle = glow;
    g.fillRect(0, 0, W, H);
    g.fillStyle = "#ffcf7a";
    g.beginPath(); g.arc(mx, my, mr, 0, Math.PI * 2); g.fill();
    // stars
    g.fillStyle = "rgba(246,234,210,0.6)";
    for (let i = 0; i < 40; i++) {
      g.fillRect((i * 97.3) % W, (i * 53.7) % (H * 0.6), 1.5, 1.5);
    }
    // graveyard silhouette
    g.fillStyle = "#07040d";
    g.beginPath();
    g.moveTo(0, H);
    g.lineTo(0, H - 22);
    for (let x = 0; x <= W; x += 40) g.quadraticCurveTo(x + 20, H - 34 - (x % 80 ? 4 : 10), x + 40, H - 22);
    g.lineTo(W, H);
    g.fill();
    for (let x = 30; x < W; x += 110) {
      const h = 30 + (x % 3) * 8;
      g.beginPath();
      g.roundRect ? g.roundRect(x, H - 22 - h, 26, h + 4, [13, 13, 2, 2]) : g.rect(x, H - 22 - h, 26, h + 4);
      g.fill();
    }
    return c;
  }

  /* ---------- Game state ---------- */
  function reset() {
    player = { x: W / 2, targetX: W / 2, y: H - 46, tilt: 0 };
    items = [];
    pops = [];
    score = 0;
    lives = MAX_LIVES;
    drops = 0;
    t = 0;
    spawnIn = 0.6;
    slowUntil = 0;
    shake = 0;
    flash = 0;
    renderHud();
  }

  function renderHud() {
    ui.score.textContent = score;
    ui.lives.textContent = "🎃".repeat(lives) + "🖤".repeat(MAX_LIVES - lives);
    ui.drops.textContent = "●".repeat(drops) + "○".repeat(DROPS_PER_LIFE - drops);
    ui.best.textContent = best;
  }

  function spawn() {
    const skullChance = Math.min(0.16 + t * 0.004, 0.38);
    let type;
    if (Math.random() < skullChance) type = SKULL;
    else {
      let r = Math.random() * GOOD_TOTAL;
      type = GOOD.find((g) => (r -= g.w) < 0) || GOOD[0];
    }
    const scale = H / 600;
    items.push({
      type,
      x: ITEM_SIZE / 2 + Math.random() * (W - ITEM_SIZE),
      y: -ITEM_SIZE,
      vy: Math.min(130 + t * 5, 460) * (0.85 + Math.random() * 0.35) * scale,
      sway: Math.random() * Math.PI * 2,
      rot: (Math.random() - 0.5) * 0.6,
      spin: (Math.random() - 0.5) * 3,
    });
  }

  function pop(text, x, y, color) {
    pops.push({ text, x, y, color, life: 1 });
  }

  /* ---------- Loop ---------- */
  function loop(ts) {
    if (!playing) return;
    const dt = Math.min((ts - lastTs) / 1000 || 0, 0.05);
    lastTs = ts;
    update(dt);
    draw();
    raf = requestAnimationFrame(loop);
  }

  function update(dt) {
    t += dt;
    const slow = t < slowUntil ? 0.45 : 1;

    // player
    if (keys.left) player.targetX -= 520 * dt;
    if (keys.right) player.targetX += 520 * dt;
    player.targetX = Math.max(PLAYER_SIZE / 2, Math.min(W - PLAYER_SIZE / 2, player.targetX));
    const prev = player.x;
    player.x += (player.targetX - player.x) * Math.min(1, dt * 14);
    player.tilt += ((player.x - prev) * 0.02 - player.tilt) * Math.min(1, dt * 10);

    // spawning
    spawnIn -= dt * slow;
    if (spawnIn <= 0) {
      spawn();
      spawnIn = Math.max(0.26, 0.85 - t * 0.012) * (0.7 + Math.random() * 0.6);
    }

    // items
    const catchR = (PLAYER_SIZE + ITEM_SIZE) * 0.38;
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      it.y += it.vy * dt * slow;
      it.sway += dt * 2;
      it.x += Math.sin(it.sway) * 18 * dt;
      it.rot += it.spin * dt * slow;

      const dx = it.x - player.x, dy = it.y - (player.y - 8);
      if (dx * dx + dy * dy < catchR * catchR) {
        items.splice(i, 1);
        collect(it);
        if (!playing) return;
        continue;
      }
      if (it.y > H - 10) {
        items.splice(i, 1);
        if (!it.type.bad && !it.type.power) {
          dropped(it);
          if (!playing) return;
        }
      }
    }

    for (let i = pops.length - 1; i >= 0; i--) {
      pops[i].life -= dt * 1.4;
      pops[i].y -= 50 * dt;
      if (pops[i].life <= 0) pops.splice(i, 1);
    }
    shake = Math.max(0, shake - dt);
    flash = Math.max(0, flash - dt * 2.5);
  }

  function dropped(it) {
    score = Math.max(0, score - 1);
    drops++;
    pop("-1", Math.max(20, Math.min(W - 20, it.x)), H - 40, "#ff6b6b");
    ui.drops.classList.remove("bump");
    void ui.drops.offsetWidth;
    ui.drops.classList.add("bump");
    if (drops >= DROPS_PER_LIFE) {
      drops = 0;
      loseLife("TOO MANY DROPS!", W / 2, H * 0.45);
      return;
    }
    renderHud();
  }

  function loseLife(text, x, y) {
    lives--;
    shake = 0.35;
    flash = 1;
    pop(text, x, y, "#ff5a5a");
    renderHud();
    if (lives <= 0) gameOver(text === "RUGGED!" ? "Rugged!" : "Butterfingers!");
  }

  function collect(it) {
    const { type } = it;
    if (type.bad) {
      loseLife("RUGGED!", it.x, it.y);
      return;
    }
    if (type.power === "slow") {
      slowUntil = t + 4;
      pop("SLOW-MO!", it.x, it.y, "#8bff5e");
      return;
    }
    score += type.pts;
    pop(type.pts >= 5 ? "+5 🚀" : "+" + type.pts, it.x, it.y, type.pts >= 5 ? "#ffd27a" : "#ffa53c");
    renderHud();
  }

  function draw() {
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * 12 * shake * 3, (Math.random() - 0.5) * 12 * shake * 3);
    ctx.drawImage(bg, 0, 0, W, H);

    if (t < slowUntil) {
      ctx.fillStyle = "rgba(139,255,94,0.08)";
      ctx.fillRect(0, 0, W, H);
    }

    for (const it of items) drawSprite(it.type.e, ITEM_SIZE, it.x, it.y, it.rot);
    if (player) drawSprite("🎃", PLAYER_SIZE, player.x, player.y, player.tilt);

    ctx.textAlign = "center";
    ctx.font = '400 24px "Creepster", cursive';
    for (const p of pops) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    if (flash > 0) {
      ctx.fillStyle = `rgba(255,40,40,${flash * 0.25})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  /* ---------- Flow ---------- */
  function start() {
    reset();
    ui.start.hidden = true;
    ui.over.hidden = true;
    playing = true;
    lastTs = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function gameOver(title = "Rugged!") {
    ui.overTitle.textContent = title;
    playing = false;
    cancelAnimationFrame(raf);
    draw();
    const isBest = score > best;
    if (isBest) { best = score; saveBest(best); }
    ui.final.textContent = score;
    ui.newBest.hidden = !isBest || score === 0;
    renderHud();
    const ticker = typeof CONFIG !== "undefined" ? CONFIG.ticker : "";
    const site = location.protocol.startsWith("http") && !/localhost|127\.0\.0\.1/.test(location.hostname) ? " " + location.origin + location.pathname : "";
    const text = `I bagged ${score} candy in MEME-O-WEEN Candy Rush 🎃🍬 Can you beat me? ${ticker}${site}`;
    ui.share.href = "https://twitter.com/intent/tweet?text=" + encodeURIComponent(text);
    ui.over.hidden = false;
    setTimeout(() => ui.again.focus(), 50);
  }

  let lastFocus = null;
  function open() {
    if (!modal.hidden) return;
    lastFocus = document.activeElement;
    modal.hidden = false;
    document.body.classList.add("game-open");
    resize();
    reset();
    draw();
    ui.over.hidden = true;
    ui.start.hidden = false;
    setTimeout(() => ui.play.focus(), 50);
  }

  function close() {
    playing = false;
    cancelAnimationFrame(raf);
    modal.hidden = true;
    document.body.classList.remove("game-open");
    if (lastFocus) lastFocus.focus();
  }

  /* ---------- Input ---------- */
  function pointer(e) {
    const rect = canvas.getBoundingClientRect();
    player && (player.targetX = e.clientX - rect.left);
  }
  canvas.addEventListener("pointermove", pointer);
  canvas.addEventListener("pointerdown", (e) => { pointer(e); canvas.setPointerCapture(e.pointerId); });

  document.addEventListener("keydown", (e) => {
    if (modal.hidden) return;
    if (e.key === "Escape") return close();
    if (e.key === "ArrowLeft" || e.key === "a") { keys.left = true; e.preventDefault(); }
    if (e.key === "ArrowRight" || e.key === "d") { keys.right = true; e.preventDefault(); }
  });
  document.addEventListener("keyup", (e) => {
    if (e.key === "ArrowLeft" || e.key === "a") keys.left = false;
    if (e.key === "ArrowRight" || e.key === "d") keys.right = false;
  });

  ui.play.addEventListener("click", start);
  ui.again.addEventListener("click", start);
  ui.close.addEventListener("click", close);
  modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
  window.addEventListener("resize", () => { if (!modal.hidden) { resize(); if (!playing) draw(); } });

  /* ---------- Triggers ---------- */
  window.openCandyRush = open;
  document.querySelectorAll("[data-game]").forEach((el) =>
    el.addEventListener("click", (e) => { e.stopPropagation(); open(); })
  );
  let typed = "";
  document.addEventListener("keydown", (e) => {
    if (!modal.hidden || e.key.length !== 1) return;
    typed = (typed + e.key.toLowerCase()).slice(-3);
    if (typed === "boo") { typed = ""; open(); }
  });

  /* ---------- Best score ---------- */
  function readBest() {
    try { return parseInt(localStorage.getItem("memeoween-best") || "0", 10) || 0; } catch { return 0; }
  }
  function saveBest(v) {
    try { localStorage.setItem("memeoween-best", String(v)); } catch {}
  }
})();
