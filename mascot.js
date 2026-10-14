/* =========================================================
   MASCOT: the pumpkin buddy who walks along with your scroll.
   Built from cut-out parts in assets/character/ (legs, arms, head swing
   independently) plus full-body poses for special moments.
   ========================================================= */
(function mascot() {
  const NAME = (typeof CONFIG !== "undefined" && CONFIG.mascotName) || "Pumpy";
  const TICKER = (typeof CONFIG !== "undefined" && CONFIG.ticker) || "";
  const DIR = "assets/character/";

  const root = document.getElementById("mascot");
  if (!root) return;
  const body = root.querySelector(".mascot-body");
  const rig = root.querySelector(".rig");
  const head = root.querySelector(".head");
  const legL = root.querySelector(".leg-l");
  const legR = root.querySelector(".leg-r");
  const armL = root.querySelector(".arm-l");
  const armR = root.querySelector(".arm-r");
  const posesBox = root.querySelector(".poses");
  const bubble = root.querySelector(".mascot-bubble");

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // phones/tablets: a normal flick scroll is "fast", so the tumble would fire on almost every swipe
  const touchScreen = window.matchMedia("(hover: none) and (pointer: coarse)").matches;

  /* ---------- What he says & does in each section ---------- */
  const SECTIONS = {
    hero:        { pose: "wave",  say: `Hey! I'm ${NAME} 🎃 Scroll down, I'll show you around!` },
    about:       { face: "laugh", say: `${TICKER || "We"} = the spookiest bag on Solana 👻` },
    coven:       { pose: "point", say: "Meet my buddies! Shib, Doge & Pepe 🧛" },
    tokenomics:  { face: "evil",  say: "0% tax. Even ghosts hate taxes 💀" },
    how:         { pose: "point", say: "Step 1: grab a Phantom wallet. Easy!" },
    roadmap:     { pose: "jump",  say: "Next stop… the MOON 🌕" },
    "game-teaser": { pose: "jump", say: "Play Candy Rush with me! 🍬 Click here!", game: true },
    join:        { pose: "wave",  say: "Join the coven! 🦇 Telegram & X are waiting" },
    footer:      { pose: "sit",   say: "Nom nom… see you Friday 🍬" },
  };
  const CLICK_LINES = [
    "Wen moon? 🌕", "Trick or treat! 🍬", "Not financial advice 👻",
    "Psst… try typing “boo” 🤫", "I'm not a pumpkin, I'm a lifestyle 🎃",
    "Hold me, I'm scared of paper hands 😱", "Have you joined the Discord yet? 🦇",
  ];

  /* ---------- One image per face & pose, all decoded up front ----------
     Changing expression or pose only flips which image is visible, so nothing
     has to load or decode at the moment he reacts. */
  const FACES = ["happy", "blink", "surprised", "laugh", "sleepy", "evil"];
  const POSES = ["peek", "wave", "point", "jump", "fall", "sit"];
  function addImg(parent, src) {
    let img = [...parent.querySelectorAll("img")].find((i) => i.getAttribute("src") === src);
    if (!img) {
      img = new Image();
      img.alt = "";
      img.src = src;
      parent.appendChild(img);
    }
    if (img.decode) img.decode().catch(() => {});
    return img;
  }
  const faceImgs = {}, poseImgs = {};
  FACES.forEach((f) => (faceImgs[f] = addImg(head, `${DIR}face-${f}.webp`)));
  faceImgs.happy.classList.add("on");
  POSES.forEach((p) => {
    const img = (poseImgs[p] = addImg(posesBox, `${DIR}pose-${p}.webp`));
    img.className = "pose";
    // poses come from a different sheet; show them at the same scale as the cut-out rig
    const size = () => (img.style.width = img.naturalWidth * 1.05 + "px");
    img.complete && img.naturalWidth ? size() : img.addEventListener("load", size, { once: true });
  });

  /* ---------- State ---------- */
  let scale = 1, width = 0, docMax = 1, appliedDir = 0;
  let x = 0, targetX = 0, dir = 1;
  let phase = 0, walkAmp = 0;
  let lastY = window.scrollY, recent = []; // recent scroll distances, for a smoothed speed
  let raf = 0, lastT = 0;
  let face = "happy", mode = "rig", pose = null;
  let sleeping = false, busyUntil = 0;
  let scrolledSincePose = false, clickHold = false;
  let section = "hero", bubbleSection = null; // which section the bubble currently on screen belongs to
  let idleTimer = 0, bubbleTimer = 0, poseTimer = 0;

  // page height is cached (and refreshed when the page resizes) so scrolling never forces a layout
  function measurePage() {
    docMax = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  }
  function measure() {
    measurePage();
    scale = window.innerWidth < 640 ? 0.42 : window.innerWidth < 980 ? 0.52 : 0.62;
    root.style.setProperty("--s", scale);
    width = 200 * scale;
    targetX = computeTarget();
  }
  function computeTarget() {
    const progress = Math.min(1, Math.max(0, window.scrollY / docMax));
    return 8 + progress * (window.innerWidth - width - 16);
  }

  /* ---------- Look ---------- */
  function setFace(f) {
    if (face === f) return;
    faceImgs[face].classList.remove("on");
    face = f;
    faceImgs[f].classList.add("on");
  }
  function showPose(name, ms) {
    clearTimeout(poseTimer);
    mode = "pose";
    scrolledSincePose = false;
    if (pose) poseImgs[pose].classList.remove("on");
    pose = name;
    poseImgs[name].classList.add("on");
    root.dataset.pose = name;
    root.classList.add("posing");
    if (ms) poseTimer = setTimeout(endPose, ms);
  }
  function endPose() {
    clearTimeout(poseTimer);
    mode = "rig";
    if (pose) poseImgs[pose].classList.remove("on");
    pose = null;
    delete root.dataset.pose;
    root.classList.remove("posing");
  }
  // long enough to actually read: ~70ms per character, between 5 and 9 seconds
  const readTime = (text) => Math.min(9000, Math.max(5000, 2500 + text.length * 70));

  function say(text, ms = readTime(text), opts = {}) {
    clearTimeout(bubbleTimer);
    bubbleSection = opts.section || null;
    bubble.textContent = text;
    bubble.classList.toggle("clickable", !!opts.game);
    bubble.onclick = opts.game ? () => window.openCandyRush && window.openCandyRush() : null;
    // keep the bubble on screen: anchor it towards the middle of the page
    root.classList.toggle("bubble-left", x + width / 2 > window.innerWidth / 2);
    bubble.classList.add("show");
    bubbleTimer = setTimeout(hush, ms);
  }
  function hush() {
    clearTimeout(bubbleTimer);
    bubbleSection = null;
    if (bubble.classList.contains("show")) bubble.classList.remove("show");
  }

  /* ---------- Walking loop (only runs while he's moving) ---------- */
  function apply() {
    root.style.transform = `translate3d(${x}px,0,0)`;
    if (dir !== appliedDir) { body.style.setProperty("--dir", dir); appliedDir = dir; }
    const swing = Math.sin(phase) * walkAmp;
    const bounce = Math.abs(Math.sin(phase)) * walkAmp;
    legL.style.transform = `rotate(${swing * 26}deg)`;
    legR.style.transform = `rotate(${-swing * 26}deg)`;
    armL.style.transform = `rotate(${-swing * 12 - 6}deg)`;  // near arm rests angled in towards the body
    armR.style.transform = `rotate(${swing * 11 - 13}deg)`;  // far arm rests angled out so the paw peeks past the robe
    head.style.transform = `rotate(${Math.sin(phase + 0.6) * 4 * walkAmp}deg)`;
    rig.style.transform = `translateY(${-bounce * 7}px) rotate(${swing * 3}deg)`;
    // the bubble walks with him; flip its side when he crosses the middle so it never runs off screen
    if (bubbleSection !== null || bubble.classList.contains("show")) root.classList.toggle("bubble-left", x + width / 2 > window.innerWidth / 2);
  }

  function loop(t) {
    const dt = Math.min((t - lastT) / 1000 || 0.016, 0.05);
    lastT = t;
    const dx = (targetX - x) * Math.min(1, dt * 5);
    x += dx;
    const moving = Math.abs(dx) > 0.15;
    // a new scroll ends the pose once he actually has to walk (a tiny accidental scroll keeps it)
    if (mode === "pose" && pose !== "fall" && scrolledSincePose && Math.abs(targetX - x) > 6) endPose();
    if (moving) {
      dir = dx > 0 ? 1 : -1;
      phase += Math.min(Math.abs(dx), 18) * 0.12;
    }
    walkAmp += ((moving ? 1 : 0) - walkAmp) * Math.min(1, dt * 8);
    root.classList.toggle("walking", walkAmp > 0.3);
    apply();
    if (Math.abs(targetX - x) > 0.3 || walkAmp > 0.02) {
      raf = requestAnimationFrame(loop);
    } else {
      raf = 0;
      walkAmp = 0;
      apply();
      root.classList.remove("walking");
    }
  }
  function kick() {
    if (!raf && !reduceMotion) {
      lastT = performance.now();
      raf = requestAnimationFrame(loop);
    }
  }

  /* ---------- Reactions ---------- */
  let retryTimer = 0;
  function react() {
    clearTimeout(retryTimer);
    const wait = busyUntil - performance.now();
    if (wait > 0) { retryTimer = setTimeout(react, wait + 50); return; } // still mid-animation: try again after
    if (sleeping || document.body.classList.contains("game-open")) return;
    const r = SECTIONS[section];
    if (!r) return;
    // runs every time scrolling stops: if this section's line is still up, keep it up longer, otherwise say it again
    const dur = readTime(r.say);
    if (r.pose) showPose(r.pose, dur);
    if (r.face) { setFace(r.face); setTimeout(() => face === r.face && setFace("happy"), dur); }
    if (bubbleSection === section && bubble.classList.contains("show")) {
      clearTimeout(bubbleTimer);
      bubbleTimer = setTimeout(hush, dur);
    } else {
      say(r.say, dur, { game: r.game, section });
    }
  }

  function tumble() {
    busyUntil = performance.now() + 1100;
    hush();
    showPose("fall", 1000);
    root.classList.add("tumble");
    setTimeout(() => {
      root.classList.remove("tumble");
      setFace("surprised");
      setTimeout(() => face === "surprised" && setFace("happy"), 900);
    }, 1000);
  }

  function fallAsleep() {
    if (sleeping || document.body.classList.contains("game-open")) return;
    sleeping = true;
    hush();
    endPose();
    setFace("sleepy");
    root.classList.add("sleeping");
  }
  function wake() {
    if (!sleeping) return;
    sleeping = false;
    root.classList.remove("sleeping");
    setFace("surprised");
    say("Huh?! I'm awake! 😳", 1600);
    setTimeout(() => face === "surprised" && setFace("happy"), 900);
  }

  function scheduleIdle() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      react();
      idleTimer = setTimeout(fallAsleep, 14000);
    }, 650);
  }

  /* ---------- Blinking ---------- */
  (function blink() {
    setTimeout(() => {
      if (mode === "rig" && face === "happy" && !sleeping) {
        setFace("blink");
        setTimeout(() => face === "blink" && setFace("happy"), 140);
      }
      blink();
    }, 2200 + Math.random() * 3800);
  })();

  /* ---------- Which section is in the middle of the screen ---------- */
  const sectionIO = new IntersectionObserver(
    (entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      section = e.target.id;
      if (bubbleSection && bubbleSection !== section) hush(); // moved on to another section: that line no longer applies
    }),
    { rootMargin: "-45% 0px -45% 0px" }
  );
  document.querySelectorAll("main > section[id], footer[id]").forEach((el) => {
    sectionIO.observe(el);
  });

  /* ---------- Events ---------- */
  window.addEventListener("scroll", () => {
    const now = performance.now();
    const y = window.scrollY;
    recent.push([now, Math.abs(y - lastY)]);
    lastY = y;
    while (recent.length && now - recent[0][0] > 300) recent.shift();
    const velocity = recent.reduce((n, r) => n + r[1], 0) / 0.3; // px per second over the last 300ms
    clearTimeout(retryTimer);
    scrolledSincePose = true;
    if (clickHold) { clickHold = false; busyUntil = 0; } // scrolling away: don't keep waiting on the click line
    wake();
    if (velocity > 6000 && now > busyUntil && !reduceMotion && !touchScreen) tumble(); // a really fast mouse-wheel spin makes him fall over
    targetX = computeTarget();
    if (reduceMotion) { x = targetX; apply(); }
    kick();
    scheduleIdle();
  }, { passive: true });

  // On phones the address bar sliding in/out fires "resize" with only the height changing. That doesn't move
  // him sideways, so just refresh the page height instead of re-laying him out (which made him shuffle).
  let lastW = window.innerWidth;
  window.addEventListener("resize", () => {
    if (window.innerWidth === lastW) { measurePage(); targetX = computeTarget(); return; }
    lastW = window.innerWidth;
    measure();
    x = Math.min(x, window.innerWidth - width - 8);
    kick();
  });
  new ResizeObserver(() => { measurePage(); targetX = computeTarget(); }).observe(document.body);

  root.addEventListener("click", (e) => {
    if (e.target === bubble) return;
    wake();
    clearTimeout(idleTimer);
    endPose();
    setFace("laugh");
    body.animate([{ translate: "0 0" }, { translate: "0 -26px", offset: 0.4 }, { translate: "0 0" }], { duration: 450, easing: "ease-out" });
    const line = CLICK_LINES[Math.floor(Math.random() * CLICK_LINES.length)];
    const dur = readTime(line);
    say(line, dur);
    setTimeout(() => face === "laugh" && setFace("happy"), 1200);
    // hold the section line back until the click line has had its full reading time
    busyUntil = performance.now() + dur;
    clickHold = true;
    scheduleIdle();
  });

  /* ---------- Entrance: peek from the edge, then say hi ---------- */
  measure();
  x = 0;
  apply();
  if (reduceMotion) {
    x = targetX;
    apply();
  } else {
    showPose("peek");
    say("Psst… 👀", 1500);
    busyUntil = performance.now() + 2600;
    setTimeout(() => {
      if (pose !== "peek") return;
      endPose();
      x = 8;
      kick();
    }, 1600);
  }
  setTimeout(() => { if (window.scrollY < 50) { busyUntil = 0; react(); } scheduleIdle(); }, 2700);
})();
