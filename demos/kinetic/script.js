/* Forge DS · Kinetic — behaviour layer.
   Progressive: every section reads and works without this file.
   Motion reads scroll; it never writes it (no scroll-jacking). */
(() => {
  'use strict';

  const root = document.documentElement;
  root.classList.add('js');

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reduce = mqReduce.matches;
  const SDA = !!(window.CSS && CSS.supports && CSS.supports('animation-timeline: view()'));
  if (!SDA) root.classList.add('no-sda');
  const hasIO = 'IntersectionObserver' in window;

  /* Isolate modules: one failure never takes the page down, but still surfaces. */
  const run = (fn) => { try { fn(); } catch (err) { setTimeout(() => { throw err; }); } };

  /* Shared scroll velocity (px/frame, smoothed). Read-only consumers. */
  const motion = { vel: 0, listeners: new Set() };

  /* ── Reveals ─────────────────────────────────────────────────────────── */
  run(() => {
    const els = $$('[data-reveal]');
    if (!hasIO) { els.forEach((el) => el.classList.add('is-in')); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0 });
    els.forEach((el) => io.observe(el));
  });

  /* ── Odometer: digits roll like a scoreboard (transform only) ──────────── */
  run(() => {
    $$('[data-odometer]').forEach((el) => {
      const text = el.textContent.trim();
      const chars = Array.from(text);
      const digits = chars.filter((c) => /\d/.test(c)).length;
      const sr = document.createElement('span');
      sr.className = 'sr-only';
      sr.textContent = text + (el.nextElementSibling && el.nextElementSibling.classList.contains('stat__suffix') ? '+' : '');
      const vis = document.createElement('span');
      vis.className = 'odo';
      vis.setAttribute('aria-hidden', 'true');
      let di = 0;
      chars.forEach((ch) => {
        if (!/\d/.test(ch)) {
          const s = document.createElement('span');
          s.textContent = ch;
          vis.appendChild(s);
          return;
        }
        const fromRight = digits - di - 1;
        const cycles = Math.max(1, 3 - fromRight);       // rightmost digit spins most
        const total = (cycles + 1) * 10;
        const col = document.createElement('span');
        col.className = 'odo__col';
        col.style.setProperty('--c', String(di));
        const strip = document.createElement('span');
        strip.className = 'odo__strip';
        for (let i = 0; i < total; i++) {
          const n = document.createElement('span');
          n.textContent = String(i % 10);
          strip.appendChild(n);
        }
        strip.style.setProperty('--to', String((cycles * 10 + Number(ch)) / total));
        col.appendChild(strip);
        vis.appendChild(col);
        di++;
      });
      el.textContent = '';
      el.append(sr, vis);
    });
  });

  /* ── Schedule: today, live/next session, filters, phone day picker ─────── */
  const schedule = {};
  run(() => {
    const week = $('[data-week]');
    if (!week) return;
    const days = $$('.day', week);
    const picks = $$('[data-pick]');
    const chips = $$('[data-filter]');
    const DAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    const fmt = (min) => {
      let h = Math.floor(min / 60); const m = min % 60; const ap = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      return h + (m ? ':' + String(m).padStart(2, '0') : '') + ' ' + ap;
    };
    const sessions = $$('.session', week).map((el) => ({
      el,
      day: Number(el.closest('.day').dataset.day),
      start: toMin(el.dataset.start),
      end: toMin(el.dataset.end),
      program: el.dataset.program,
      name: $('.session__prog', el).textContent.trim(),
      age: $('.session__age', el).textContent.trim(),
      flag: $('.session__flag', el),
    }));

    // "No sessions" line for days a filter empties
    days.forEach((d) => {
      if (d.classList.contains('day--off')) return;
      const p = document.createElement('p');
      p.className = 'day__none';
      p.textContent = 'Nothing for this program today — try another day.';
      d.appendChild(p);
    });

    let today = new Date().getDay();
    let active = today;
    let filter = 'all';
    const isPhone = () => window.matchMedia('(max-width: 639px)').matches;

    function pick(d) {
      active = d;
      days.forEach((x) => x.classList.toggle('is-active', Number(x.dataset.day) === d));
      picks.forEach((p) => p.setAttribute('aria-pressed', String(Number(p.dataset.pick) === d)));
    }
    picks.forEach((p) => p.addEventListener('click', () => pick(Number(p.dataset.pick))));

    function applyFilter(f) {
      filter = f;
      chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.filter === f)));
      sessions.forEach((s) => { s.el.hidden = !(f === 'all' || s.program === f); });
      days.forEach((d) => {
        if (d.classList.contains('day--off')) return;
        d.classList.toggle('is-empty', !d.querySelector('.session:not([hidden])'));
      });
      picks.forEach((p) => {
        const d = Number(p.dataset.pick);
        const has = sessions.some((s) => s.day === d && !s.el.hidden);
        p.classList.toggle('is-quiet', !has);
      });
      // On a phone, never leave a parent staring at an empty day
      const activeDay = days.find((d) => Number(d.dataset.day) === active);
      if (activeDay && (activeDay.classList.contains('is-empty') || activeDay.classList.contains('day--off'))) {
        for (let i = 1; i <= 7; i++) {
          const d = (active + i) % 7;
          if (sessions.some((s) => s.day === d && !s.el.hidden)) { pick(d); break; }
        }
      }
    }

    function setFilter(f, animate) {
      if (f === filter) return;
      const canVT = animate && document.startViewTransition && !reduce && !document.hidden;
      if (!canVT) { applyFilter(f); return; }
      sessions.forEach((s, i) => { s.el.style.viewTransitionName = 'k-sess-' + i; });
      const t = document.startViewTransition(() => applyFilter(f));
      t.ready.catch(() => {});          // a rapid second tap skips the first transition — that's fine
      t.finished.finally(() => sessions.forEach((s) => { s.el.style.viewTransitionName = ''; }));
    }
    chips.forEach((c) => c.addEventListener('click', () => setFilter(c.dataset.filter, true)));
    $$('[data-filter-link]').forEach((a) => a.addEventListener('click', () => setFilter(a.dataset.filterLink, false)));

    // Today + live/next, refreshed every minute
    const nextLabel = $('[data-next-label]');
    const nextWhat = $('[data-next-what]');
    const nextWhen = $('[data-next-when]');
    const nextAge = $('[data-next-age]');
    let firstTick = true;

    function tick() {
      const now = new Date();
      const d = now.getDay();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      if (d !== today || firstTick) {
        today = d;
        days.forEach((x) => {
          const isT = Number(x.dataset.day) === today;
          x.classList.toggle('is-today', isT);
          let tag = $('.day__tag', x);
          if (isT && !tag) {
            tag = document.createElement('span');
            tag.className = 'day__tag';
            tag.textContent = 'Today';
            $('.day__head', x).appendChild(tag);
          } else if (!isT && tag) tag.remove();
        });
        picks.forEach((p) => p.classList.toggle('is-today', Number(p.dataset.pick) === today));
        if (firstTick) pick(today);
      }

      const live = sessions.find((s) => s.day === today && s.start <= nowMin && nowMin < s.end);
      let next = null; let best = Infinity;
      sessions.forEach((s) => {
        let delta = ((s.day - today + 7) % 7) * 1440 + s.start - nowMin;
        if (delta <= 0) delta += 7 * 1440;
        if (delta < best) { best = delta; next = s; }
      });

      sessions.forEach((s) => {
        s.el.classList.toggle('is-live', s === live);
        s.el.classList.toggle('is-next', !live && s === next);
        if (s.flag) s.flag.textContent = s === live ? 'On now' : (!live && s === next ? 'Next up' : '');
      });

      if (nextWhat && nextWhen && nextLabel) {
        if (live) {
          nextLabel.textContent = 'On the floor now';
          nextWhat.textContent = live.name;
          if (nextAge) nextAge.textContent = live.age;
          nextWhen.textContent = 'Until ' + fmt(live.end);
        } else if (next) {
          nextLabel.textContent = 'Next on the floor';
          nextWhat.textContent = next.name;
          if (nextAge) nextAge.textContent = next.age;
          const dayDiff = (next.day - today + 7) % 7;
          let when;
          if (best < 60) when = 'Starts in ' + best + ' min';
          else if (dayDiff === 0) when = 'Today · ' + fmt(next.start);
          else if (dayDiff === 1) when = 'Tomorrow · ' + fmt(next.start);
          else when = DAY[next.day].slice(0, 3) + ' · ' + fmt(next.start);
          nextWhen.textContent = when;
        }
      }
      firstTick = false;
    }
    tick();
    setInterval(tick, 60 * 1000);

    applyFilter('all');
    schedule.isPhone = isPhone;
  });

  /* ── Floor plan ↔ legend ───────────────────────────────────────────────── */
  run(() => {
    const plan = $('[data-plan]');
    if (!plan) return;
    const zones = $$('.zone', plan);
    const btns = $$('[data-zone-btn]');
    let pinned = null;
    const show = (z) => {
      zones.forEach((el) => el.classList.toggle('is-active', el.dataset.zone === z));
      btns.forEach((b) => b.classList.toggle('is-active', b.dataset.zoneBtn === z));
    };
    const pin = (z) => {
      pinned = pinned === z ? null : z;
      btns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.zoneBtn === pinned)));
      show(pinned);
    };
    btns.forEach((b) => {
      const z = b.dataset.zoneBtn;
      b.addEventListener('pointerenter', () => show(z));
      b.addEventListener('pointerleave', () => show(pinned));
      b.addEventListener('focus', () => show(z));
      b.addEventListener('blur', () => show(pinned));
      b.addEventListener('click', () => pin(z));
    });
    zones.forEach((g) => {
      const z = g.dataset.zone;
      g.addEventListener('pointerenter', () => show(z));
      g.addEventListener('pointerleave', () => show(pinned));
      g.addEventListener('click', () => pin(z));
    });
  });

  /* ── Header: menu + scrolled state; phone action bar ───────────────────── */
  run(() => {
    const header = $('[data-header]');
    const btn = $('.nav__toggle');
    const menu = $('#nav-menu');
    if (header && btn && menu) {
      const label = $('[data-nav-label]', btn);
      const set = (open) => {
        btn.setAttribute('aria-expanded', String(open));
        header.classList.toggle('menu-open', open);
        if (label) label.textContent = open ? 'Close' : 'Menu';
      };
      btn.addEventListener('click', () => set(btn.getAttribute('aria-expanded') !== 'true'));
      menu.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && header.classList.contains('menu-open')) { set(false); btn.focus(); }
      });
      document.addEventListener('click', (e) => {
        if (header.classList.contains('menu-open') && !header.contains(e.target)) set(false);
      });
      const wide = window.matchMedia('(min-width: 900px)');
      const onWide = () => { if (wide.matches) set(false); };
      wide.addEventListener ? wide.addEventListener('change', onWide) : wide.addListener(onWide);
    }

    if (!hasIO) return;
    const hero = $('[data-hero]');
    if (header && hero) {
      const sentinel = document.createElement('div');
      sentinel.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:8px;pointer-events:none';
      sentinel.setAttribute('aria-hidden', 'true');
      hero.prepend(sentinel);
      new IntersectionObserver(([e]) => header.classList.toggle('is-scrolled', !e.isIntersecting)).observe(sentinel);
    }

    const bar = $('[data-action-bar]');
    const ctas = $('[data-hero-ctas]');
    const ends = [$('#trial'), $('.site-footer')].filter(Boolean);
    if (bar && ctas) {
      let ctasSeen = true; const endSeen = new Set();
      const update = () => bar.classList.toggle('is-shown', !ctasSeen && endSeen.size === 0);
      new IntersectionObserver(([e]) => {
        // Only count "passed" once the CTAs are above the viewport
        ctasSeen = e.isIntersecting || e.boundingClientRect.top > 0;
        update();
      }).observe(ctas);
      const endIO = new IntersectionObserver((entries) => {
        entries.forEach((e) => (e.isIntersecting ? endSeen.add(e.target) : endSeen.delete(e.target)));
        update();
      }, { rootMargin: '0px 0px -30% 0px' });
      ends.forEach((el) => endIO.observe(el));
    }
  });

  /* ── Momentum: scroll velocity drives the tapes + hero lanes ───────────── */
  run(() => {
    const leans = $$('.tape__lean');
    const tracks = $$('.tape__track');
    const hero = $('[data-hero]');
    let anims = null;
    const getAnims = () => {
      if (!anims || anims.length === 0) {
        anims = tracks.map((t) => (t.getAnimations ? t.getAnimations()[0] : null)).filter(Boolean);
      }
      return anims;
    };
    let lastY = window.scrollY;
    let raf = 0; let idle = 0; let lastRate = 1;
    let heroH = hero ? hero.offsetHeight : window.innerHeight;
    let docMax = Math.max(1, root.scrollHeight - window.innerHeight);

    const fallbackDrift = (y) => {
      if (SDA) return;
      if (hero && !reduce) hero.style.setProperty('--p', Math.min(1, Math.max(0, y / heroH)).toFixed(4));
      root.style.setProperty('--progress', Math.min(1, y / docMax).toFixed(4));
    };

    function frame() {
      const y = window.scrollY;
      const dy = y - lastY;
      lastY = y;
      motion.vel += (dy - motion.vel) * 0.16;
      const v = motion.vel;

      if (!reduce) {
        const skew = Math.max(-9, Math.min(9, v * 0.32));
        leans.forEach((l) => { l.style.transform = Math.abs(skew) < 0.05 ? '' : 'skewX(' + (-skew).toFixed(2) + 'deg)'; });
        const dir = v < -0.6 ? -1 : 1;
        const rate = dir * (1 + Math.min(5, Math.abs(v) * 0.09));
        if (Math.abs(rate - lastRate) > 0.03) {
          getAnims().forEach((a) => { a.playbackRate = rate; });
          lastRate = rate;
        }
      }
      fallbackDrift(y);
      motion.listeners.forEach((fn) => fn(v));

      idle = Math.abs(v) < 0.04 && dy === 0 ? idle + 1 : 0;
      if (idle > 12) {
        motion.vel = 0; raf = 0;
        leans.forEach((l) => { l.style.transform = ''; });
        if (lastRate !== 1) { getAnims().forEach((a) => { a.playbackRate = 1; }); lastRate = 1; }
        motion.listeners.forEach((fn) => fn(0));
        return;
      }
      raf = requestAnimationFrame(frame);
    }
    window.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(frame); }, { passive: true });
    window.addEventListener('resize', () => {
      heroH = hero ? hero.offsetHeight : window.innerHeight;
      docMax = Math.max(1, root.scrollHeight - window.innerHeight);
      fallbackDrift(window.scrollY);
    }, { passive: true });
    fallbackDrift(window.scrollY);
  });

  /* ── Hero lanes: nine running lanes on canvas; runners surge with scroll ── */
  run(() => {
    const cv = $('.hero__lanes');
    if (!cv || !cv.getContext) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const LANES = 9;
    const ANGLE = -8 * Math.PI / 180;
    let w = 0; let h = 0; let dpr = 1; let D = 0; let laneW = 0;
    let runners = [];
    let colors = {};
    let visible = true; let raf = 0; let last = 0; let boost = 0;

    const readColors = () => {
      const cs = getComputedStyle(root);
      const hex = (v, f) => { v = (v || '').trim(); return /^#[0-9a-f]{6}$/i.test(v) ? v : f; };
      colors = { accent: hex(cs.getPropertyValue('--brand-accent'), '#D4FF1E'), chalk: hex(cs.getPropertyValue('--brand-chalk'), '#F2F0E9') };
    };

    const seed = () => {
      runners = [];
      for (let i = 0; i < LANES * 3; i++) {
        runners.push({
          lane: i % LANES,
          x: (Math.random() * 1.6 - 0.8) * D,
          speed: 30 + Math.random() * 110,
          len: 80 + Math.random() * 260,
          hot: Math.random() < 0.14,
          a: 0.18 + Math.random() * 0.45,
        });
      }
    };

    const size = () => {
      const r = cv.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = Math.max(1, r.width); h = Math.max(1, r.height);
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      D = Math.hypot(w, h) * 0.62;
      laneW = Math.max(46, Math.min(110, h / 7.5));
      if (!runners.length) seed();
      draw(0);
    };

    function draw(dt) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.translate(w * 0.5, h * 0.55);
      ctx.rotate(ANGLE);
      const top = -(LANES * laneW) / 2;
      ctx.lineWidth = 1;
      ctx.strokeStyle = colors.chalk;
      ctx.globalAlpha = 0.075;
      for (let i = 0; i <= LANES; i++) {
        const y = top + i * laneW;
        ctx.beginPath(); ctx.moveTo(-D, y); ctx.lineTo(D, y); ctx.stroke();
      }
      ctx.lineCap = 'round';
      for (const r of runners) {
        r.x += r.speed * (1 + boost) * dt;
        const L = r.len * (1 + boost * 0.55);
        if (r.x - L > D) { r.x = -D - Math.random() * D * 0.4; r.lane = Math.floor(Math.random() * LANES); }
        const y = top + (r.lane + 0.5) * laneW;
        const col = r.hot ? colors.accent : colors.chalk;
        const g = ctx.createLinearGradient(r.x - L, 0, r.x, 0);
        g.addColorStop(0, col + '00');
        g.addColorStop(1, col);
        ctx.globalAlpha = r.hot ? Math.min(1, r.a + 0.35) : r.a * 0.6;
        ctx.strokeStyle = g;
        ctx.lineWidth = r.hot ? 2.5 : 1.5;
        ctx.beginPath(); ctx.moveTo(r.x - L, y); ctx.lineTo(r.x, y); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    function loop(t) {
      const dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
      last = t;
      boost += (Math.min(7, Math.abs(motion.vel) * 0.16) - boost) * 0.12;
      draw(dt);
      raf = requestAnimationFrame(loop);
    }
    const start = () => { if (!raf && visible && !reduce && !document.hidden) { last = 0; raf = requestAnimationFrame(loop); } };
    const stop = () => { if (raf) cancelAnimationFrame(raf); raf = 0; };

    readColors();
    size();
    if ('ResizeObserver' in window) new ResizeObserver(() => { size(); }).observe(cv);
    else window.addEventListener('resize', size, { passive: true });
    if (hasIO) {
      new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : stop(); }).observe(cv);
    }
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
    window.addEventListener('k:colorway', () => { readColors(); if (!raf) draw(0); });
    const onReduce = () => { reduce = mqReduce.matches; if (reduce) { stop(); draw(0); } else start(); };
    mqReduce.addEventListener ? mqReduce.addEventListener('change', onReduce) : mqReduce.addListener(onReduce);
    start();
  });

  /* ── Colorway: re-theme the whole page with a circular View Transition ─── */
  run(() => {
    const btns = $$('[data-colorway-btn]');
    btns.forEach((b) => b.addEventListener('click', () => {
      const name = b.dataset.colorwayBtn;
      if (b.getAttribute('aria-pressed') === 'true') return;
      const apply = () => {
        if (name === 'volt') delete root.dataset.colorway; else root.dataset.colorway = name;
        btns.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        window.dispatchEvent(new Event('k:colorway'));
      };
      if (!document.startViewTransition || reduce) { apply(); return; }
      const r = b.getBoundingClientRect();
      const x = r.left + r.width / 2; const y = r.top + r.height / 2;
      const R = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
      root.classList.add('vt-wipe');
      const t = document.startViewTransition(apply);
      t.ready.then(() => {
        root.animate(
          { clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + R + 'px at ' + x + 'px ' + y + 'px)'] },
          { duration: 900, easing: 'cubic-bezier(0.76, 0, 0.24, 1)', pseudoElement: '::view-transition-new(root)' }
        );
      }).catch(() => {});
      t.finished.finally(() => root.classList.remove('vt-wipe'));
    }));
  });

  /* ── Free-trial form (demo: confirms on the page, sends nothing) ──────── */
  run(() => {
    const form = $('[data-trial-form]');
    const status = $('[data-form-status]');
    if (!form || !status) return;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      const data = new FormData(form);
      const first = String(data.get('name') || '').trim().split(/\s+/)[0];
      const program = String(data.get('program') || 'a program');
      const day = String(data.get('day') || 'a weekday');
      status.textContent = '';
      const strong = document.createElement('strong');
      strong.textContent = 'You’re pencilled in' + (first ? ', ' + first : '') + '.';
      const p = document.createElement('span');
      p.textContent = program + ', ' + day + ', age ' + data.get('age') + '. On the live site the front desk would confirm by tomorrow — this demo didn’t send anything.';
      status.append(strong, p);
    });
  });
})();
