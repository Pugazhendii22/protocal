/* ============================================================
   tour-view.js — the front door: paths, progress, syllabus
   ============================================================ */
(function (root) {
  'use strict';
  const U = root.PE_UI;
  const { S, esc, ICON, byId } = U;

  const PATHS = [
    { id: 'start', title: 'I know nothing yet', sub: 'Start from zero and go in order. Nothing is assumed, and every hard word is explained.', from: 0, to: 8, icon: 'home' },
    { id: 'web', title: 'I want to know why a website opens', sub: 'The real steps: find the name, open a connection, make it private, then ask for the page.', from: 5, to: 12, icon: 'web' },
    { id: 'secure', title: 'I want to learn about safety', sub: 'Lock icons, certificates, safe logins, and how attackers get caught.', from: 9, to: 12, icon: 'ca' },
    { id: 'ops', title: 'I look after networks', sub: 'Office and cloud networks, containers, and how to find out what is broken.', from: 14, to: 36, icon: 'router' },
  ];

  function render() {
    const o = U.overall();
    const next = U.LESSONS.find((l) => !U.isDone(l)) || U.LESSONS[0];
    const nextTrack = U.trackOf[next.track];
    let h = '';

    /* ---------- hero ---------- */
    h += '<div style="border:1px solid var(--line);border-radius:20px;padding:34px 32px;margin-bottom:22px;box-shadow:var(--shadow);' +
      'background:radial-gradient(800px 320px at 88% -30%,#e6e9ff,transparent 62%),radial-gradient(600px 300px at 6% 130%,#e3f7f4,transparent 60%),#fff">' +
      '<div style="display:flex;gap:30px;flex-wrap:wrap;align-items:center">' +
      '<div style="flex:1;min-width:290px">' +
      '<div class="chip" style="color:var(--accent);border-color:#d5d7fb;background:var(--accent-soft)">Free · ' + U.TRACKS.length + ' tracks · ' + U.LESSONS.length + ' short lessons</div>' +
      '<h1 style="margin:14px 0 10px;max-width:24ch">Learn how the internet works — in easy words.</h1>' +
      '<p style="color:var(--text2);font-size:16px;max-width:58ch;line-height:1.65">You do not need any background. Each lesson shows you one small idea, then plays the real traffic on a diagram so you can watch it happen. You can also open any device and look inside it, like opening the bonnet of a car.</p>' +
      '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:14px;padding:10px 13px;border-radius:11px;background:#fff;border:1px solid var(--line);max-width:560px">' +
      '<b style="font-size:13px">Easy English:</b>' +
      '<button class="btn sm ' + (S.simple ? 'on' : '') + '" data-act="simple">' + (S.simple ? '✓ On — short lines + word help' : 'Off — original wording') + '</button>' +
      '<span style="font-size:12px;color:var(--muted)">Tap to switch. Hard words get a plain meaning.</span></div>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:20px">' +
      '<button class="btn primary lg" data-act="openLesson" data-id="' + next.id + '">' + (o.done ? 'Continue: ' + esc(next.title) : 'Start lesson 1') + ' ' + ICON.next.replace('<svg', '<svg width="14" height="14"') + '</button>' +
      '<button class="btn lg" data-act="view" data-v="lab">Look inside a device</button>' +
      '</div>' +
      '<div style="display:flex;gap:16px;margin-top:18px;flex-wrap:wrap;font-size:12.5px;color:var(--muted)">' +
      ['no signup', 'works offline', 'real headers and checksums', 'progress saved on this device'].map((x) =>
        '<span style="display:flex;align-items:center;gap:6px"><span class="dot" style="color:var(--ok)"></span>' + esc(x) + '</span>').join('') +
      '</div></div>';

    h += '<div style="flex:0 0 236px;min-width:210px">' +
      '<div style="border:1px solid var(--line);border-radius:16px;background:#fff;padding:18px;box-shadow:var(--shadow)">' +
      '<div style="display:flex;align-items:center;gap:12px">' +
      '<div class="ring" style="--p:' + o.pct + ';width:56px;height:56px;font-size:12px"><span>' + o.pct + '%</span></div>' +
      '<div><div style="font-size:19px;font-weight:750;letter-spacing:-.02em">' + o.done + ' / ' + o.total + '</div>' +
      '<div style="font-size:12px;color:var(--muted)">lessons finished</div></div></div>' +
      '<div style="margin-top:14px;display:flex;flex-direction:column;gap:9px">' +
      U.TRACKS.map((t) => {
        const st = U.trackStats(t.id);
        return '<div><div style="display:flex;justify-content:space-between;font-size:11.5px;color:var(--muted);margin-bottom:4px">' +
          '<span style="color:var(--text2)">' + t.n + '. ' + esc(t.title) + '</span><span class="mono">' + st.done + '/' + st.total + '</span></div>' +
          '<div class="trackbar" style="margin:0;height:5px"><i style="width:' + st.pct + '%;background:' + t.color + '"></i></div></div>';
      }).join('') +
      '</div></div></div>';
    h += '</div></div>';

    /* ---------- pick a path ---------- */
    h += '<div class="sectionhead" style="margin-top:26px"><div><h2>Where would you like to start?</h2>' +
      '<p>Four doors into the same course. You can always jump around afterwards.</p></div></div>' +
      '<div class="cards" style="grid-template-columns:repeat(auto-fit,minmax(250px,1fr))">';

    PATHS.forEach((p) => {
      const first = U.LESSONS[p.from] || next;
      const count = Math.min(p.to, U.LESSONS.length - 1) - p.from + 1;
      h += '<button class="pcard" data-act="openLesson" data-id="' + first.id + '" style="text-align:left">' +
        '<div class="top"><span class="ab" style="width:32px;height:32px;display:grid;place-items:center;background:var(--accent-soft);color:var(--accent);padding:0">' +
        (ICON[p.icon] || ICON.book) + '</span><h4>' + esc(p.title) + '</h4></div>' +
        '<div class="sm">' + esc(p.sub) + '</div>' +
        '<div style="display:flex;align-items:center;gap:7px;margin-top:13px;font-size:12px;color:var(--accent);font-weight:650">' +
        count + ' lessons · starts with “' + esc(first.title) + '” ' + ICON.next.replace('<svg', '<svg width="12" height="12"') + '</div></button>';
    });
    h += '</div>';

    /* ---------- how a lesson works ---------- */
    h += '<div class="panel" style="margin-top:22px"><div class="hd"><span>How a lesson works</span>' +
      '<span class="spacer"></span><span style="text-transform:none;letter-spacing:0;color:var(--muted);font-weight:500">four things, every time</span></div>' +
      '<div class="bd" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:18px">' +
      [['' + ICON.book, 'Read one small idea', 'A few short lines in easy words, why it happens that way, and something you already know that works the same way.'],
        [ICON.play, 'Watch the packet move', 'The label on the moving dot tells you what it is and how many stops it has. A red ✕ means it was dropped.'],
        [ICON.terminal, 'Open the bytes', 'Click a packet, then click a field. You will see exactly which bytes it uses. The maths is real, not fake.'],
        [ICON.grid, 'Open a device', 'Every box can be opened: its addresses, its routes, the doors it listens on, and a shell you can type into.']]
        .map(([ic, t, d], i) => '<div style="display:flex;gap:11px"><div style="flex:0 0 30px;height:30px;border-radius:9px;background:var(--accent-soft);color:var(--accent);display:grid;place-items:center;font-weight:700">' + (i + 1) + '</div>' +
          '<div><div style="font-size:14px;font-weight:650;margin-bottom:3px">' + esc(t) + '</div>' +
          '<div style="font-size:12.5px;color:var(--muted);line-height:1.55">' + esc(d) + '</div></div></div>').join('') +
      '</div></div>';

    /* ---------- syllabus ---------- */
    h += '<div class="sectionhead" style="margin-top:26px"><div><h2>All ' + U.LESSONS.length + ' lessons</h2>' +
      '<p>Grouped into ' + U.TRACKS.length + ' tracks. Each track assumes the one before it — but nothing here is locked.</p></div></div>';

    U.TRACKS.forEach((t) => {
      const ls = U.LESSONS.filter((l) => l.track === t.id);
      const st = U.trackStats(t.id);
      const firstUndone = ls.find((l) => !U.isDone(l)) || ls[0];
      h += '<div class="panel" style="margin-bottom:14px"><div class="hd" style="gap:11px;text-transform:none;letter-spacing:0">' +
        '<span style="width:26px;height:26px;border-radius:8px;display:grid;place-items:center;background:' + t.color + '1a;color:' + t.color + ';font-family:var(--mono);font-size:12px;font-weight:700">' + t.n + '</span>' +
        '<span style="color:var(--text);font-size:14.5px;font-weight:700">' + esc(t.title) + '</span>' +
        '<span class="chip" style="font-weight:600">' + esc(t.tag) + '</span>' +
        '<span class="spacer"></span>' +
        '<span class="mono" style="font-size:11.5px;color:var(--muted)">' + st.done + '/' + st.total + '</span>' +
        '<button class="btn sm" data-act="openLesson" data-id="' + firstUndone.id + '">' + (st.done ? 'Continue' : 'Start track') + '</button></div>' +
        '<div class="bd"><p style="font-size:13.5px;color:var(--muted);margin-bottom:14px;max-width:82ch;line-height:1.6">' + esc(t.blurb) + '</p>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:10px">' +
        ls.map((l) => {
          const done = U.isDone(l);
          const idx = U.LESSONS.indexOf(l) + 1;
          return '<button class="pcard" style="padding:13px 14px;box-shadow:none" data-act="openLesson" data-id="' + l.id + '">' +
            '<div style="display:flex;gap:9px;align-items:center;margin-bottom:6px">' +
            '<span style="width:22px;height:22px;border-radius:7px;display:grid;place-items:center;font-family:var(--mono);font-size:10.5px;font-weight:700;' +
            (done ? 'background:#e6f7f0;color:var(--ok)' : 'background:var(--panel3);color:var(--muted)') + '">' + (done ? '✓' : U.pad(idx)) + '</span>' +
            '<span style="flex:1"></span><span style="font-size:10.5px;color:var(--dim)">' + l.steps.length + ' steps · ' + l.minutes + ' min</span></div>' +
            '<div style="font-size:14px;font-weight:650;letter-spacing:-.01em">' + esc(l.title) + '</div>' +
            '<div style="font-size:12.5px;color:var(--muted);margin-top:4px;line-height:1.5">' + esc(l.subtitle) + '</div></button>';
        }).join('') +
        '</div></div></div>';
    });

    /* ---------- free explore ---------- */
    h += '<div class="sectionhead" style="margin-top:26px"><div><h2>Or wander off on your own</h2>' +
      '<p>The same material, without the rails.</p></div></div><div class="cards">' +
      [['lab', 'Look inside devices', 'Ten different networks. Open any box: addresses, routes, open doors, and a shell that really answers.'],
        ['library', 'Protocol guide', root.PE_DATA.PROTOCOLS.length + ' rules of the road: what each one puts on the wire, and the one mistake people make.'],
        ['exam', 'Practice test', 'A timed quiz made from all the lessons, with an explanation of everything you got wrong.'],
        ['timeline', 'History', (root.PE_DATA.TIMELINE || []).length + ' turning points, in the order they happened.'],
        ['glossary', 'Word list', 'Every word used in the course, explained simply, in one place.'],
        ['sources', 'Books & links', 'Where to read more, if you want to go deeper.']]
        .map(([v, t, d]) => '<button class="pcard" data-act="view" data-v="' + v + '">' +
          '<div style="font-size:15px;font-weight:700;letter-spacing:-.01em;margin-bottom:5px">' + esc(t) + '</div>' +
          '<div style="font-size:13px;color:var(--muted);line-height:1.55">' + esc(d) + '</div></button>').join('') +
      '</div>';

    return h;
  }

  root.PE_TOUR = { render };
})(typeof window !== 'undefined' ? window : globalThis);
