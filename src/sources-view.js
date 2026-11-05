/* ============================================================
   sources-view.js — books, repositories and captures behind the course
   ============================================================ */
(function (root) {
  'use strict';
  const U = root.PE_UI;
  const { S, esc } = U;

  const BOOKS = [
    {
      group: 'Start with these',
      items: [
        { t: 'Computer Networking: A Top-Down Approach', a: 'Kurose & Ross', tag: 'textbook · 8th ed.',
          why: 'The standard course text. Starts at the application layer and works down, which is why this course is ordered the same way. Free lecture videos are published by the authors.',
          u: 'https://gaia.cs.umass.edu/kurose_ross/lectures.php', level: 'beginner → advanced' },
        { t: 'Computer Networks: A Systems Approach', a: 'Peterson & Davie', tag: 'free · CC BY 4.0',
          why: 'Open-source textbook, updated continuously on GitHub. Strongest on design rationale — why protocols look the way they do — and on modern topics like SDN, overlays and congestion control.',
          u: 'https://book.systemsapproach.org/', level: 'intermediate → advanced', gh: 'https://github.com/SystemsApproach/book' },
        { t: 'High Performance Browser Networking', a: 'Ilya Grigorik', tag: 'free online',
          why: 'Everything this course says about latency, TCP, TLS and HTTP/2 is owed to this book. The best single source on why the web feels slow and what each protocol generation fixed.',
          u: 'https://hpbn.co/', level: 'intermediate' },
      ],
    },
    {
      group: 'Go deeper on the protocols',
      items: [
        { t: 'TCP/IP Illustrated, Volume 1: The Protocols', a: 'Stevens & Fall', tag: 'reference · 2nd ed.',
          why: 'The book that taught a generation to read captures. If you finish this course and want every field of every header explained by example, this is the next step.',
          u: 'https://www.informit.com/store/tcp-ip-illustrated-volume-1-the-protocols-9780321336316', level: 'advanced' },
        { t: 'Routing TCP/IP, Volumes I & II', a: 'Doyle & Carroll', tag: 'reference',
          why: 'The BGP lesson here is a sketch of chapter 9 of this book. Path selection, policy, filtering and convergence in real detail.',
          u: 'https://www.ciscopress.com/store/routing-tcp-ip-volume-i-9781587052026', level: 'advanced' },
        { t: 'Computer Networks', a: 'Tanenbaum & Wetherall', tag: 'textbook · 5th ed.',
          why: 'Broader than the internet: wireless, physical layers, and a more theoretical treatment of each layer.',
          u: 'https://www.pearson.com/store/p/computer-networks/P100000901551', level: 'intermediate' },
        { t: 'The TCP/IP Guide', a: 'Charles Kozierok', tag: 'free online reference',
          why: 'Encyclopaedic, well-illustrated field-by-field reference. Useful when you need the exact meaning of one flag.',
          u: 'http://www.tcpipguide.com/free/index.htm', level: 'reference' },
      ],
    },
    {
      group: 'The Systems Approach micro-books (free)',
      items: [
        { t: 'TCP Congestion Control: A Systems Approach', a: 'Peterson, Davie et al.', tag: 'free · GitHub',
          why: 'Read this straight after the performance lesson. Covers slow start, CUBIC, BBR and the queueing maths properly.',
          u: 'https://github.com/SystemsApproach/tcpcc', level: 'advanced' },
        { t: 'Network Security: A Systems Approach', a: 'Peterson, Davie et al.', tag: 'free · GitHub',
          why: 'The right follow-up to the middleboxes and observability lessons: firewalls, DDoS, middlebox design, trust boundaries.',
          u: 'https://github.com/SystemsApproach/security', level: 'advanced' },
        { t: 'Software-Defined Networks: A Systems Approach', a: 'Peterson, Davie et al.', tag: 'free · GitHub',
          why: 'How networks are programmed rather than configured: control planes, overlays, and why cloud networking looks nothing like a router CLI.',
          u: 'https://github.com/SystemsApproach/sdn', level: 'advanced' },
      ],
    },
    {
      group: 'Cloud, containers and operations',
      items: [
        { t: 'Kubernetes documentation: Services, Networking, DNS', a: 'CNCF / Kubernetes authors', tag: 'free · docs',
          why: 'The primary source for the k8s lesson. Read "Services, Load Balancing, and Networking" then "DNS for Services and Pods" — n dots and search domains finally make sense in context.',
          u: 'https://kubernetes.io/docs/concepts/services-networking/', level: 'intermediate → advanced' },
        { t: 'nftables wiki and netfilter documentation', a: 'Netfilter project', tag: 'free · reference',
          why: 'Hooks, chains and priorities are documented officially, and reading the hook diagram once will fix every "my rule has zero counters" bug you ever hit.',
          u: 'https://wiki.nftables.org/wiki-nftables/index.php/Main_Page', level: 'advanced' },
        { t: 'SPIFFE / SPIRE', a: 'CNCF', tag: 'free · spec + code',
          why: 'The identity standard behind mTLS in service meshes. The spec is short and answers why a certificate is a better identity than an IP address.',
          u: 'https://spiffe.io/', level: 'advanced' },
        { t: 'Cloud provider VPC docs (AWS as the reference)', a: 'AWS', tag: 'free · docs',
          why: 'Route tables, security groups versus NACLs, and flow logs. Vendor-specific names, universal concepts — the model transfers to GCP and Azure intact.',
          u: 'https://docs.aws.amazon.com/vpc/latest/userguide/what-is-amazon-vpc.html', level: 'beginner → advanced' },
        { t: 'BPF Performance Tools', a: 'Brendan Gregg', tag: 'book · eBPF',
          why: 'The follow-up to the observability lessons: how to answer "which process is dropping these packets?" on a real Linux host.',
          u: 'https://www.brendangregg.com/bpf-performance-tools-book.html', level: 'advanced' },
      ],
    },
    {
      group: 'Security, packets and performance',
      items: [
        { t: 'Practical Packet Analysis', a: 'Chris Sanders', tag: 'Wireshark',
          why: 'The book to read with a capture open beside this site. Teaches the workflow: what to look at, in what order, and when to stop.',
          u: 'https://nostarch.com/packetanalysis3', level: 'beginner → intermediate' },
        { t: 'Attacking Network Protocols', a: 'James Forshaw', tag: 'offensive',
          why: 'How to reason about a protocol as an attacker: framing, state machines, authentication gaps. Sharpens your reading of every lesson here.',
          u: 'https://nostarch.com/autopsi', level: 'advanced' },
        { t: 'Bulletproof SSL and TLS', a: 'Ivan Ristić', tag: 'TLS',
          why: 'The definitive practical TLS reference — certificate chains, revocation, and every misconfiguration you will ever meet.',
          u: 'https://www.feistyduck.com/books/bulletproof-ssl-and-tls/', level: 'intermediate → advanced' },
      ],
    },
  ];

  const REPOS = [
    { t: 'SystemsApproach/book', d: 'Source of Computer Networks: A Systems Approach (CC BY 4.0). Build it locally as HTML, EPUB or PDF.', u: 'https://github.com/SystemsApproach/book', tag: 'textbook source' },
    { t: 'SystemsApproach/7E', d: 'The working draft of the 7th edition — the most current open networking text available.', u: 'https://github.com/SystemsApproach/7E', tag: 'textbook source' },
    { t: 'SystemsApproach/tcpcc', d: 'TCP Congestion Control micro-book. The reference for the sawtooth, CUBIC and BBR.', u: 'https://github.com/SystemsApproach/tcpcc', tag: 'congestion control' },
    { t: 'SystemsApproach/security', d: 'Network Security micro-book: firewalls, middleboxes, DDoS defence, zero trust.', u: 'https://github.com/SystemsApproach/security', tag: 'security' },
    { t: 'SystemsApproach/sdn', d: 'Software-Defined Networks micro-book — control planes, overlays, programmable data planes.', u: 'https://github.com/SystemsApproach/sdn', tag: 'SDN' },
    { t: 'facyber/awesome-networking', d: 'Curated list of courses, books and tutorials, from CCNA through to packet analysis.', u: 'https://github.com/facyber/awesome-networking', tag: 'list' },
    { t: 'chrissanders/packets', d: 'A large collection of real capture files from teaching and incident work. Free to use.', u: 'https://github.com/chrissanders/packets', tag: 'pcaps' },
    { t: 'Wireshark sample captures (mirror)', d: 'The community mirror of the official Wireshark SampleCaptures wiki, browsable by protocol.', u: 'https://github.com/briliant-ben/PacketCaptures', tag: 'pcaps' },
    { t: 'PaloAltoNetworks/Unit42-Wireshark-tutorials', d: 'Capture sets built for teaching filters, host identification and object extraction.', u: 'https://github.com/PaloAltoNetworks/Unit42-Wireshark-tutorials', tag: 'pcaps + tutorials' },
    { t: 'amwalding/IPv6_Extension_Header_PCAPs', d: 'The rare stuff: real captures with hop-by-hop, routing, fragment and ESP extension headers.', u: 'https://github.com/amwalding/IPv6_Extension_Header_PCAPs', tag: 'IPv6 pcaps' },
    { t: 'qmonnet/awesome-ebpf', d: 'Curated eBPF projects, papers and tutorials — the map for the observability lesson.', u: 'https://github.com/qmonnet/awesome-ebpf', tag: 'eBPF' },
    { t: 'cilium/pwru', d: '"Packet, where are you?" — trace one packet through every kernel function and find the drop.', u: 'https://github.com/cilium/pwru', tag: 'eBPF tool' },
    { t: 'cilium/cilium', d: 'eBPF-based networking, security and observability — a real production data plane to read.', u: 'https://github.com/cilium/cilium', tag: 'eBPF tool' },
    { t: 'kubernetes/kubernetes', d: 'The kube-proxy and CoreDNS wiring lives in the tree. Search for iptables DNAT rules and the service CIDR constants.', u: 'https://github.com/kubernetes/kubernetes', tag: 'cloud' },
    { t: 'istio/istio', d: 'The reference service mesh: sidecar injection, SPIFFE identities, AuthorizationPolicy — the mesh lesson with real code.', u: 'https://github.com/istio/istio', tag: 'service mesh' },
    { t: 'spiffe/spire', d: 'A production implementation of workload identity: attestation, SVIDs, rotation.', u: 'https://github.com/spiffe/spire', tag: 'identity' },
    { t: 'the-tcpdump-group/tcpdump', d: 'Read the source for a printer (e.g. print-tcp.c) and every field of every header stops being abstract.', u: 'https://github.com/the-tcpdump-group/tcpdump', tag: 'tooling source' },
    { t: 'google/gopacket', d: 'A packet parsing library with clean, readable decoders — the fastest way to see how a real parser is structured.', u: 'https://github.com/google/gopacket', tag: 'tooling source' },
  ];

  const RFCS = [
    ['RFC 791', 'IPv4', 'https://datatracker.ietf.org/doc/html/rfc791'],
    ['RFC 793 / 9293', 'TCP', 'https://datatracker.ietf.org/doc/html/rfc9293'],
    ['RFC 768', 'UDP', 'https://datatracker.ietf.org/doc/html/rfc768'],
    ['RFC 8200', 'IPv6', 'https://datatracker.ietf.org/doc/html/rfc8200'],
    ['RFC 4861', 'Neighbor Discovery', 'https://datatracker.ietf.org/doc/html/rfc4861'],
    ['RFC 4862', 'SLAAC', 'https://datatracker.ietf.org/doc/html/rfc4862'],
    ['RFC 9110 / 9112', 'HTTP semantics and HTTP/1.1', 'https://datatracker.ietf.org/doc/html/rfc9110'],
    ['RFC 9113 / 9114', 'HTTP/2 and HTTP/3', 'https://datatracker.ietf.org/doc/html/rfc9113'],
    ['RFC 8446', 'TLS 1.3', 'https://datatracker.ietf.org/doc/html/rfc8446'],
    ['RFC 9000', 'QUIC', 'https://datatracker.ietf.org/doc/html/rfc9000'],
    ['RFC 7323', 'TCP window scaling and timestamps', 'https://datatracker.ietf.org/doc/html/rfc7323'],
    ['RFC 8305', 'Happy Eyeballs v2', 'https://datatracker.ietf.org/doc/html/rfc8305'],
    ['RFC 4271', 'BGP-4', 'https://datatracker.ietf.org/doc/html/rfc4271'],
    ['RFC 6888', 'Carrier-grade NAT requirements', 'https://datatracker.ietf.org/doc/html/rfc6888'],
    ['RFC 1035', 'DNS', 'https://datatracker.ietf.org/doc/html/rfc1035'],
    ['RFC 2131', 'DHCP', 'https://datatracker.ietf.org/doc/html/rfc2131'],
    ['RFC 2474', 'DSCP / differentiated services', 'https://datatracker.ietf.org/doc/html/rfc2474'],
    ['RFC 3550', 'RTP / RTCP', 'https://datatracker.ietf.org/doc/html/rfc3550'],
    ['RFC 8445', 'ICE (NAT traversal)', 'https://datatracker.ietf.org/doc/html/rfc8445'],
    ['RFC 7348', 'VXLAN', 'https://datatracker.ietf.org/doc/html/rfc7348'],
    ['RFC 4033-4035', 'DNSSEC', 'https://datatracker.ietf.org/doc/html/rfc4033'],
    ['RFC 8484', 'DNS over HTTPS', 'https://datatracker.ietf.org/doc/html/rfc8484'],
    ['RFC 5905', 'NTPv4', 'https://datatracker.ietf.org/doc/html/rfc5905'],
  ];

  function card(item) {
    return '<div class="gl" style="display:flex;flex-direction:column;gap:5px">' +
      '<div style="display:flex;gap:7px;align-items:baseline;flex-wrap:wrap"><b>' + esc(item.t) + '</b>' +
      (item.a ? '<span style="font-size:11.5px;color:var(--muted)">' + esc(item.a) + '</span>' : '') + '</div>' +
      (item.tag ? '<div><span class="chip" style="font-size:9.5px;padding:1px 7px">' + esc(item.tag) + '</span>' +
        (item.level ? '<span class="chip mono" style="font-size:9.5px;padding:1px 7px;margin-left:4px">' + esc(item.level) + '</span>' : '') + '</div>' : '') +
      '<p style="margin:0">' + esc(item.why || item.d) + '</p>' +
      '<div style="display:flex;gap:9px;flex-wrap:wrap;margin-top:2px">' +
      '<a href="' + item.u + '" target="_blank" rel="noopener noreferrer" style="color:var(--accent);font-size:11.5px;font-weight:600">' + esc(shortUrl(item.u)) + ' ↗</a>' +
      (item.gh ? '<a href="' + item.gh + '" target="_blank" rel="noopener noreferrer" style="color:var(--muted);font-size:11.5px">source ↗</a>' : '') +
      '</div></div>';
  }

  function shortUrl(u) {
    return String(u).replace(/^https?:\/\//, '').replace(/\/$/, '');
  }

  function lessonRefRows() {
    const all = U.LESSONS.filter((l) => l.refs && l.refs.length);
    if (!all.length) return '';
    return '<div class="panel" style="margin-top:16px"><div class="hd"><span>Where each lesson points</span>' +
      '<span class="spacer"></span><span class="mono" style="text-transform:none;letter-spacing:0">' + all.length + ' lessons with sources</span></div>' +
      '<div class="bd" style="padding:0"><table class="grid"><thead><tr><th>Lesson</th><th>Read next</th></tr></thead><tbody>' +
      all.map((l) => '<tr><td class="hi" style="font-family:var(--sans);font-size:12px">' +
        '<button style="color:var(--accent);font-family:var(--sans);font-size:12px;text-align:left" data-act="openLesson" data-id="' + l.id + '">' + esc(l.title) + '</button></td>' +
        '<td style="font-family:var(--sans);font-size:11.5px;color:var(--text2)">' +
        l.refs.map((r) => '<a href="' + r.u + '" target="_blank" rel="noopener noreferrer" style="color:var(--text2);border-bottom:1px dotted #33475f">' + esc(r.t) + '</a>').join(' · ') +
        '</td></tr>').join('') +
      '</tbody></table></div></div>';
  }

  function render() {
    const q = S.search.trim().toLowerCase();
    const match = (o) => !q || JSON.stringify(o).toLowerCase().includes(q);

    let h = '<div class="sectionhead"><div><h2>Sources & further reading</h2>' +
      '<p>The books, repositories and RFCs this course is written against — with a note on what each one is actually for. Links open in a new tab.</p></div>' +
      '<div class="searchbox">' + U.ICON.search + '<input id="srcsearch" placeholder="Filter sources…" value="' + esc(S.search) + '" /></div></div>';

    h += '<div class="panel" style="margin-bottom:16px"><div class="hd"><span>How to use this page</span></div>' +
      '<div class="bd" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:14px">' +
      [['Finished the course?', 'Read Kurose & Ross or the free Systems Approach book end to end. This site is the on-ramp; those are the road.'],
        ['Want packet fluency?', 'Practical Packet Analysis, then download real captures from the repositories below and try to explain every packet before reading the answer.'],
        ['Working on performance?', 'High Performance Browser Networking, then the TCP Congestion Control micro-book. Those two cover almost every real incident.'],
        ['Working on infrastructure?', 'The SDN and Network Security micro-books, then read a real data plane such as cilium.']]
        .map(([t, d]) => '<div><div style="font-size:12.5px;font-weight:650;margin-bottom:3px">' + esc(t) + '</div>' +
          '<div style="font-size:12px;color:var(--muted);line-height:1.55">' + esc(d) + '</div></div>').join('') +
      '</div></div>';

    BOOKS.forEach((g) => {
      const items = g.items.filter(match);
      if (!items.length) return;
      h += '<div class="sectionhead" style="margin:18px 0 10px"><div><h2 style="font-size:16.5px">' + esc(g.group) + '</h2></div></div>' +
        '<div class="cards" style="grid-template-columns:repeat(auto-fill,minmax(320px,1fr))">' + items.map(card).join('') + '</div>';
    });

    const repos = REPOS.filter(match);
    if (repos.length) {
      h += '<div class="sectionhead" style="margin:22px 0 10px"><div><h2 style="font-size:16.5px">Repositories worth cloning</h2>' +
        '<p>Textbooks you can build, capture libraries to practise on, and tools that see inside the kernel.</p></div></div>' +
        '<div class="cards" style="grid-template-columns:repeat(auto-fill,minmax(300px,1fr))">' + repos.map(card).join('') + '</div>';
    }

    if (!q) h += lessonRefRows();

    const rfcs = RFCS.filter((r) => !q || JSON.stringify(r).toLowerCase().includes(q));
    if (rfcs.length) {
      h += '<div class="panel" style="margin-top:20px"><div class="hd"><span>The specifications themselves</span>' +
        '<span class="spacer"></span><span class="mono" style="text-transform:none;letter-spacing:0">' + rfcs.length + ' RFCs</span></div>' +
        '<div class="bd" style="padding:0"><table class="grid"><thead><tr><th>RFC</th><th>Protocol</th><th>Link</th></tr></thead><tbody>' +
        rfcs.map(([id, name, u]) => '<tr><td class="hi">' + esc(id) + '</td><td style="font-family:var(--sans);font-size:12px">' + esc(name) + '</td>' +
          '<td><a href="' + u + '" target="_blank" rel="noopener noreferrer" style="color:var(--accent);font-size:11px">datatracker ↗</a></td></tr>').join('') +
        '</tbody></table></div></div>';
    }

    if (!q && !repos.length) h += '<div class="empty">Nothing matches that filter.</div>';
    return h;
  }

  root.PE_SOURCES = { render };
})(typeof window !== 'undefined' ? window : globalThis);
