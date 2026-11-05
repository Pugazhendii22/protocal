/* ============================================================
   tour-view.js — the front door: syllabus, order, progress
   ============================================================ */
(function (root) {
  'use strict';
  const U = root.PE_UI;
  const { S, esc, ICON, byId } = U;

  function render() {
    const o = U.overall();
    const next = U.LESSONS.find((l) => !U.isDone(l)) || U.LESSONS[0];
    const nextTrack = U.trackOf[next.track];

    let h = '';

    // hero
    h += '<div style="position:relative;border:1px solid var(--line);border-radius:16px;overflow:hidden;padding:26px 26px 22px;margin-bottom:20px;' +
      'background:radial-gradient(700px 300px at 88% -30%,rgba(91,141,239,.22),transparent 65%),radial-gradient(600px 320px at 12% 120%,rgba(192,132,252,.14),transparent 60%),linear-gradient(180deg,#0e1728,#0a111d)">';
    h += '<div style="display:flex;gap:26px;flex-wrap:wrap;align-items:flex-start">';
    h += '<div style="flex:1;min-width:300px">' +
      '<div class="chip" style="color:var(--accent);border-color:rgba(91,141,239,.4);background:rgba(91,141,239,.12)">Guided course · ' + U.TRACKS.length + ' tracks · ' + U.LESSONS.length + ' lessons</div>' +
      '<h1 style="font-size:33px;letter-spacing:-.03em;margin:12px 0 8px;max-width:22ch">Learn the internet by watching it work.</h1>' +
      '<p style="color:var(--text2);font-size:15px;max-width:62ch">Every lesson is a scenario you can step through: real headers, real checksums, real devices. Start at lesson 1 with no prior knowledge and finish able to read a packet capture, diagnose a broken page, and explain what the padlock means.</p>' +
      '<div style="display:flex;gap:9px;flex-wrap:wrap;margin-top:17px">' +
      '<button class="btn primary" data-act="openLesson" data-id="' + next.id + '">' + (o.done ? 'Continue: ' + esc(next.title) : 'Start lesson 1: ' + esc(U.LESSONS[0].title)) + ' ' + ICON.next.replace('<svg', '<svg width="13" height="13"') + '</button>' +
      '<button class="btn" data-act="view" data-v="lab">Open the device lab</button>' +
      '<button class="btn ghost" data-act="view" data-v="cheatsheet">Cheat sheet</button>' +
      '</div>' +
      '<div style="display:flex;gap:18px;margin-top:18px;flex-wrap:wrap;font-size:11.5px;color:var(--muted)">' +
      ['real IPv4 / TCP / UDP / ICMPv6 checksums', root.PE_DATA.PROTOCOLS.length + ' protocols', 'a shell on every device', 'further reading per lesson'].map((x) =>
        '<span style="display:flex;align-items:center;gap:6px"><span class="dot" style="color:var(--ok)"></span>' + esc(x) + '</span>').join('') +
      '</div></div>';

    h += '<div style="flex:0 0 250px;min-width:220px">' +
      '<div style="border:1px solid var(--line2);border-radius:13px;background:rgba(8,13,22,.6);padding:15px">' +
      '<div style="display:flex;align-items:center;gap:11px">' +
      '<div class="ring" style="--p:' + o.pct + ';width:52px;height:52px;font-size:11px"><span>' + o.pct + '%</span></div>' +
      '<div><div style="font-size:16px;font-weight:650">' + o.done + ' / ' + o.total + '</div>' +
      '<div style="font-size:11.5px;color:var(--muted)">lessons complete</div></div></div>' +
      '<div style="margin-top:13px;display:flex;flex-direction:column;gap:8px">' +
      U.TRACKS.map((t) => {
        const st = U.trackStats(t.id);
        return '<div><div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-bottom:3px"><span style="color:var(--text2)">' + t.n + '. ' + esc(t.title) + '</span><span class="mono">' + st.done + '/' + st.total + '</span></div>' +
          '<div class="trackbar" style="margin:0;height:4px"><i style="width:' + st.pct + '%;background:' + t.color + '"></i></div></div>';
      }).join('') +
      '</div></div></div>';
    h += '</div></div>';

    // how to use
    h += '<div class="panel" style="margin-bottom:20px"><div class="hd"><span>How a lesson works</span></div>' +
      '<div class="bd" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:14px">' +
      [['1', 'Read the step', 'A plain-language explanation, why it works that way, and an analogy. No jargon left undefined — terms are listed under each step.'],
        ['2', 'Watch the packets', 'The diagram animates the real exchange. Dots are packets; a red ✕ is a dropped one.'],
        ['3', 'Open the bytes', 'Click any packet, then any field, to see the exact bytes it occupies. Checksums are computed, not faked.'],
        ['4', 'Step into a device', 'Every box in the diagram opens: interfaces, routes, ARP cache, services, and a shell with working commands.']]
        .map(([n, t, d]) => '<div><div style="font-family:var(--mono);font-size:11px;color:var(--accent);margin-bottom:3px">STEP ' + n + '</div>' +
          '<div style="font-size:13.5px;font-weight:600;margin-bottom:3px">' + esc(t) + '</div>' +
          '<div style="font-size:12.5px;color:var(--muted);line-height:1.55">' + esc(d) + '</div></div>').join('') +
      '</div></div>';

    // syllabus
    h += '<div class="sectionhead"><div><h2>The syllabus</h2><p>Each track builds on the one before it. Lesson 1 assumes you know nothing.</p></div></div>';

    U.TRACKS.forEach((t) => {
      const ls = U.LESSONS.filter((l) => l.track === t.id);
      const st = U.trackStats(t.id);
      h += '<div class="panel" style="margin-bottom:14px"><div class="hd" style="gap:11px">' +
        '<span class="dot" style="color:' + t.color + '"></span>' +
        '<span style="color:var(--text);font-size:12.5px">Track ' + t.n + ' · ' + esc(t.title) + '</span>' +
        '<span class="chip" style="text-transform:none;letter-spacing:0">' + esc(t.tag) + '</span>' +
        '<span class="spacer"></span><span class="mono" style="text-transform:none;letter-spacing:0">' + st.done + '/' + st.total + '</span></div>' +
        '<div class="bd"><p style="font-size:13px;color:var(--text2);margin-bottom:12px;max-width:80ch">' + esc(t.blurb) + '</p>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:9px">' +
        ls.map((l) => {
          const done = U.isDone(l);
          const idx = U.LESSONS.indexOf(l) + 1;
          return '<button class="pcard" style="padding:11px 12px" data-act="openLesson" data-id="' + l.id + '">' +
            '<div style="display:flex;gap:8px;align-items:center;margin-bottom:5px">' +
            '<span class="num" style="width:20px;height:20px;border-radius:6px;display:grid;place-items:center;font-family:var(--mono);font-size:10px;background:' +
            (done ? 'rgba(52,211,153,.16);color:var(--ok)' : 'var(--panel3);color:var(--muted)') + '">' + (done ? '✓' : U.pad(idx)) + '</span>' +
            '<span style="flex:1"></span><span class="mono" style="font-size:9.5px;color:var(--dim)">' + l.steps.length + ' steps · ' + l.minutes + ' min</span></div>' +
            '<div style="font-size:13.5px;font-weight:600;letter-spacing:-.01em">' + esc(l.title) + '</div>' +
            '<div style="font-size:12px;color:var(--muted);margin-top:3px;line-height:1.45">' + esc(l.subtitle) + '</div></button>';
        }).join('') +
        '</div></div></div>';
    });

    // free explore row
    h += '<div class="sectionhead" style="margin-top:22px"><div><h2>Or explore freely</h2><p>The same material, without the rails.</p></div></div>' +
      '<div class="cards">' +
      [['lab', 'Device lab', 'Open any device in four networks and inspect it like a real box — with a working shell.', 'grid'],
        ['library', 'Protocol library', root.PE_DATA.PROTOCOLS.length + ' protocols: what goes on the wire, the RFC, and the one gotcha for each.', 'book'],
        ['sources', 'Sources & further reading', 'The books, repositories and RFCs behind the course — with what each is actually for.', 'book'],
        ['glossary', 'Glossary', 'Every term from every lesson, in one searchable place.', 'list'],
        ['cheatsheet', 'Ports & cheat sheet', 'Ports, the layer model, symptom → cause, and the ten commands worth knowing.', 'terminal']]
        .map(([v, t, d, ic]) => '<button class="pcard" data-act="view" data-v="' + v + '">' +
          '<div class="top"><span class="ab" style="background:var(--panel3);color:var(--text2);width:26px;height:26px;display:grid;place-items:center;padding:0">' + (ICON[ic] || '') + '</span>' +
          '<h4>' + esc(t) + '</h4></div><div class="sm">' + esc(d) + '</div></button>').join('') +
      '</div>';

    return h;
  }

  root.PE_TOUR = { render };
})(typeof window !== 'undefined' ? window : globalThis);
