/* WebForge · start.html — the intake. Vanilla, no backend.
   · Free site check: four fields → an email the visitor sends themselves.
   · Demo request: the platform's ten intake questions (same ids, same order),
     one at a time, saved in this browser as you type, composed into an email.
   Nothing leaves the browser until the visitor presses send in their own
   email app. Every storage access is wrapped, so private windows still work.
   Without JavaScript the page still reads, and the <noscript> note gives the
   plain email address. */
(() => {
  'use strict';

  const TO = 'connect@webforgecreate.org';
  const KEY = 'webforge-start-v1';
  const MAILTO_MAX = 1900;     // Chrome on Windows silently drops longer mailto: links
  const MAX_ANSWER = 1600;     // the platform's cap per answer
  const FROM_LINE = 'Sent from the form at webforgecreate.org/start.html';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mqCoarse = window.matchMedia('(pointer: coarse)');
  const run = (fn) => { try { fn(); } catch (err) { setTimeout(() => { throw err; }); } };

  /* ── Storage: this browser only, every access wrapped ──────────────────── */
  const store = {
    read() { try { const raw = window.localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } },
    write(data) { try { window.localStorage.setItem(KEY, JSON.stringify(data)); return true; } catch (e) { return false; } },
    clear() { try { window.localStorage.removeItem(KEY); return true; } catch (e) { return false; } },
  };

  const blank = () => ({ v: 1, contact: { name: '', org: '', email: '' }, site: '', answers: {}, style: '', color: '', step: 0, savedAt: 0 });
  const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
  let state = blank();
  const restored = (() => {
    const raw = store.read();
    if (!raw || typeof raw !== 'object') return false;
    const s = blank();
    const c = raw.contact && typeof raw.contact === 'object' ? raw.contact : {};
    s.contact = { name: str(c.name, 200), org: str(c.org, 200), email: str(c.email, 200) };
    s.site = str(raw.site, 500);
    if (raw.answers && typeof raw.answers === 'object') {
      Object.keys(raw.answers).forEach((k) => { if (/^[a-z-]{3,40}$/.test(k)) s.answers[k] = str(raw.answers[k], MAX_ANSWER); });
    }
    s.style = str(raw.style, 60);
    s.color = /^#[0-9a-f]{6}$/i.test(raw.color || '') ? raw.color : '';
    s.step = Number.isInteger(raw.step) ? raw.step : 0;
    s.savedAt = Number(raw.savedAt) || 0;
    state = s;
    return true;
  })();
  const hasContent = () => !!(state.contact.name || state.contact.org || state.contact.email || state.site || state.style || state.color ||
    Object.keys(state.answers).some((k) => state.answers[k].trim()));

  /* "Saved" indicator */
  const savedEls = $$('[data-saved]');
  const clock = (t) => { try { return new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); } catch (e) { return ''; } };
  const setSaved = (text, off) => savedEls.forEach((el) => { el.textContent = text; el.classList.toggle('is-off', !!off); });
  let saveTimer = 0;
  const save = (now) => {
    clearTimeout(saveTimer);
    const go = () => {
      state.savedAt = Date.now();
      if (store.write(state)) setSaved('Saved in this browser at ' + clock(state.savedAt));
      else setSaved('This browser won’t save — finish in one go, or copy your answers', true);
    };
    if (now) go(); else saveTimer = setTimeout(go, 280);
  };

  /* ── Validation (messages in the page, never a browser bubble) ─────────── */
  const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
  const checks = {
    name: (v) => (v.trim() ? '' : 'Add your name so I know who I’m replying to.'),
    org: (v) => (v.trim() ? '' : 'Add your club, facility or studio.'),
    email: (v) => {
      const t = v.trim();
      if (!t) return 'Add your email — it’s how I reply.';
      return EMAIL_RE.test(t) ? '' : 'That email doesn’t look right — check for a typo.';
    },
    site: (v) => {
      const t = v.trim();
      if (!t) return 'Add your current site’s address, like yourclub.org. No site yet? The demo request below fits better.';
      const host = t.replace(/^[a-z]+:\/\//i, '').split(/[/?#]/)[0];
      return (/\s/.test(t) || !/^[^.\s]+(\.[^.\s]+)*\.[a-z]{2,}(:\d+)?$/i.test(host)) ? 'That doesn’t look like a web address — try something like yourclub.org.' : '';
    },
  };
  const setError = (input, msg) => {
    const field = input.closest('.st-field');
    const err = field ? $('.st-field__err', field) : null;
    if (!err) return;
    const ids = (input.getAttribute('aria-describedby') || '').split(/\s+/).filter((x) => x && x !== err.id);
    if (msg) {
      const t = $('.st-field__err-text', err);
      if (t) t.textContent = msg;
      err.hidden = false;
      field.classList.add('is-invalid');
      input.setAttribute('aria-invalid', 'true');
      ids.push(err.id);
    } else {
      err.hidden = true;
      field.classList.remove('is-invalid');
      input.removeAttribute('aria-invalid');
    }
    if (ids.length) input.setAttribute('aria-describedby', ids.join(' ')); else input.removeAttribute('aria-describedby');
  };
  const validate = (inputs) => {
    let first = null;
    inputs.forEach((inp) => {
      const msg = checks[inp.dataset.check] ? checks[inp.dataset.check](inp.value) : '';
      setError(inp, msg);
      if (msg && !first) first = inp;
    });
    return first;
  };
  const recheck = (inp) => { if (inp.getAttribute('aria-invalid') === 'true') setError(inp, checks[inp.dataset.check](inp.value)); };

  /* ── Email: mailto, plus a box you can always copy from ────────────────── */
  const crlf = (t) => t.replace(/\r?\n/g, '\r\n');
  const mailto = (subject, body) => 'mailto:' + TO + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(crlf(body));

  /* Copy: the synchronous path first (it still has the click's user gesture,
     even when an email app is about to take focus), then the async API. */
  const copyText = (text, box) => new Promise((resolve) => {
    const active = document.activeElement;
    let ok = false;
    try {
      box.value = text;
      box.focus({ preventScroll: true });
      box.select();
      box.setSelectionRange(0, box.value.length);
      ok = document.execCommand('copy');
    } catch (e) { ok = false; }
    if (active && active !== box && active.focus) active.focus({ preventScroll: true });
    if (ok) { resolve(true); return; }
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(() => resolve(true), () => resolve(false));
    else resolve(false);
  });

  const say = (el, text) => {   // live region: clear, then set, so a repeat is still announced
    if (!el) return;
    el.textContent = '';
    setTimeout(() => { el.textContent = text; }, 60);
  };
  const flash = (el) => {
    el.classList.remove('is-flash');
    void el.offsetWidth;
    el.classList.add('is-flash');
  };

  /* Fill a compose panel, open the visitor's email app, and say what happened */
  const openCompose = (panel, subject, body, what) => {
    const subj = $('[data-compose-subject]', panel);
    const box = $('[data-compose-text]', panel);
    const status = $('[data-compose-status]', panel);
    panel.hidden = false;
    if (subj) subj.textContent = subject;
    box.value = body;
    let url = mailto(subject, body);
    if (url.length > MAILTO_MAX) {
      const who = body.split('\n').filter((l) => /^(Name|Organization|Email):/.test(l)).slice(0, 3);
      const short = ['Hi Gavin,', '', 'Here’s my ' + what + '. My answers were too long for an email link, so I’m pasting them below.', '']
        .concat(who, ['', '[ Paste your answers here ]', '', FROM_LINE]).join('\n');
      url = mailto(subject, short);
      copyText(body, box).then((ok) => say(status, ok
        ? 'Your answers are long, so I copied them for you. Your email app should open now — paste them in (Ctrl+V, or ⌘V on a Mac) and press send.'
        : 'Your answers are too long for an email link. Copy them from the box above and paste them into an email to ' + TO + '.'));
    } else {
      say(status, 'Your email app should open with this filled in — nothing is sent until you press send there. Didn’t open? Copy it and email it to ' + TO + '.');
    }
    flash(panel);
    if (panel.getBoundingClientRect().bottom > window.innerHeight) panel.scrollIntoView({ block: 'nearest' });
    try { window.location.href = url; } catch (e) { /* the box and the address are right there */ }
  };

  const wireCopy = (panel, getText) => {
    const btn = $('[data-copy]', panel);
    const box = $('[data-compose-text]', panel);
    const status = $('[data-compose-status]', panel);
    if (!btn || !box) return;
    btn.addEventListener('click', () => {
      const text = getText();
      box.value = text;
      copyText(text, box).then((ok) => {
        if (ok) { say(status, 'Copied. Paste it into an email to ' + TO + ' and press send.'); flash(panel); }
        else { box.focus(); box.select(); say(status, 'Your browser blocked copying — the text is selected, so press Ctrl+C (or ⌘C) to copy it.'); }
      });
    });
  };

  /* ── Contact fields are shared by both forms ───────────────────────────── */
  const contactInputs = $$('[data-contact]');
  let refresh = () => {};
  contactInputs.forEach((inp) => {
    inp.value = state.contact[inp.dataset.contact] || '';
    inp.addEventListener('input', () => {
      const k = inp.dataset.contact;
      state.contact[k] = inp.value.slice(0, 200);
      contactInputs.forEach((o) => { if (o !== inp && o.dataset.contact === k) { o.value = inp.value; recheck(o); } });
      recheck(inp);
      save();
      refresh();
    });
    inp.addEventListener('blur', () => { if (inp.value.trim()) setError(inp, checks[inp.dataset.check](inp.value)); });
  });

  /* ── 01 · Free site check ──────────────────────────────────────────────── */
  run(() => {
    const form = $('[data-check-form]');
    if (!form) return;
    const site = $('[data-site]', form);
    const panel = $('[data-compose]', form);
    if (site) {
      site.value = state.site;
      site.addEventListener('input', () => { state.site = site.value.slice(0, 500); recheck(site); save(); });
      site.addEventListener('blur', () => { if (site.value.trim()) setError(site, checks.site(site.value)); });
    }
    const compose = () => {
      const c = state.contact;
      return {
        subject: 'Free site check — ' + (c.org.trim() || 'my club'),
        body: ['Hi Gavin,', '', 'Could you check my club’s current site?', '',
          'Name: ' + c.name.trim(), 'Organization: ' + c.org.trim(), 'Email: ' + c.email.trim(), 'Current site: ' + state.site.trim(),
          '', FROM_LINE].join('\n'),
      };
    };
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const first = validate($$('[data-check]', form));
      if (first) { first.focus(); return; }
      const m = compose();
      openCompose(panel, m.subject, m.body, 'request for a free site check');
    });
    wireCopy(panel, () => compose().body);
  });

  /* ── 02 · The demo request — one question at a time ────────────────────── */
  run(() => {
    const app = $('[data-intake]');
    if (!app) return;
    const steps = $$('[data-step]', app);
    const last = steps.length - 1;
    const questions = steps.map((el, i) => ({ el, i, qid: el.dataset.qid || '', min: Number(el.dataset.min) || 0, no: el.dataset.no, name: el.dataset.name }))
      .filter((q) => q.qid);
    const rail = $('[data-rail]', app);
    const list = $('[data-steps]', app);
    const nav = $('[data-nav]', app);
    const back = $('[data-back]', app);
    const next = $('[data-next]', app);
    const nextLabel = $('[data-next-label]', app);
    const keys = $('.st-keys', app);
    const countEl = $('[data-count]', app);
    const fill = $('[data-fill]', app);
    const sendStep = steps[last];
    const panel = $('[data-compose]', sendStep);
    const picks = $('[data-picks]', app);
    const header = $('[data-header]');

    /* answers ← state */
    $$('[data-answer]', app).forEach((ta) => {
      ta.value = state.answers[ta.name] || '';
      ta.addEventListener('input', () => { state.answers[ta.name] = ta.value.slice(0, MAX_ANSWER); save(); refresh(); });
    });

    /* Q9: the style a visitor picked, and their club colour, join the answer */
    const answerText = (qid) => {
      const t = (state.answers[qid] || '').trim();
      if (qid !== 'visual-direction') return t;
      const bits = [];
      if (state.style) bits.push('Starting style: ' + state.style + '.');
      if (state.color) bits.push('Club color: ' + state.color.toUpperCase() + '.');
      if (t) bits.push(t);
      return bits.join('\n');
    };
    const isDone = (q) => answerText(q.qid).length >= q.min;

    const compose = () => {
      const c = state.contact;
      const lines = ['Hi Gavin,', '', 'Here’s my demo request — my answers to the ten questions are below.', '',
        'Name: ' + c.name.trim(), 'Organization: ' + c.org.trim(), 'Email: ' + c.email.trim(), ''];
      questions.forEach((q) => { lines.push(q.no + ' · ' + q.name, answerText(q.qid) || '(left blank)', ''); });
      lines.push(FROM_LINE);
      return { subject: 'Demo request — ' + (c.org.trim() || 'my club'), body: lines.join('\n') };
    };

    /* the rail */
    const railBtns = steps.map((el, i) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.className = i === steps.length - 1 ? 'st-step st-step--go' : 'st-step';
      b.dataset.goto = String(i);
      const no = document.createElement('span'); no.className = 'st-step__no'; no.textContent = el.dataset.no;
      const name = document.createElement('span'); name.className = 'st-step__name'; name.textContent = el.dataset.name;
      const st = document.createElement('span'); st.className = 'sr-only';
      b.append(no, document.createTextNode(' '), name, st);   // the space keeps the button's name readable: "03 What you do"
      li.append(b);
      list.append(li);
      return { b, st };
    });

    let cur = -1;
    let lastCount = -1;
    const contactOk = () => $$('[data-check]', steps[0]).every((i) => !checks[i.dataset.check](i.value));

    const buildReview = () => {
      const sum = $('[data-review-sum]', sendStep);
      const todo = $('[data-review-todo]', sendStep);
      const warn = $('[data-review-warn]', sendStep);
      const missing = questions.filter((q) => !isDone(q));
      const done = questions.length - missing.length;
      sum.textContent = '';
      const strong = document.createElement('strong');
      strong.textContent = done + ' of ' + questions.length + ' answered.';
      sum.append(strong, document.createTextNode(missing.length
        ? ' Short or blank answers are fine — I’ll ask about them when I reply. Want to fill one in first?'
        : ' That’s everything. Read it over, then send it.'));
      todo.textContent = '';
      missing.forEach((q) => {
        const li = document.createElement('li');
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'swatch'; b.dataset.goto = String(q.i);
        const n = document.createElement('b'); n.textContent = q.no;
        const t = document.createElement('span'); t.className = 'st-review__todo-name'; t.textContent = ' ' + q.name;
        b.append(n, t);
        li.append(b); todo.append(li);
      });
      todo.hidden = !missing.length;
      warn.hidden = contactOk();
      const m = compose();
      $('[data-compose-subject]', panel).textContent = m.subject;
      $('[data-compose-text]', panel).value = m.body;
    };

    refresh = () => {
      const count = questions.filter(isDone).length;
      if (countEl) {
        countEl.textContent = String(count).padStart(2, '0');
        if (lastCount !== -1 && count !== lastCount && !mqReduce.matches) {
          countEl.classList.remove('is-bump'); void countEl.offsetWidth; countEl.classList.add('is-bump');
        }
      }
      lastCount = count;
      if (fill) fill.style.setProperty('--fill', String(count / questions.length));
      railBtns.forEach(({ b, st }, i) => {
        const q = questions.find((x) => x.i === i);
        const done = i === 0 ? contactOk() : q ? isDone(q) : false;
        b.classList.toggle('is-done', done);
        st.textContent = i === last ? '' : done ? ', answered' : ', not answered yet';
      });
      if (cur === last) buildReview();
    };

    /* a quick cut, never a glide: put the progress + question right under the header */
    const scrollToStage = () => {
      const stage = $('[data-stage]', app);
      const narrow = window.innerWidth < 1000;
      const anchor = (narrow && rail ? rail : stage).getBoundingClientRect().top;
      const h = header ? header.getBoundingClientRect().bottom : 0;
      if (anchor < h || anchor > h + window.innerHeight * 0.25) window.scrollTo(0, Math.max(0, window.scrollY + anchor - h - (narrow ? 12 : 24)));
    };

    const show = (n, opts = {}) => {
      n = Math.max(0, Math.min(last, n));
      const dir = n >= cur ? 'fwd' : 'back';
      const prev = cur;
      cur = n;
      steps.forEach((el, i) => {
        el.hidden = i !== n;
        el.classList.remove('is-enter-fwd', 'is-enter-back');
      });
      const el = steps[n];
      if (opts.animate && prev !== n && !mqReduce.matches) { void el.offsetWidth; el.classList.add('is-enter-' + dir); }
      railBtns.forEach(({ b }, i) => { if (i === n) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
      back.hidden = n === 0;
      next.hidden = n === last;
      if (keys) keys.hidden = n === 0 || n === last;
      nextLabel.textContent = n === 0 ? 'Start the questions' : n === last - 1 ? 'Review and send' : 'Next';
      state.step = n;
      if (n === last) buildReview();
      if (opts.save !== false) save();
      if (opts.focus) {
        scrollToStage();
        const field = $('input.st-field__input, textarea.st-field__input', el);
        const useField = field && !mqCoarse.matches && n !== last && el.dataset.qid !== 'visual-direction';
        const target = useField ? field : $('.st-q__title', el);
        if (!useField) target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
      }
    };

    const goNext = () => {
      if (cur === 0) {
        const first = validate($$('[data-check]', steps[0]));
        if (first) { first.focus(); return; }
      }
      show(cur + 1, { animate: true, focus: true });
    };

    /* switch the page from "everything listed" to the stepper */
    rail.hidden = false;
    nav.hidden = false;
    $$('[data-js-note]', app).forEach((n) => { n.hidden = false; });
    show(Math.max(0, Math.min(last, state.step)), { save: false });
    refresh();
    if (restored && hasContent()) setSaved('Welcome back — your answers are still here');

    next.addEventListener('click', goNext);
    back.addEventListener('click', () => show(cur - 1, { animate: true, focus: true }));
    app.addEventListener('click', (e) => {
      const g = e.target.closest('[data-goto]');
      if (!g || !app.contains(g)) return;
      show(Number(g.dataset.goto), { animate: true, focus: true });
    });

    /* Enter in a one-line field = next; Ctrl/⌘ + Enter in an answer = next */
    app.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || e.isComposing) return;
      if (e.target.matches('textarea.st-field__input') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); goNext(); return; }
      if (e.target.matches('input.st-field__input') && cur !== last) { e.preventDefault(); goNext(); }
    });

    /* the form's own submit = send (only reachable on the last step) */
    app.addEventListener('submit', (e) => {
      e.preventDefault();
      if (cur !== last) { goNext(); return; }
      buildReview();
      if (!contactOk()) {
        const warn = $('[data-review-warn]', sendStep);
        warn.hidden = false;
        const fix = $('[data-goto]', warn);
        if (fix) fix.focus();
        return;
      }
      const m = compose();
      openCompose(panel, m.subject, m.body, 'demo request');
    });
    wireCopy(panel, () => compose().body);

    /* answer chips: tap to add the phrase to the answer */
    $$('[data-chip]', app).forEach((chip) => chip.addEventListener('click', () => {
      const field = chip.closest('.st-field');
      const ta = field ? $('textarea', field) : null;
      if (!ta) return;
      const v = ta.value.replace(/\s+$/, '');
      const add = chip.textContent.trim();
      ta.value = (v ? v + (/[.!?,;:—-]$/.test(v) ? ' ' : ', ') : '') + add;
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      chip.classList.remove('is-pop'); void chip.offsetWidth; chip.classList.add('is-pop');
      setTimeout(() => chip.classList.remove('is-pop'), 700);
      if (!mqCoarse.matches) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
    }));

    /* Q9: style radios + club colour */
    $$('input[name="style"]', app).forEach((r) => {
      r.checked = r.value === state.style;
      r.addEventListener('change', () => { if (r.checked) { state.style = r.value; save(); refresh(); } });
    });
    const colorIn = $('#club-color');
    const colorVal = $('[data-color-value]');
    const colorReset = $('[data-color-reset]');
    const lum = (hex) => {
      const c = [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const applyColor = () => {
      if (!picks) return;
      if (state.color) {
        picks.style.setProperty('--club', state.color);
        picks.classList.toggle('is-dark-club', lum(state.color) < 0.18);
        if (colorVal) colorVal.textContent = state.color.toUpperCase() + ' — the four previews above use it now';
        if (colorReset) colorReset.hidden = false;
      } else {
        picks.style.removeProperty('--club');
        picks.classList.remove('is-dark-club');
        if (colorVal) colorVal.textContent = 'Not set — the previews show each style’s own colors';
        if (colorReset) colorReset.hidden = true;
      }
    };
    if (colorIn) {
      if (state.color) colorIn.value = state.color;
      colorIn.addEventListener('input', () => { state.color = /^#[0-9a-f]{6}$/i.test(colorIn.value) ? colorIn.value : ''; applyColor(); save(); refresh(); });
    }
    if (colorReset) colorReset.addEventListener('click', () => { state.color = ''; applyColor(); save(); refresh(); if (colorIn) colorIn.focus(); });
    applyColor();

    /* Clear: two taps, so nobody loses ten answers to a slip */
    const clearBtn = $('[data-clear]', app);
    let armed = 0;
    const disarm = () => { clearTimeout(armed); armed = 0; clearBtn.classList.remove('is-confirm'); clearBtn.textContent = 'Clear my answers'; };
    clearBtn.addEventListener('click', () => {
      if (!armed) {
        clearBtn.classList.add('is-confirm');
        clearBtn.textContent = 'Sure? Tap again to clear';
        armed = setTimeout(disarm, 4500);
        return;
      }
      disarm();
      clearTimeout(saveTimer);
      store.clear();
      state = blank();
      contactInputs.forEach((i) => { i.value = ''; setError(i, ''); });
      $$('[data-check]').forEach((i) => setError(i, ''));
      const site = $('[data-site]'); if (site) site.value = '';
      $$('[data-answer]', app).forEach((ta) => { ta.value = ''; });
      $$('input[name="style"]', app).forEach((r) => { r.checked = false; });
      $$('[data-compose]').forEach((p) => {
        const s = $('[data-compose-status]', p); if (s) s.textContent = '';
        if (!p.closest('[data-intake]')) p.hidden = true;
      });
      applyColor();
      show(0, { animate: true, focus: true, save: false });
      refresh();
      setSaved('Cleared — nothing is saved in this browser now');
    });
  });
})();
