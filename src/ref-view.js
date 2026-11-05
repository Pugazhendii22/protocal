/* ============================================================
   ref-view.js — protocol library, glossary, cheat sheet
   ============================================================ */
(function (root) {
  'use strict';
  const U = root.PE_UI;
  const { S, esc, byId } = U;
  const D = root.PE_DATA;

  const LAYER_NAMES = { 1: 'Physical', 2: 'Data link', 3: 'Network', 4: 'Transport', 5: 'Session', 6: 'Presentation', 7: 'Application' };

  function protoColor(p) {
    return root.PE_ENGINE.PROTO_COLORS[p.abbr] || root.PE_ENGINE.PROTO_COLORS[p.name] || '#5b8def';
  }

  function library() {
    const sel = S.lib ? D.PROTOCOLS.find((p) => p.id === S.lib) : null;
    let h = '<div class="sectionhead"><div><h2>Protocol library</h2>' +
      '<p>Seventeen protocols, what each one actually puts on the wire, and the one gotcha that trips people up.</p></div>' +
      '<div class="searchbox">' + U.ICON.search + '<input id="libsearch" placeholder="Filter protocols…" value="' + esc(S.search) + '" /></div></div>';

    const q = S.search.trim().toLowerCase();
    const list = D.PROTOCOLS.filter((p) => !q || (p.name + p.abbr + p.summary + p.rfc).toLowerCase().includes(q));

    h += '<div class="cards">' + list.map((p) => {
      const c = protoColor(p);
      return '<button class="pcard" data-act="proto" data-id="' + p.id + '"' + (sel && sel.id === p.id ? ' style="border-color:' + c + '88"' : '') + '>' +
        '<div class="top"><span class="ab" style="background:' + c + '">' + esc(p.abbr) + '</span>' +
        '<span class="chip mono" style="font-size:10px">L' + p.layer + '</span>' +
        '<span class="spacer" style="flex:1"></span><span class="mono" style="font-size:10px;color:var(--dim)">' + esc(p.port) + '</span></div>' +
        '<h4>' + esc(p.name) + '</h4>' +
        '<div class="sm">' + esc(p.summary) + '</div>' +
        '<div class="ft"><span>' + esc(p.transport) + '</span><span>' + esc(p.rfc) + '</span><span>' + p.lessons.length + ' lesson' + (p.lessons.length === 1 ? '' : 's') + '</span></div>' +
        '</button>';
    }).join('') + '</div>';

    if (!list.length) h += '<div class="empty">Nothing matches that filter.</div>';

    if (sel) {
      const c = protoColor(sel);
      h += '<div class="panel" style="margin-top:16px"><div class="hd"><span style="color:' + c + '">' + esc(sel.name) + '</span>' +
        '<span class="chip mono" style="text-transform:none;letter-spacing:0">' + esc(sel.rfc) + '</span>' +
        '<span class="spacer"></span><button class="btn sm ghost" data-act="proto" data-id="">Close</button></div>' +
        '<div class="bd" style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:18px">' +
        '<div><p style="font-size:13.5px;color:var(--text2)">' + esc(sel.summary) + '</p>' +
        '<div class="decode" style="margin-top:12px"><b>Gotcha:</b> ' + esc(sel.gotcha) + '</div>' +
        '<div style="display:flex;gap:7px;flex-wrap:wrap;margin-top:13px">' +
        sel.lessons.map((id) => byId[id] ? '<button class="btn sm primary" data-act="openLesson" data-id="' + id + '">' + esc(byId[id].title) + ' →</button>' : '').join('') +
        '</div></div>' +
        '<div><div style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--dim);font-weight:650;margin-bottom:7px">What is on the wire</div>' +
        '<div class="datacard"><table><tbody>' + sel.fields.map((f) => '<tr><td style="font-family:var(--mono);font-size:11.5px">' + esc(f) + '</td></tr>').join('') + '</tbody></table>' +
        '<div class="nt">Layer ' + sel.layer + ' · ' + (LAYER_NAMES[Math.round(sel.layer)] || '') + ' · ports ' + esc(sel.port) + '</div></div>' +
        '</div></div></div>';
    }
    return h;
  }

  function glossary() {
    const all = [];
    U.LESSONS.forEach((l) => l.steps.forEach((s) => (s.terms || []).forEach((t) => {
      if (!all.find((x) => x.t.toLowerCase() === t.t.toLowerCase())) all.push({ t: t.t, d: t.d, from: l });
    })));
    D.GLOSSARY_EXTRA.forEach((t) => { if (!all.find((x) => x.t.toLowerCase() === t.t.toLowerCase())) all.push(t); });
    all.sort((a, b) => a.t.localeCompare(b.t));

    const q = S.search.trim().toLowerCase();
    const list = all.filter((x) => !q || (x.t + x.d).toLowerCase().includes(q));

    let h = '<div class="sectionhead"><div><h2>Glossary</h2>' +
      '<p>' + all.length + ' terms, every one defined in the context of a lesson — not a dictionary dump.</p></div>' +
      '<div class="searchbox">' + U.ICON.search + '<input id="glsearch" placeholder="Search terms…" value="' + esc(S.search) + '" /></div></div>';
    h += '<div class="cards" style="grid-template-columns:repeat(auto-fill,minmax(300px,1fr))">' +
      list.map((x) => '<div class="gl"><b>' + esc(x.t) + '</b><p>' + esc(x.d) + '</p>' +
        (x.from ? '<button class="btn sm ghost" style="margin-top:7px;padding:2px 7px;font-size:10.5px" data-act="openLesson" data-id="' + x.from.id + '">in: ' + esc(x.from.title) + '</button>' : '') +
        '</div>').join('') + '</div>';
    if (!list.length) h += '<div class="empty">No term matches that.</div>';
    return h;
  }

  const PORTS = [
    [20, 'TCP', 'FTP data', 'ftp'],
    [21, 'TCP', 'FTP control', 'ftp'],
    [22, 'TCP', 'SSH / SFTP', 'ssh'],
    [23, 'TCP', 'Telnet (never use)', null],
    [25, 'TCP', 'SMTP server to server', 'smtp'],
    [53, 'UDP/TCP', 'DNS', 'dns'],
    [67, 'UDP', 'DHCP server', 'dhcp'],
    [68, 'UDP', 'DHCP client', 'dhcp'],
    [80, 'TCP', 'HTTP', 'http'],
    [110, 'TCP', 'POP3', 'pop3'],
    [123, 'UDP', 'NTP time sync', null],
    [143, 'TCP', 'IMAP', 'imap'],
    [161, 'UDP', 'SNMP', null],
    [179, 'TCP', 'BGP', 'bgp'],
    [389, 'TCP', 'LDAP', null],
    [443, 'TCP/UDP', 'HTTPS · QUIC', 'tls'],
    [465, 'TCP', 'SMTP over TLS', 'smtp'],
    [587, 'TCP', 'SMTP submission', 'smtp'],
    [636, 'TCP', 'LDAPS', null],
    [993, 'TCP', 'IMAP over TLS', 'imap'],
    [995, 'TCP', 'POP3 over TLS', 'pop3'],
    [3306, 'TCP', 'MySQL', null],
    [5432, 'TCP', 'PostgreSQL', null],
    [6379, 'TCP', 'Redis', null],
    [8080, 'TCP', 'HTTP alternate', null],
  ];

  function cheatsheet() {
    let h = '<div class="sectionhead"><div><h2>Ports & cheat sheet</h2>' +
      '<p>The numbers worth memorising, the layer model, and the diagnostic table you will actually use.</p></div></div>';

    h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px;align-items:start">';

    h += '<div class="panel"><div class="hd"><span>Well-known ports</span></div><div class="bd" style="padding:0">' +
      '<table class="grid"><thead><tr><th>Port</th><th>Transport</th><th>Service</th></tr></thead><tbody>' +
      PORTS.map(([p, tr, svc, lid]) => '<tr><td class="hi">' + p + '</td><td>' + tr + '</td><td>' +
        (lid && byId[lid] ? '<button style="color:var(--accent);font-family:var(--mono);font-size:11px" data-act="openLesson" data-id="' + lid + '">' + esc(svc) + ' →</button>' : esc(svc)) +
        '</td></tr>').join('') + '</tbody></table></div></div>';

    h += '<div style="display:flex;flex-direction:column;gap:16px;min-width:0">';

    h += '<div class="panel"><div class="hd"><span>The layer model, with what it means</span></div><div class="bd" style="padding:0">' +
      '<table class="grid"><thead><tr><th>Layer</th><th>Job</th><th>Address</th><th>Examples</th></tr></thead><tbody>' +
      [['7 Application', 'the conversation', 'name', 'HTTP, DNS, SMTP, SSH'],
        ['6 Presentation', 'encoding, encryption', '—', 'TLS'],
        ['5 Session', 'who is talking to whom', 'socket', 'TLS handshake'],
        ['4 Transport', 'which program, reliability', 'port', 'TCP, UDP, QUIC'],
        ['3 Network', 'where, across networks', 'IP address', 'IPv4, ICMP, BGP'],
        ['2 Data link', 'who, on this wire', 'MAC address', 'Ethernet, ARP'],
        ['1 Physical', 'the actual signal', '—', 'copper, fibre, radio']]
        .map((r) => '<tr><td class="hi" style="font-family:var(--sans);font-size:11.5px">' + r[0] + '</td><td style="font-family:var(--sans);font-size:11.5px">' + r[1] + '</td><td>' + r[2] + '</td><td style="font-family:var(--sans);font-size:11.5px">' + r[3] + '</td></tr>').join('') +
      '</tbody></table><div class="nt">The 7-layer model is a teaching tool. In practice: link, network, transport, application.</div></div></div>';

    h += '<div class="panel"><div class="hd"><span>Symptom → where to look</span></div><div class="bd" style="padding:0">' +
      '<table class="grid"><thead><tr><th>Symptom</th><th>Check first</th></tr></thead><tbody>' +
      [['169.254.x.x address', 'DHCP failed — cable/Wi-Fi, or the DHCP server'],
        ['ping by IP works, by name fails', 'DNS resolver, UDP 53 blocked'],
        ['ping by IP fails too', 'link, ARP, gateway, routing'],
        ['SYN with no reply', 'firewall / security group / filtered'],
        ['SYN answered with RST', 'host up, no listener on that port'],
        ['Certificate warning', 'name mismatch, expiry, untrusted CA'],
        ['TLS ok but 502/504', 'the application or its upstream'],
        ['Slow, not broken', 'latency, packet loss, window size'],
        ['Works on mobile data, not Wi-Fi', 'the local network, DNS or NAT']]
        .map((r) => '<tr><td class="hi" style="font-family:var(--sans);font-size:11.5px">' + esc(r[0]) + '</td><td style="font-family:var(--sans);font-size:11.5px">' + esc(r[1]) + '</td></tr>').join('') +
      '</tbody></table></div></div>';

    h += '<div class="panel"><div class="hd"><span>Commands worth knowing</span></div><div class="bd">' +
      '<div class="cli" style="border:0"><div class="out" style="height:auto;max-height:none;padding:4px 0">' +
      [['ping 8.8.8.8', 'is there a path at all'],
        ['ping www.example.com', 'do names resolve'],
        ['traceroute 203.0.113.10', 'which hop drops it'],
        ['dig www.example.com', 'raw DNS answer, no cache'],
        ['curl -v https://example.com', 'the whole stack in one command'],
        ['ip addr / ip route', 'my addresses and my gateway'],
        ['arp -a', 'who is on my link'],
        ['ss -tulpn', 'what am I listening on'],
        ['tcpdump -ni any port 443', 'the truth'],
        ['openssl s_client -connect h:443', 'the certificate chain, verbatim']]
        .map(([c, w]) => '<div><span class="cmdline">$ ' + esc(c) + '</span>   <span class="mut"># ' + esc(w) + '</span></div>').join('') +
      '</div></div></div></div>';

    h += '</div></div>';
    return h;
  }

  root.PE_REF = { library, glossary, cheatsheet };
})(typeof window !== 'undefined' ? window : globalThis);
