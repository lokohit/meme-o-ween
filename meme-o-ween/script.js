/* =========================================================
   EDIT THESE BEFORE LAUNCH
   Leave a link as "" and its buttons show a "coming soon" toast.
   ========================================================= */
const CONFIG = {
  ticker: "$MEMEOWEEN",
  mascotName: "Pumpy",                      // the walking pumpkin buddy's name
  contractAddress: "",                       // paste the CA here once it's live
  launchDate: "2026-10-16T20:00:00Z",        // Friday launch time (UTC)
  links: {
    pumpfun: "",
    dexscreener: "",
    telegram: "",
    x: "",                                   // X Community URL
  },
};

/* ---------- Ticker + links ---------- */
document.querySelectorAll("[data-ticker]").forEach((el) => (el.textContent = CONFIG.ticker));
document.getElementById("year").textContent = new Date().getFullYear();

const LINK_NAMES = { pumpfun: "Pump.fun", dexscreener: "Dexscreener", telegram: "Telegram", x: "X Community" };

document.querySelectorAll("[data-link]").forEach((el) => {
  const key = el.dataset.link;
  const url = CONFIG.links[key];
  if (url) {
    el.href = url;
    el.target = "_blank";
    el.rel = "noopener noreferrer";
  } else {
    el.setAttribute("role", "button");
    el.tabIndex = 0;
    const soon = () => toast(`${LINK_NAMES[key]} link drops at launch 🎃`);
    el.addEventListener("click", (e) => { e.preventDefault(); soon(); });
    el.addEventListener("keydown", (e) => { if (e.key === "Enter") soon(); });
  }
});

/* ---------- Toast ---------- */
const toastEl = document.getElementById("toast");
let toastTimer;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2400);
}

/* ---------- Contract address copy ---------- */
const caText = document.getElementById("ca-text");
const caCopy = document.getElementById("ca-copy");
if (CONFIG.contractAddress) caText.textContent = CONFIG.contractAddress;
document.getElementById("ca-btn").addEventListener("click", async () => {
  if (!CONFIG.contractAddress) return toast("CA is revealed at launch. Stay spooky 👻");
  try {
    await navigator.clipboard.writeText(CONFIG.contractAddress);
  } catch {
    const ta = Object.assign(document.createElement("textarea"), { value: CONFIG.contractAddress });
    document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove();
  }
  caCopy.textContent = "Copied!";
  toast("Contract address copied 🧪");
  setTimeout(() => (caCopy.textContent = "Copy"), 1600);
});

/* ---------- Countdown ---------- */
const target = new Date(CONFIG.launchDate).getTime();
const cd = { d: cdEl("d"), h: cdEl("h"), m: cdEl("m"), s: cdEl("s") };
function cdEl(k) { return document.getElementById("cd-" + k); }
const pad = (n) => String(n).padStart(2, "0");
function setDigits(el, n) {
  const v = pad(n);
  if (el.textContent !== v) el.textContent = v;
}
function tick() {
  const diff = target - Date.now();
  if (diff <= 0) {
    const box = document.getElementById("countdown");
    box.classList.add("live");
    box.innerHTML = '<p class="live-msg">We are LIVE 🎃</p>';
    document.getElementById("countdown-label").textContent = "The summoning is complete";
    return;
  }
  setDigits(cd.d, Math.floor(diff / 864e5));
  setDigits(cd.h, Math.floor((diff / 36e5) % 24));
  setDigits(cd.m, Math.floor((diff / 6e4) % 60));
  setDigits(cd.s, Math.floor((diff / 1e3) % 60));
  setTimeout(tick, 1000);
}
tick();

/* ---------- Nav background on scroll ---------- */
const nav = document.getElementById("nav");
const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 30);
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

/* ---------- Scroll reveal ---------- */
const io = new IntersectionObserver(
  (entries) => entries.forEach((e) => {
    // also reveal anything the user scrolled past too quickly
    if (e.isIntersecting || e.boundingClientRect.top < 0) { e.target.classList.add("in"); io.unobserve(e.target); }
  }),
  { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
);
document.querySelectorAll(".reveal").forEach((el, i) => {
  el.style.transitionDelay = `${(i % 4) * 90}ms`;
  io.observe(el);
});

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- Click for candy ---------- */
const TREATS = ["🍬", "🍭", "🎃", "👻", "🦇", "🍫", "🕸️", "💀"];
document.addEventListener("click", (e) => {
  if (reduceMotion || document.body.classList.contains("game-open")) return;
  for (let i = 0; i < 7; i++) {
    const c = document.createElement("span");
    c.className = "candy";
    c.textContent = TREATS[Math.floor(Math.random() * TREATS.length)];
    c.style.left = e.clientX - 12 + "px";
    c.style.top = e.clientY - 12 + "px";
    const a = Math.random() * Math.PI * 2, r = 50 + Math.random() * 70;
    c.style.setProperty("--dx", Math.cos(a) * r + "px");
    c.style.setProperty("--dy", Math.sin(a) * r - 30 + "px");
    c.style.setProperty("--rot", (Math.random() * 360 - 180) + "deg");
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 1000);
  }
});

/* ---------- Lightning ---------- */
const lightning = document.querySelector(".lightning");
const FLASH = [{ opacity: 0 }, { opacity: 0.9, offset: 0.08 }, { opacity: 0.1, offset: 0.16 }, { opacity: 0.7, offset: 0.24 }, { opacity: 0 }];
function strike() {
  if (!reduceMotion && !document.hidden) lightning.animate(FLASH, { duration: 900, easing: "ease-out" });
  setTimeout(strike, 9000 + Math.random() * 14000);
}
setTimeout(strike, 4000);

/* ---------- Embers & fireflies ---------- */
(function embers() {
  if (reduceMotion) return;
  const canvas = document.getElementById("embers");
  const ctx = canvas.getContext("2d");
  let w, h, parts = [], running = true, lastResize = 0;

  // Pre-render one soft glow per colour; drawing a cached image is far cheaper than building gradients every frame.
  const SPRITE = 32;
  const sprites = ["139,255,94", "255,165,60", "255,122,26"].map((rgb) => {
    const c = document.createElement("canvas");
    c.width = c.height = SPRITE;
    const g = c.getContext("2d");
    const grad = g.createRadialGradient(SPRITE / 2, SPRITE / 2, 0, SPRITE / 2, SPRITE / 2, SPRITE / 2);
    grad.addColorStop(0, `rgba(${rgb},1)`);
    grad.addColorStop(0.25, `rgba(${rgb},0.5)`);
    grad.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, SPRITE, SPRITE);
    return c;
  });

  function resize() {
    // Glows are soft anyway, so render at 1x to keep the full-screen canvas cheap on retina screens.
    w = canvas.width = innerWidth;
    h = canvas.height = innerHeight;
    const count = Math.round(Math.min(45, (w * h) / 30000));
    parts = Array.from({ length: count }, () => spawn(true));
  }
  function spawn(anywhere) {
    const firefly = Math.random() < 0.25;
    return {
      x: Math.random() * w,
      y: anywhere ? Math.random() * h : h + 20,
      size: firefly ? 18 : 12 + Math.random() * 14,
      vy: -(0.2 + Math.random() * 0.6),
      vx: (Math.random() - 0.5) * 0.3,
      phase: Math.random() * Math.PI * 2,
      sprite: firefly ? sprites[0] : sprites[1 + (Math.random() < 0.5 ? 0 : 1)],
      life: 0,
    };
  }
  // Redraw at ~30fps; movement is scaled by elapsed time so speed is the same on any monitor refresh rate.
  const FRAME_MS = 1000 / 30;
  let last = 0;
  function frame(now = performance.now()) {
    if (!running) return;
    if (document.body.classList.contains("game-open")) return requestAnimationFrame(frame); // game covers the page
    const elapsed = now - last;
    if (elapsed < FRAME_MS - 1) return requestAnimationFrame(frame);
    const step = Math.min(elapsed, 100) / 16.67; // clamp so embers don't jump after a pause
    last = now;
    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      p.life += 0.016 * step;
      p.x += (p.vx + Math.sin(p.life * 1.5 + p.phase) * 0.35) * step;
      p.y += p.vy * step;
      ctx.globalAlpha = 0.35 + Math.sin(p.life * 3 + p.phase) * 0.3;
      ctx.drawImage(p.sprite, p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      if (p.y < -30) parts[i] = spawn(false);
    }
    requestAnimationFrame(frame);
  }
  addEventListener("resize", () => {
    clearTimeout(lastResize);
    lastResize = setTimeout(resize, 150);
  });
  document.addEventListener("visibilitychange", () => {
    const wasRunning = running;
    running = !document.hidden;
    if (running && !wasRunning) requestAnimationFrame(frame);
  });
  resize();
  frame();
})();
