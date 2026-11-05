/* ============================================================
   lesson-view.js — guided lesson: explainer, canvas, pcap, inspector
   ============================================================ */
(function (root) {
  'use strict';
  const U = root.PE_UI;
  const E = root.PE_ENGINE;
  const SX = root.PE_SIMPLE || { lines: (t) => '<p>' + t + '</p>', wordHelp: () => '' };
  const { S, esc, ICON, fmtB, pad, byId, trackOf } = U;

  const cache = {};

  /* ---------- node layout: nudge overlapping boxes apart, once per topology ----------
     Positions are authored in %, but the canvas is much wider than it is tall, so we
     solve the layout in pixel-ish units (x weighted by W/H) and convert back. */
  const layouts = {};
  const ASPECT = 2.6;
  function layoutFor(topo) {
    if (layouts[topo.id]) return layouts[topo.id];
    const pads = topo.devices.map((d) => ({
      id: d.id,
      x: Math.max(11, Math.min(86, d.x)),
      y: Math.max(12, Math.min(78, d.y)),
    }));
    const MINX = 17, MINY = 17;
    for (let iter = 0; iter < 260; iter++) {
      for (let i = 0; i < pads.length; i++) {
        for (let j = i + 1; j < pads.length; j++) {
          const a = pads[i], b = pads[j];
          let dx = (b.x - a.x) * ASPECT;
          let dy = b.y - a.y;
          const adx = Math.abs(dx) || 0.001;
          const ady = Math.abs(dy) || 0.001;
          // minimum gap in weighted units
          const needX = MINX, needY = MINY;
          if (adx < needX && ady < needY) {
            const pushX = (needX - adx) / 2;
            const pushY = (needY - ady) / 2;
            const sx = dx >= 0 ? 1 : -1;
            const sy = dy >= 0 ? 1 : -1;
            a.x -= (pushX / ASPECT) * sx; b.x += (pushX / ASPECT) * sx;
            a.y -= pushY * sy; b.y += pushY * sy;
          }
        }
      }
      pads.forEach((p) => {
        p.x = Math.max(11, Math.min(86, p.x));
        p.y = Math.max(12, Math.min(78, p.y));
      });
    }
    const out = {};
    pads.forEach((p) => { out[p.id] = { x: p.x, y: p.y }; });
    layouts[topo.id] = out;
    return out;
  }
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

    const lay = layoutFor(sess.topo);
    const nodes = sess.topo.devices.map((d) => {
      const cls = 'node' + (focus.has(d.id) ? ' focus' : '') + (focus.size && !focus.has(d.id) ? ' dim' : '');
      const p = lay[d.id] || { x: d.x, y: d.y };
      return '<div class="' + cls + '" data-dev="' + d.id + '" style="left:' + p.x.toFixed(2) + '%;top:' + p.y.toFixed(2) + '%" title="Open ' + esc(d.label) + '">' +
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

  /* ---- topology graph + real routing between devices ---- */
  const graphs = {};
  function graphOf(topo) {
    if (graphs[topo.id]) return graphs[topo.id];
    const adj = {};
    topo.devices.forEach((d) => { adj[d.id] = []; });
    (topo.links || []).forEach(([a, b]) => {
      if (!adj[a] || !adj[b]) return;
      adj[a].push(b);
      adj[b].push(a);
    });
    graphs[topo.id] = adj;
    return adj;
  }

  /* shortest path over the drawn links — a packet never teleports across the diagram */
  function routeFor(topo, a, b) {
    if (!a || !b) return [];
    if (a === b) return [a];
    const adj = graphOf(topo);
    if (!adj[a] || !adj[b]) return [];
    const prev = {};
    const seen = { [a]: true };
    const q = [a];
    while (q.length) {
      const cur = q.shift();
      if (cur === b) break;
      (adj[cur] || []).forEach((n) => {
        if (seen[n]) return;
        seen[n] = true;
        prev[n] = cur;
        q.push(n);
      });
    }
    if (!seen[b]) return [];
    const out = [b];
    let cur = b;
    while (cur !== a) { cur = prev[cur]; out.unshift(cur); }
    return out;
  }

  /* px-space relaxation, run against the measured canvas so it works at any width */
  const pxCache = {};
  function layoutPx(topo, w, h) {
    const key = topo.id + ':' + Math.round(w) + 'x' + Math.round(h);
    if (pxCache[key]) return pxCache[key];
    // phones get a slightly smaller footprint so the whole map still fits across
    const narrow = w < 520;
    const MX = narrow ? 106 : 116, MY = narrow ? 82 : 62;   // node footprint incl. label, in px
    const pts = topo.devices.map((d) => ({
      id: d.id,
      x: (Math.max(11, Math.min(86, d.x)) / 100) * w,
      y: (Math.max(12, Math.min(78, d.y)) / 100) * h,
    }));
    const clamp = () => pts.forEach((p) => {
      p.x = Math.max(MX / 2 + 6, Math.min(w - MX / 2 - 6, p.x));
      p.y = Math.max(MY / 2 + 4, Math.min(h - MY / 2 - 4, p.y));
    });
    clamp();
    for (let it = 0; it < 220; it++) {
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const a = pts[i], b = pts[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const ox = MX - Math.abs(dx), oy = MY - Math.abs(dy);
          if (ox > 0 && oy > 0) {
            if (ox < oy) { const s = (dx >= 0 ? 1 : -1) * ox / 2; a.x -= s; b.x += s; }
            else { const s = (dy >= 0 ? 1 : -1) * oy / 2; a.y -= s; b.y += s; }
          }
        }
      }
      clamp();
    }
    // if the solver squeezed everything into part of the canvas, centre it
    const ys = pts.map((p) => p.y);
    const top = Math.min(...ys), bot = Math.max(...ys);
    const slack = (h - (bot - top)) / 2 - top;
    if (slack > 18) pts.forEach((p) => { p.y = Math.min(h - MY / 2 - 4, Math.max(MY / 2 + 4, p.y + Math.min(slack, 60))); });

    const out = {};
    pts.forEach((p) => { out[p.id] = p; });
    pxCache[key] = out;
    return out;
  }

  function applyNodePositions(topo, pos) {
    const cv = document.getElementById('cv');
    if (!cv) return;
    cv.querySelectorAll('.node[data-dev]').forEach((n) => {
      const p = pos[n.getAttribute('data-dev')];
      if (!p) return;
      n.style.left = p.x + 'px';
      n.style.top = p.y + 'px';
    });
  }

  function drawLinks(sess) {
    const cv = document.getElementById('cv');
    const svg = document.getElementById('cvsvg');
    if (!cv || !svg) return { pos: {} };
    const r = cv.getBoundingClientRect();
    const pos = layoutPx(sess.topo, r.width, r.height);
    applyNodePositions(sess.topo, pos);
    const links = (sess.topo.links || []).filter(([a, b]) => pos[a] && pos[b]);
    // gentle curve so crossing links are easy to tell apart, plus a white casing
    const pathFor = (a, b, k) => {
      const A = pos[a], B = pos[b];
      const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
      const dx = B.x - A.x, dy = B.y - A.y;
      const len = Math.max(1, Math.hypot(dx, dy));
      const bend = (k || 0) * Math.min(26, len * 0.12);
      const cx = mx - (dy / len) * bend, cy = my + (dx / len) * bend;
      return { d: 'M' + A.x.toFixed(1) + ',' + A.y.toFixed(1) + ' Q' + cx.toFixed(1) + ',' + cy.toFixed(1) + ' ' + B.x.toFixed(1) + ',' + B.y.toFixed(1), cx, cy };
    };
    let casing = '', lines = '';
    links.forEach(([a, b], i) => {
      const { d } = pathFor(a, b, i % 2 ? 1 : -1);
      casing += '<path d="' + d + '" class="link-case"/>';
      lines += '<path d="' + d + '" class="link"/>';
    });
    svg.setAttribute('viewBox', '0 0 ' + r.width + ' ' + r.height);
    svg.innerHTML =
      '<defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">' +
      '<path d="M0 0 L10 5 L0 10 z" fill="currentColor"/></marker></defs>' +
      '<g class="links">' + casing + lines + '</g><g id="cvroute"></g><g id="cvhops"></g>';
    return { pos, w: r.width, h: r.height };
  }

  function clearTimers() {
    LS.timers.forEach((t) => clearTimeout(t));
    LS.timers = [];
  }

  function openCache() { return {}; }

  /* ---------- one packet: hop, hop, hop along the real route ---------- */
  function moveAlong(geo, route, color, segDur, dropped, label) {
    const layer = document.getElementById('cvpk');
    if (!layer || route.length < 2) return 0;
    if (!isFinite(segDur) || segDur <= 0) segDur = 200;
    const pts = route.map((id) => geo.pos[id]).filter(Boolean);
    if (pts.length < 2) return 0;

    // highlight the route under the packet so the path itself is visible
    const g = document.getElementById('cvroute');
    if (g) {
      g.innerHTML = pts.slice(0, -1).map((p, i) => {
        const q = pts[i + 1];
        return '<line x1="' + p.x.toFixed(1) + '" y1="' + p.y.toFixed(1) + '" x2="' + q.x.toFixed(1) +
          '" y2="' + q.y.toFixed(1) + '" class="link hot"/>';
      }).join('');
    }

    const dot = document.createElement('div');
    dot.className = 'pktdot';
    dot.style.background = color;
    dot.style.boxShadow = '0 0 0 3px ' + color + '33, 0 0 16px 3px ' + color + '77';
    dot.style.transform = 'translate(' + (pts[0].x - 7) + 'px,' + (pts[0].y - 7) + 'px)';
    layer.appendChild(dot);

    const tag = document.createElement('div');
    tag.className = 'pkttag';
    tag.style.color = color;
    tag.style.borderColor = color + '55';
    tag.textContent = label || 'packet';
    layer.appendChild(tag);

    // keep the little protocol tag inside the picture: flip it left near the
    // right edge and slide it down near the top edge
    const canW = layer.clientWidth || 640;
    const canH = layer.clientHeight || 424;
    function placeTag(x, y) {
      const tw = tag.offsetWidth || 64;
      const th = tag.offsetHeight || 20;
      let tx = x + 12;
      if (tx + tw > canW - 4) tx = x - 12 - tw;
      if (tx < 4) tx = 4;
      let ty = y - 30;
      if (ty < 4) ty = y + 14;
      if (ty + th > canH - 4) ty = canH - 4 - th;
      tag.style.transform = 'translate(' + tx + 'px,' + ty + 'px)';
    }
    placeTag(pts[0].x, pts[0].y);

    // dropped packets stop two-thirds of the way along, wherever that is
    const total = pts.length - 1;
    const stopAt = dropped ? Math.max(0.35, Math.min(0.66, (total - 0.34) / total)) : 1;

    let seg = 0;
    let segStart = performance.now();
    function frame(now) {
      if (!dot.isConnected) return;
      const progressed = Math.min(1, Math.max(0, (now - segStart) / segDur));
      const overall = Math.min(stopAt, Math.max(0, (seg + progressed) / total));
      const t = overall * total;
      const i = Math.max(0, Math.min(total - 1, Math.floor(t)));
      const k = Math.max(0, Math.min(1, t - i));
      const a = pts[i] || pts[0];
      const b = pts[i + 1] || a;
      const ease = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const x = a.x + (b.x - a.x) * ease;
      const y = a.y + (b.y - a.y) * ease;
      dot.style.transform = 'translate(' + (x - 7) + 'px,' + (y - 7) + 'px)';
      if (tag && tag.isConnected) placeTag(x, y);
      if (dropped && overall >= stopAt - 0.001) {
        dot.classList.add('dead');
        dot.textContent = '✕';
        if (tag) { tag.textContent = 'dropped'; tag.classList.add('dead'); setTimeout(() => tag.remove(), 900); }
        setTimeout(() => dot.remove(), 900);
        return;
      }
      if (now - segStart >= segDur) {
        seg += 1;
        segStart = now;
        if (seg >= total * stopAt) {
          dot.classList.add('gone');
          if (tag) { tag.classList.add('gone'); setTimeout(() => tag.remove(), 400); }
          setTimeout(() => dot.remove(), 400);
          return;
        }
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    return segDur * total * stopAt;
  }

  function pulseNodes(route) {
    route.forEach((id, i) => {
      const n = document.querySelector('.node[data-dev="' + id + '"]');
      if (!n) return;
      const delay = i * 10;
      setTimeout(() => {
        n.classList.add(i === route.length - 1 ? 'arrive' : 'through');
        setTimeout(() => n.classList.remove('arrive', 'through'), 620);
      }, delay);
    });
  }

  function flashNodes(p) {
    [p.src, p.dst].forEach((id) => {
      const n = document.querySelector('.node[data-dev="' + id + '"]');
      if (!n) return;
      n.classList.add('active');
      setTimeout(() => n.classList.remove('active'), 900);
    });
  }

  /* draw the route of the current step permanently, so a beginner can read the path */
  function pathBetweenPts(A, B, k) {
    const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
    const dx = B.x - A.x, dy = B.y - A.y;
    const len = Math.max(1, Math.hypot(dx, dy));
    const bend = (k || 0) * Math.min(26, len * 0.12);
    const cx = mx - (dy / len) * bend, cy = my + (dx / len) * bend;
    return 'M' + A.x.toFixed(1) + ',' + A.y.toFixed(1) + ' Q' + cx.toFixed(1) + ',' + cy.toFixed(1) + ' ' + B.x.toFixed(1) + ',' + B.y.toFixed(1);
  }

  /* numbered badges on the route of the current step: 1 → 2 → 3 */
  function paintHops(pos, route, color) {
    const g = document.getElementById('cvhops');
    if (!g) return;
    if (route.length < 2) { g.innerHTML = ''; return; }
    g.innerHTML = route.map((id, i) => {
      const p = pos[id];
      if (!p) return '';
      const last = i === route.length - 1;
      return '<g class="hopnum" opacity="' + (last ? '.95' : '.8') + '">' +
        '<circle cx="' + (p.x + 26).toFixed(1) + '" cy="' + (p.y - 26).toFixed(1) + '" r="9" fill="' + color + '" opacity=".92"/>' +
        '<text x="' + (p.x + 26).toFixed(1) + '" y="' + (p.y - 22.5).toFixed(1) + '" text-anchor="middle" font-size="10" font-weight="700" fill="#fff">' + (i + 1) + '</text>' +
        '</g>';
    }).join('');
  }

  function paintRoutes(sess, stepIdx) {
    const g = document.getElementById('cvroute');
    if (!g) return;
    const cv = document.getElementById('cv');
    if (!cv) return;
    const r = cv.getBoundingClientRect();
    const pos = layoutPx(sess.topo, r.width, r.height);
    let out = '';
    const pkts = stepPackets(sess, stepIdx);
    const last = pkts[pkts.length - 1];
    pkts.forEach((p) => {
      const route = routeFor(sess.topo, p.src, p.dst);
      if (route.length < 2) return;
      const dim = last && p !== last;
      out += route.slice(0, -1).map((id, i) => {
        const a = pos[id], b = pos[route[i + 1]];
        if (!a || !b) return '';
        return '<path d="' + pathBetweenPts(a, b, i % 2 ? 1 : -1) + '" class="link path" stroke="' + p.protoColor +
          '" stroke-opacity="' + (dim ? '.28' : '.62') + '" marker-end="url(#arrow)" style="color:' + p.protoColor + '"/>';
      }).join('');
    });
    g.innerHTML = out;
    const g2 = document.getElementById('cvhops');
    if (g2) g2.innerHTML = '';
  }

  /* when the canvas is wider than its box (phones), keep the action in frame */
  function centerCanvas(sess, stepIdx) {
    const wrap = document.querySelector('.canvaswrap');
    const cv = document.getElementById('cv');
    if (!wrap || !cv) return;
    if (wrap.scrollWidth <= wrap.clientWidth + 4) return;
    const r = cv.getBoundingClientRect();
    const pos = layoutPx(sess.topo, cv.clientWidth, cv.clientHeight);
    const pkts = stepPackets(sess, stepIdx);
    let ids = [];
    if (pkts.length) {
      const p = pkts[0];
      ids = routeFor(sess.topo, p.src, p.dst);
    }
    if (!ids.length) ids = sess.topo.devices.slice(0, 3).map((d) => d.id);
    const xs = ids.map((id) => (pos[id] || {}).x).filter((x) => typeof x === 'number');
    if (!xs.length) return;
    const mid = (Math.min.apply(null, xs) + Math.max.apply(null, xs)) / 2;
    const target = Math.max(0, mid - wrap.clientWidth / 2);
    if (Math.abs(wrap.scrollLeft - target) > 24) {
      try { wrap.scrollTo({ left: target, behavior: 'smooth' }); } catch (e) { wrap.scrollLeft = target; }
    }
  }

  function animateStep(sess, stepIdx, cb) {
    clearTimers();
    const geo = drawLinks(sess);
    const pkts = stepPackets(sess, stepIdx);
    paintRoutes(sess, stepIdx);
    if (!pkts.length) { if (cb) cb(); return; }
    const whole = 1250 / S.speed;
    let i = 0;
    function next() {
      if (i >= pkts.length) { if (cb) cb(); return; }
      const p = pkts[i];
      const route = routeFor(sess.topo, p.src, p.dst);
      const hops = Math.max(1, route.length - 1);
      const segDur = Math.max(260 / S.speed, whole / hops);
      if (route.length >= 2) {
        const tagTxt = (p.proto || 'IP') + (hops > 1 ? ' · ' + hops + ' hops' : '');
        moveAlong(geo, route, p.protoColor, segDur, p.dropped, tagTxt);
        pulseNodes(route);
      }
      flashNodes(p);
      i += 1;
      LS.timers.push(setTimeout(next, segDur * hops + 160 / S.speed));
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
    if (ipL) {
      const ttlF = ipL.fields.find((f) => /Time to Live|Hop Limit/i.test(f.name));
      const ttlV = ttlF && ttlF.value != null && ttlF.value !== '' ? String(ttlF.value).split(' ')[0] : null;
      if (ttlV && /^\d+$/.test(ttlV)) {
        bits.push((/Hop Limit/i.test(ttlF.name) ? 'Hop Limit ' : 'TTL ') + ttlV +
          ' means it can cross ' + ttlV + ' more hops before it is dropped.');
      } else if (ttlF) {
        bits.push((/Hop Limit/i.test(ttlF.name) ? 'Hop Limit ' : 'TTL ') + 'caps how many hops this packet may take before a router drops it.');
      }
    }
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

  /* a plain-English line of the path the current step's packets take */
  function routeCrumb(sess, stepIdx) {
    const pkts = stepPackets(sess, stepIdx);
    if (!pkts.length) return '';
    const p = pkts[pkts.length - 1];
    const route = routeFor(sess.topo, p.src, p.dst);
    if (route.length < 2) {
      return '<span class="rc-lab">Route</span><span class="rc-hint">this packet leaves the drawn network</span>';
    }
    const names = route.map((id, i) => {
      const d = sess.topo.devices.find((x) => x.id === id) || { label: id };
      return '<span class="rc-step"><em>' + (i + 1) + '</em><b>' + esc(d.label) + '</b></span>';
    });
    return '<span class="rc-lab">The packet goes</span><span class="rc-path">' + names.join('<i>›</i>') + '</span>' +
      '<span class="rc-hint">' + (route.length - 1) + ' hop' + (route.length === 2 ? '' : 's') +
      (p.dropped ? ' · this one is dropped' : '') + '</span>';
  }

  /* ---------------- explainer ---------------- */
  function explainHTML(lesson, stepIdx) {
    const st = lesson.steps[stepIdx];
    const total = lesson.steps.length;
    let h = '<div class="explain">';
    h += '<div class="eyebrow"><span>Step ' + (stepIdx + 1) + ' of ' + total + '</span><span>' + esc(lesson.steps[stepIdx].sub ? '' : '') + '</span></div>';
    h += '<h3>' + esc(st.title) + '</h3><div class="sub">' + esc(st.sub || '') + '</div>';
    const easy = S.simple !== false;
    if (st.what) h += '<div class="qa"><div class="k" style="--kc:var(--accent)">What is happening</div>' +
      (easy ? SX.lines(st.what) : '<p>' + esc(st.what) + '</p>') + '</div>';
    if (st.why) h += '<div class="qa why"><div class="k">Why it works this way</div>' +
      (easy ? SX.lines(st.why) : '<p>' + esc(st.why) + '</p>') + '</div>';
    if (st.analogy) h += '<div class="qa analogy"><div class="k">Think of it like this</div><p>' + esc(SX.plainSwap(st.analogy)) + '</p></div>';
    if (easy) h += SX.wordHelp([st.what, st.why, st.sub, (st.terms || []).map((t) => t.t).join(' ')].join(' '));
    if (st.card) h += dataCard(st.card);
    if (st.terms && st.terms.length) {
      h += '<div class="terms"><div class="k" style="font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--dim);font-weight:700">Terms</div>' +
        st.terms.map((t) => {
          const easy = (root.PE_SIMPLE && S.simple !== false) ? SX.plainSwap(t.d) : t.d;
          return '<div class="term"><b>' + esc(t.t) + '</b> — <span>' + esc(easy) + '</span></div>';
        }).join('') + '</div>';
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
      if (picked !== undefined) h += '<div class="why">' + esc(S.simple !== false ? SX.plainSwap(q.why) : q.why) + '</div>';
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
      '<b>' + (i < stepIdx ? '✓' : i + 1) + '</b><span title="' + esc(s.title) + '">' + esc(s.title) + '</span></button>').join('');

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
    h += '<div class="col-explain">' + explainHTML(lesson, stepIdx) + '</div>';
    h += '<div class="col-net">';

    // canvas panel
    const crumb = routeCrumb(sess, stepIdx);
    h += '<div class="panel"><div class="hd"><span>Network</span>' +
      '<span class="chip mono" style="text-transform:none;letter-spacing:0">' + esc(sess.topo.label) + '</span>' +
      '<span class="spacer"></span><button class="btn sm ghost" data-act="view" data-v="lab">Open device lab ↗</button></div>' +
      (crumb ? '<div class="routecrumb">' + crumb + '</div>' : '') +
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

    h += '</div></div>';   // end lesson-grid

    h += '<div class="lesson-lower">';
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

    h += '</div>';        // end lesson-lower

    // quiz + completion
    if (atEnd || S.peek) h += quizHTML(lesson);

    h += '<div class="panel"><div class="bd"><div class="lessondone">' +
      '<div class="ring" style="--p:' + U.lessonProgress(lesson) + '"><span>' + U.lessonProgress(lesson) + '%</span></div>' +
      '<div style="flex:1"><div style="font-size:13px;font-weight:600">' + (prog ? 'Lesson complete' : atEnd ? 'You reached the last step' : 'In progress') + '</div>' +
      '<div style="font-size:12px;color:var(--muted)">' + (atEnd ? 'Mark it done, or keep poking at the packets — nothing here is read-only.' : 'Keep going. Each step adds one idea.') + '</div></div>' +
      '<button class="btn ' + (prog ? '' : 'primary') + '" data-act="complete">' + (prog ? 'Mark as unread' : 'Mark lesson complete') + '</button>' +
      (nextLesson ? '<button class="btn primary" data-act="openLesson" data-id="' + nextLesson.id + '">Next: ' + esc(nextLesson.title) + ' ' + ICON.next.replace('<svg', '<svg width="13" height="13"') + '</button>' : '') +
      '</div></div></div>';

    /* sticky footer: always shows where you are and what comes next */
    h += '<div class="lessonnav">' +
      '<span class="lbl">Step <b>' + (stepIdx + 1) + '</b> of ' + lesson.steps.length + ' · <b>' + esc(lesson.title) + '</b></span>' +
      '<div class="track"><i style="width:' + Math.round(((stepIdx + 1) / lesson.steps.length) * 100) + '%"></i></div>' +
      '<button class="btn sm" data-act="step" data-i="' + (stepIdx - 1) + '"' + (stepIdx === 0 ? ' disabled' : '') + '>‹ Back</button>' +
      (atEnd
        ? (nextLesson
            ? '<button class="btn sm primary" data-act="openLesson" data-id="' + nextLesson.id + '">Next lesson: ' + esc(nextLesson.title) + ' ›</button>'
            : '<button class="btn sm primary" data-act="complete">Finish the course ✓</button>')
        : '<button class="btn sm primary" data-act="step" data-i="' + (stepIdx + 1) + '">Next step ›</button>') +
      '</div>';

    return h;
  }

  function redraw() {
    const lesson = byId[S.lessonId];
    if (!lesson || S.view !== 'lesson') return;
    const sess = session(lesson);
    const stepIdx = Math.min(S.step, lesson.steps.length - 1);
    drawLinks(sess);
    paintRoutes(sess, stepIdx);
  }

  function afterRender() {
    const lesson = byId[S.lessonId];
    const sess = session(lesson);
    const stepIdx = Math.min(S.step, lesson.steps.length - 1);
    LS.hl = null;
    requestAnimationFrame(() => {
      drawLinks(sess);
      paintRoutes(sess, stepIdx);
      centerCanvas(sess, stepIdx);
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

  root.PE_LESSON = { redraw,
    render, afterRender, refreshInspector, session, LS,
    animate(sess, stepIdx) { animateStep(sess, stepIdx); },
    fitHex,
    onResize() {
      if (!document.getElementById('cv')) return;
      redraw();
      const sess = session(byId[S.lessonId]);
      centerCanvas(sess, Math.min(S.step, byId[S.lessonId].steps.length - 1));
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
