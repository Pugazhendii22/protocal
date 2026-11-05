/* ============================================================
   app.js — router, events, keyboard
   ============================================================ */
(function (root) {
  'use strict';
  const U = root.PE_UI;
  const { S, byId, esc } = U;

  function curLesson() { return byId[S.lessonId]; }

  function render(keepScroll) {
    const view = document.getElementById('view');
    const scrollTop = view.scrollTop;
    U.renderSidebar();
    U.renderTopbar();

    if (S.view === 'tour') {
      view.innerHTML = root.PE_TOUR.render();
    } else if (S.view === 'lesson') {
      const l = curLesson();
      S.step = Math.max(0, Math.min(S.step, l.steps.length - 1));
      view.innerHTML = root.PE_LESSON.render();
      root.PE_LESSON.afterRender();
    } else if (S.view === 'lab') {
      view.innerHTML = root.PE_LAB.render();
      root.PE_LAB.afterRender();
    } else if (S.view === 'library') {
      view.innerHTML = root.PE_REF.library();
    } else if (S.view === 'sources') {
      view.innerHTML = root.PE_SOURCES.render();
    } else if (S.view === 'glossary') {
      view.innerHTML = root.PE_REF.glossary();
    } else if (S.view === 'cheatsheet') {
      view.innerHTML = root.PE_REF.cheatsheet();
    } else if (S.view === 'exam') {
      view.innerHTML = root.PE_EXTRA.renderExam();
    } else if (S.view === 'timeline') {
      view.innerHTML = root.PE_EXTRA.renderTimeline();
    }
    if (keepScroll) view.scrollTop = scrollTop; else view.scrollTop = 0;
    window.scrollTo(0, 0);
  }

  function goLesson(id, step) {
    if (!byId[id]) return;
    S.view = 'lesson';
    S.lessonId = id;
    S.step = step || 0;
    S.sel = null;
    S.playing = false;
    S.peek = false;
    U.save();
    render();
  }

  function nextLessonId() {
    const i = U.LESSONS.indexOf(curLesson());
    return (U.LESSONS[i + 1] || {}).id;
  }

  /* ---------------- events ---------------- */
  document.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-act]');
    if (!el) {
      if (S.menu && !ev.target.closest('#sidebar') && !ev.target.closest('[data-act="menu"]')) {
        S.menu = false;
        document.getElementById('sidebar').classList.remove('open');
      }
      return;
    }
    const act = el.getAttribute('data-act');
    const L = root.PE_LESSON;

    switch (act) {
      case 'menu':
        S.menu = !S.menu;
        document.getElementById('sidebar').classList.toggle('open', S.menu);
        break;

      case 'view':
        S.view = el.getAttribute('data-v');
        S.search = '';
        S.menu = false;
        render();
        break;

      case 'lesson':
      case 'openLesson':
        goLesson(el.getAttribute('data-id'));
        break;

      case 'openNextLesson': {
        const n = nextLessonId();
        if (n) goLesson(n); else U.toast('That was the last lesson — try the Device lab next.');
        break;
      }
      case 'nextLesson': {
        const n = nextLessonId();
        if (n) goLesson(n); else U.toast('No more lessons after this one.');
        break;
      }
      case 'prev': {
        const i = U.LESSONS.indexOf(curLesson());
        if (i > 0) goLesson(U.LESSONS[i - 1].id);
        break;
      }

      case 'step': {
        const i = parseInt(el.getAttribute('data-i'), 10);
        const l = curLesson();
        if (isNaN(i) || i < 0 || i >= l.steps.length) break;
        S.step = i;
        S.sel = null;
        S.playing = false;
        L.LS.hl = null;
        U.markStep(l, i);
        render();
        break;
      }
      case 'replay': {
        const sess = L.session(curLesson());
        L.animate(sess, S.step);
        break;
      }
      case 'play':
        S.playing = !S.playing;
        render(true);
        break;
      case 'speed':
        S.speed = parseFloat(el.getAttribute('data-v'));
        render(true);
        break;
      case 'peek':
        S.peek = !S.peek;
        render(true);
        break;

      case 'packet': {
        S.sel = parseInt(el.getAttribute('data-i'), 10);
        L.LS.hl = null;
        L.refreshInspector();
        const rows = document.querySelectorAll('table.pcap tr');
        rows.forEach((r) => r.classList.remove('sel'));
        if (el.tagName === 'TR') el.classList.add('sel');
        break;
      }
      case 'layer': {
        const i = el.getAttribute('data-i');
        L.LS.open[i] = L.LS.open[i] !== false ? false : true;
        L.refreshInspector();
        break;
      }
      case 'field': {
        const off = parseInt(el.getAttribute('data-off'), 10);
        const len = parseInt(el.getAttribute('data-len'), 10);
        L.LS.hl = { off, len };
        L.refreshInspector();
        break;
      }
      case 'quiz': {
        const q = parseInt(el.getAttribute('data-q'), 10);
        const o = parseInt(el.getAttribute('data-o'), 10);
        S.quiz[S.lessonId] = S.quiz[S.lessonId] || {};
        if (S.quiz[S.lessonId][q] !== undefined) break;
        S.quiz[S.lessonId][q] = o;
        U.save();
        render(true);
        break;
      }
      case 'complete': {
        const l = curLesson();
        if (U.isDone(l)) { delete S.done[l.id]; }
        else { S.done[l.id] = 'done'; U.toast('Lesson marked complete'); }
        U.save();
        render(true);
        break;
      }
      case 'reset':
        if (confirm('Reset all lesson progress?')) {
          S.done = {}; S.quiz = {};
          U.save(); render();
        }
        break;

      /* ---- device lab ---- */
      case 'lab-topo':
        S.lab.topo = el.getAttribute('data-v');
        S.lab.device = null;
        S.lab.tab = 'overview';
        S.view = 'lab';
        render();
        break;
      case 'lab-device':
        S.lab.device = el.getAttribute('data-id');
        root.PE_LAB.cliReset();
        render();
        break;
      case 'lab-tab':
        S.lab.tab = el.getAttribute('data-t');
        render(true);
        break;
      case 'lab-trace':
        S.lab.traceTarget = el.getAttribute('data-id');
        render(true);
        break;
      case 'cli-run':
        S.lab.tab = 'cli';
        render(true);
        setTimeout(() => root.PE_LAB.submit(el.getAttribute('data-cmd')), 30);
        break;
      case 'cli-submit':
        ev.preventDefault();
        break;

      /* ---- reference ---- */
      case 'proto': {
        const id = el.getAttribute('data-id');
        S.lib = id === S.lib ? null : id;
        render();
        if (S.lib) {
          const d = document.getElementById('proto-detail');
          if (d) d.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        break;
      }
      case 'exam-scope':
        S.exam.scope = el.getAttribute('data-v');
        render(true);
        break;
      case 'exam-size':
        S.exam.n = parseInt(el.getAttribute('data-v'), 10) || 12;
        render(true);
        break;
      case 'exam-start':
        root.PE_EXTRA.examStart();
        break;
      case 'exam-answer':
        root.PE_EXTRA.examAnswer(parseInt(el.getAttribute('data-o'), 10));
        break;
      case 'exam-skip':
        root.PE_EXTRA.examSkip();
        break;
      case 'exam-back':
        root.PE_EXTRA.examBack();
        break;
      case 'exam-finish':
        root.PE_EXTRA.examFinish();
        break;
      case 'exam-again':
        root.PE_EXTRA.examReset();
        break;
      case 'simple':
        S.simple = !S.simple;
        U.save();
        U.toast(S.simple ? 'Easy English on — short lines and word help' : 'Showing the original wording');
        render(true);
        break;
      case 'palette':
        ev.preventDefault();
        root.PE_EXTRA.paletteOpen('');
        break;
      case 'proto-jump':
        S.view = 'library';
        S.lib = el.getAttribute('data-id');
        S.search = '';
        render();
        break;
      case 'glossary':
        S.view = 'glossary';
        S.search = el.getAttribute('data-id') || '';
        render();
        break;

      case 'dev':
        S.view = 'lab';
        S.lab.device = el.getAttribute('data-id');
        S.lab.tab = 'overview';
        root.PE_LAB.cliReset();
        render();
        break;
    }
  });

  /* device nodes on the canvas */
  document.addEventListener('click', (ev) => {
    const node = ev.target.closest('.node[data-dev]');
    if (!node) return;
    const sess = root.PE_LESSON.session(byId[S.lessonId]);
    S.view = 'lab';
    S.lab.topo = sess.topo.id || 'home';
    S.lab.device = node.getAttribute('data-dev');
    S.lab.tab = 'overview';
    root.PE_LAB.cliReset();
    U.toast('Opened ' + (root.PE_TOPO.TOPOLOGIES[S.lab.topo].devices.find((d) => d.id === node.getAttribute('data-dev')) || {}).label);
    render();
  });

  /* cli form + search inputs */
  document.addEventListener('submit', (ev) => {
    const f = ev.target;
    if (f.id === 'cliform') {
      ev.preventDefault();
      const inp = document.getElementById('cliin');
      const cmd = inp.value;
      inp.value = '';
      root.PE_LAB.submit(cmd);
    }
  });

  document.addEventListener('input', (ev) => {
    if (ev.target.id === 'libsearch' || ev.target.id === 'glsearch' || ev.target.id === 'srcsearch') {
      S.search = ev.target.value;
      const sel = document.activeElement;
      render(true);
      const again = document.getElementById(sel.id);
      if (again) { again.focus(); again.setSelectionRange(again.value.length, again.value.length); }
    }
  });

  /* keyboard */
  document.addEventListener('keydown', (ev) => {
    const tag = (ev.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') {
      if (ev.key === 'ArrowUp' && ev.target.id === 'cliin') {
        ev.preventDefault();
        const C = root.PE_LAB.CLI;
        if (C.hist.length) { C.hi = Math.max(0, C.hi - 1); ev.target.value = C.hist[C.hi] || ''; }
      } else if (ev.key === 'ArrowDown' && ev.target.id === 'cliin') {
        ev.preventDefault();
        const C = root.PE_LAB.CLI;
        C.hi = Math.min(C.hist.length, C.hi + 1);
        ev.target.value = C.hist[C.hi] || '';
      }
      return;
    }
    if (S.view !== 'lesson') return;
    const l = curLesson();
    if (ev.key === 'ArrowRight') {
      ev.preventDefault();
      if (S.step < l.steps.length - 1) { S.step += 1; S.sel = null; U.markStep(l, S.step); render(true); }
    } else if (ev.key === 'ArrowLeft') {
      ev.preventDefault();
      if (S.step > 0) { S.step -= 1; S.sel = null; render(true); }
    } else if (ev.key === ' ') {
      ev.preventDefault();
      S.playing = !S.playing;
      render(true);
    } else if (/^[1-9]$/.test(ev.key)) {
      const i = parseInt(ev.key, 10) - 1;
      if (i < l.steps.length) { S.step = i; S.sel = null; U.markStep(l, i); render(true); }
    }
  });

  window.addEventListener('resize', () => {
    if (S.view === 'lesson' && root.PE_LESSON) root.PE_LESSON.onResize();
  });

  /* boot */
  U.load();
  root.PE_APP = { render, goLesson };
  render();
})(typeof window !== 'undefined' ? window : globalThis);
