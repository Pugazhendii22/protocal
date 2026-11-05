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
    simple: true,
  };

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      const j = JSON.parse(raw);
      if (j.done) S.done = j.done;
      if (j.quiz) S.quiz = j.quiz;
      if (j.lessonId && byId[j.lessonId]) S.lessonId = j.lessonId;
      if (j.simple === false) S.simple = false;
    } catch (e) { /* ignore */ }
  }
  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ done: S.done, quiz: S.quiz, lessonId: S.lessonId, simple: S.simple }));
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
    const next = LESSONS.find((l) => !isDone(l)) || LESSONS[0];
    const nextTrack = trackOf[next.track];

    const explore = [
      { kind: 'view', id: 'lab', label: 'Explore devices', icon: 'grid', hint: 'Look inside any router, phone or server' },
      { kind: 'view', id: 'library', label: 'Protocol guide', icon: 'book', hint: root.PE_DATA.PROTOCOLS.length + ' protocols explained' },
      { kind: 'view', id: 'exam', label: 'Practice test', icon: 'list', hint: 'Timed quiz, all tracks' },
      { kind: 'view', id: 'timeline', label: 'History of the internet', icon: 'book', hint: (root.PE_DATA.TIMELINE || []).length + ' moments that shaped it' },
      { kind: 'view', id: 'cheatsheet', label: 'Quick reference', icon: 'terminal', hint: 'Ports, layers, commands' },
      { kind: 'view', id: 'glossary', label: 'Word list', icon: 'list', hint: 'Every term, plain English' },
      { kind: 'view', id: 'sources', label: 'Books & links', icon: 'book', hint: 'Where to go next' },
    ];

    let h = '<div class="brand">' + brandMark() +
      '<div><div class="name">Protocol Explorer</div><div class="sub">learn it packet by packet</div></div></div>' +
      '<div class="sidebar-scroll scroll">';

    // continue card
    h += '<button class="navitem active" data-act="openLesson" data-id="' + next.id + '" style="padding:11px 12px;margin:4px 0 6px;background:var(--accent-soft);border:1px solid #dcdcfb">' +
      '<span class="num" style="background:' + nextTrack.color + ';color:#fff;box-shadow:none">' + (o.done ? '▶' : '1') + '</span>' +
      '<span class="lbl"><b style="font-size:13px">' + (o.done ? 'Continue learning' : 'Start here') + '</b>' +
      '<div style="font-size:11.5px;color:var(--muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(next.title) + '</div></span></button>';

    h += '<div class="navgroup"><div class="gt"><span>Lessons</span>' +
      '<span class="mono" style="font-size:10.5px;letter-spacing:0;color:var(--muted)">' + o.done + '/' + o.total + '</span></div>';

    TRACKS.forEach((t) => {
      const st = trackStats(t.id);
      h += '<div style="padding:10px 9px 2px;display:flex;align-items:center;gap:8px">' +
        '<span class="dot" style="color:' + t.color + '"></span>' +
        '<span style="font-size:12px;font-weight:750;color:var(--text2);flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + t.n + '. ' + esc(t.title) + '</span>' +
        '<span class="mono" style="font-size:10px;color:var(--dim)">' + st.done + '/' + st.total + '</span></div>' +
        '<div class="trackbar"><i style="width:' + st.pct + '%;background:' + t.color + '"></i></div>';
      LESSONS.filter((l) => l.track === t.id).forEach((l) => {
        const idx = LESSONS.indexOf(l) + 1;
        const active = S.view === 'lesson' && S.lessonId === l.id;
        const done = isDone(l);
        h += '<button class="navitem' + (active ? ' active' : '') + (done ? ' done' : '') + '" data-act="lesson" data-id="' + l.id + '">' +
          '<span class="num">' + (done ? '✓' : pad(idx)) + '</span>' +
          '<span class="lbl">' + esc(l.title) + '</span></button>';
      });
    });
    h += '</div>';

    h += '<div class="navgroup"><div class="gt"><span>Explore</span></div>';
    explore.forEach((it) => {
      h += '<button class="navitem' + (S.view === it.id ? ' active' : '') + '" data-act="view" data-v="' + it.id + '">' +
        '<span class="num" style="background:transparent;color:var(--dim)">' + (ICON[it.icon] ? ICON[it.icon].replace('<svg', '<svg width="15" height="15"') : '') + '</span>' +
        '<span class="lbl">' + esc(it.label) + '</span></button>';
    });
    h += '</div></div>';

    h += '<div class="side-foot"><span><b style="color:var(--text2)">' + o.pct + '%</b> complete</span>' +
      '<button class="btn sm ' + (S.simple ? 'on' : 'ghost') + ' simplebtn" data-act="simple" title="Short, easy sentences and word help">' +
      (S.simple ? '✓ Easy English' : 'Easy English') + '</button>' +
      '<button class="btn sm ghost" data-act="reset">Reset progress</button></div>';
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

  function renderTabs() {
    const bar = document.getElementById('tabbar');
    if (!bar) return;
    bar.querySelectorAll('[data-ico]').forEach((sp) => {
      if (sp.firstChild) return;
      const svg = ICON[sp.getAttribute('data-ico')] || '';
      sp.innerHTML = svg.replace('<svg', '<svg width="20" height="20"');
    });
    const active = S.view === 'lab' ? 'lab' : S.view === 'exam' ? 'exam' : S.view === 'tour' ? 'tour' : S.view === 'lesson' ? 'lessons' : '';
    bar.querySelectorAll('[data-tab]').forEach((b) => {
      b.classList.toggle('on', b.getAttribute('data-tab') === active);
    });
  }

  function renderTopbar() {
    let crumbs = '';
    let right = '<button class="btn sm ghost hide-sm" data-act="palette" title="Search everything (Ctrl+K)" style="gap:7px">' +
        ICON.search + '<span style="color:var(--muted)">Search</span><kbd style="margin-left:2px">Ctrl K</kbd></button>' +
      '<button class="icobtn" data-act="view" data-v="tour" title="Home">' + ICON.home + '</button>';

    if (S.view === 'tour') {
      crumbs = '<b>Home</b><span class="hint" style="color:var(--dim)">·</span><span class="hint">' + TRACKS.length + ' tracks · ' + LESSONS.length + ' lessons</span>';
    } else if (S.view === 'lesson') {
      const l = byId[S.lessonId];
      const t = trackOf[l.track];
      crumbs = '<span class="hint" style="color:' + t.color + ';font-weight:650">Track ' + t.n + ' · ' + esc(t.title) + '</span>' +
        '<span class="hint" style="color:var(--dim)">/</span><b>' + esc(l.title) + '</b>';
      right = '<button class="btn sm ' + (S.simple ? 'on' : 'ghost') + ' hide-sm" data-act="simple" title="Short, easy sentences and word help">' +
          (S.simple ? '✓ Easy English' : 'Easy English') + '</button>' +
        '<div class="seg" style="margin-right:2px">' +
          '<button data-act="prev" title="Previous lesson">‹</button>' +
          '<button data-act="nextLesson" title="Next lesson">›</button></div>' +
        '<button class="icobtn" data-act="palette" title="Search everything (Ctrl+K)">' + ICON.search + '</button>' +
        '<button class="icobtn" data-act="view" data-v="tour" title="Home">' + ICON.home + '</button>' +
        '<button class="btn sm" data-act="view" data-v="lab">Explore devices</button>';
    } else if (S.view === 'lab') {
      crumbs = '<b>Explore devices</b><span class="hint" style="color:var(--dim)">·</span><span class="hint">click any box to open it</span>';
    } else if (S.view === 'library') {
      crumbs = '<b>Protocol guide</b>';
    } else if (S.view === 'sources') {
      crumbs = '<b>Books & links</b>';
    } else if (S.view === 'glossary') {
      crumbs = '<b>Word list</b>';
    } else if (S.view === 'cheatsheet') {
      crumbs = '<b>Quick reference</b>';
    } else if (S.view === 'exam') {
      crumbs = '<b>Practice test</b>';
    } else if (S.view === 'timeline') {
      crumbs = '<b>History of the internet</b>';
    }

    document.getElementById('topbar').innerHTML =
      '<button class="icobtn menubtn" data-act="menu">' + ICON.menu + '</button>' +
      '<div class="crumbs">' + crumbs + '</div><div class="spacer"></div>' + right;
  }

  root.PE_UI = {
    S, LESSONS, TRACKS, byId, trackOf, esc, $, $$, pad, fmtB, fmtT, ICON,
    toast, save, load, renderSidebar, renderTopbar, renderTabs,
    lessonProgress, isDone, trackStats, overall, markStep,
  };
})(typeof window !== 'undefined' ? window : globalThis);
