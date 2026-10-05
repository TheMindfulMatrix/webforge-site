/* WebForge · Bright Club — behaviour layer.
   Everything here is progressive enhancement: the page is complete without it. */
(() => {
  'use strict';

  const doc = document.documentElement;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
  const reduce = () => mqReduce.matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const mqDayView = matchMedia('(max-width: 1023.98px)');

  /* ---------------------------------------------------------------- 1. headline letters */
  let ch = 0;
  $$('[data-split]').forEach((el) => {
    const text = el.textContent;
    el.textContent = '';
    text.split(/(\s+)/).forEach((part) => {
      if (!part) return;
      if (/^\s+$/.test(part)) { el.append(' '); return; }
      const word = document.createElement('span');
      word.className = 'word';
      for (const c of part) {
        const s = document.createElement('span');
        s.className = 'ch';
        s.style.setProperty('--i', ch++);
        s.textContent = c;
        word.append(s);
      }
      el.append(word);
    });
  });

  /* ---------------------------------------------------------------- 2. reveals + "live" loops */
  $$('.cards__item, .visit__cards .info').forEach((el) => {
    const i = Array.prototype.indexOf.call(el.parentElement.children, el);
    el.style.setProperty('--d', `${i * 130}ms`);
  });
  const revealIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      revealIO.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
  $$('[data-reveal]').forEach((el) => revealIO.observe(el));

  const liveIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => e.target.classList.toggle('is-live', e.isIntersecting));
  }, { rootMargin: '80px 0px' });
  $$('.program, .stage, .map, .photo-slot--feature, .mug').forEach((el) => liveIO.observe(el));

  /* ---------------------------------------------------------------- 3. scoreboard digits */
  $$('[data-roll]').forEach((el) => {
    const value = el.textContent.trim();
    el.textContent = '';
    const sr = document.createElement('span');
    sr.className = 'sr-only';
    sr.textContent = value;
    const roll = document.createElement('span');
    roll.className = 'roll';
    roll.setAttribute('aria-hidden', 'true');
    [...value].forEach((digit, c) => {
      const col = document.createElement('span');
      col.className = 'roll__col';
      const strip = document.createElement('span');
      strip.className = 'roll__strip';
      const target = 10 * (c + 1) + Number(digit);
      let html = '';
      for (let k = 0; k <= target; k++) html += `<span>${k % 10}</span>`;
      strip.innerHTML = html;
      strip.style.setProperty('--n', target);
      strip.style.setProperty('--c', c);
      col.append(strip);
      roll.append(col);
    });
    el.append(sr, roll);
  });
  const slab = $('.scoreboard__slab');
  if (slab && reduce()) slab.classList.add('is-rolled');
  else if (slab) {
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      slab.classList.add('is-rolled');
      io.disconnect();
    }, { threshold: 0.4 });
    io.observe(slab);
  }

  /* ---------------------------------------------------------------- 4. hero parallax */
  const stage = $('[data-stage]');
  const hero = stage && stage.closest('.hero');
  if (stage && hero) {
    const layers = $$('[data-depth]', stage).map((el) => ({ el, d: Number(el.dataset.depth) }));
    let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
    const tick = () => {
      cx += (tx - cx) * 0.09;
      cy += (ty - cy) * 0.09;
      layers.forEach(({ el, d }) => {
        el.style.translate = `${(cx * d * 34).toFixed(2)}px ${(cy * d * 30).toFixed(2)}px`;
      });
      raf = (Math.abs(tx - cx) > 0.0008 || Math.abs(ty - cy) > 0.0008) ? requestAnimationFrame(tick) : 0;
    };
    hero.addEventListener('pointermove', (e) => {
      if (!finePointer.matches || reduce()) return;
      const r = hero.getBoundingClientRect();
      tx = (e.clientX - r.left) / r.width - 0.5;
      ty = (e.clientY - r.top) / r.height - 0.5;
      if (!raf) raf = requestAnimationFrame(tick);
    });
    hero.addEventListener('pointerleave', () => {
      tx = 0; ty = 0;
      if (!raf) raf = requestAnimationFrame(tick);
    });
  }

  /* ---------------------------------------------------------------- 5. tear-off ticket */
  const ticket = $('[data-ticket]');
  if (ticket) {
    ticket.addEventListener('click', (e) => {
      if (reduce() || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      if (ticket.classList.contains('is-torn')) return;
      e.preventDefault();
      ticket.classList.add('is-torn');
      setTimeout(() => {
        if (location.hash === '#book') document.getElementById('book').scrollIntoView({ behavior: 'smooth' });
        else location.hash = '#book';
        setTimeout(() => ticket.classList.remove('is-torn'), 1400);
      }, 480);
    });
  }

  /* ---------------------------------------------------------------- 6. nav: shadow, scroll-spy, menu */
  const nav = $('[data-nav]');
  if (nav) {
    const sentinel = document.createElement('div');
    sentinel.setAttribute('aria-hidden', 'true');
    sentinel.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:24px;pointer-events:none;';
    document.body.prepend(sentinel);
    new IntersectionObserver(([e]) => nav.classList.toggle('is-scrolled', !e.isIntersecting)).observe(sentinel);

    const links = $$('.nav__links a');
    const byId = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        links.forEach((a) => a.removeAttribute('aria-current'));
        const link = byId.get(e.target.id);
        if (link) link.setAttribute('aria-current', 'true');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    ['top', ...byId.keys(), 'book'].forEach((id) => {
      const s = document.getElementById(id);
      if (s) spy.observe(s);
    });
  }

  const menu = $('#menu');
  if (menu) {
    const supportsPopover = typeof menu.showPopover === 'function';
    if (supportsPopover) {
      menu.addEventListener('click', (e) => { if (e.target.closest('a')) menu.hidePopover(); });
    } else {
      // Fallback for browsers without the Popover API: a simple toggled panel.
      menu.hidden = true;
      menu.style.opacity = '1';
      menu.style.transform = 'none';
      menu.style.zIndex = '150';
      $$('[popovertarget="menu"]').forEach((btn) => btn.addEventListener('click', () => { menu.hidden = !menu.hidden; }));
      menu.addEventListener('click', (e) => { if (e.target.closest('a')) menu.hidden = true; });
    }
  }

  /* ---------------------------------------------------------------- 7. mobile dock */
  const dock = $('[data-dock]');
  const heroActions = $('[data-hero-actions]');
  const book = $('#book');
  if (dock && heroActions && book) {
    let heroSeen = true, bookSeen = false;
    const update = () => {
      const up = !heroSeen && !bookSeen;
      dock.classList.toggle('is-up', up);
      dock.inert = !up;
    };
    new IntersectionObserver(([e]) => { heroSeen = e.isIntersecting; update(); }).observe(heroActions);
    new IntersectionObserver(([e]) => { bookSeen = e.isIntersecting; update(); }, { threshold: 0.12 }).observe(book);
    update();
  }

  /* ---------------------------------------------------------------- 8. schedule */
  const week = $('[data-week]');
  const daypick = $('[data-daypick]');
  const status = $('[data-sched-status]');
  const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const DAY_NAMES = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };
  const PROGRAM = {
    wrestling: { long: 'Youth Wrestling', short: 'Wrestling', plural: 'wrestling sessions' },
    volleyball: { long: 'Club Volleyball', short: 'Volleyball', plural: 'volleyball sessions' },
    speed: { long: 'Speed & Agility', short: 'Speed & Agility', plural: 'speed & agility sessions' },
    unsure: { long: 'Not sure yet', short: 'Coach’s pick', plural: 'sessions' },
  };
  if (week && daypick && status) {
    const days = $$('.day', week);
    const dayBtns = $$('button', daypick);
    const filterBtns = $$('[data-filter]');
    const todayKey = DAY_KEYS[new Date().getDay()];
    let currentDay = todayKey === 'sun' ? 'mon' : todayKey;
    let currentFilter = 'all';

    const todayEl = days.find((d) => d.dataset.day === todayKey);
    if (todayEl) {
      todayEl.classList.add('is-today');
      const tag = document.createElement('span');
      tag.className = 'today-tag';
      tag.textContent = 'Today';
      $('.day__name', todayEl).append(tag);
    }
    dayBtns.forEach((b) => {
      if (b.dataset.day === todayKey) {
        b.classList.add('is-today');
        b.setAttribute('aria-label', `${DAY_NAMES[b.dataset.day]} (today)`);
      }
    });
    daypick.hidden = false;
    week.dataset.mode = 'day';

    const visibleCount = (dayEl) => $$('.session', dayEl).filter((s) => !s.classList.contains('is-dim')).length;

    const updateStatus = () => {
      const label = currentFilter === 'all' ? 'sessions' : PROGRAM[currentFilter].plural;
      if (mqDayView.matches) {
        const dayEl = days.find((d) => d.dataset.day === currentDay);
        const n = visibleCount(dayEl);
        let msg = `${n} ${n === 1 ? label.replace(/s$/, '') : label} on ${DAY_NAMES[currentDay]}.`;
        if (n === 0) {
          const alt = days.filter((d) => visibleCount(d) > 0).map((d) => DAY_NAMES[d.dataset.day].slice(0, 3));
          msg = `No ${label} on ${DAY_NAMES[currentDay]} — try ${alt.join(', ')}.`;
        }
        if (todayKey === 'sun' && currentDay === 'mon') msg = `We’re closed Sundays, so here’s Monday. ${msg}`;
        status.textContent = msg;
      } else {
        const n = days.reduce((sum, d) => sum + visibleCount(d), 0);
        status.textContent = `${n} ${label} this week.`;
      }
    };

    const showDay = (key) => {
      currentDay = key;
      days.forEach((d) => d.classList.toggle('is-shown', d.dataset.day === key));
      dayBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.day === key)));
      updateStatus();
    };

    const applyFilter = (f) => {
      currentFilter = f;
      filterBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === f)));
      $$('.session', week).forEach((s) => {
        const dim = f !== 'all' && s.dataset.program !== f;
        s.classList.toggle('is-dim', dim);
        s.inert = dim;
      });
      dayBtns.forEach((b) => {
        const dayEl = days.find((d) => d.dataset.day === b.dataset.day);
        b.style.opacity = visibleCount(dayEl) ? '' : '0.4';
      });
      updateStatus();
    };

    dayBtns.forEach((b) => b.addEventListener('click', () => showDay(b.dataset.day)));
    filterBtns.forEach((b) => b.addEventListener('click', () => applyFilter(b.dataset.filter)));
    mqDayView.addEventListener('change', updateStatus);
    showDay(currentDay);
  }

  /* ---------------------------------------------------------------- 9. trading cards */
  $$('[data-tilt]').forEach((card) => {
    const front = $('.tcard__front', card);
    const back = $('.tcard__back', card);
    let raf = 0, px = 0.5, py = 0.5;
    const resetTilt = () => {
      card.classList.remove('is-tilting');
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    };
    card.addEventListener('pointermove', (e) => {
      if (!finePointer.matches || reduce()) return;
      const r = card.getBoundingClientRect();
      px = (e.clientX - r.left) / r.width;
      py = (e.clientY - r.top) / r.height;
      card.classList.add('is-tilting');
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const flip = card.classList.contains('is-flipped') ? -1 : 1;
        card.style.setProperty('--ry', `${((px - 0.5) * 18 * flip).toFixed(2)}deg`);
        card.style.setProperty('--rx', `${((0.5 - py) * 14).toFixed(2)}deg`);
        card.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`);
        card.style.setProperty('--my', `${(py * 100).toFixed(1)}%`);
      });
    });
    card.addEventListener('pointerleave', resetTilt);
    card.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      const flipped = !card.classList.contains('is-flipped');
      card.classList.toggle('is-flipped', flipped);
      front.inert = flipped;
      back.inert = !flipped;
      $$('.tcard__flip', card).forEach((b) => b.setAttribute('aria-expanded', String(flipped)));
      if (e.target.closest('button')) $('.tcard__flip', flipped ? back : front).focus({ preventScroll: true });
    });
  });

  /* ---------------------------------------------------------------- 10. floor plan */
  const plan = $('[data-plan]');
  const zoneBtns = $$('.zone');
  if (plan && zoneBtns.length) {
    const shapes = $$('.pz', plan);
    let pinned = null;
    const activate = (z) => {
      plan.classList.toggle('has-active', Boolean(z));
      shapes.forEach((s) => s.classList.toggle('is-active', s.dataset.zone === z));
      zoneBtns.forEach((b) => b.classList.toggle('is-active', b.dataset.zone === z));
    };
    const pin = (z) => {
      pinned = pinned === z ? null : z;
      zoneBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.zone === pinned)));
      activate(pinned);
    };
    zoneBtns.forEach((b) => {
      b.addEventListener('pointerenter', () => activate(b.dataset.zone));
      b.addEventListener('pointerleave', () => activate(pinned));
      b.addEventListener('focus', () => activate(b.dataset.zone));
      b.addEventListener('blur', () => activate(pinned));
      b.addEventListener('click', () => pin(b.dataset.zone));
    });
    shapes.forEach((s) => {
      s.addEventListener('pointerenter', () => activate(s.dataset.zone));
      s.addEventListener('pointerleave', () => activate(pinned));
      s.addEventListener('click', () => pin(s.dataset.zone));
    });
  }

  /* ---------------------------------------------------------------- 11. booking form + live pass */
  const form = $('[data-form]');
  const pass = $('[data-pass]');
  const success = $('[data-success]');
  if (form && pass && success) {
    const out = {
      name: $('[data-pass-name]', pass),
      age: $('[data-pass-age]', pass),
      prog: $('[data-pass-prog]', pass),
      when: $('[data-pass-when]', pass),
      coach: $('[data-pass-coach]', pass),
    };
    const COACH = { wrestling: 'Coach Marcus', volleyball: 'Coach Keisha', speed: 'Coach Dre', unsure: 'We’ll match you' };
    const sessionField = $('[data-session-field]', form);
    const sessionText = $('[data-session-text]', form);
    let session = null; // { when, program }

    const bump = (el) => {
      if (reduce()) return;
      el.classList.remove('bump');
      void el.offsetWidth;
      el.classList.add('bump');
    };
    const put = (el, text, withBump) => {
      if (el.textContent === text) return;
      el.textContent = text;
      if (withBump) bump(el);
    };

    const sync = (changed) => {
      const fd = new FormData(form);
      const name = String(fd.get('athlete') || '').trim();
      const age = fd.get('age');
      const prog = fd.get('program');
      put(out.name, name || 'Your athlete', false);
      put(out.age, age ? String(age) : '—', changed === 'age');
      put(out.prog, prog ? PROGRAM[prog].short : 'Pick one', changed === 'program');
      put(out.when, session ? session.when : 'Any day', changed === 'session');
      put(out.coach, prog ? COACH[prog] : 'We’ll match you', changed === 'program');
      pass.dataset.prog = prog || '';
      sessionField.hidden = !session;
      if (session) sessionText.textContent = `${session.when} · ${PROGRAM[session.program].long}`;
    };

    const setProgram = (p) => {
      const radio = $(`input[name="program"][value="${p}"]`, form);
      if (!radio) return;
      radio.checked = true;
      clearError(radio.closest('.field'));
    };

    form.addEventListener('input', (e) => {
      const field = e.target.closest('.field');
      if (field) clearError(field);
      if (e.target.name === 'program' && session && session.program !== e.target.value) session = null;
      sync(e.target.name === 'athlete' ? null : e.target.name);
    });
    $('[data-session-clear]', form).addEventListener('click', () => {
      session = null;
      sync('session');
      $('input[name="program"]:checked', form)?.focus();
    });

    // Program buttons + schedule "Try free" links pre-fill the form.
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href="#book"][data-program]');
      if (!a) return;
      setProgram(a.dataset.program);
      session = a.dataset.session ? { when: a.dataset.session, program: a.dataset.program } : null;
      sync(session ? 'session' : 'program');
    });

    const ERR = {
      athlete: 'Add your athlete’s first name.',
      age: 'Pick an age from 8 to 18.',
      program: 'Pick a program — or choose “Not sure yet”.',
      parent: 'Add your name so the coach knows who to ask for.',
      contact: 'Add a 10-digit mobile number or an email address.',
    };
    function setError(field, msg) {
      field.classList.add('is-invalid');
      const err = $('.field__err', field);
      if (err) err.textContent = msg;
      $$('input', field).forEach((i) => i.setAttribute('aria-invalid', 'true'));
      if (!reduce()) {
        field.classList.remove('is-shake');
        void field.offsetWidth;
        field.classList.add('is-shake');
      }
    }
    function clearError(field) {
      if (!field || !field.classList.contains('is-invalid')) return;
      field.classList.remove('is-invalid', 'is-shake');
      const err = $('.field__err', field);
      if (err) err.textContent = '';
      $$('input', field).forEach((i) => i.removeAttribute('aria-invalid'));
    }

    const validate = () => {
      const fd = new FormData(form);
      const bad = [];
      const check = (name, ok) => { if (!ok) bad.push(name); };
      check('athlete', String(fd.get('athlete') || '').trim().length > 0);
      check('age', Boolean(fd.get('age')));
      check('program', Boolean(fd.get('program')));
      check('parent', String(fd.get('parent') || '').trim().length > 1);
      const contact = String(fd.get('contact') || '').trim();
      check('contact', /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact) || contact.replace(/\D/g, '').length >= 10);
      return bad;
    };

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const bad = validate();
      $$('.field', form).forEach((f) => clearError(f));
      if (bad.length) {
        bad.forEach((name) => setError($(`[name="${name}"]`, form).closest('.field'), ERR[name]));
        $(`[name="${bad[0]}"]`, form).focus();
        return;
      }
      const fd = new FormData(form);
      const name = String(fd.get('athlete')).trim();
      const prog = PROGRAM[fd.get('program')];
      $('[data-success-text]', success).textContent = fd.get('program') === 'unsure'
        ? `A coach will text you within one business day to find the right fit for ${name}.`
        : `A coach will text you within one business day to pick ${name}’s first ${prog.long} session${session ? ` (you asked for ${session.when})` : ''}.`;
      form.hidden = true;
      success.hidden = false;
      success.focus({ preventScroll: true });

      const passRect = pass.getBoundingClientRect();
      const offscreen = passRect.top < 0 || passRect.bottom > innerHeight;
      if (offscreen) pass.scrollIntoView({ block: 'center', behavior: reduce() ? 'auto' : 'smooth' });
      setTimeout(() => {
        pass.classList.add('is-stamped');
        const note = $('[data-passnote]');
        if (note) note.textContent = 'Stamped. Screenshot it if you like.';
        const s = $('[data-stamp]', pass).getBoundingClientRect();
        confetti(s.left + s.width / 2, s.top + s.height / 2);
      }, offscreen ? 650 : 250);
    });

    $('[data-reset]', success).addEventListener('click', () => {
      form.reset();
      session = null;
      pass.classList.remove('is-stamped');
      const note = $('[data-passnote]');
      if (note) note.textContent = 'Your pass fills itself in as you type.';
      sync(null);
      success.hidden = true;
      form.hidden = false;
      $('#f-athlete').focus();
    });

    sync(null);
  }

  function confetti(x, y) {
    if (reduce()) return;
    const canvas = document.createElement('canvas');
    canvas.className = 'confetti';
    canvas.setAttribute('aria-hidden', 'true');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = innerWidth, h = innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    document.body.append(canvas);
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const cs = getComputedStyle(doc);
    const colors = ['--brand', '--accent', '--pop', '--deep'].map((v) => cs.getPropertyValue(v).trim()).concat(['#FFFFFF']);
    const ink = cs.getPropertyValue('--line').trim() || '#14231F';
    const parts = Array.from({ length: 120 }, () => ({
      x, y,
      vx: (Math.random() - 0.5) * 16,
      vy: -Math.random() * 15 - 5,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.35,
      w: 7 + Math.random() * 9,
      h: 5 + Math.random() * 6,
      c: colors[(Math.random() * colors.length) | 0],
      round: Math.random() < 0.35,
    }));
    const start = performance.now();
    const frame = (t) => {
      ctx.clearRect(0, 0, w, h);
      parts.forEach((p) => {
        p.vy += 0.38;
        p.vx *= 0.985;
        p.x += p.vx;
        p.y += p.vy;
        p.r += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.fillStyle = p.c;
        ctx.strokeStyle = ink;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        if (p.round) ctx.arc(0, 0, p.w / 2.4, 0, Math.PI * 2);
        else ctx.roundRect ? ctx.roundRect(-p.w / 2, -p.h / 2, p.w, p.h, 2) : ctx.rect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      });
      if (t - start < 2600) requestAnimationFrame(frame);
      else canvas.remove();
    };
    requestAnimationFrame(frame);
  }

  /* ---------------------------------------------------------------- 12. open-now pill */
  const pill = $('[data-open]');
  const hoursList = $('[data-hours]');
  if (pill && hoursList) {
    const HOURS = { 0: null, 1: [930, 1290], 2: [930, 1290], 3: [930, 1290], 4: [930, 1290], 5: [930, 1290], 6: [510, 900] };
    const fmt = (m) => {
      const h = Math.floor(m / 60), mm = m % 60;
      return `${((h + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
    };
    const now = new Date();
    const day = now.getDay();
    const mins = now.getHours() * 60 + now.getMinutes();
    const today = HOURS[day];
    if (today && mins >= today[0] && mins < today[1]) {
      pill.textContent = `Open now · until ${fmt(today[1])}`;
      pill.classList.add('is-open');
    } else {
      let label = '';
      if (today && mins < today[0]) label = `today ${fmt(today[0])}`;
      else {
        for (let k = 1; k <= 7; k++) {
          const d = (day + k) % 7;
          if (HOURS[d]) {
            label = `${k === 1 ? 'tomorrow' : DAY_NAMES[DAY_KEYS[d]].slice(0, 3)} ${fmt(HOURS[d][0])}`;
            break;
          }
        }
      }
      pill.textContent = `Closed now · opens ${label}`;
    }
    pill.hidden = false;
    $$('[data-days]', hoursList).forEach((row) => {
      if (row.dataset.days.split(',').map(Number).includes(day)) row.classList.add('is-today');
    });
  }

  /* ---------------------------------------------------------------- 13. theme preview */
  const swatches = $$('[data-theme-set]');
  swatches.forEach((btn) => {
    btn.addEventListener('click', () => {
      const name = btn.dataset.themeSet;
      if (doc.dataset.theme === name) return;
      const apply = () => {
        doc.dataset.theme = name;
        swatches.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      };
      if (typeof document.startViewTransition !== 'function' || reduce()) { apply(); return; }
      const r = btn.getBoundingClientRect();
      doc.style.setProperty('--vt-x', `${Math.round(r.left + r.width / 2)}px`);
      doc.style.setProperty('--vt-y', `${Math.round(r.top + r.height / 2)}px`);
      document.startViewTransition(apply);
    });
  });

  /* ---------------------------------------------------------------- 14. footer year */
  const year = $('[data-year]');
  if (year) year.textContent = String(new Date().getFullYear());
})();
