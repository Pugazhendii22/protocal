/* ============================================================
   ui.js — state, icons, shell rendering, small helpers
   ============================================================ */
(function (root) {
  'use strict';

  const TRACKS = root.PE_DATA.TRACKS;
  const LESSONS = root.PE_LESSONS_BASICS.concat(root.PE_LESSONS_MORE, root.PE_LESSONS_ADVANCED || [], root.PE_LESSONS_DEEP || [], root.PE_LESSONS_OPS || []);
  const byId = {};
  LESSONS.forEach((l) => { byId[l.id] = l; });
  const trackOf = {};
  TRACKS.forEach((t) => { trackOf[t.id] = t; });

  const STORE_KEY = 'pe2-progress-v1';

  const S = {
    view: 'tour',
    lessonId: LESSONS[0].id,
    step: 0,
    sel: null,
    peek: false,
    speed: 1,
    playing: false,
    done: {},
    quiz: {},
    lab: { topo: null, device: null, tab: 'overview' },
    lib: null,
    search: '',
    menu: false,
  };

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      const j = JSON.parse(raw);
      if (j.done) S.done = j.done;
      if (j.quiz) S.quiz = j.quiz;
      if (j.lessonId && byId[j.lessonId]) S.lessonId = j.lessonId;
    } catch (e) { /* ignore */ }
  }
  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ done: S.done, quiz: S.quiz, lessonId: S.lessonId }));
    } catch (e) { /* ignore */ }
  }

  /* ---------------- helpers ---------------- */
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = (sel, r) => (r || document).querySelector(sel);
  const $$ = (sel, r) => Array.from((r || document).querySelectorAll(sel));
  const pad = (n, w) => String(n).padStart(w || 2, '0');
  const fmtB = (n) => (n >= 1024 ? (n / 1024).toFixed(1) + ' KB' : n + ' B');
  const fmtT = (t) => t.toFixed(3) + 's';

  const ICON = {
    laptop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="11" rx="1.6"/><path d="M2 19.5h20"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="2.5" width="10" height="19" rx="2.4"/><path d="M11 18.5h2"/></svg>',
    router: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="12" width="18" height="7" rx="1.8"/><path d="M7 15.5h.01M10.5 15.5h.01"/><path d="M12 9V3M12 6l3-2M12 6L9 4"/></svg>',
    switch: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="8.5" width="19" height="7" rx="1.6"/><path d="M6 12h.01M9 12h.01M12 12h.01M15 12h.01M18 12h.01"/></svg>',
    web: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="7" rx="1.4"/><rect x="3" y="14" width="18" height="6" rx="1.4"/><path d="M6.5 7.5h.01M6.5 17h.01"/></svg>',
    dns: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.4 2.4 14.6 0 17M12 3.5c-2.4 2.4-2.4 14.6 0 17"/></svg>',
    server: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3.5" width="16" height="6.5" rx="1.4"/><rect x="4" y="14" width="16" height="6.5" rx="1.4"/><path d="M7.5 6.8h.01M7.5 17.2h.01"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
    ca: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v6c0 4.2-3 7.5-7 9-4-1.5-7-4.8-7-9V6z"/><path d="m9 12 2.2 2.2L15.5 10"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="7" y="5" width="3.5" height="14" rx="1"/><rect x="13.5" y="5" width="3.5" height="14" rx="1"/></svg>',
    next: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
    prev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
    reset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"/><path d="M3.5 4.5V10H9"/></svg>',
    search: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 4.5 4.5"/></svg>',
    menu: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4.5h6a3 3 0 0 1 3 3V20a2.4 2.4 0 0 0-2.4-2.4H4z"/><path d="M20 4.5h-6a3 3 0 0 0-3 3V20a2.4 2.4 0 0 1 2.4-2.4H20z"/></svg>',
    grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><rect x="3.5" y="3.5" width="7" height="7" rx="1.4"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.4"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.4"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.4"/></svg>',
    terminal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="4" width="19" height="16" rx="2"/><path d="m6.5 9 3 3-3 3M12.5 15.5h5"/></svg>',
    list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/></svg>',
    pod: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.6l8 4.6v9.6l-8 4.6-8-4.6V7.2z"/><path d="M12 7.4l4 2.3v4.6l-4 2.3-4-2.3V9.7z"/></svg>',
    proxy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="8" height="10" rx="1.6"/><rect x="13" y="7" width="8" height="10" rx="1.6"/><path d="M6 12h4M14 12h4"/></svg>',
    ap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12a7 7 0 0 1 14 0"/><path d="M8 14.5a4 4 0 0 1 8 0"/><circle cx="12" cy="18" r="1.4"/><path d="M12 19.4V21"/></svg>',
    cloud: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 18h10a4 4 0 0 0 .6-7.96A6 6 0 0 0 6.1 11.2 3.5 3.5 0 0 0 7 18z"/></svg>',
    home: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 10.5 12 3.5l8.5 7"/><path d="M5.5 9.5V20h13V9.5"/></svg>',
  };

  function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('on'), 2200);
  }

  /* ---------------- progress ---------------- */
  function lessonProgress(l) {
    const d = S.done[l.id];
    if (!d) return 0;
    if (d === 'done') return 100;
    return Math.min(99, Math.round((d.steps / l.steps.length) * 100));
  }
  function isDone(l) { return S.done[l.id] === 'done'; }
  function trackStats(tid) {
    const ls = LESSONS.filter((l) => l.track === tid);
    const done = ls.filter(isDone).length;
    return { total: ls.length, done, pct: Math.round((done / ls.length) * 100) };
  }
  function overall() {
    const done = LESSONS.filter(isDone).length;
    return { done, total: LESSONS.length, pct: Math.round((done / LESSONS.length) * 100) };
  }
  function markStep(l, stepIdx) {
    const cur = S.done[l.id];
    const maxStep = cur === 'done' ? l.steps.length : Math.max((cur && cur.steps) || 0, stepIdx + 1);
    S.done[l.id] = maxStep >= l.steps.length ? (cur === 'done' ? 'done' : 'done') : { steps: maxStep };
    save();
  }

  /* ---------------- shell ---------------- */
  function renderSidebar() {
    const o = overall();
    const groups = [
      { title: 'Guided course', items: [{ kind: 'view', id: 'tour', label: 'Course overview', icon: 'home', hint: 'Syllabus & progress' }].concat(TRACKS.map((t) => ({ kind: 'track', t }))) },
      { title: 'Free explore', items: [
        { kind: 'view', id: 'lab', label: 'Device lab', icon: 'grid', hint: 'Open any device' },
        { kind: 'view', id: 'exam', label: 'Exam mode', icon: 'list', hint: 'Timed mixed quiz' },
        { kind: 'view', id: 'library', label: 'Protocol library', icon: 'book', hint: root.PE_DATA.PROTOCOLS.length + ' protocols' },
        { kind: 'view', id: 'timeline', label: 'Protocol timeline', icon: 'book', hint: (root.PE_DATA.TIMELINE || []).length + ' milestones' },
        { kind: 'view', id: 'sources', label: 'Sources & further reading', icon: 'book', hint: 'books · repos · RFCs' },
        { kind: 'view', id: 'glossary', label: 'Glossary', icon: 'list', hint: 'Every term' },
        { kind: 'view', id: 'cheatsheet', label: 'Ports & cheat sheet', icon: 'terminal', hint: 'Quick reference' },
      ] },
    ];

    let h = '<div class="brand">' + brandMark() +
      '<div><div class="name">Protocol Explorer</div><div class="sub">packet by packet</div></div></div>' +
      '<div class="sidebar-scroll scroll">';

    groups.forEach((g) => {
      h += '<div class="navgroup"><div class="gt"><span>' + g.title + '</span>' +
        (g.title === 'Guided course' ? '<span class="mono" style="color:var(--muted);font-size:10px">' + o.done + '/' + o.total + '</span>' : '') +
        '</div>';
      g.items.forEach((it) => {
        if (it.kind === 'view') {
          h += '<button class="navitem' + (S.view === it.id ? ' active' : '') + '" data-act="view" data-v="' + it.id + '">' +
            '<span class="num" style="background:transparent;color:var(--dim)">' + (ICON[it.icon] ? ICON[it.icon].replace('<svg', '<svg width="14" height="14"') : '') + '</span>' +
            '<span class="lbl">' + esc(it.label) + '<div style="font-size:10.5px;color:var(--dim)">' + esc(it.hint) + '</div></span></button>';
          return;
        }
        const t = it.t;
        const st = trackStats(t.id);
        h += '<div style="padding:8px 9px 3px;display:flex;align-items:center;gap:7px">' +
          '<span class="dot" style="color:' + t.color + '"></span>' +
          '<span style="font-size:11.5px;font-weight:650;color:var(--text2)">' + t.n + '. ' + esc(t.title) + '</span>' +
          '<span style="flex:1"></span><span class="mono" style="font-size:9.5px;color:var(--dim)">' + st.done + '/' + st.total + '</span></div>' +
          '<div class="trackbar"><i style="width:' + st.pct + '%;background:' + t.color + '"></i></div>';
        LESSONS.filter((l) => l.track === t.id).forEach((l) => {
          const idx = LESSONS.indexOf(l) + 1;
          const active = S.view === 'lesson' && S.lessonId === l.id;
          const done = isDone(l);
          h += '<button class="navitem' + (active ? ' active' : '') + (done ? ' done' : '') + '" data-act="lesson" data-id="' + l.id + '">' +
            '<span class="num">' + (done ? '✓' : pad(idx)) + '</span>' +
            '<span class="lbl">' + esc(l.title) + '</span>' +
            (done ? '<span class="chk">✓</span>' : '') + '</button>';
        });
      });
      h += '</div>';
    });
    h += '</div>';
    h += '<div class="side-foot"><span>' + o.pct + '% complete</span><button class="btn sm ghost" data-act="reset">Reset</button></div>';
    document.getElementById('sidebar').innerHTML = h;
    document.getElementById('sidebar').classList.toggle('open', S.menu);
  }

  function brandMark() {
    return '<svg width="30" height="30" viewBox="0 0 32 32" fill="none">' +
      '<rect x="1" y="1" width="30" height="30" rx="9" fill="#12203a" stroke="#2b4568"/>' +
      '<circle cx="9" cy="22" r="2.4" fill="#5b8def"/><circle cx="23" cy="9" r="2.4" fill="#22d3ee"/>' +
      '<circle cx="23" cy="22" r="2.4" fill="#c084fc"/>' +
      '<path d="M10.5 21 21 10.5M11 22h10" stroke="#3d6dab" stroke-width="1.3" stroke-linecap="round"/></svg>';
  }

  function renderTopbar() {
    let crumbs = '';
    let right = '<button class="icobtn" data-act="palette" title="Search everything (Ctrl+K)">' + ICON.search + '</button>' +
      '<button class="icobtn" data-act="view" data-v="tour" title="Course overview">' + ICON.home + '</button>';
    if (S.view === 'tour') {
      crumbs = '<b>Course overview</b><span style="color:var(--dim)">·</span><span>' + TRACKS.length + ' tracks · ' + LESSONS.length + ' lessons</span>';
    }
    if (S.view === 'lesson') {
      const l = byId[S.lessonId];
      const t = trackOf[l.track];
      crumbs = '<span style="color:' + t.color + '">Track ' + t.n + ' · ' + esc(t.title) + '</span>' +
        '<span style="color:var(--dim)">/</span><b>' + esc(l.title) + '</b>';
      right = '<div class="seg" style="margin-right:2px">' +
        '<button data-act="prev" title="Previous lesson">‹</button>' +
        '<button data-act="nextLesson" title="Next lesson">›</button></div>' +
        '<button class="btn sm" data-act="view" data-v="lab">Device lab</button>' +
        '<button class="btn sm primary" data-act="openNextLesson">Next<span class="hide-sm"> lesson</span> ' + ICON.next.replace('<svg', '<svg width="13" height="13"') + '</button>';
    } else if (S.view === 'lab') {
      crumbs = '<span style="color:var(--accent)">Free explore</span><span style="color:var(--dim)">/</span><b>Device lab</b>';
    } else if (S.view === 'library') {
      crumbs = '<span style="color:var(--accent)">Free explore</span><span style="color:var(--dim)">/</span><b>Protocol library</b>';
    } else if (S.view === 'sources') {
      crumbs = '<span style="color:var(--accent)">Free explore</span><span style="color:var(--dim)">/</span><b>Sources & further reading</b>';
    } else if (S.view === 'glossary') {
      crumbs = '<span style="color:var(--accent)">Free explore</span><span style="color:var(--dim)">/</span><b>Glossary</b>';
    } else if (S.view === 'cheatsheet') {
      crumbs = '<span style="color:var(--accent)">Free explore</span><span style="color:var(--dim)">/</span><b>Ports & cheat sheet</b>';
    } else if (S.view === 'exam') {
      crumbs = '<span style="color:var(--accent)">Free explore</span><span style="color:var(--dim)">/</span><b>Exam mode</b>';
    } else if (S.view === 'timeline') {
      crumbs = '<span style="color:var(--accent)">Free explore</span><span style="color:var(--dim)">/</span><b>Protocol timeline</b>';
    }
    document.getElementById('topbar').innerHTML =
      '<button class="icobtn menubtn" data-act="menu">' + ICON.menu + '</button>' +
      '<div class="crumbs">' + crumbs + '</div><div class="spacer"></div>' + right;
  }

  root.PE_UI = {
    S, LESSONS, TRACKS, byId, trackOf, esc, $, $$, pad, fmtB, fmtT, ICON,
    toast, save, load, renderSidebar, renderTopbar,
    lessonProgress, isDone, trackStats, overall, markStep,
  };
})(typeof window !== 'undefined' ? window : globalThis);
