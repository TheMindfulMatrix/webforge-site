/* =============================================================================
   WebForge · Precision · behaviour
   Vanilla JS, no dependencies. Progressive enhancement only: the page is
   complete and usable with this file switched off.
   ============================================================================= */
(() => {
  'use strict';

  const root = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
  const mqFine = matchMedia('(hover: hover) and (pointer: fine)');
  const reduced = () => mqReduce.matches;
  const canVT = () => typeof document.startViewTransition === 'function' && !reduced();
  const SDT = !!(window.CSS && CSS.supports && CSS.supports('animation-timeline: view()'));
  if (!SDT) root.classList.add('sdt-none');

  /* ---------------------------------------------------------------------------
     Facility data. The schedule markup is the single source of truth for
     sessions; this only holds what the markup does not.
     --------------------------------------------------------------------------- */
  const PROGRAMS = { wrestling: 'Youth Wrestling', volleyball: 'Club Volleyball', speed: 'Speed & Agility' };
  const PROGRAM_AGES = { wrestling: [8, 14], volleyball: [11, 18], speed: [8, 18] };
  const DAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const HOURS = { 0: null, 1: [930, 1260], 2: [930, 1260], 3: [930, 1260], 4: [930, 1260], 5: [930, 1200], 6: [510, 840] };
  const ZONES = {
    wrestling: { name: 'Wrestling room', x: 0, y: 0, w: 60, h: 100 },
    volleyball: { name: 'Volleyball gym', x: 60, y: 0, w: 80, h: 72 },
    strength: { name: 'Strength room', x: 140, y: 0, w: 40, h: 40 },
    lounge: { name: 'Parent lounge', x: 140, y: 40, w: 40, h: 32 },
    turf: { name: 'Turf lane', x: 60, y: 72, w: 120, h: 28 }
  };

  /* ---------------------------------------------------------------------------
     Time, always in the facility's own time zone (America/Chicago)
     --------------------------------------------------------------------------- */
  const ctFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago', weekday: 'short', year: 'numeric', month: 'numeric',
    day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23'
  });
  const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

  function nowCT() {
    const p = {};
    ctFmt.formatToParts(new Date()).forEach((x) => { p[x.type] = x.value; });
    const h = (+p.hour) % 24;
    return {
      dow: DAY_SHORT.indexOf(p.weekday), y: +p.year, mo: +p.month, d: +p.day,
      h, m: +p.minute, s: +p.second, min: h * 60 + (+p.minute)
    };
  }
  const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  function fmtTime(min, withPeriod = true) {
    const h = Math.floor(min / 60) % 24, m = min % 60;
    const h12 = ((h + 11) % 12) + 1;
    return `${h12}:${String(m).padStart(2, '0')}${withPeriod ? (h < 12 ? ' AM' : ' PM') : ''}`;
  }
  function fmtDur(mins) {
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60), m = mins % 60;
    return m ? `${h} h ${m} min` : `${h} h`;
  }
  function dateFor(t, day) {
    const offset = t.dow === 0 ? day : day - t.dow;
    return new Date(Date.UTC(t.y, t.mo - 1, t.d) + offset * 864e5);
  }

  /* ---------------------------------------------------------------------------
     Sessions, read from the schedule markup
     --------------------------------------------------------------------------- */
  const sessions = $$('.session').map((el) => ({
    el,
    day: +el.closest('.day').dataset.day,
    program: el.dataset.program,
    name: PROGRAMS[el.dataset.program],
    start: toMin(el.dataset.start),
    end: toMin(el.dataset.end),
    ages: el.dataset.ages,
    label: el.querySelector('.session__ages').textContent
  }));
  const sessionsOn = (day) => sessions.filter((s) => s.day === day);

  function stateOf(s, t) {
    if (s.day !== t.dow) return 'later';
    if (t.min >= s.end) return 'done';
    if (t.min >= s.start) return 'live';
    return 'later';
  }

  function openState(t) {
    const h = HOURS[t.dow];
    if (h && t.min >= h[0] && t.min < h[1]) return { open: true, text: `Open · until ${fmtTime(h[1])}` };
    for (let i = 0; i < 8; i++) {
      const d = (t.dow + i) % 7;
      const hh = HOURS[d];
      if (!hh || (i === 0 && t.min >= hh[0])) continue;
      const when = i === 0 ? '' : i === 1 ? 'tomorrow ' : `${DAY_SHORT[d]} `;
      return { open: false, text: `Closed · opens ${when}${fmtTime(hh[0])}` };
    }
    return { open: false, text: 'Closed' };
  }

  /* ---------------------------------------------------------------------------
     NAV · stuck state, mobile menu (no focus trap), scroll-spy, open status
     --------------------------------------------------------------------------- */
  const nav = $('[data-nav]');
  const toggle = $('[data-menu-toggle]');
  const menu = $('[data-menu]');

  // The bar takes on the surface of whatever section is under it (paper or ink).
  let stuckRaf = 0;
  const updateStuck = () => {
    stuckRaf = 0;
    nav.classList.toggle('is-stuck', window.scrollY > 8);
    const under = document.elementsFromPoint(innerWidth / 2, nav.offsetHeight / 2).find((el) => !nav.contains(el));
    const surf = (under && under.closest('[data-surface]')) ? under.closest('[data-surface]').dataset.surface : 'paper';
    if (nav.dataset.surface !== surf) nav.dataset.surface = surf;
  };
  window.addEventListener('scroll', () => { if (!stuckRaf) stuckRaf = requestAnimationFrame(updateStuck); }, { passive: true });
  updateStuck();

  function setMenu(open, returnFocus) {
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    if (!open && returnFocus) toggle.focus();
  }
  toggle.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')));
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) setMenu(false, true);
  });
  nav.addEventListener('focusout', (e) => {
    if (nav.classList.contains('is-open') && e.relatedTarget && !nav.contains(e.relatedTarget)) setMenu(false);
  });
  matchMedia('(min-width: 1024px)').addEventListener('change', (e) => { if (e.matches) setMenu(false); });

  const spyLinks = $$('.nav__links a');
  const spyMap = { programs: 'programs', schedule: 'schedule', method: 'method', coaches: 'coaches', facility: 'facility', trial: 'visit' };
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const id = spyMap[en.target.id];
      spyLinks.forEach((a) => a.toggleAttribute('aria-current', a.getAttribute('href') === `#${id}`));
      spyLinks.forEach((a) => { if (a.hasAttribute('aria-current')) a.setAttribute('aria-current', 'true'); });
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  Object.keys(spyMap).forEach((id) => { const el = document.getElementById(id); if (el) spy.observe(el); });
  new IntersectionObserver(([en]) => {
    if (en.isIntersecting) spyLinks.forEach((a) => a.removeAttribute('aria-current'));
  }, { rootMargin: '-45% 0px -50% 0px' }).observe($('.hero'));

  const statusEl = $('[data-status]');
  const statusText = $('[data-status-text]');

  /* ---------------------------------------------------------------------------
     HERO · gridline stagger
     --------------------------------------------------------------------------- */
  $$('.gridlines i').forEach((i, n) => i.style.setProperty('--n', n));

  /* ---------------------------------------------------------------------------
     DIAL · "Today at Copperline", a 12-hour face of today's sessions
     --------------------------------------------------------------------------- */
  const SVGNS = 'http://www.w3.org/2000/svg';
  const dial = $('[data-dial]');
  const C = 300;
  const polar = (r, deg) => {
    const a = (deg * Math.PI) / 180;
    return [C + r * Math.sin(a), C - r * Math.cos(a)];
  };
  const mk = (tag, attrs) => {
    const n = document.createElementNS(SVGNS, tag);
    Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
    return n;
  };

  const ticks = $('[data-dial-ticks]');
  for (let i = 0; i < 60; i++) {
    const hour = i % 5 === 0;
    const [x1, y1] = polar(hour ? 264 : 276, i * 6);
    const [x2, y2] = polar(286, i * 6);
    const l = mk('line', { x1: x1.toFixed(2), y1: y1.toFixed(2), x2: x2.toFixed(2), y2: y2.toFixed(2) });
    if (hour) l.setAttribute('class', 'is-hour');
    ticks.appendChild(l);
  }
  const nums = $('[data-dial-nums]');
  [[12, 0], [3, 90], [6, 180], [9, 270]].forEach(([n, deg]) => {
    const [x, y] = polar(204, deg);
    const t = mk('text', { x: x.toFixed(1), y: y.toFixed(1) });
    t.textContent = n;
    nums.appendChild(t);
  });

  const minToDeg = (min) => ((min / 60) % 12) * 30;
  function arcPath(r, a0, a1) {
    const [x0, y0] = polar(r, a0);
    const [x1, y1] = polar(r, a1);
    const large = a1 - a0 > 180 ? 1 : 0;
    return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  }

  const arcsG = $('[data-dial-arcs]');
  const legend = $('[data-dial-legend]');
  const center = $('[data-dial-center]');
  const dayLabel = $('[data-dial-day]');
  const clockEl = $('[data-dial-clock]');
  const needle = $('[data-dial-now]');
  const secDot = $('[data-dial-sec]');
  let dialDay = -1;
  let dialItems = [];
  let defaultCenter = null;
  let needleDeg = 0;

  const STATE_LABEL = { done: 'Done', live: 'Live now', next: 'Up next', later: 'Later' };

  function setCenter(kicker, big, small, swap = true) {
    center.innerHTML = '';
    const k = document.createElement('span'); k.className = 'dial__kicker mono'; k.textContent = kicker;
    const b = document.createElement('span'); b.className = 'dial__big'; b.textContent = big;
    const s = document.createElement('span'); s.className = 'dial__small'; s.innerHTML = small;
    center.append(k, b, s);
    if (swap && !reduced()) {
      center.classList.remove('is-swap');
      void center.offsetWidth;
      center.classList.add('is-swap');
    }
  }

  function chooseDialDay(t) {
    const today = sessionsOn(t.dow);
    if (today.length && t.min < today[today.length - 1].end) return { day: t.dow, isToday: true };
    for (let i = 1; i <= 7; i++) {
      const d = (t.dow + i) % 7;
      if (sessionsOn(d).length) return { day: d, isToday: false, inDays: i };
    }
    return { day: 1, isToday: false, inDays: 1 };
  }

  function hot(idx) {
    arcsG.classList.toggle('has-hot', idx != null);
    dialItems.forEach((it, i) => {
      it.arc.classList.toggle('is-hot', i === idx);
      it.row.classList.toggle('is-hot', i === idx);
    });
    if (idx == null) { if (defaultCenter) setCenter(...defaultCenter); return; }
    const it = dialItems[idx];
    const s = it.s;
    const kick = it.state === 'later' && !it.isToday ? DAY_LONG[s.day] : STATE_LABEL[it.state];
    setCenter(kick, s.name, `${s.label}<br>${fmtTime(s.start, false)}–${fmtTime(s.end)}`);
  }

  function renderDial(t) {
    const pick = chooseDialDay(t);
    const list = sessionsOn(pick.day);
    let nextFound = false;
    const items = list.map((s) => {
      let state = pick.isToday ? stateOf(s, t) : 'later';
      if (state === 'later' && !nextFound) { state = 'next'; nextFound = true; }
      return { s, state, isToday: pick.isToday };
    });

    arcsG.classList.toggle('has-live', items.some((i) => i.state === 'live'));
    const sig = pick.day + items.map((i) => i.state).join();
    if (sig !== dialDay) {
      dialDay = sig;
      arcsG.innerHTML = '';
      legend.innerHTML = '';
      items.forEach((it, i) => {
        const a0 = minToDeg(it.s.start) + 1.2;
        let a1 = minToDeg(it.s.end) - 1.2;
        if (a1 <= a0) a1 += 360;
        const arc = mk('path', { d: arcPath(236, a0, a1), class: `dial__arc is-${it.state}` });
        arc.addEventListener('pointerenter', () => hot(i));
        arc.addEventListener('pointerleave', () => hot(null));
        arcsG.appendChild(arc);

        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = '#schedule';
        a.dataset.pickDay = it.s.day;
        a.innerHTML = `<span class="lg-time">${fmtTime(it.s.start)}</span><span class="lg-name">${it.s.name}<small>${it.s.ages}</small></span><span class="lg-state is-${it.state}">${it.isToday ? STATE_LABEL[it.state] : DAY_SHORT[it.s.day]}</span>`;
        a.addEventListener('pointerenter', () => hot(i));
        a.addEventListener('pointerleave', () => hot(null));
        a.addEventListener('focus', () => hot(i));
        a.addEventListener('blur', () => hot(null));
        li.appendChild(a);
        legend.appendChild(li);
        it.arc = arc;
        it.row = a;
      });
      dialItems = items;
    }

    // Default centre read-out
    const live = items.find((i) => i.state === 'live');
    const next = items.find((i) => i.state === 'next');
    if (pick.isToday && live) {
      defaultCenter = ['Live now', live.s.name, `${live.s.label}<br>until <b>${fmtTime(live.s.end)}</b>`];
    } else if (pick.isToday && next) {
      defaultCenter = [`Up next · in ${fmtDur(next.s.start - t.min)}`, next.s.name, `${next.s.label}<br>starts <b>${fmtTime(next.s.start)}</b>`];
    } else if (next) {
      const when = pick.inDays === 1 ? 'Tomorrow' : DAY_LONG[pick.day];
      defaultCenter = [`Next on the floor · ${when}`, next.s.name, `${next.s.label}<br>starts <b>${fmtTime(next.s.start)}</b>`];
    }
    if (!arcsG.classList.contains('has-hot') && defaultCenter) {
      const key = defaultCenter.join('|');
      if (center.dataset.key !== key) { setCenter(...defaultCenter, center.dataset.key !== undefined); center.dataset.key = key; }
    }

    const d = dateFor(t, pick.day);
    dayLabel.textContent = pick.isToday
      ? `Today · ${DAY_SHORT[t.dow]} ${dateFmt.format(d)}`
      : `${pick.inDays === 1 ? 'Tomorrow' : DAY_LONG[pick.day]} · ${dateFmt.format(d)}`;
    dial.classList.toggle('no-dial', !pick.isToday);
  }

  legend.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-pick-day]');
    if (a) pickDay(+a.dataset.pickDay, false);
  });

  function tickClock(t) {
    clockEl.textContent = `${fmtTime(t.min, false)}:${String(t.s).padStart(2, '0')} ${t.h < 12 ? 'AM' : 'PM'}`;
    let deg = ((t.h % 12) + t.m / 60 + t.s / 3600) * 30;
    while (deg < needleDeg - 180) deg += 360;
    needleDeg = deg;
    needle.style.setProperty('--now-deg', `${deg.toFixed(2)}deg`);
  }

  /* ---------------------------------------------------------------------------
     SCHEDULE · dates, today, live states, now line, filter, day picker
     --------------------------------------------------------------------------- */
  const week = $('[data-week]');
  const filterGroup = $('[data-filter-group]');
  const picker = $('[data-day-picker]');
  let pickedDay = 1;

  function setFilter(f) {
    week.dataset.filter = f;
    const btns = $$('button', filterGroup);
    btns.forEach((b, i) => {
      const on = b.dataset.filter === f;
      b.setAttribute('aria-pressed', String(on));
      if (on) filterGroup.style.setProperty('--seg', i);
    });
  }
  filterGroup.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-filter]');
    if (b) setFilter(b.dataset.filter);
  });
  $$('[data-filter-link]').forEach((a) => a.addEventListener('click', () => setFilter(a.dataset.filterLink)));

  function pickDay(day, animate = true) {
    if (day === pickedDay && $('.day.is-picked')) return;
    const apply = () => {
      $$('.day').forEach((d) => d.classList.toggle('is-picked', +d.dataset.day === day));
      $$('button', picker).forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.pick === day)));
    };
    const back = day < pickedDay;
    pickedDay = day;
    const mobile = matchMedia('(max-width: 699px)').matches;
    if (animate && mobile && canVT()) {
      root.classList.toggle('vt-back', back);
      document.startViewTransition(apply).finished.finally(() => root.classList.remove('vt-back'));
    } else apply();
  }
  picker.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-pick]');
    if (b) pickDay(+b.dataset.pick);
  });

  function setupDates(t) {
    for (let day = 1; day <= 6; day++) {
      const d = dateFor(t, day);
      const long = $(`[data-date-long="${day}"]`);
      const short = $(`[data-date-short="${day}"]`);
      if (long) long.textContent = dateFmt.format(d);
      if (short) short.textContent = d.getUTCDate();
    }
    $$('.day').forEach((d) => d.classList.toggle('is-today', +d.dataset.day === t.dow));
    $$('button', picker).forEach((b) => b.classList.toggle('is-today', +b.dataset.pick === t.dow));
  }

  function renderSchedule(t) {
    let nextMarked = false;
    sessions.forEach((s) => {
      let st = stateOf(s, t);
      if (s.day === t.dow && st === 'later' && !nextMarked) { st = 'next'; nextMarked = true; }
      s.el.classList.toggle('is-live', st === 'live');
      s.el.classList.toggle('is-next', st === 'next');
      s.el.classList.toggle('is-done', st === 'done');
      let tag = s.el.querySelector('.session__state');
      const want = st === 'live' ? 'Live' : st === 'next' ? 'Next' : st === 'done' ? 'Done' : '';
      if (want && !tag) { tag = document.createElement('span'); tag.className = 'session__state'; s.el.appendChild(tag); }
      if (tag) { if (want) tag.textContent = want; else tag.remove(); }
    });

    // Now line inside today's column, positioned against real block geometry
    $$('.now-line').forEach((n) => n.remove());
    const todays = sessionsOn(t.dow);
    if (!todays.length) return;
    const first = todays[0], last = todays[todays.length - 1];
    if (t.min < first.start || t.min >= last.end) return;
    const cur = todays.find((s) => t.min >= s.start && t.min < s.end);
    if (!cur) return;
    const li = cur.el.parentElement;
    const list = li.parentElement;
    const y = li.offsetTop + ((t.min - cur.start) / (cur.end - cur.start)) * li.offsetHeight;
    const line = document.createElement('div');
    line.className = 'now-line';
    line.setAttribute('aria-hidden', 'true');
    line.style.setProperty('--y', `${y.toFixed(1)}px`);
    list.appendChild(line);
  }

  /* ---------------------------------------------------------------------------
     Book-from-anywhere: tapping a session pre-fills the trial form
     --------------------------------------------------------------------------- */
  const form = $('[data-trial]');
  const prefill = $('[data-prefill]');
  sessions.forEach((s) => s.el.addEventListener('click', () => {
    const prog = form.querySelector(`input[name="program"][value="${s.program}"]`);
    const day = form.querySelector(`input[name="day"][value="${DAY_LONG[s.day]}"]`);
    if (prog && !prog.disabled) prog.checked = true;
    if (day) day.checked = true;
    if (prefill) {
      prefill.hidden = false;
      prefill.textContent = `Booking into ${DAY_LONG[s.day]} · ${fmtTime(s.start)} · ${s.name} (${s.label})`;
    }
  }));

  /* ---------------------------------------------------------------------------
     STATS · odometer numerals
     --------------------------------------------------------------------------- */
  const odos = $$('[data-odo]');
  odos.forEach((el) => {
    const target = el.dataset.odo;
    el.textContent = '';
    const sr = document.createElement('span');
    sr.className = 'sr-only';
    sr.textContent = target;
    el.appendChild(sr);
    [...target].forEach((ch, k) => {
      const col = document.createElement('span');
      col.className = 'odo__col';
      col.setAttribute('aria-hidden', 'true');
      const strip = document.createElement('span');
      strip.className = 'odo__strip';
      strip.style.setProperty('--d', ch);
      strip.style.setProperty('--k', k);
      for (let i = 0; i <= 9; i++) { const n = document.createElement('span'); n.textContent = i; strip.appendChild(n); }
      col.appendChild(strip);
      el.appendChild(col);
    });
    if (!reduced()) el.classList.add('is-armed');
  });
  const odoIO = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      requestAnimationFrame(() => en.target.classList.remove('is-armed'));
      odoIO.unobserve(en.target);
    });
  }, { threshold: 0.6 });
  odos.forEach((el) => odoIO.observe(el));

  /* ---------------------------------------------------------------------------
     SVG line art keeps a constant on-screen stroke while still drawing itself
     with pathLength dashes: --u = user units per CSS pixel.
     --------------------------------------------------------------------------- */
  const unitSvgs = $$('.plate, [data-plan-svg], .chart svg');
  const setUnits = (svg) => {
    const w = svg.getBoundingClientRect().width;
    if (w) svg.style.setProperty('--u', (svg.viewBox.baseVal.width / w).toFixed(4));
  };
  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver((entries) => entries.forEach((en) => setUnits(en.target)));
    unitSvgs.forEach((svg) => ro.observe(svg));
  } else unitSvgs.forEach(setUnits);

  /* ---------------------------------------------------------------------------
     PROGRAMS · accent trace layer for each field drawing
     --------------------------------------------------------------------------- */
  $$('.plate').forEach((svg) => {
    const base = $('.plate__base', svg);
    const trace = base.cloneNode(true);
    trace.setAttribute('class', 'plate__trace');
    svg.appendChild(trace);
  });

  /* ---------------------------------------------------------------------------
     Reveal fallback where scroll-driven animations are unsupported,
     plus one-shot reveals used everywhere (report chart)
     --------------------------------------------------------------------------- */
  const oneShot = (els, threshold = 0.2) => {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        en.target.classList.add('is-in');
        io.unobserve(en.target);
      });
    }, { threshold, rootMargin: '0px 0px -8% 0px' });
    els.forEach((el) => io.observe(el));
  };
  if (!SDT) oneShot($$('[data-reveal], .program, .plan'), 0.15);
  oneShot($$('[data-report]'), 0.35);

  /* ---------------------------------------------------------------------------
     POINTER · magnetic buttons, cursor light, report tilt  (fine pointers only)
     --------------------------------------------------------------------------- */
  if (mqFine.matches) {
    $$('[data-magnetic]').forEach((btn) => {
      btn.addEventListener('pointermove', (e) => {
        const r = btn.getBoundingClientRect();
        const x = e.clientX - r.left, y = e.clientY - r.top;
        btn.style.setProperty('--mx', `${x}px`);
        btn.style.setProperty('--my', `${y}px`);
        if (reduced()) return;
        const dx = (x - r.width / 2) / (r.width / 2);
        const dy = (y - r.height / 2) / (r.height / 2);
        btn.classList.add('is-magnet');
        btn.style.setProperty('--tx', `${(dx * 5).toFixed(2)}px`);
        btn.style.setProperty('--ty', `${(dy * 4).toFixed(2)}px`);
        btn.style.setProperty('--lx', `${(dx * 2.5).toFixed(2)}px`);
        btn.style.setProperty('--ly', `${(dy * 2).toFixed(2)}px`);
      });
      btn.addEventListener('pointerleave', () => {
        btn.classList.remove('is-magnet');
        ['--tx', '--ty', '--lx', '--ly'].forEach((p) => btn.style.removeProperty(p));
      });
    });

    let glowRaf = 0, glowEvt = null;
    document.addEventListener('pointermove', (e) => {
      glowEvt = e;
      if (glowRaf) return;
      glowRaf = requestAnimationFrame(() => {
        glowRaf = 0;
        const el = glowEvt.target.closest && glowEvt.target.closest('[data-glow], [data-spot], .session');
        if (!el) return;
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', `${glowEvt.clientX - r.left}px`);
        el.style.setProperty('--my', `${glowEvt.clientY - r.top}px`);
      });
    }, { passive: true });

    const report = $('[data-report]');
    const tilt = $('[data-tilt]');
    if (report && tilt) {
      report.addEventListener('pointermove', (e) => {
        if (reduced()) return;
        const r = report.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        tilt.classList.add('is-tilting');
        tilt.style.setProperty('--ry', `${(px * 6).toFixed(2)}deg`);
        tilt.style.setProperty('--rx', `${(-py * 5).toFixed(2)}deg`);
      });
      report.addEventListener('pointerleave', () => {
        tilt.classList.remove('is-tilting');
        tilt.style.removeProperty('--rx');
        tilt.style.removeProperty('--ry');
      });
    }
  }

  /* ---------------------------------------------------------------------------
     FACILITY · blueprint crosshair + zone selection
     --------------------------------------------------------------------------- */
  const plan = $('[data-plan]');
  const planSvg = $('[data-plan-svg]');
  const cross = $('[data-cross]');
  const readout = $('[data-readout]');
  const coord = $('[data-plan-coord]');
  const zoneRects = $$('.zone', planSvg);
  const zoneItems = $$('.zone-item');
  let pinnedZone = null;

  function showZone(id) {
    zoneRects.forEach((z) => z.classList.toggle('is-active', z.dataset.zone === id));
    zoneItems.forEach((z) => z.classList.toggle('is-active', z.dataset.zone === id));
  }
  function zoneAt(x, y) {
    return Object.keys(ZONES).find((k) => {
      const z = ZONES[k];
      return x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h;
    }) || null;
  }
  const pad = (n) => (n < 0 ? '-' : '') + Math.abs(n).toFixed(1).padStart(5, '0');

  function track(e) {
    const pr = plan.getBoundingClientRect();
    const cx = e.clientX - pr.left, cy = e.clientY - pr.top;
    const ctm = planSvg.getScreenCTM();
    if (!ctm) return;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    const zone = zoneAt(pt.x, pt.y);
    plan.classList.add('is-tracking');
    cross.style.setProperty('--cx', `${cx}px`);
    cross.style.setProperty('--cy', `${cy}px`);
    cross.style.setProperty('--ox', cx > pr.width - 230 ? 'calc(-100% - 14px)' : '14px');
    const inside = pt.x >= 0 && pt.x <= 180 && pt.y >= 0 && pt.y <= 100;
    const xy = `X ${pad(pt.x)} · Y ${pad(pt.y)}`;
    readout.textContent = inside ? `${xy} FT · ${zone ? ZONES[zone].name : 'Corridor'}` : `${xy} FT · Outside`;
    coord.textContent = xy;
    showZone(zone || pinnedZone);
  }
  plan.addEventListener('pointermove', track);
  plan.addEventListener('pointerdown', track);
  plan.addEventListener('pointerleave', () => {
    plan.classList.remove('is-tracking');
    showZone(pinnedZone);
  });

  zoneItems.forEach((btn) => {
    const id = btn.dataset.zone;
    btn.addEventListener('pointerenter', () => showZone(id));
    btn.addEventListener('pointerleave', () => showZone(pinnedZone));
    btn.addEventListener('focus', () => showZone(id));
    btn.addEventListener('blur', () => showZone(pinnedZone));
    btn.addEventListener('click', () => {
      pinnedZone = pinnedZone === id ? null : id;
      zoneItems.forEach((z) => z.setAttribute('aria-pressed', String(z.dataset.zone === pinnedZone)));
      showZone(pinnedZone || id);
    });
  });

  /* ---------------------------------------------------------------------------
     TRIAL FORM · age-aware program choice, demo submit with a View Transition
     --------------------------------------------------------------------------- */
  const wrap = $('[data-trial-wrap]');
  const done = $('[data-trial-done]');
  const doneBody = $('[data-done-body]');
  const errorEl = $('[data-trial-error]');
  const ageSel = $('#age');
  const ageHint = $('[data-age-hint]');
  const progInputs = $$('input[name="program"]', form);

  ageSel.addEventListener('change', () => {
    const age = +ageSel.value;
    if (!age) { progInputs.forEach((i) => { i.disabled = false; }); ageHint.textContent = ''; return; }
    const ok = [];
    progInputs.forEach((i) => {
      const [lo, hi] = PROGRAM_AGES[i.value];
      const fits = age >= lo && age <= hi;
      i.disabled = !fits;
      if (!fits && i.checked) { i.checked = false; if (prefill) prefill.hidden = true; }
      if (fits) ok.push(PROGRAMS[i.value]);
    });
    ageHint.textContent = `At ${age}: ${ok.join(', ')}.`;
  });

  const swap = (fn) => (canVT() ? document.startViewTransition(fn) : fn());

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    form.classList.add('was-validated');
    const data = new FormData(form);
    const missing = [];
    if (!data.get('program')) missing.push('a program');
    if (!data.get('age')) missing.push("your athlete's age");
    if (!String(data.get('name') || '').trim()) missing.push('your name');
    const contact = String(data.get('contact') || '').trim();
    const contactOk = /^\S+@\S+\.\S+$/.test(contact) || contact.replace(/\D/g, '').length >= 10;
    if (!contactOk) missing.push('an email or a 10-digit mobile number');
    if (missing.length) {
      errorEl.textContent = `Almost there. Add ${missing.join(', ')}.`;
      const firstBad = !data.get('program') ? progInputs.find((i) => !i.disabled)
        : !data.get('age') ? ageSel
        : !String(data.get('name') || '').trim() ? $('#name') : $('#contact');
      if (firstBad) firstBad.focus();
      return;
    }
    errorEl.textContent = '';
    const first = String(data.get('name')).trim().split(/\s+/)[0];
    const day = data.get('day');
    doneBody.textContent = `Thanks, ${first}. A coach will reach out at ${contact} within one business day to set up a ${data.get('age')}-year-old's free ${PROGRAMS[data.get('program')]} session${day ? ` on ${day}` : ''}. This is a demo, so nothing was actually sent.`;
    swap(() => { form.hidden = true; done.hidden = false; });
    setTimeout(() => done.focus({ preventScroll: true }), 30);
  });

  $('[data-trial-reset]').addEventListener('click', () => {
    swap(() => {
      form.reset();
      form.classList.remove('was-validated');
      progInputs.forEach((i) => { i.disabled = false; });
      ageHint.textContent = '';
      if (prefill) prefill.hidden = true;
      done.hidden = true;
      form.hidden = false;
    });
    setTimeout(() => progInputs[0].focus({ preventScroll: true }), 30);
  });
  void wrap;

  /* ---------------------------------------------------------------------------
     HOURS · today's row
     --------------------------------------------------------------------------- */
  function renderHours(t, st) {
    $$('[data-hours] tr').forEach((tr) => {
      const isToday = tr.dataset.days.split(' ').map(Number).includes(t.dow);
      tr.classList.toggle('is-today', isToday);
      tr.classList.toggle('is-open', isToday && st.open);
      if (isToday) tr.querySelector('th').dataset.state = st.open ? 'Open now' : 'Today';
    });
  }

  /* ---------------------------------------------------------------------------
     DESIGN-SYSTEM CONTROLS · club colour (circular View Transition) + grid
     --------------------------------------------------------------------------- */
  $$('.swatch').forEach((sw) => sw.addEventListener('click', (e) => {
    const apply = () => {
      root.style.setProperty('--brand-hue', sw.dataset.hue);
      root.style.setProperty('--brand-chroma', sw.dataset.chroma);
      $$('.swatch').forEach((s) => s.setAttribute('aria-pressed', String(s === sw)));
    };
    if (!canVT()) { apply(); return; }
    const r = sw.getBoundingClientRect();
    const x = e.clientX || r.left + r.width / 2;
    const y = e.clientY || r.top + r.height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    root.classList.add('vt-theme');
    const vt = document.startViewTransition(apply);
    vt.ready.then(() => {
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 750, easing: 'cubic-bezier(0.65, 0, 0.35, 1)', pseudoElement: '::view-transition-new(root)' }
      );
    }).catch(() => {});
    vt.finished.finally(() => root.classList.remove('vt-theme'));
  }));

  const gridBtn = $('[data-grid-toggle]');
  const setGrid = (on) => {
    root.classList.toggle('show-grid', on);
    gridBtn.setAttribute('aria-pressed', String(on));
  };
  gridBtn.addEventListener('click', () => setGrid(!root.classList.contains('show-grid')));
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'g' && e.key !== 'G') return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest('input, select, textarea, [contenteditable]')) return;
    setGrid(!root.classList.contains('show-grid'));
  });

  /* ---------------------------------------------------------------------------
     CLOCK · one heartbeat for every live element
     --------------------------------------------------------------------------- */
  const yearEl = $('[data-year]');
  let lastMinute = -1;

  function beat() {
    const t = nowCT();
    tickClock(t);
    if (t.min !== lastMinute) {
      lastMinute = t.min;
      const st = openState(t);
      statusEl.classList.toggle('is-open', st.open);
      statusText.textContent = st.text;
      renderDial(t);
      renderSchedule(t);
      renderHours(t, st);
    }
  }

  const t0 = nowCT();
  if (yearEl) yearEl.textContent = t0.y;
  setupDates(t0);
  pickDay(t0.dow >= 1 && t0.dow <= 6 ? t0.dow : 1, false);
  secDot.style.setProperty('--sec-delay', `-${t0.s + new Date().getMilliseconds() / 1000}s`);
  beat();
  // Let the needle sweep in from 12 on first paint, then follow real time.
  if (!reduced()) {
    const target = needle.style.getPropertyValue('--now-deg');
    needle.style.setProperty('--now-deg', '0deg');
    requestAnimationFrame(() => requestAnimationFrame(() => needle.style.setProperty('--now-deg', target)));
  }
  setInterval(beat, 1000);
  window.addEventListener('resize', () => renderSchedule(nowCT()), { passive: true });
})();
