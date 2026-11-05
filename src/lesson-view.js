/* ============================================================
   lesson-view.js — guided lesson: explainer, canvas, pcap, inspector
   ============================================================ */
(function (root) {
  'use strict';
  const U = root.PE_UI;
  const E = root.PE_ENGINE;
  const { S, esc, ICON, fmtB, pad, byId, trackOf } = U;

  const cache = {};
  const LS = { open: {}, hl: null, sel: null, timers: [], playToken: 0 };

  function session(lesson) {
    if (!cache[lesson.id]) cache[lesson.id] = E.buildSession(lesson);
    return cache[lesson.id];
  }

  function stepPackets(sess, stepIdx) {
    return sess.packets.filter((p) => p.step === stepIdx);
  }
  function visiblePackets(sess, stepIdx) {
    return S.peek ? sess.packets : sess.packets.filter((p) => p.step <= stepIdx);
  }

  /* ---------------- canvas ---------------- */
  function canvasHTML(sess, lesson, stepIdx) {
    const active = new Set();
    stepPackets(sess, stepIdx).forEach((p) => { active.add(p.src); active.add(p.dst); });
    if (!stepPackets(sess, stepIdx).length && lesson.steps[stepIdx].focus) {
      lesson.steps[stepIdx].focus.forEach((f) => active.add(f));
    }
    const focus = new Set(lesson.steps[stepIdx].focus || []);
    active.forEach((a) => focus.add(a));

    const nodes = sess.topo.devices.map((d) => {
      const cls = 'node' + (focus.has(d.id) ? ' focus' : '') + (focus.size && !focus.has(d.id) ? ' dim' : '');
      const cx = Math.max(7, Math.min(93, d.x));
      const cy = Math.max(10, Math.min(84, d.y));
      return '<div class="' + cls + '" data-dev="' + d.id + '" style="left:' + cx + '%;top:' + cy + '%" title="Open ' + esc(d.label) + '">' +
        '<div class="bx">' + (ICON[d.kind] || ICON.server) + '</div>' +
        '<div class="nm">' + esc(d.label) + '</div>' +
        '<div class="ip">' + esc(d.ip || '—') + '</div></div>';
    }).join('');

    return '<div class="canvas" id="cv">' +
      '<svg id="cvsvg" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none"></svg>' +
      '<div id="cvpk" style="position:absolute;inset:0;pointer-events:none"></div>' +
      nodes +
      '<div class="legend">' + legendFor(sess).join('') + '</div>' +
      '<div class="hint">click a device to inspect it · ← → to step, space to auto-play</div>' +
      '</div>';
  }

  function legendFor(sess) {
    const seen = new Map();
    sess.packets.forEach((p) => seen.set(p.proto, p.protoColor));
    return Array.from(seen.entries()).slice(0, 5).map(([p, c]) =>
      '<span><i class="dot" style="color:' + c + '"></i>' + esc(p) + '</span>');
  }

  function drawLinks(sess) {
    const cv = document.getElementById('cv');
    const svg = document.getElementById('cvsvg');
    if (!cv || !svg) return { pos: {} };
    const r = cv.getBoundingClientRect();
    const pos = {};
    sess.topo.devices.forEach((d) => { pos[d.id] = { x: (d.x / 100) * r.width, y: (d.y / 100) * r.height }; });
    const lines = (sess.topo.links || []).map(([a, b]) => {
      if (!pos[a] || !pos[b]) return '';
      return '<line x1="' + pos[a].x + '" y1="' + pos[a].y + '" x2="' + pos[b].x + '" y2="' + pos[b].y + '" class="link"/>';
    }).join('');
    svg.setAttribute('viewBox', '0 0 ' + r.width + ' ' + r.height);
    svg.innerHTML = lines;
    return { pos, w: r.width, h: r.height };
  }

  function clearTimers() {
    LS.timers.forEach((t) => clearTimeout(t));
    LS.timers = [];
  }

  function moveDot(from, to, color, duration, dropped) {
    const layer = document.getElementById('cvpk');
    if (!layer) return;
    const dot = document.createElement('div');
    dot.style.cssText = 'position:absolute;width:11px;height:11px;border-radius:50%;left:0;top:0;background:' + color +
      ';box-shadow:0 0 12px 2px ' + color + '99;transition:none;z-index:9';
    dot.style.transform = 'translate(' + (from.x - 5.5) + 'px,' + (from.y - 5.5) + 'px)';
    layer.appendChild(dot);
    const t0 = performance.now();
    function frame(now) {
      const k = Math.min(1, (now - t0) / duration);
      const ease = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const x = from.x + (to.x - from.x) * ease;
      const y = from.y + (to.y - from.y) * ease;
      dot.style.transform = 'translate(' + (x - 5.5) + 'px,' + (y - 5.5) + 'px)';
      if (dropped && k > 0.55) dot.style.opacity = String(Math.max(0, 1 - (k - 0.55) / 0.35));
      if (k < 1) requestAnimationFrame(frame);
      else {
        if (dropped) {
          dot.textContent = '✕';
          dot.style.cssText += ';width:auto;height:auto;background:none;box-shadow:none;color:#f87171;font-size:13px;font-weight:700';
        } else {
          dot.style.transition = 'opacity .35s';
          dot.style.opacity = '0';
        }
        setTimeout(() => dot.remove(), 420);
      }
    }
    requestAnimationFrame(frame);
  }

  function flashNodes(p) {
    [p.src, p.dst].forEach((id) => {
      const n = document.querySelector('.node[data-dev="' + id + '"]');
      if (!n) return;
      n.classList.add('active');
      setTimeout(() => n.classList.remove('active'), 900);
    });
  }

  function animateStep(sess, stepIdx, cb) {
    clearTimers();
    const geo = drawLinks(sess);
    const pkts = stepPackets(sess, stepIdx);
    const dur = 780 / S.speed;
    let i = 0;
    function next() {
      if (i >= pkts.length) { if (cb) cb(); return; }
      const p = pkts[i];
      const from = geo.pos[p.src];
      const to = geo.pos[p.dst];
      if (from && to) moveDot(from, to, p.protoColor, dur, p.dropped);
      flashNodes(p);
      i += 1;
      LS.timers.push(setTimeout(next, dur + 120 / S.speed));
    }
    next();
  }

  /* ---------------- hex + inspector ---------------- */
  function hexHTML(p, hl, perLine) {
    const lines = E.hexDump(p.hex, perLine || 16);
    return lines.map((l) => {
      const start = l.off;
      const hexBytes = l.hex.split(' ');
      const hx = hexBytes.map((b, i) => {
        const inHL = hl && start + i >= hl.off && start + i < hl.off + hl.len;
        return inHL ? '<b>' + b + '</b>' : b;
      }).join(' ');
      const ascii = l.asc.split('').map((c, i) => {
        const inHL = hl && start + i >= hl.off && start + i < hl.off + hl.len;
        return inHL ? '<b>' + (c === '·' ? '·' : esc(c)) + '</b>' : (c === '·' ? '·' : esc(c));
      }).join('');
      return '<div class="hexline"><span class="of">' + pad(start, 4) + '</span><span class="hb">' + hx + '</span><span class="as">' + ascii + '</span></div>';
    }).join('');
  }

  function decodeText(p, lesson) {
    const bits = [];
    bits.push('<b>' + esc(p.srcLabel) + '</b> (' + esc(p.srcIp) + ') → <b>' + esc(p.dstLabel) + '</b> (' + esc(p.dstIp) + ').');
    const ipL = p.layers.find((l) => /Internet Protocol/.test(l.name));
    const nm = p.layers.find((l) => /Transmission|User Datagram|Control Message|Address Resolution|Domain Name|Dynamic Host|Layer Security|Hypertext|Simple Mail|Internet Message|File Transfer|Post Office|Border|Secure Shell/.test(l.name));
    if (nm) bits.push('The payload is <b>' + esc(nm.name) + '</b>, ' + nm.bytes.length + ' bytes.');
    if (ipL) bits.push('TTL ' + (ipL.fields.find((f) => /Time to Live/.test(f.name)) || {}).value + ' means it can cross ' + (ipL.fields.find((f) => /Time to Live/.test(f.name)) || {}).value + ' more hops before it is dropped.');
    if (p.sport != null) bits.push('Port ' + p.sport + ' → ' + p.dport + ' selects the service at the far end.');
    bits.push('On the wire this frame is <b>' + fmtB(p.frameLen) + '</b> including the 4-byte FCS.');
    if (p.dropped) bits.push('<span style="color:var(--bad)">This packet never arrives: ' + esc(p.note || 'it was dropped') + '.</span>');
    else if (p.note) bits.push('<span style="color:var(--warn)">' + esc(p.note) + '</span>');
    return bits.join(' ');
  }

  function inspectorHTML(p) {
    if (!p) return '<div class="empty">No packet selected yet. Step through the lesson and click a row in the packet list.</div>';
    const layers = p.layers.map((l, i) => {
      const open = LS.open[i] !== false;
      const rows = l.fields.map((f) =>
        '<div class="frow" data-act="field" data-off="' + f.off + '" data-len="' + f.len + '">' +
        '<span class="fn">' + esc(f.name) + '</span><span class="fv">' + esc(f.value) + '</span>' +
        '<span class="fo">' + f.off + '</span></div>').join('');
      return '<div class="layer' + (open ? ' open' : '') + '">' +
        '<div class="lh" data-act="layer" data-i="' + i + '"><span class="caret">▶</span>' +
        '<span class="nm">' + esc(l.name) + '</span><span class="ln">' + l.bytes.length + ' B</span></div>' +
        '<div class="fl">' + rows + '</div></div>';
    }).join('');

    const hlNote = LS.hl ? '<div class="decode" style="background:rgba(91,141,239,.07);border-color:#2b4470">Highlighting <b>' +
      esc((p.fields.find((f) => f.off === LS.hl.off && f.name) || {}).name || 'bytes') + '</b> at offset ' + LS.hl.off + ' (' + LS.hl.len + ' bytes).</div>' : '';

    return '<div class="insp-head"><span class="tagp" style="color:' + p.protoColor + ';border-color:' + p.protoColor + '55;background:' + p.protoColor + '18">' + esc(p.proto) + '</span>' +
      '<span class="pt">Packet ' + p.no + '</span><span class="chip mono">' + fmtB(p.frameLen) + ' on wire</span>' +
      '<span class="spacer"></span><span class="mono" style="font-size:11px;color:var(--dim)">' + esc(String(p.t)) + 's</span></div>' +
      '<div class="insp"><div class="col scroll" style="max-height:460px">' + layers +
      '<div class="decode">' + decodeText(p) + '</div>' + hlNote + '</div>' +
      '<div class="col scroll"><div class="hexw" id="hexel">' + hexHTML(p, LS.hl) + '</div>' +
      '<div style="margin-top:8px;font-size:11px;color:var(--dim)">Click any field on the left to highlight its bytes. Offset is in bytes from the start of the frame.</div></div></div>';
  }

  /* ---------------- pcap table ---------------- */
  function pcapHTML(sess, lesson) {
    const vis = visiblePackets(sess, S.step);
    if (!vis.length) {
      return '<div class="empty">No packets yet. This step is about what a device knows before anything is sent.</div>';
    }
    const rows = sess.packets.map((p) => {
      const future = !vis.includes(p);
      const sel = S.sel === p.no - 1;
      return '<tr class="' + (sel ? 'sel ' : '') + (future ? 'future ' : '') + (p.dropped ? 'dropped' : '') + '" data-act="packet" data-i="' + (p.no - 1) + '">' +
        '<td class="no">' + p.no + '</td>' +
        '<td class="mono">' + p.t.toFixed(3) + '</td>' +
        '<td class="mono">' + esc(p.srcIp) + '</td>' +
        '<td class="mono">' + esc(p.dstIp) + '</td>' +
        '<td><span class="tagp" style="color:' + p.protoColor + ';border-color:' + p.protoColor + '55;background:' + p.protoColor + '14">' + esc(p.proto) + '</span></td>' +
        '<td><span class="info">' + esc(p.summary) + '</span></td>' +
        '<td class="mono" style="text-align:right">' + fmtB(p.bytes) + '</td></tr>';
    }).join('');
    return '<div class="pcaplist scroll"><table class="pcap">' +
      '<colgroup><col class="c-no"><col class="c-t"><col class="c-s"><col class="c-d"><col class="c-p"><col><col class="c-z"></colgroup>' +
      '<thead><tr>' +
      '<th>No.</th><th>Time</th><th>Source</th><th>Destination</th><th>Proto</th><th>Info</th><th style="text-align:right">Size</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  /* ---------------- explainer ---------------- */
  function explainHTML(lesson, stepIdx) {
    const st = lesson.steps[stepIdx];
    const total = lesson.steps.length;
    let h = '<div class="explain">';
    h += '<div class="eyebrow"><span>Step ' + (stepIdx + 1) + ' of ' + total + '</span><span>' + esc(lesson.steps[stepIdx].sub ? '' : '') + '</span></div>';
    h += '<h3>' + esc(st.title) + '</h3><div class="sub">' + esc(st.sub || '') + '</div>';
    if (st.what) h += '<div class="qa"><div class="k" style="--kc:var(--accent)">What is happening</div><p>' + esc(st.what) + '</p></div>';
    if (st.why) h += '<div class="qa why"><div class="k">Why it works this way</div><p>' + esc(st.why) + '</p></div>';
    if (st.analogy) h += '<div class="qa analogy"><div class="k">Analogy</div><p>' + esc(st.analogy) + '</p></div>';
    if (st.card) h += dataCard(st.card);
    if (st.terms && st.terms.length) {
      h += '<div class="terms"><div class="k" style="font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--dim);font-weight:700">Terms</div>' +
        st.terms.map((t) => '<div class="term"><b>' + esc(t.t) + '</b> — <span>' + esc(t.d) + '</span></div>').join('') + '</div>';
    }
    if (lesson.refs && lesson.refs.length) {
      h += '<div class="terms"><div class="k" style="font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--dim);font-weight:700">Further reading</div>' +
        lesson.refs.map((r) => '<div class="term" style="font-size:12.5px">' +
          '<a href="' + r.u + '" target="_blank" rel="noopener noreferrer" style="color:var(--accent);font-weight:600">' + esc(r.t) + ' ↗</a>' +
          (r.note ? ' <span style="color:var(--muted)">— ' + esc(r.note) + '</span>' : '') + '</div>').join('') +
        '</div>';
    }
    if (!st.packets || !st.packets.length) {
      h += '<div class="emptynote">Nothing is transmitted in this step. Understanding what a device <em>knows</em> before it talks is half of networking — some failures are decided before a single packet exists.</div>';
    }
    h += '<div class="navrow">' +
      '<button class="btn" data-act="step" data-i="' + (stepIdx - 1) + '"' + (stepIdx === 0 ? ' disabled' : '') + '>' + ICON.prev.replace('<svg', '<svg width="13" height="13"') + ' Back</button>' +
      '<button class="btn primary" data-act="step" data-i="' + (stepIdx + 1) + '"' + (stepIdx === total - 1 ? ' disabled' : '') + '>Next ' + ICON.next.replace('<svg', '<svg width="13" height="13"') + '</button></div>';
    h += '</div>';
    return h;
  }

  function dataCard(card) {
    if (!card) return '';
    let h = '<div class="datacard"><div class="hd"><span>' + esc(card.title) + '</span>' +
      (card.right ? '<span class="mono" style="color:var(--muted)">' + esc(card.right) + '</span>' : '') + '</div><table>';
    if (card.cols) h += '<thead><tr>' + card.cols.map((c) => '<th>' + esc(c) + '</th>').join('') + '</tr></thead>';
    h += '<tbody>' + card.rows.map((r) => '<tr>' + r.map((c) => '<td>' + esc(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table>';
    if (card.note) h += '<div class="nt">' + esc(card.note) + '</div>';
    h += '</div>';
    return h;
  }

  /* ---------------- quiz ---------------- */
  function quizHTML(lesson) {
    if (!lesson.quiz || !lesson.quiz.length) return '';
    const answers = S.quiz[lesson.id] || {};
    let h = '<div class="panel"><div class="hd"><span>Check yourself</span><span class="spacer"></span>' +
      '<span class="mono" style="text-transform:none;letter-spacing:0;color:var(--muted);font-size:10.5px">' +
      Object.keys(answers).length + '/' + lesson.quiz.length + ' answered</span></div><div class="bd quiz">';
    lesson.quiz.forEach((q, qi) => {
      const picked = answers[qi];
      h += '<div class="q">' + (lesson.quiz.length > 1 ? (qi + 1) + '. ' : '') + esc(q.q) + '</div>';
      q.opts.forEach((o, oi) => {
        const isRight = oi === q.a;
        let cls = 'opt';
        if (picked !== undefined) {
          if (isRight) cls += ' right';
          else if (picked === oi) cls += ' wrong';
        }
        h += '<button class="' + cls + '" data-act="quiz" data-q="' + qi + '" data-o="' + oi + '"' + (picked !== undefined ? ' disabled' : '') + '>' +
          '<span class="b">' + String.fromCharCode(65 + oi) + '</span><span>' + esc(o) + '</span></button>';
      });
      if (picked !== undefined) h += '<div class="why">' + esc(q.why) + '</div>';
      h += '<div style="height:12px"></div>';
    });
    h += '</div></div>';
    return h;
  }

  /* ---------------- main render ---------------- */
  function render() {
    const lesson = byId[S.lessonId];
    const sess = session(lesson);
    const t = trackOf[lesson.track];
    const stepIdx = Math.min(S.step, lesson.steps.length - 1);
    const step = lesson.steps[stepIdx];

    if (S.sel === null) {
      const vis = stepPackets(sess, stepIdx);
      if (vis.length) S.sel = vis[vis.length - 1].no - 1;
    }
    const selPacket = sess.packets[S.sel] || null;

    const pips = lesson.steps.map((s, i) =>
      '<button class="pip' + (i === stepIdx ? ' active' : '') + (i < stepIdx ? ' done' : '') + '" data-act="step" data-i="' + i + '">' +
      '<b>' + (i < stepIdx ? '✓' : i + 1) + '</b><span>' + esc(s.title) + '</span></button>').join('');

    const nextLesson = U.LESSONS[U.LESSONS.indexOf(lesson) + 1];
    const atEnd = stepIdx === lesson.steps.length - 1;
    const prog = U.isDone(lesson);

    let h = '';
    h += '<div class="lesson-head"><div style="flex:1;min-width:280px">' +
      '<div style="display:flex;gap:7px;align-items:center;margin-bottom:7px">' +
      '<span class="chip" style="color:' + t.color + ';border-color:' + t.color + '55;background:' + t.color + '14">Track ' + t.n + ' · ' + esc(t.title) + '</span>' +
      '<span class="chip mono">' + (lesson.level <= 2 ? 'beginner' : lesson.level === 3 ? 'intermediate' : 'advanced') + '</span>' +
      '<span class="chip mono">~' + lesson.minutes + ' min</span>' +
      (prog ? '<span class="chip" style="color:var(--ok);border-color:rgba(52,211,153,.4);background:rgba(52,211,153,.1)">completed</span>' : '') +
      '</div>' +
      '<div class="t1">' + esc(lesson.title) + '</div>' +
      '<div class="t2">' + esc(lesson.subtitle) + '</div>' +
      '<div class="goals">' + lesson.goals.map((g) => '<span class="goal">' + esc(g) + '</span>').join('') + '</div>' +
      '</div></div>';

    h += '<div class="pips">' + pips + '</div>';

    h += '<div class="lesson-grid">';
    h += '<div>' + explainHTML(lesson, stepIdx) + '</div>';
    h += '<div class="stack">';

    // canvas panel
    h += '<div class="panel"><div class="hd"><span>Network</span>' +
      '<span class="chip mono" style="text-transform:none;letter-spacing:0">' + esc(sess.topo.label) + '</span>' +
      '<span class="spacer"></span><button class="btn sm ghost" data-act="view" data-v="lab">Open device lab ↗</button></div>' +
      '<div class="canvaswrap">' + canvasHTML(sess, lesson, stepIdx) + '</div>' +
      '<div class="playbar">' +
      '<button class="icobtn" data-act="step" data-i="' + (stepIdx - 1) + '"' + (stepIdx === 0 ? ' disabled' : '') + ' title="Previous step">' + ICON.prev + '</button>' +
      '<button class="btn" data-act="replay" title="Replay this step">' + ICON.reset.replace('<svg', '<svg width="13" height="13"') + ' Replay</button>' +
      '<button class="btn ' + (S.playing ? 'on' : 'primary') + '" data-act="play">' + (S.playing ? ICON.pause : ICON.play).replace('<svg', '<svg width="12" height="12"') + (S.playing ? ' Pause' : ' Auto-play') + '</button>' +
      '<button class="icobtn" data-act="step" data-i="' + (stepIdx + 1) + '"' + (atEnd ? ' disabled' : '') + ' title="Next step">' + ICON.next + '</button>' +
      '<span class="spacer"></span>' +
      '<span class="mono" style="font-size:10.5px;color:var(--dim)">' + (stepPackets(sess, stepIdx).length) + ' pkt in this step</span>' +
      '<div class="speed">' + [0.5, 1, 2].map((v) => '<button data-act="speed" data-v="' + v + '" class="' + (S.speed === v ? 'on' : '') + '">' + v + '×</button>').join('') + '</div>' +
      '</div></div>';

    // pcap panel
    h += '<div class="panel"><div class="hd"><span>Packet flow</span>' +
      '<span class="mono" style="text-transform:none;letter-spacing:0;color:var(--muted)">' + visiblePackets(sess, S.step).length + ' of ' + sess.packets.length + '</span>' +
      '<span class="spacer"></span>' +
      '<button class="btn sm ' + (S.peek ? 'on' : 'ghost') + '" data-act="peek">' + (S.peek ? 'Showing all' : 'Peek ahead') + '</button></div>' +
      pcapHTML(sess, lesson) + '</div>';

    // inspector
    h += '<div class="panel"><div class="hd"><span>Packet inspector</span><span class="spacer"></span>' +
      '<span class="mono" style="text-transform:none;letter-spacing:0;color:var(--dim)">real headers · real checksums</span></div>' +
      '<div id="insp">' + inspectorHTML(selPacket) + '</div></div>';

    // quiz + completion
    if (atEnd || S.peek) h += quizHTML(lesson);

    h += '<div class="panel"><div class="bd"><div class="lessondone">' +
      '<div class="ring" style="--p:' + U.lessonProgress(lesson) + '"><span>' + U.lessonProgress(lesson) + '%</span></div>' +
      '<div style="flex:1"><div style="font-size:13px;font-weight:600">' + (prog ? 'Lesson complete' : atEnd ? 'You reached the last step' : 'In progress') + '</div>' +
      '<div style="font-size:12px;color:var(--muted)">' + (atEnd ? 'Mark it done, or keep poking at the packets — nothing here is read-only.' : 'Keep going. Each step adds one idea.') + '</div></div>' +
      '<button class="btn ' + (prog ? '' : 'primary') + '" data-act="complete">' + (prog ? 'Mark as unread' : 'Mark lesson complete') + '</button>' +
      (nextLesson ? '<button class="btn primary" data-act="openLesson" data-id="' + nextLesson.id + '">Next: ' + esc(nextLesson.title) + ' ' + ICON.next.replace('<svg', '<svg width="13" height="13"') + '</button>' : '') +
      '</div></div></div>';

    h += '</div></div>';
    return h;
  }

  function afterRender() {
    const lesson = byId[S.lessonId];
    const sess = session(lesson);
    const stepIdx = Math.min(S.step, lesson.steps.length - 1);
    LS.hl = null;
    requestAnimationFrame(() => {
      drawLinks(sess);
      fitHex();
      animateStep(sess, stepIdx, () => {
        if (S.playing) {
          const tok = ++LS.playToken;
          LS.timers.push(setTimeout(() => {
            if (tok !== LS.playToken || !S.playing) return;
            if (stepIdx < lesson.steps.length - 1) {
              S.step = stepIdx + 1;
              S.sel = null;
              root.PE_APP.render();
            } else {
              S.playing = false;
              root.PE_APP.render();
            }
          }, 2600 / S.speed));
        }
      });
    });
  }

  /* the hex pane picks 8 or 16 bytes per line depending on the room it has,
     so nothing ever needs a horizontal scroll */
  function fitHex() {
    const el = document.getElementById('hexel');
    if (!el) return;
    const p = session(byId[S.lessonId]).packets[S.sel];
    if (!p) return;
    const w = (el.clientWidth || 340) - 6;
    const per = Math.max(6, Math.min(16, Math.floor((w - 54) / 26.5)));
    el.innerHTML = hexHTML(p, LS.hl, per);
    el.scrollLeft = 0;
  }

  function refreshInspector() {
    const sess = session(byId[S.lessonId]);
    const p = sess.packets[S.sel] || null;
    const el = document.getElementById('insp');
    if (el) el.innerHTML = inspectorHTML(p);
    fitHex();
  }

  root.PE_LESSON = {
    render, afterRender, refreshInspector, session, LS,
    animate(sess, stepIdx) { animateStep(sess, stepIdx); },
    fitHex,
    onResize() {
      const sess = session(byId[S.lessonId]);
      if (document.getElementById('cv')) drawLinks(sess);
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
