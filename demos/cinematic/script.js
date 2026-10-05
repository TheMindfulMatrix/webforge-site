/* ==========================================================================
   WEBFORGE · CINEMATIC — behaviour layer
   Vanilla JS, no dependencies. Every feature is an enhancement: with JS off
   the page is complete; with reduced motion it is complete and still.
   ========================================================================== */
(() => {
  'use strict';

  const doc = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reduce = mqReduce.matches;
  if (mqReduce.addEventListener) mqReduce.addEventListener('change', (e) => { reduce = e.matches; });
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const canVT = typeof document.startViewTransition === 'function';
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const toMin = (hm) => { const [h, m] = String(hm).split(':').map(Number); return h * 60 + m; };
  const fmt = (min) => {
    const h = Math.floor(min / 60), m = min % 60;
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
  };

  /** Run a DOM change inside a View Transition when allowed, tagged for CSS. */
  function transition(kind, update) {
    if (!canVT || reduce) { update(); return Promise.resolve(); }
    doc.dataset.vt = kind;
    let t;
    try { t = document.startViewTransition(update); }
    catch (err) { delete doc.dataset.vt; update(); return Promise.resolve(); }
    // a transition can be skipped when another starts; that is expected, not an error
    t.ready.catch(() => {});
    t.updateCallbackDone.catch(() => {});
    return t.finished.catch(() => {}).finally(() => { if (doc.dataset.vt === kind) delete doc.dataset.vt; });
  }

  /* ------------------------------------------------------------------------
     1. Title-card intro: wait for fonts (max 900 ms) so the reveal never
        animates fallback glyphs.
     ------------------------------------------------------------------------ */
  const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  Promise.race([fontsReady, new Promise((r) => setTimeout(r, 900))])
    .then(() => requestAnimationFrame(() => doc.classList.add('is-ready')));

  /* ------------------------------------------------------------------------
     2. Header glass + mobile menu
     ------------------------------------------------------------------------ */
  const header = $('[data-header]');
  const toggle = $('.nav__toggle');
  const navList = $('#nav-list');

  function setMenu(open, returnFocus) {
    if (!toggle || !navList) return;
    toggle.setAttribute('aria-expanded', String(open));
    navList.classList.toggle('is-open', open);
    header.classList.toggle('is-open', open);
    const label = toggle.querySelector('.nav__toggle-label');
    if (label) label.textContent = open ? 'Close' : 'Menu';
    if (!open && returnFocus) toggle.focus();
  }
  if (toggle) {
    toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') setMenu(false, true);
    });
    window.matchMedia('(min-width: 1000px)').addEventListener('change', (e) => { if (e.matches) setMenu(false); });
  }

  /* ------------------------------------------------------------------------
     3. Schedule — today, next up, filter
     ------------------------------------------------------------------------ */
  const sessions = $$('.session').map((el, i) => ({
    el,
    i,
    day: Number(el.closest('.day').dataset.day),
    start: toMin(el.dataset.start),
    end: toMin(el.dataset.end),
    program: el.dataset.program,
    name: el.querySelector('.session__prog').textContent.trim(),
    ages: el.querySelector('.session__ages').textContent.trim(),
  }));
  const days = $$('.day');

  function findNext(now) {
    const d = now.getDay();
    const t = now.getHours() * 60 + now.getMinutes();
    const live = sessions.find((s) => s.day === d && s.start <= t && t < s.end);
    if (live) return { s: live, kind: 'now', offset: 0 };
    for (let k = 0; k < 7; k++) {
      const dd = (d + k) % 7;
      const list = sessions.filter((s) => s.day === dd && (k > 0 || s.start > t)).sort((a, b) => a.start - b.start);
      if (list.length) return { s: list[0], kind: 'next', offset: k };
    }
    return null;
  }

  function paintSchedule() {
    const now = new Date();
    const today = now.getDay();
    days.forEach((d) => d.classList.toggle('is-today', Number(d.dataset.day) === today));
    sessions.forEach((s) => s.el.classList.remove('is-next', 'is-now'));
    const n = findNext(now);
    if (!n) return;
    const { s, kind, offset } = n;
    s.el.classList.add(kind === 'now' ? 'is-now' : 'is-next');
    const when = offset === 0 ? 'Today' : offset === 1 ? 'Tomorrow' : DAY_NAMES[s.day];
    const short = kind === 'now'
      ? `${s.name} · ${s.ages} · until ${fmt(s.end)}`
      : `${when} ${fmt(s.start)} · ${s.name} · ${s.ages}`;
    const long = kind === 'now'
      ? `${s.name}, ${s.ages}. Running until ${fmt(s.end)}.`
      : `${when} at ${fmt(s.start)}: ${s.name}, ${s.ages}.`;
    $$('[data-next]').forEach((el) => { el.textContent = short; });
    $$('[data-next-long]').forEach((el) => { el.textContent = long; });
    $$('[data-next-label]').forEach((el) => { el.textContent = kind === 'now' ? 'On the floor now' : 'Next up'; });
    $$('[data-ticker-label]').forEach((el) => { el.textContent = kind === 'now' ? 'On now' : 'Next session'; });
  }
  paintSchedule();
  setInterval(paintSchedule, 60 * 1000);

  const chips = $$('.chip[data-show]');
  const filterWrap = $('.filter');
  let filterStatus = null;
  if (filterWrap) {
    filterStatus = document.createElement('p');
    filterStatus.className = 'sr-only';
    filterStatus.setAttribute('aria-live', 'polite');
    filterWrap.after(filterStatus);
  }

  function applyFilter(value, animate) {
    const update = () => {
      chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.show === value)));
      let count = 0;
      sessions.forEach((s) => {
        const show = value === 'all' || s.program === value;
        s.el.hidden = !show;
        if (show) count++;
      });
      days.forEach((d) => {
        const any = $$('.session', d).some((el) => !el.hidden);
        d.classList.toggle('day--empty', !any);
      });
      if (filterStatus) {
        const chip = chips.find((c) => c.dataset.show === value);
        filterStatus.textContent = `Showing ${count} ${value === 'all' ? '' : chip.textContent.trim() + ' '}sessions this week.`;
      }
    };
    if (!animate) { update(); return; }
    sessions.forEach((s) => { s.el.style.viewTransitionName = `session-${s.i}`; });
    days.forEach((d, i) => { d.querySelector('.day__name').style.viewTransitionName = `day-${i}`; });
    transition('filter', update).then(() => {
      sessions.forEach((s) => { s.el.style.viewTransitionName = ''; });
      days.forEach((d) => { d.querySelector('.day__name').style.viewTransitionName = ''; });
    });
  }
  chips.forEach((c) => c.addEventListener('click', () => applyFilter(c.dataset.show, true)));

  /* ------------------------------------------------------------------------
     4. In-page navigation as a film cut (dip to black), focus follows
     ------------------------------------------------------------------------ */
  function focusTarget(target) {
    let f = target.matches('[tabindex], a, button, input, select, textarea') ? target : target.querySelector('[tabindex="-1"]');
    if (!f) { target.setAttribute('tabindex', '-1'); f = target; }
    f.focus({ preventScroll: true });
  }

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const hash = a.getAttribute('href');
    if (hash.length < 2) return;
    const target = document.getElementById(hash.slice(1));
    if (!target) return;

    // shortcut links that pre-set state
    if (a.dataset.filter) applyFilter(a.dataset.filter, false);
    if (a.dataset.program) {
      const radio = $(`input[name="program"][value="${a.dataset.program}"]`);
      if (radio) radio.checked = true;
    }
    if (toggle && toggle.getAttribute('aria-expanded') === 'true') setMenu(false);

    if (a.classList.contains('skip')) return; // skip links: native, instant
    e.preventDefault();
    const go = () => {
      target.scrollIntoView({ block: 'start' });
      if (location.hash !== hash) history.pushState(null, '', hash);
    };
    transition('cut', go).then(() => focusTarget(target));
  });

  /* ------------------------------------------------------------------------
     5. Reveals, scene liveness, counters
     ------------------------------------------------------------------------ */
  const autoReveal = [
    '.programs .section-head', '.callsheet__head', '.filter', '.day', '.leader__title',
    '.cast .section-head', '.location__copy', '.zones li', '.subtitle__slate',
    '.finale__main > *', '.visit', '.roll > div', '.endcredits__card', '.endcredits__grid',
  ];
  const vh = window.innerHeight;
  autoReveal.forEach((sel) => {
    $$(sel).forEach((el, i) => {
      if (el.hasAttribute('data-reveal')) return;
      if (el.getBoundingClientRect().top < vh * 0.92) return; // never hide what is already on screen
      el.setAttribute('data-reveal', '');
      if (sel === '.day' || sel === '.zones li' || sel === '.finale__main > *' || sel === '.roll > div') el.style.setProperty('--d', String(i));
    });
  });
  const endCard = $('.endcredits__card');
  if (endCard && !endCard.hasAttribute('data-reveal')) endCard.setAttribute('data-reveal', '');

  function countUp(el) {
    const target = Number(el.dataset.count);
    if (!target || reduce) return;
    const dur = 1600;
    const t0 = performance.now();
    const ease = (x) => (x === 1 ? 1 : 1 - Math.pow(2, -10 * x));
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      el.textContent = String(Math.round(target * ease(p)));
      if (p < 1) requestAnimationFrame(tick);
    };
    el.textContent = '0';
    requestAnimationFrame(tick);
  }

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        const el = en.target;
        el.classList.add('is-in');
        if (el.classList.contains('dial')) { const n = $('.dial__num', el); if (n) countUp(n); }
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    $$('[data-reveal]').forEach((el) => io.observe(el));

    const live = new IntersectionObserver((entries) => {
      entries.forEach((en) => en.target.classList.toggle('is-live', en.isIntersecting));
    }, { threshold: 0.05 });
    $$('.scene').forEach((el) => live.observe(el));
  } else {
    $$('[data-reveal]').forEach((el) => el.classList.add('is-in'));
    $$('.scene').forEach((el) => el.classList.add('is-live'));
  }

  /* ------------------------------------------------------------------------
     6. Subtitle: split the quote into words for a caption-track reveal
     ------------------------------------------------------------------------ */
  const quoteP = $('[data-subtitle] p');
  if (quoteP && !reduce) {
    const words = quoteP.textContent.trim().split(/\s+/);
    quoteP.textContent = '';
    words.forEach((w, i) => {
      const span = document.createElement('span');
      span.className = 'w';
      span.style.setProperty('--i', String(i));
      span.textContent = w;
      quoteP.append(span);
      if (i < words.length - 1) quoteP.append(' ');
    });
  }

  /* ------------------------------------------------------------------------
     7. Floor plan ↔ zone list
     ------------------------------------------------------------------------ */
  const plan = $('.plan');
  const zoneBtns = $$('.zone');
  const zoneGs = $$('.plan__zone');
  let pressed = null;
  function showZone(z) {
    zoneGs.forEach((g) => g.classList.toggle('is-active', g.dataset.zone === z));
    zoneBtns.forEach((b) => b.classList.toggle('is-active', b.dataset.zone === z));
    if (plan) plan.classList.toggle('has-active', Boolean(z));
  }
  zoneBtns.forEach((b) => {
    b.addEventListener('click', () => {
      pressed = pressed === b.dataset.zone ? null : b.dataset.zone;
      zoneBtns.forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.zone === pressed)));
      showZone(pressed);
    });
    b.addEventListener('mouseenter', () => showZone(b.dataset.zone));
    b.addEventListener('mouseleave', () => showZone(pressed));
    b.addEventListener('focus', () => showZone(b.dataset.zone));
    b.addEventListener('blur', () => showZone(pressed));
  });
  zoneGs.forEach((g) => {
    g.addEventListener('mouseenter', () => showZone(g.dataset.zone));
    g.addEventListener('mouseleave', () => showZone(pressed));
    g.addEventListener('click', () => {
      const b = zoneBtns.find((x) => x.dataset.zone === g.dataset.zone);
      if (b) b.click();
    });
  });

  /* ------------------------------------------------------------------------
     8. Visit card: open now?
     ------------------------------------------------------------------------ */
  (function openStatus() {
    const out = $('[data-open-status]');
    const rows = $$('[data-hours] > div');
    if (!out || !rows.length) return;
    const now = new Date();
    const d = now.getDay();
    const t = now.getHours() * 60 + now.getMinutes();
    const rowFor = (day) => rows.find((r) => r.dataset.days.split(',').map(Number).includes(day));
    const todayRow = rowFor(d);
    if (todayRow) todayRow.classList.add('is-today');
    let text = '';
    let open = false;
    if (todayRow && todayRow.dataset.open && t >= toMin(todayRow.dataset.open) && t < toMin(todayRow.dataset.close)) {
      open = true;
      text = `Open now · until ${fmt(toMin(todayRow.dataset.close))}`;
    } else {
      for (let k = 0; k < 8; k++) {
        const dd = (d + k) % 7;
        const r = rowFor(dd);
        if (!r || !r.dataset.open) continue;
        if (k === 0 && t >= toMin(r.dataset.open)) continue;
        const when = k === 0 ? 'today' : k === 1 ? 'tomorrow' : SHORT[dd];
        text = `Closed now · opens ${when} ${fmt(toMin(r.dataset.open))}`;
        break;
      }
    }
    out.textContent = text;
    out.classList.toggle('is-open', open);
    out.hidden = !text;
  })();

  /* ------------------------------------------------------------------------
     9. Booking form (demo: nothing is sent)
     ------------------------------------------------------------------------ */
  const form = $('[data-form]');
  if (form) {
    const status = $('[data-form-status]', form);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      const data = new FormData(form);
      const first = String(data.get('name') || '').trim().split(/\s+/)[0] || 'there';
      const prog = form.querySelector('input[name="program"]:checked');
      const progName = prog ? prog.nextElementSibling.textContent.trim() : 'a program';
      const day = String(data.get('day') || '') || 'a day that works';
      status.textContent = `Thanks, ${first}. This is a demo, so nothing was sent. On the live site, a coach would text you within one business day to confirm ${progName === 'Not sure yet' ? 'the right program' : progName} on ${day}.`;
    });
  }

  /* ------------------------------------------------------------------------
     10. Colour grade switch (system demo)
     ------------------------------------------------------------------------ */
  $$('[data-set-grade]').forEach((b) => {
    b.addEventListener('click', () => {
      const g = b.dataset.setGrade;
      transition('grade', () => {
        doc.dataset.grade = g;
        $$('[data-set-grade]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      });
    });
  });

  /* ------------------------------------------------------------------------
     11. Scroll bookkeeping: header glass, timecode rail, nav location,
         mobile action bar. Reads only; never touches the scroll itself.
     ------------------------------------------------------------------------ */
  const tc = $('[data-tc]');
  const scLabel = $('[data-sc]');
  const RUNTIME = 4 * 60 + 12; // the page "runs" 4 min 12 s
  let ticking = false;
  const pad = (n) => String(n).padStart(2, '0');
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const y = window.scrollY;
      if (header) header.classList.toggle('is-scrolled', y > 24);
      if (tc && window.innerWidth >= 1440) {
        const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        const sec = (y / max) * RUNTIME;
        const ff = Math.floor((sec % 1) * 24);
        tc.textContent = `TC 00:${pad(Math.floor(sec / 60))}:${pad(Math.floor(sec % 60))}:${pad(ff)}`;
      }
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const navLinks = $$('.nav__list a[href^="#"]:not(.btn)');
  if ('IntersectionObserver' in window) {
    const sceneIO = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        if (scLabel) scLabel.textContent = en.target.dataset.scene || '';
        const id = en.target.id;
        navLinks.forEach((l) => {
          if (l.getAttribute('href') === `#${id}`) l.setAttribute('aria-current', 'true');
          else l.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    $$('[data-scene]').forEach((s) => sceneIO.observe(s));

    const bar = $('[data-actionbar]');
    const heroActions = $('[data-hero-actions]');
    const book = $('#book');
    if (bar) {
      const seen = new Map();
      const barIO = new IntersectionObserver((entries) => {
        entries.forEach((en) => seen.set(en.target, en.isIntersecting));
        const hide = Array.from(seen.values()).some(Boolean);
        bar.classList.toggle('is-hidden', hide);
      }, { threshold: 0 });
      [heroActions, book].forEach((el) => { if (el) barIO.observe(el); });
    }
  }

  /* ------------------------------------------------------------------------
     12. Hero: light source position, pointer parallax, dust in the beam
     ------------------------------------------------------------------------ */
  const hero = $('.hero');
  const scene = $('.hero__scene');
  const lanesSvg = $('.hero__svg--lanes');
  const canvas = $('[data-dust]');
  let head = { x: 0, y: 0 };

  function locateHead() {
    if (!scene || !lanesSvg || !lanesSvg.getScreenCTM) return;
    const ctm = lanesSvg.getScreenCTM();
    if (!ctm) return;
    const r = scene.getBoundingClientRect();
    const pt = new DOMPoint(1400, 130).matrixTransform(ctm);
    head = { x: pt.x - r.left, y: pt.y - r.top };
    scene.style.setProperty('--head-x', `${(head.x / r.width) * 100}%`);
  }

  if (hero && finePointer && !reduce) {
    let px = 0, py = 0, raf = 0;
    hero.addEventListener('pointermove', (e) => {
      const r = hero.getBoundingClientRect();
      px = ((e.clientX - r.left) / r.width - 0.5) * 2;
      py = ((e.clientY - r.top) / r.height - 0.5) * 2;
      if (!raf) raf = requestAnimationFrame(() => {
        raf = 0;
        hero.style.setProperty('--px', px.toFixed(3));
        hero.style.setProperty('--py', py.toFixed(3));
      });
    });
    hero.addEventListener('pointerleave', () => {
      hero.style.setProperty('--px', '0');
      hero.style.setProperty('--py', '0');
    });
  }

  // Dust motes drifting through the projector beam
  let ctx = null;
  try { ctx = canvas ? canvas.getContext('2d') : null; } catch (err) { ctx = null; }
  let W = 0, H = 0, parts = [], heroVisible = true, rafId = 0;
  const BEAM_ANGLE = (110 * Math.PI) / 180;

  function spawn(fresh) {
    return {
      u: fresh ? Math.random() : 0,
      v: Math.random() * 2 - 1,
      r: 0.5 + Math.random() * 1.5,
      sp: 0.00012 + Math.random() * 0.00035,
      wob: Math.random() * Math.PI * 2,
      tw: Math.random() * Math.PI * 2,
    };
  }
  function sizeCanvas() {
    if (!ctx) return;
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round(Math.min(70, Math.max(24, (W * H) / 16000)));
    parts = Array.from({ length: n }, () => spawn(true));
  }
  function drawDust(t) {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    const ox = head.x || W * 0.8;
    const oy = -H * 0.12;
    const len = H * 1.3;
    const beamW = Math.max(W, H) * 0.52;
    const cos = Math.cos(BEAM_ANGLE), sin = Math.sin(BEAM_ANGLE);
    for (const p of parts) {
      const d = p.u * len;
      const half = beamW * (0.03 + 0.47 * (d / (H * 1.4)));
      const v = p.v + Math.sin(t * 0.0004 + p.wob) * 0.08;
      const x = ox + cos * d - sin * v * half * 0.85;
      const y = oy + sin * d + cos * v * half * 0.85;
      const edge = Math.min(1, p.u * 6, (1 - p.u) * 3) * (1 - Math.abs(v) * 0.7);
      const a = Math.max(0, edge) * (0.35 + 0.65 * Math.abs(Math.sin(t * 0.0012 + p.tw)));
      ctx.beginPath();
      ctx.arc(x, y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 232, 196, ${a.toFixed(3)})`;
      ctx.fill();
    }
  }
  function loop(t) {
    rafId = 0;
    for (const p of parts) { p.u += p.sp; if (p.u > 1) Object.assign(p, spawn(false)); }
    drawDust(t);
    if (heroVisible && !reduce && !document.hidden) rafId = requestAnimationFrame(loop);
  }
  function startDust() { if (ctx && !rafId && heroVisible && !reduce && !document.hidden) rafId = requestAnimationFrame(loop); }

  function layoutHero() {
    locateHead();
    sizeCanvas();
    if (reduce) drawDust(0); else startDust();
  }
  layoutHero();
  let resizeT = 0;
  window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(layoutHero, 150); });
  document.addEventListener('visibilitychange', startDust);
  if (hero && 'IntersectionObserver' in window) {
    new IntersectionObserver(([en]) => { heroVisible = en.isIntersecting; startDust(); }).observe(hero);
  }
})();
