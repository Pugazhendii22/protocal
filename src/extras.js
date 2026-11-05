/* ============================================================
   extras.js — exam mode, protocol timeline, command palette (Ctrl+K)
   ============================================================ */
(function (root) {
  'use strict';
  const U = root.PE_UI;
  const { S, esc, LESSONS, TRACKS, byId, ICON } = U;
  const D = root.PE_DATA;

  /* ---------------- exam mode ---------------- */
  const EXAM_SIZES = [8, 12, 20];
  S.exam = S.exam || { stage: 'setup', scope: 'all', n: 12, qs: [], i: 0, ans: [], left: 0, secs: 0 };

  function pool(scope) {
    const out = [];
    LESSONS.forEach((l) => {
      if (scope !== 'all' && l.track !== scope) return;
      (l.quiz || []).forEach((q, qi) => out.push({ lessonId: l.id, qi: qi, q: q, track: l.track, title: l.title }));
    });
    return out;
  }

  function shuffle(a) {
    const r = a.slice();
    for (let i = r.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = r[i]; r[i] = r[j]; r[j] = t;
    }
    return r;
  }

  const timers = {};
  function clearTimer() { if (timers.h) { clearInterval(timers.h); timers.h = null; } }

  function examStart() {
    const p = shuffle(pool(S.exam.scope)).slice(0, S.exam.n);
    Object.assign(S.exam, { stage: 'run', qs: p, i: 0, ans: [], left: p.length * 45, secs: p.length * 45 });
    clearTimer();
    timers.h = setInterval(() => {
      if (S.exam.stage !== 'run') { clearTimer(); return; }
      S.exam.left -= 1;
      const el = document.getElementById('examclock');
      if (S.exam.left <= 0) { clearTimer(); examFinish(); root.PE_APP.render(); return; }
      if (el) {
        el.textContent = clockStr(S.exam.left);
        el.className = 'mono' + (S.exam.left <= 30 ? ' danger' : S.exam.left <= 90 ? ' warn' : '');
      }
    }, 1000);
    root.PE_APP.render();
  }

  const clockStr = (s) => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');

  function examAnswer(o) {
    if (S.exam.stage !== 'run') return;
    S.exam.ans[S.exam.i] = o;
    if (S.exam.i < S.exam.qs.length - 1) S.exam.i += 1;
    root.PE_APP.render();
  }
  function examSkip() {
    if (S.exam.stage !== 'run') return;
    if (S.exam.i < S.exam.qs.length - 1) S.exam.i += 1;
    root.PE_APP.render();
  }
  function examBack() {
    if (S.exam.stage !== 'run' || S.exam.i === 0) return;
    S.exam.i -= 1;
    root.PE_APP.render();
  }
  function examFinish() {
    clearTimer();
    S.exam.stage = 'done';
    let right = 0;
    S.exam.qs.forEach((it, k) => { if (S.exam.ans[k] === it.q.a) right += 1; });
    S.exam.score = { right, total: S.exam.qs.length, pct: Math.round((right / S.exam.qs.length) * 100) };
    S.exam.spent = S.exam.secs - Math.max(0, S.exam.left);
    root.PE_APP.render();
  }
  function examReset() {
    clearTimer();
    S.exam = { stage: 'setup', scope: S.exam.scope || 'all', n: S.exam.n || 12, qs: [], i: 0, ans: [], left: 0, secs: 0 };
    root.PE_APP.render();
  }

  function renderExam() {
    const E = S.exam;
    if (E.stage === 'setup') {
      const p = pool(E.scope);
      let h = '<div class="page narrow">' +
        '<div class="eyebrow">Exam mode</div>' +
        '<h1>Test yourself under a clock</h1>' +
        '<p class="lead">Every quiz question in the course, sampled at random. No feedback until the end, and a time limit — ' +
        'because recalling under pressure is a different skill from reading comfortably.</p>';

      h += '<div class="panel"><div class="panel-h"><b>1 · Scope</b></div><div class="panel-b">' +
        '<div class="chips">' +
        '<button class="chip' + (E.scope === 'all' ? ' on' : '') + '" data-act="exam-scope" data-v="all">Whole course · ' + pool('all').length + ' questions</button>';
      TRACKS.forEach((t) => {
        const n = pool(t.id).length;
        if (!n) return;
        h += '<button class="chip' + (E.scope === t.id ? ' on' : '') + '" data-act="exam-scope" data-v="' + t.id + '">' +
          esc(t.title) + ' · ' + n + '</button>';
      });
      h += '</div></div></div>';

      h += '<div class="panel"><div class="panel-h"><b>2 · Length</b></div><div class="panel-b"><div class="chips">';
      EXAM_SIZES.forEach((n) => {
        const avail = p.length;
        const capped = Math.min(n, avail);
        h += '<button class="chip' + (E.n === n ? ' on' : '') + '" data-act="exam-size" data-v="' + n + '">' +
          capped + ' questions · ' + clockStr(capped * 45) + '</button>';
      });
      h += '</div><p class="fine">45 seconds per question. Unanswered questions count as wrong, so guess rather than stall.</p></div></div>';

      h += '<div class="panel"><div class="panel-b row"><div class="muted">' + (p.length ? (E.scope === 'all' ? 'Mixed across all ' + TRACKS.length + ' tracks.' : 'From one track only.') : 'No questions in this scope.') + '</div>' +
        '<div class="spacer"></div><button class="btn primary lg" data-act="exam-start"' + (p.length ? '' : ' disabled') + '>Start exam</button></div></div>';
      h += '</div>';
      return h;
    }

    if (E.stage === 'run') {
      const it = E.qs[E.i];
      const t = U.trackOf[it.track];
      const picked = E.ans[E.i];
      let h = '<div class="page narrow exam">' +
        '<div class="exambar"><div class="mono muted">Question ' + (E.i + 1) + ' / ' + E.qs.length + '</div>' +
        '<div class="exprog">' + E.qs.map((x, k) => '<i class="' + (E.ans[k] !== undefined ? 'on' : k === E.i ? 'cur' : '') + '"></i>').join('') + '</div>' +
        '<div class="spacer"></div><div id="examclock" class="mono">' + clockStr(E.left) + '</div></div>' +
        '<div class="eyebrow" style="color:' + t.color + '">Track ' + t.n + ' · ' + esc(t.title) + '</div>' +
        '<h2 class="qstem">' + esc(it.q.q) + '</h2><div class="opts">';
      it.q.opts.forEach((o, k) => {
        h += '<button class="opt' + (picked === k ? ' on' : '') + '" data-act="exam-answer" data-o="' + k + '">' +
          '<span class="key">' + 'ABCD'[k] + '</span><span>' + esc(o) + '</span></button>';
      });
      h += '</div><div class="row" style="margin-top:18px">' +
        '<button class="btn ghost" data-act="exam-back"' + (E.i === 0 ? ' disabled' : '') + '>‹ Back</button>' +
        '<button class="btn ghost" data-act="exam-skip">Skip</button><div class="spacer"></div>' +
        (E.i === E.qs.length - 1 ? '<button class="btn primary" data-act="exam-finish">Finish</button>' : '<span class="fine">Answer to continue</span>') +
        '</div></div>';
      return h;
    }

    /* results */
    const sc = E.score;
    const byTrack = {};
    E.qs.forEach((it, k) => {
      const rec = byTrack[it.track] || (byTrack[it.track] = { right: 0, total: 0 });
      rec.total += 1;
      if (E.ans[k] === it.q.a) rec.right += 1;
    });
    let h = '<div class="page narrow"><div class="eyebrow">Exam results</div>' +
      '<h1>' + sc.right + ' / ' + sc.total + ' <span class="muted" style="font-size:20px">· ' + sc.pct + '%</span></h1>' +
      '<p class="lead">' + (sc.pct >= 90 ? 'Strong. Move on to the messy edges: failures, asymmetry, MTU.' :
        sc.pct >= 70 ? 'Solid foundation. The misses below point at exactly which lessons to reread.' :
          'Worth another pass through the earlier tracks — the gaps here are the ones that bite in production.') +
      ' Time used ' + clockStr(E.spent) + '.</p>';

    h += '<div class="panel"><div class="panel-h"><b>By track</b></div><div class="panel-b"><div class="tkrows">';
    Object.keys(byTrack).forEach((tid) => {
      const t = U.trackOf[tid], r = byTrack[tid];
      h += '<div class="tkrow"><span class="dot" style="color:' + t.color + '"></span><span class="nm">' + esc(t.title) + '</span>' +
        '<span class="bar"><i style="width:' + Math.round((r.right / r.total) * 100) + '%;background:' + t.color + '"></i></span>' +
        '<span class="mono">' + r.right + '/' + r.total + '</span></div>';
    });
    h += '</div></div></div>';

    h += '<div class="panel"><div class="panel-h"><b>Every question</b><span class="mono muted">' +
      (sc.total - sc.right) + ' to review</span></div><div class="panel-b"><div class="revlist">';
    E.qs.forEach((it, k) => {
      const ok = E.ans[k] === it.q.a;
      h += '<div class="rev' + (ok ? ' ok' : ' bad') + '">' +
        '<div class="revq"><span class="mark">' + (ok ? '✓' : '✕') + '</span><span>' + esc(it.q.q) + '</span></div>' +
        '<div class="reva">Your answer: <b>' + (E.ans[k] === undefined ? 'none' : esc(it.q.opts[E.ans[k]])) + '</b>' +
        (ok ? '' : '<br>Correct: <b>' + esc(it.q.opts[it.q.a]) + '</b>') + '</div>' +
        (ok ? '' : '<div class="revy">' + esc(it.q.why) + '</div>') +
        '<button class="lnk" data-act="lesson" data-id="' + it.lessonId + '">↗ ' + esc(it.title) + '</button></div>';
    });
    h += '</div></div></div>';
    h += '<div class="row" style="margin-top:16px"><button class="btn primary" data-act="exam-again">New exam</button>' +
      '<button class="btn ghost" data-act="view" data-v="tour">Back to course</button></div></div>';
    return h;
  }

  /* ---------------- protocol timeline ---------------- */
  function renderTimeline() {
    const T = D.TIMELINE || [];
    let h = '<div class="page"><div class="eyebrow">History</div><h1>The internet, one decision at a time</h1>' +
      '<p class="lead">Every protocol in this course exists because something broke, or because someone refused the obvious workaround. ' +
      'Read top to bottom and the shape of the modern internet stops looking accidental.</p><div class="tl">';
    T.forEach((row) => {
      const p = row[3] ? D.PROTOCOLS.find((x) => x.id === row[3]) : null;
      h += '<div class="tli"><div class="tly mono">' + esc(row[0]) + '</div><div class="tldot"></div>' +
        '<div class="tlb"><div class="tlt">' + esc(row[1]) + '</div>' +
        '<div class="tlx">' + esc(row[2]) + '</div>' +
        (p ? '<button class="chip sm" data-act="proto-jump" data-id="' + p.id + '">' +
          esc(p.abbr === p.name ? p.name : p.abbr + ' · ' + p.name) + '</button>' : '') +
        '</div></div>';
    });
    h += '</div></div>';
    return h;
  }

  /* ---------------- command palette ---------------- */
  const P = { open: false, q: '', items: [], sel: 0 };

  function search(q) {
    const s = q.trim().toLowerCase();
    const out = [];
    if (!s) {
      out.push({ kind: 'cmd', label: 'Course overview', sub: 'Start here', act: 'view', v: 'tour', icon: 'home' });
      out.push({ kind: 'cmd', label: 'Device lab', sub: 'Inspect any device', act: 'view', v: 'lab', icon: 'grid' });
      out.push({ kind: 'cmd', label: 'Exam mode', sub: 'Timed mixed quiz', act: 'view', v: 'exam', icon: 'list' });
      out.push({ kind: 'cmd', label: 'Protocol timeline', sub: 'History of the internet', act: 'view', v: 'timeline', icon: 'book' });
      return out;
    }
    const hit = (txt) => txt && txt.toLowerCase().indexOf(s) >= 0;
    LESSONS.forEach((l) => {
      if (hit(l.title) || hit(l.subtitle) || hit(l.goals.join(' '))) {
        out.push({ kind: 'lesson', label: l.title, sub: 'Lesson · ' + U.trackOf[l.track].title, act: 'lesson', id: l.id });
      }
      l.steps.forEach((st, i) => {
        if (hit(st.title) || hit(st.what)) out.push({ kind: 'step', label: st.title, sub: 'Step ' + (i + 1) + ' · ' + l.title, act: 'lesson-step', id: l.id, step: i });
      });
    });
    D.PROTOCOLS.forEach((p) => {
      if (hit(p.name) || hit(p.abbr) || hit(p.summary)) out.push({ kind: 'proto', label: p.name + ' (' + p.abbr + ')', sub: 'Protocol · layer ' + p.layer + ' · ' + p.rfc, act: 'proto-jump', id: p.id });
    });
    const terms = [];
    LESSONS.forEach((l) => l.steps.forEach((st) => (st.terms || []).forEach((tm) => {
      if (!terms.find((x) => x.t.toLowerCase() === tm.t.toLowerCase())) terms.push(tm);
    })));
    (D.GLOSSARY_EXTRA || []).forEach((tm) => { if (!terms.find((x) => x.t.toLowerCase() === tm.t.toLowerCase())) terms.push(tm); });
    terms.forEach((g) => {
      if (hit(g.t)) out.push({ kind: 'term', label: g.t, sub: 'Glossary · ' + String(g.d).slice(0, 70), act: 'glossary', id: g.t });
    });
    return out.slice(0, 40);
  }

  function paletteEl() {
    let el = document.getElementById('palette');
    if (!el) {
      el = document.createElement('div');
      el.id = 'palette';
      el.className = 'palette';
      el.innerHTML = '<div class="palbox"><div class="palinput">' + ICON.search +
        '<input id="palin" type="text" placeholder="Search lessons, steps, protocols, terms…" autocomplete="off" spellcheck="false"></div>' +
        '<div id="palres" class="palres"></div>' +
        '<div class="palfoot"><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>↵</kbd> open</span><span><kbd>esc</kbd> close</span></div></div>';
      document.body.appendChild(el);
      const inp = el.querySelector('#palin');
      inp.addEventListener('input', () => {
        P.q = inp.value;
        P.items = search(P.q);
        P.sel = 0;
        paintPalette();
      });
    }
    return el;
  }

  function paintPalette() {
    const box = document.getElementById('palres');
    if (!box) return;
    if (!P.items.length) { box.innerHTML = '<div class="palempty">Nothing matched. Try “TLS”, “conntrack”, “subnet”, “handshake”.</div>'; return; }
    let h = '';
    P.items.forEach((it, i) => {
      h += '<button class="palitem' + (i === P.sel ? ' on' : '') + '" data-pal="' + i + '">' +
        '<span class="palk">' + esc(it.kind) + '</span><span class="pall">' + esc(it.label) + '</span>' +
        '<span class="pals">' + esc(it.sub) + '</span></button>';
    });
    box.innerHTML = h;
  }

  function paletteOpen(initial) {
    const el = paletteEl();
    P.q = initial || '';
    P.items = search(P.q);
    P.sel = 0;
    el.classList.add('on');
    P.open = true;
    const inp = el.querySelector('#palin');
    inp.value = P.q;
    paintPalette();
    setTimeout(() => inp.focus(), 10);
  }
  function paletteClose() {
    const el = document.getElementById('palette');
    if (el) el.classList.remove('on');
    P.open = false;
  }
  function paletteRun(i) {
    const it = P.items[i];
    if (!it) return;
    paletteClose();
    if (it.act === 'view') { S.view = it.v; S.search = ''; root.PE_APP.render(); return; }
    if (it.act === 'lesson') { root.PE_APP.goLesson(it.id); return; }
    if (it.act === 'lesson-step') { root.PE_APP.goLesson(it.id, it.step); return; }
    if (it.act === 'proto-jump') { S.view = 'library'; S.lib = it.id; S.search = ''; root.PE_APP.render(); return; }
    if (it.act === 'glossary') { S.view = 'glossary'; S.search = it.id; root.PE_APP.render(); return; }
  }

  document.addEventListener('keydown', (ev) => {
    const k = ev.key;
    if ((ev.metaKey || ev.ctrlKey) && (k === 'k' || k === 'K')) {
      ev.preventDefault();
      if (P.open) paletteClose(); else paletteOpen('');
      return;
    }
    if (k === '/' && !P.open) {
      const tag = (ev.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      ev.preventDefault();
      paletteOpen('');
      return;
    }
    if (!P.open) return;
    if (k === 'Escape') { ev.preventDefault(); paletteClose(); return; }
    if (k === 'ArrowDown') { ev.preventDefault(); P.sel = Math.min(P.items.length - 1, P.sel + 1); paintPalette(); return; }
    if (k === 'ArrowUp') { ev.preventDefault(); P.sel = Math.max(0, P.sel - 1); paintPalette(); return; }
    if (k === 'Enter') { ev.preventDefault(); paletteRun(P.sel); return; }
  }, true);

  document.addEventListener('click', (ev) => {
    const pal = ev.target.closest('[data-pal]');
    if (pal) { paletteRun(parseInt(pal.getAttribute('data-pal'), 10)); return; }
    const el = document.getElementById('palette');
    if (el && el.classList.contains('on') && ev.target === el) paletteClose();
  });

  root.PE_EXTRA = { renderExam, renderTimeline, examStart, examAnswer, examSkip, examBack, examFinish, examReset, paletteOpen, paletteClose };
})(typeof window !== 'undefined' ? window : globalThis);
