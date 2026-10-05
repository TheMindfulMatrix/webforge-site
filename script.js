/* WebForge · site behaviour (Forge DS · Kinetic 2.0)
   Progressive: every page reads and works without this file.
   Motion reads scroll; it never writes it (no scroll-jacking).
   Every module is optional: it looks for its data-hook and quietly returns
   if the page doesn't have one, so page-builders can include this file as-is.

   Hooks:  [data-header] [data-reveal] [data-odometer] [data-hero]
           [data-colorway-btn] [data-styles] [data-action-bar] [data-hero-ctas]
           .tape__track  ·  any <a href="#id"> on the same page gets the "cut". */
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
  const canVT = typeof document.startViewTransition === 'function';

  /* Isolate modules: one failure never takes the page down, but still surfaces. */
  const run = (fn) => { try { fn(); } catch (err) { setTimeout(() => { throw err; }); } };

  /* Shared state other modules can read */
  const ui = { closeMenu: () => {}, revealCheck: () => {}, vel: 0 };

  /* Same-document view transition with a named flavour (html[data-vt]) */
  function transition(kind, update) {
    if (!canVT || reduce || document.hidden) { update(); return Promise.resolve(null); }
    root.dataset.vt = kind;
    let t;
    try { t = document.startViewTransition(update); } catch (e) { delete root.dataset.vt; update(); return Promise.resolve(null); }
    t.ready.catch(() => {});
    t.updateCallbackDone.catch(() => {});
    t.finished.catch(() => {}).finally(() => { if (root.dataset.vt === kind) delete root.dataset.vt; });
    return Promise.resolve(t);
  }

  /* ── Reveals ───────────────────────────────────────────────────────────
     Visible by default. Only elements BELOW the fold at load are armed
     (hidden), and they are released by the observer OR by a scroll check —
     whichever comes first. Elements skipped by a fast scroll appear
     instantly, so nothing is ever held back. */
  run(() => {
    const els = $$('[data-reveal]');
    if (reduce || !hasIO || !els.length) return;
    const armed = new Set();
    const vh = window.innerHeight;
    els.forEach((el) => {
      if (el.getBoundingClientRect().top > vh * 0.92) { el.classList.add('is-armed'); armed.add(el); }
    });
    if (!armed.size) return;

    const show = (el, instant) => {
      if (!armed.has(el)) return;
      armed.delete(el);
      io.unobserve(el);
      if (Math.abs(ui.vel) > 32) instant = true;         // flying past: don't make anyone wait
      if (instant) el.classList.add('is-instant');
      el.classList.add('is-in');
      el.classList.remove('is-armed');
      if (instant) requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('is-instant')));
    };
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) show(en.target, false);
        else if (en.boundingClientRect.bottom < 0) show(en.target, true);
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0 });
    armed.forEach((el) => io.observe(el));

    /* safety net, run from the scroll loop and after every in-page cut */
    ui.revealCheck = (instantAll) => {
      if (!armed.size) return;
      const h = window.innerHeight;
      armed.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.bottom < 0) show(el, true);                  // skipped past: just show it
        else if (r.top < h * 0.96) show(el, !!instantAll); // on screen now
      });
    };
  });

  /* ── Odometer: digits roll like a scoreboard (transform only) ─────────── */
  run(() => {
    $$('[data-odometer]').forEach((el) => {
      const text = el.textContent.trim();
      const chars = Array.from(text);
      const digits = chars.filter((c) => /\d/.test(c)).length;
      const sr = document.createElement('span');
      sr.className = 'sr-only';
      sr.textContent = text;
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
        const cycles = Math.max(1, 2 - fromRight);      // rightmost digit spins most
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

  /* ── Header: phone menu + scrolled state ─────────────────────────────── */
  run(() => {
    const header = $('[data-header]');
    if (!header) return;
    const btn = $('.nav__toggle', header);
    const menu = $('.nav__menu', header);
    if (btn && menu) {
      const label = $('[data-nav-label]', btn);
      const set = (open) => {
        btn.setAttribute('aria-expanded', String(open));
        header.classList.toggle('menu-open', open);
        if (label) label.textContent = open ? 'Close' : 'Menu';
      };
      ui.closeMenu = () => set(false);
      btn.addEventListener('click', () => set(btn.getAttribute('aria-expanded') !== 'true'));
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && header.classList.contains('menu-open')) { set(false); btn.focus(); }
      });
      document.addEventListener('click', (e) => {
        if (header.classList.contains('menu-open') && !header.contains(e.target)) set(false);
      });
      menu.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
      const wide = window.matchMedia('(min-width: 900px)');
      const onWide = () => { if (wide.matches) set(false); };
      wide.addEventListener ? wide.addEventListener('change', onWide) : wide.addListener(onWide);
    }
    const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  });

  /* ── In-page navigation: a quick "cut" instead of a long glide ────────── */
  run(() => {
    const norm = (p) => p.replace(/index\.html?$/, '');
    const focusTarget = (target) => {
      let f = target.matches('h1, h2, h3') ? target : target.querySelector('h1, h2');
      if (!f) f = target;
      if (!f.hasAttribute('tabindex') && !f.matches('a, button, input, select, textarea')) f.setAttribute('tabindex', '-1');
      f.focus({ preventScroll: true });
    };
    document.addEventListener('click', (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest('a[href*="#"]');
      if (!a || a.classList.contains('skip-link') || a.target) return;
      let url;
      try { url = new URL(a.href, location.href); } catch (err) { return; }
      if (url.origin !== location.origin || norm(url.pathname) !== norm(location.pathname) || url.hash.length < 2) return;
      const target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
      if (!target) return;
      e.preventDefault();
      ui.closeMenu();
      const go = () => {
        target.scrollIntoView({ block: 'start' });
        ui.revealCheck(true);                                  // arrive to finished content
        if (location.hash !== url.hash) history.pushState(null, '', url.hash);
      };
      transition('cut', go).then((t) => {
        if (t) t.updateCallbackDone.then(() => focusTarget(target)).catch(() => focusTarget(target));
        else focusTarget(target);
      });
    });
  });

  /* ── Momentum: scroll velocity drives the tapes; also the reveal net ──── */
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
      ui.vel += (dy - ui.vel) * 0.16;
      const v = ui.vel;

      if (!reduce && leans.length) {
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
      ui.revealCheck(false);

      idle = Math.abs(v) < 0.04 && dy === 0 ? idle + 1 : 0;
      if (idle > 12) {
        ui.vel = 0; raf = 0;
        leans.forEach((l) => { l.style.transform = ''; });
        if (lastRate !== 1) { getAnims().forEach((a) => { a.playbackRate = 1; }); lastRate = 1; }
        return;
      }
      raf = requestAnimationFrame(frame);
    }
    window.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(frame); }, { passive: true });
    window.addEventListener('resize', () => {
      heroH = hero ? hero.offsetHeight : window.innerHeight;
      docMax = Math.max(1, root.scrollHeight - window.innerHeight);
      fallbackDrift(window.scrollY);
      ui.revealCheck(false);
    }, { passive: true });
    fallbackDrift(window.scrollY);
  });

  /* ── Hero lanes: nine lanes on canvas, three of them quietly broken ──── */
  run(() => {
    const hero = $('[data-hero]');
    const cv = hero ? $('.hero__lanes', hero) : null;
    if (!cv || !cv.getContext) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const LANES = 9;
    const ANGLE = -8 * Math.PI / 180;
    let w = 0; let h = 0; let dpr = 1; let D = 0; let laneW = 0;
    let runners = [];
    let breaks = [];
    let colors = { accent: '#ff5b1f', text: '#f2f0e9' };
    let visible = true; let raf = 0; let last = 0; let boost = 0; let clock = 0;

    /* Read the ROLE tokens off the hero and normalise them through the canvas */
    const readColors = () => {
      const cs = getComputedStyle(hero);
      const norm = (v, f) => {
        ctx.fillStyle = f;
        try { ctx.fillStyle = (v || '').trim() || f; } catch (e) { /* keep fallback */ }
        const out = ctx.fillStyle;
        return /^#[0-9a-f]{6}$/i.test(out) ? out : f;
      };
      colors = { accent: norm(cs.getPropertyValue('--c-accent'), colors.accent), text: norm(cs.getPropertyValue('--c-text'), colors.text) };
    };
    const hexA = (hex, a) => hex + Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, '0');

    const seed = () => {
      runners = [];
      for (let i = 0; i < LANES * 3; i++) {
        runners.push({
          lane: i % LANES,
          x: (Math.random() * 1.6 - 0.8) * D,
          speed: 30 + Math.random() * 110,
          len: 80 + Math.random() * 260,
          hot: Math.random() < 0.16,
          a: 0.18 + Math.random() * 0.45,
        });
      }
      /* the breaks: a gap in three lane lines, somewhere mid-frame */
      breaks = [1, 4, 7].map((lane, i) => ({ lane, x: (-0.35 + i * 0.32 + Math.random() * 0.12) * D * 0.7, gap: 46 + Math.random() * 30, phase: Math.random() * 6 }));
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

    function inBreak(lane, x) {
      for (const b of breaks) if (b.lane === lane && x > b.x - b.gap / 2 && x < b.x + b.gap / 2) return true;
      return false;
    }

    function draw(dt) {
      clock += dt;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.translate(w * 0.5, h * 0.55);
      ctx.rotate(ANGLE);
      const top = -(LANES * laneW) / 2;

      /* lane lines, with gaps where a lane is broken */
      ctx.lineWidth = 1;
      ctx.strokeStyle = colors.text;
      ctx.globalAlpha = 0.075;
      for (let i = 0; i <= LANES; i++) {
        const y = top + i * laneW;
        const b = breaks.find((k) => k.lane === i);
        ctx.beginPath();
        if (b) { ctx.moveTo(-D, y); ctx.lineTo(b.x - b.gap / 2, y); ctx.moveTo(b.x + b.gap / 2, y); ctx.lineTo(D, y); }
        else { ctx.moveTo(-D, y); ctx.lineTo(D, y); }
        ctx.stroke();
      }
      /* the crack marks — they pulse, quietly */
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = colors.accent;
      for (const b of breaks) {
        const y = top + b.lane * laneW;
        ctx.globalAlpha = reduce ? 0.6 : 0.35 + 0.3 * (0.5 + 0.5 * Math.sin(clock * 1.4 + b.phase));
        /* a jagged fracture across the gap: the line is broken, and that's all */
        const x0 = b.x - b.gap / 2; const x1 = b.x + b.gap / 2;
        ctx.beginPath();
        ctx.moveTo(x0 - 10, y); ctx.lineTo(x0, y); ctx.lineTo(x0 + 3, y - 3);
        ctx.moveTo(x1 + 10, y); ctx.lineTo(x1, y); ctx.lineTo(x1 - 3, y + 3);
        ctx.moveTo(b.x - 2, y - 9); ctx.lineTo(b.x + 3, y - 2); ctx.lineTo(b.x - 3, y + 2); ctx.lineTo(b.x + 2, y + 9);
        ctx.stroke();
      }

      ctx.lineCap = 'round';
      for (const r of runners) {
        r.x += r.speed * (1 + boost) * dt;
        const L = r.len * (1 + boost * 0.55);
        if (r.x - L > D) { r.x = -D - Math.random() * D * 0.4; r.lane = Math.floor(Math.random() * LANES); }
        const y = top + (r.lane + 0.5) * laneW;
        const col = r.hot ? colors.accent : colors.text;
        const stalled = inBreak(r.lane, r.x) || inBreak(r.lane + 1, r.x);
        const g = ctx.createLinearGradient(r.x - L, 0, r.x, 0);
        g.addColorStop(0, hexA(col, 0));
        g.addColorStop(1, col);
        let a = r.hot ? Math.min(1, r.a + 0.35) : r.a * 0.6;
        if (stalled) a *= 0.12;                       // a runner hitting a break goes dark
        ctx.globalAlpha = a;
        ctx.strokeStyle = g;
        ctx.lineWidth = r.hot ? 2.5 : 1.5;
        ctx.beginPath(); ctx.moveTo(r.x - L, y); ctx.lineTo(r.x, y); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    function loop(t) {
      const dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
      last = t;
      boost += (Math.min(7, Math.abs(ui.vel) * 0.16) - boost) * 0.12;
      draw(dt);
      raf = requestAnimationFrame(loop);
    }
    const start = () => { if (!raf && visible && !reduce && !document.hidden) { last = 0; raf = requestAnimationFrame(loop); } };
    const stop = () => { if (raf) cancelAnimationFrame(raf); raf = 0; };

    readColors();
    size();
    if ('ResizeObserver' in window) new ResizeObserver(() => size()).observe(cv);
    else window.addEventListener('resize', size, { passive: true });
    if (hasIO) new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : stop(); }).observe(cv);
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
    window.addEventListener('wf:colorway', () => { readColors(); if (!raf) draw(0); });
    const onReduce = () => { reduce = mqReduce.matches; if (reduce) { stop(); draw(0); } else start(); };
    mqReduce.addEventListener ? mqReduce.addEventListener('change', onReduce) : mqReduce.addListener(onReduce);
    start();
  });

  /* ── Colorway: re-colour the whole page with a circular View Transition ── */
  run(() => {
    const btns = $$('[data-colorway-btn]');
    if (!btns.length) return;
    const status = $('[data-colorway-status]');
    btns.forEach((b) => b.addEventListener('click', () => {
      const name = b.dataset.colorwayBtn;
      if (b.getAttribute('aria-pressed') === 'true') return;
      const apply = () => {
        if (name === 'forge') delete root.dataset.colorway; else root.dataset.colorway = name;
        btns.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        $$('[data-colorway-name]').forEach((n) => { n.textContent = name === 'forge' ? 'WebForge orange' : b.textContent.trim(); });
        window.dispatchEvent(new Event('wf:colorway'));
      };
      if (status) status.textContent = 'Page re-colored: ' + b.textContent.trim() + (name === 'forge' ? '. The four styles show their own house colors.' : '. The four styles now use it too.');
      if (!canVT || reduce || document.hidden) { apply(); return; }
      const r = b.getBoundingClientRect();
      const x = r.left + r.width / 2; const y = r.top + r.height / 2;
      const R = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
      transition('wipe', apply).then((t) => {
        if (!t) return;
        t.ready.then(() => {
          root.animate(
            { clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + R + 'px at ' + x + 'px ' + y + 'px)'] },
            { duration: 640, easing: 'cubic-bezier(0.76, 0, 0.24, 1)', pseudoElement: '::view-transition-new(root)' }
          );
        }).catch(() => {});
      });
    }));
  });

  /* ── Style previews animate only while they're on screen ─────────────── */
  run(() => {
    const sec = $('[data-styles]');
    if (!sec || !hasIO) return;
    new IntersectionObserver(([e]) => sec.classList.toggle('is-live', e.isIntersecting), { rootMargin: '10% 0px' }).observe(sec);
  });

  /* ── Phone action bar: appears once the hero buttons scroll away ──────── */
  run(() => {
    const bar = $('[data-action-bar]');
    if (!bar || !hasIO) return;
    const ctas = $('[data-hero-ctas]');
    const ends = [$('.cta-band'), $('.site-footer')].filter(Boolean);
    let ctasSeen = !ctas ? false : true;
    const endSeen = new Set();
    const update = () => bar.classList.toggle('is-shown', !ctasSeen && endSeen.size === 0);
    if (ctas) {
      new IntersectionObserver(([e]) => {
        ctasSeen = e.isIntersecting || e.boundingClientRect.top > 0;   // only "passed" once above the viewport
        update();
      }).observe(ctas);
    }
    const endIO = new IntersectionObserver((entries) => {
      entries.forEach((e) => (e.isIntersecting ? endSeen.add(e.target) : endSeen.delete(e.target)));
      update();
    }, { rootMargin: '0px 0px -20% 0px' });
    ends.forEach((el) => endIO.observe(el));
    update();
  });
})();
