/* ============================================================
   lessons-advanced.js — Track 6 · Advanced & modern
   Written against, and cross-referenced with:
     · Kurose & Ross, Computer Networking: A Top-Down Approach
     · Stevens & Fall, TCP/IP Illustrated Vol. 1
     · Peterson & Davie, Computer Networks: A Systems Approach (open source)
     · Grigorik, High Performance Browser Networking (free at hpbn.co)
     · Systems Approach micro-books: tcpcc, security, sdn
   Every lesson carries a `refs` array that is rendered in the explainer.
   ============================================================ */
(function (root) {
  'use strict';

  const SA = { t: 'Computer Networks: A Systems Approach (free)', u: 'https://book.systemsapproach.org/', note: 'Peterson & Davie' };
  const HPBN = { t: 'High Performance Browser Networking (free)', u: 'https://hpbn.co/', note: 'Grigorik — latency, TCP, TLS, HTTP/2' };
  const TCPCC = { t: 'TCP Congestion Control: A Systems Approach', u: 'https://github.com/SystemsApproach/tcpcc', note: 'the micro-book on CC, incl. BBR' };

  const LESSONS = [

    {
      id: 'performance',
      track: 'modern',
      title: 'Speed: latency, windows and bufferbloat',
      subtitle: 'Why a fast link still feels slow',
      scenario: 'home',
      level: 4,
      minutes: 7,
      goals: ['latency vs bandwidth', 'bandwidth-delay product', 'congestion control and bufferbloat'],
      refs: [HPBN, TCPCC, SA],
      steps: [
        {
          title: 'Two numbers, not one',
          sub: 'Bandwidth is how wide the pipe is. Latency is how long the pipe is',
          focus: ['pc', 'rtr', 'web'],
          what: 'A 100 Mbit/s link moves 1 MB in about 80 ms of pure transfer. But before any of that data exists, the client spends one round trip on the TCP handshake and another on TLS 1.3 — 2 RTT before the first byte of HTML. On a 150 ms path that is 300 ms of waiting, four times the transfer itself.',
          why: 'Bandwidth is shared and cheaplY upgraded. Latency is physics: distance, and the number of round trips the protocol requires. This is why protocols keep racing to remove round trips — TLS 1.3 merged handshakes, QUIC merges transport and crypto, 0-RTT resumes in one.',
          analogy: 'A motorway with twelve empty lanes still takes you four hours to drive across the country. Width is not distance.',
          terms: [
            { t: 'RTT', d: 'Round-trip time: one there-and-back delay. Every handshake step costs a multiple of it.' },
            { t: 'TTFB', d: 'Time to first byte — handshakes plus server think time. Usually dominated by RTT × round trips, not by bandwidth.' },
          ],
          packets: [
            { s: 'pc', d: 'web', proto: 'TCP', app: 'tcpData', t: 0.0, sport: 52344, dport: 443, info: 'SYN · RTT 1 begins', tcp: { flags: 'SYN', seq: 0 } },
            { s: 'web', d: 'pc', proto: 'TCP', app: 'tcpData', t: 0.150, sport: 443, dport: 52344, info: 'SYN-ACK · 150 ms gone, no data yet', tcp: { flags: 'SYN, ACK', seq: 0, ack: 1 } },
            { s: 'pc', d: 'web', proto: 'TCP', app: 'tcpData', t: 0.151, sport: 52344, dport: 443, info: 'ACK + TLS ClientHello · RTT 2 begins', tcp: { flags: 'PSH, ACK', seq: 1, ack: 1 }, pay: { label: 'ClientHello', len: 517 } },
            { s: 'web', d: 'pc', proto: 'TLS', app: 'tls', t: 0.302, sport: 443, dport: 52344, info: 'ServerHello + cert + Finished · 300 ms spent before HTTP', tls: { handshakeType: 2 } },
            { s: 'pc', d: 'web', proto: 'HTTP', app: 'httpReq', t: 0.303, sport: 52344, dport: 443, info: 'GET / · the first request finally leaves', http: { method: 'GET', path: '/', host: 'www.example.com', headers: ['Host: www.example.com', 'Accept: text/html'] } },
          ],
        },
        {
          title: 'The window is the ceiling',
          sub: 'Nothing moves faster than window ÷ RTT',
          focus: ['pc', 'web'],
          what: 'TCP may only have one window of unacknowledged bytes on the wire. With an old 64 KB window and a 100 ms RTT, that ceiling is 65,535 B ÷ 0.1 s ≈ 655 kB/s — about 5.2 Mbit/s, no matter how fast the link is. Window scaling (RFC 7323) lifts it with a shift factor negotiated in the handshake.',
          why: 'The product of bandwidth and RTT — the bandwidth-delay product — is the amount of data that must be "in flight" to fill the pipe. If the window is smaller than the BDP, the pipe is never full.',
          analogy: 'A conveyor belt: the number of items on the belt at once, times the speed of the belt, is the throughput. Too few items and the belt runs half empty.',
          terms: [
            { t: 'BDP', d: 'Bandwidth × RTT. The pipe\'s capacity in bytes; the window must be at least this big to saturate it.' },
            { t: 'Window scaling', d: 'A shift factor in the TCP options that multiplies the 16-bit window field, allowing windows far beyond 64 KB.' },
          ],
          card: {
            title: 'Ceiling = window ÷ RTT',
            cols: ['Path RTT', '64 KB window', '1 MB window', 'BDP at 1 Gbit/s'],
            rows: [
              ['10 ms', '52 Mbit/s', '839 Mbit/s', '1.25 MB'],
              ['50 ms', '10 Mbit/s', '168 Mbit/s', '6.25 MB'],
              ['150 ms', '3.5 Mbit/s', '56 Mbit/s', '18.75 MB'],
            ],
            note: 'This is why long fat networks ("LFNs") are a special case in every networking textbook — and why window scaling is negotiated in the first SYN.',
          },
          packets: [
            { s: 'pc', d: 'web', proto: 'TCP', app: 'tcpData', t: 0.0, sport: 52344, dport: 443, info: 'SYN · options: MSS 1460, Window Scale 8 (×256), SACK permitted', tcp: { flags: 'SYN', seq: 0, window: 64240 }, note: 'the shift of 8 turns a 64 KB window into 16 MB' },
            { s: 'web', d: 'pc', proto: 'TCP', app: 'tcpData', t: 0.001, sport: 443, dport: 52344, info: 'SYN-ACK · peer agrees to its own scale', tcp: { flags: 'SYN, ACK', seq: 0, ack: 1, window: 65160 } },
          ],
        },
        {
          title: 'Slow start, then a sawtooth',
          sub: 'The sender guesses how much the network can take',
          focus: ['web', 'pc'],
          what: 'A new connection begins with a small congestion window and doubles it each round trip — slow start — until it hits a threshold, then grows linearly. Every loss halves it. The resulting sawtooth is loss-based congestion control, and it is why a fresh connection is always slower than a warm one.',
          why: 'Loss is treated as the only available signal of congestion, because IP cannot tell a sender that a queue is filling. It works, but it is conservative and it punishes Wi-Fi: a lost frame on radio is diagnosed as congestion and the window collapses for no reason.',
          analogy: 'Feeling for the edge of a table in the dark: reach further each time, and the moment you touch something, pull back halfway.',
          terms: [
            { t: 'Slow start', d: 'Exponential growth of the congestion window at the start of a connection or after a timeout.' },
            { t: 'CUBIC', d: 'The default Linux congestion control for years: a cubic function of time since the last loss.' },
            { t: 'BBR', d: 'A model-based algorithm (Google) that estimates bottleneck bandwidth and minimum RTT instead of waiting for loss.' },
          ],
          packets: [
            { s: 'web', d: 'pc', proto: 'TCP', app: 'tcpData', t: 0.01, info: 'cwnd 10 → 20 segments: doubling each RTT', tcp: { flags: 'PSH, ACK', seq: 1, window: 131328 }, pay: { label: 'Data', len: 1460 } },
            { s: 'web', d: 'pc', proto: 'TCP', app: 'tcpData', t: 0.11, info: 'loss detected → cwnd halved, throughput drops', tcp: { flags: 'PSH, ACK', seq: 1461, window: 131328 }, pay: { label: 'Data', len: 1460 }, note: 'the sawtooth: growth, loss, halve, grow again' },
          ],
        },
        {
          title: 'Bufferbloat: latency you added yourself',
          sub: 'Big buffers plus a full sender equals a standing queue',
          focus: ['rtr', 'pc'],
          what: 'Home routers and modems ship with large buffers so they never drop. A saturated uplink fills that buffer and keeps it full, so every packet now waits behind hundreds of others. Ping stays low when idle and jumps to seconds while you upload.',
          why: 'Queueing delay is additive and invisible in bandwidth measurements. Active queue management — fq_codel, CAKE — keeps queues short by dropping or marking early, so latency stays sane under load.',
          analogy: 'A wide funnel under a tap: the water still flows, but everything sits in the funnel for a while before it comes out.',
          terms: [
            { t: 'Bufferbloat', d: 'Latency caused by persistently full buffers in the network path.' },
            { t: 'AQM', d: 'Active Queue Management: dropping or marking packets early to keep queueing delay small.' },
            { t: 'Working latency', d: 'Latency measured while the link is busy — the number that matters for calls and games.' },
          ],
          card: {
            title: 'Same link, different load',
            cols: ['Condition', 'RTT', 'Why'],
            rows: [
              ['idle', '11 ms', 'queue empty'],
              ['downloading', '48 ms', 'small downstream queue'],
              ['uploading at capacity', '620 ms', 'standing queue in the modem buffer'],
              ['uploading with fq_codel', '23 ms', 'AQM keeps the queue short'],
            ],
            note: 'If your video calls break while a backup runs, bufferbloat is the usual culprit — not bandwidth.',
          },
          packets: [
            { s: 'pc', d: 'web', proto: 'ICMP', app: 'icmp', t: 0.0, info: 'Echo request · idle link', icmp: { type: 8, seq: 1 } },
            { s: 'web', d: 'pc', proto: 'ICMP', app: 'icmp', t: 0.011, info: 'Echo reply · 11 ms while idle', icmp: { type: 0, seq: 1 } },
            { s: 'pc', d: 'web', proto: 'ICMP', app: 'icmp', t: 1.0, info: 'Echo request · during a saturated upload', icmp: { type: 8, seq: 2 } },
            { s: 'web', d: 'pc', proto: 'ICMP', app: 'icmp', t: 1.62, info: 'Echo reply · 620 ms of queueing delay', icmp: { type: 0, seq: 2 }, note: 'same path, same bandwidth, 56× the latency' },
          ],
        },
        {
          title: 'What to measure, and what to ignore',
          sub: 'Averages hide everything that matters',
          focus: ['pc'],
          what: 'Measure the distribution, not the mean: p50 and p99 RTT, jitter, retransmission rate, and time-to-first-byte broken down into DNS, connect, TLS and server time. A 40 ms average with a 900 ms p99 is a broken experience; a 60 ms average with a 65 ms p99 is fine.',
          why: 'Page speed is dominated by the tail and by round trips, not by steady-state bandwidth. Browser devtools and packet captures give you the breakdown; a bandwidth test gives you one number that explains almost nothing.',
          analogy: 'Judging a restaurant by average service time hides the table that waited an hour.',
          terms: [
            { t: 'Jitter', d: 'Variation in delay between packets; the enemy of real-time audio and video.' },
            { t: 'Retransmission rate', d: 'Percentage of segments resent. Above ~1% on a wired LAN something is genuinely wrong.' },
          ],
          card: {
            title: 'A useful measurement breakdown',
            cols: ['Phase', 'What it depends on', 'Typical cost'],
            rows: [
              ['DNS', 'resolver + TTL cache', '1 RTT (0 if cached)'],
              ['TCP connect', 'network RTT', '1 RTT'],
              ['TLS 1.3', 'network RTT', '1 RTT (0 on resumption)'],
              ['Request → TTFB', 'server, queueing, DB', 'application time'],
              ['Body transfer', 'bandwidth + window', 'size ÷ throughput'],
            ],
            note: 'Add them up before optimising anything. Most "slow website" tickets are DNS or TLS, not the application.',
          },
          packets: [],
        },
      ],
      quiz: [
        {
          q: 'A 1 Gbit/s link has a 150 ms RTT, and the window is stuck at 64 KB. What throughput do you actually get?',
          opts: ['1 Gbit/s', 'About 3.5 Mbit/s', 'About 500 Mbit/s', 'It depends only on packet loss'],
          a: 1,
          why: '65,535 bytes ÷ 0.15 s ≈ 437 kB/s ≈ 3.5 Mbit/s. Until window scaling raises the window above the bandwidth-delay product, the link is mostly idle.',
        },
        {
          q: 'Your video call stutters whenever a backup uploads, though speed tests still show full bandwidth. Most likely cause?',
          opts: ['DNS', 'Bufferbloat — a standing queue inflating latency under load', 'The TLS certificate', 'Packet fragmentation'],
          a: 1,
          why: 'Bandwidth is unchanged, so a speed test looks fine. Queueing delay under load is what breaks real-time traffic; AQM on the router fixes it.',
        },
      ],
    },

    {
      id: 'ipv6',
      track: 'modern',
      title: 'IPv6: why, and how it really works',
      subtitle: 'No ARP, no broadcast, no router fragmentation',
      scenario: 'lan',
      level: 4,
      minutes: 7,
      goals: ['128-bit addressing and notation', 'NDP instead of ARP', 'SLAAC, extension headers, dual stack'],
      refs: [
        { t: 'RFC 8200 — IPv6 specification', u: 'https://datatracker.ietf.org/doc/html/rfc8200', note: 'the wire format' },
        { t: 'RFC 4861 — Neighbor Discovery', u: 'https://datatracker.ietf.org/doc/html/rfc4861', note: 'NDP replaces ARP' },
        { t: 'RFC 4862 — SLAAC', u: 'https://datatracker.ietf.org/doc/html/rfc4862', note: 'addresses without DHCP' },
        { t: 'IPv6 extension-header captures', u: 'https://github.com/amwalding/IPv6_Extension_Header_PCAPs', note: 'real pcaps, rare to find' },
      ],
      steps: [
        {
          title: '128 bits, written in shorthand',
          sub: '2^128 addresses, and a /64 is the normal LAN size',
          focus: ['pc', 'rtr'],
          what: 'An IPv6 address is 128 bits — eight groups of four hex digits — and the notation suppresses leading zeros and collapses one run of zeros to ::. A normal home LAN gets a /64, which is 18 quintillion addresses. Unlike IPv4 there is no need to economise: every device can have a globally routable address.',
          why: 'IPv4 ran out. NAT was the stopgap, and it broke peer-to-peer, made logging ambiguous and turned the middle of the network into a state machine. IPv6 removes the reason for NAT rather than porting it.',
          analogy: 'IPv4 gave every building a short phone number and installed switchboards everywhere. IPv6 gives every room its own direct line.',
          terms: [
            { t: '::', d: 'Compresses one run of zero groups. 2001:db8:0:0:0:0:0:1 becomes 2001:db8::1.' },
            { t: 'Link-local', d: 'fe80::/10, valid only on one link. Every IPv6 interface has one, and NDP runs on it.' },
            { t: 'Hexadecimal groups', d: 'Each group is 16 bits, so 2001:db8:1:2::10 is 2001:0db8:0001:0002:0000:0000:0000:0010.' },
          ],
          packets: [
            { s: 'pc', d: 'dns', proto: 'UDP', app: 'dnsq', t: 0.0, v6: true, sport: 51000, dport: 53, sip: '2001:db8:1:2::10', dip: '2606:4700:4700::1111', info: 'IPv6 UDP 51000 → 53 · AAAA query, 40-byte fixed header', dns: { name: 'www.example.com', qtype: 'AAAA', id: 0x6a01 } },
          ],
        },
        {
          title: 'No broadcast, so no ARP',
          sub: 'Neighbor Discovery lives inside ICMPv6',
          focus: ['pc', 'rtr'],
          what: 'IPv6 has no broadcast address. To find a neighbour\'s link-layer address, a host sends an ICMPv6 Neighbor Solicitation to a *solicited-node multicast* address (ff02::1:ff.. + the last 24 bits of the target), and gets a Neighbor Advertisement back. This is NDP, and it replaces ARP entirely.',
          why: 'Multicast wakes only the hosts that might care. And because NDP is ICMPv6 — not a separate protocol bolted underneath — the link-layer address travels as an option inside the message, with room for more options later.',
          analogy: 'ARP shouts in a crowded room. NDP uses a paging system that only calls the one desk that matches.',
          terms: [
            { t: 'NDP', d: 'Neighbor Discovery Protocol: solicitation, advertisement, router discovery and redirect, all over ICMPv6.' },
            { t: 'Solicited-node multicast', d: 'ff02::1:ff00:0/104 plus the low 24 bits of the address; exactly the hosts that might share it.' },
          ],
          packets: [
            { s: 'pc', d: 'rtr', proto: 'NDP', app: 'ndp', t: 0.0, sip: 'fe80::a65e:60ff:fe1b:2c3d', dip: 'ff02::1:ff4c:5d6e', info: 'ICMPv6 Neighbor Solicitation · who has fe80::ba27:ebff:fe4c:5d6e?', icmp6: { type: 135, target: 'fe80::ba27:ebff:fe4c:5d6e', slladdr: 'a4:5e:60:1b:2c:3d' } },
            { s: 'rtr', d: 'pc', proto: 'NDP', app: 'ndp', t: 0.001, sip: 'fe80::ba27:ebff:fe4c:5d6e', dip: 'fe80::a65e:60ff:fe1b:2c3d', info: 'ICMPv6 Neighbor Advertisement · that is me, here is my MAC', icmp6: { type: 136, target: 'fe80::ba27:ebff:fe4c:5d6e', tlladdr: 'b8:27:eb:4c:5d:6e', solicited: true } },
          ],
        },
        {
          title: 'SLAAC: addresses without a server',
          sub: 'The router advertises a prefix, the host builds its own address',
          focus: ['rtr', 'pc'],
          what: 'The router multicasts a Router Advertisement every few minutes. It carries a prefix such as 2001:db8:1:2::/64 and a flag saying "build your own address from this". The host takes the prefix, appends an interface identifier, runs duplicate-address detection, and is online — no DHCP server involved. DHCPv6 is still used when you want central control or DNS options.',
          why: 'This is the biggest architectural change from IPv4: address configuration is part of the protocol, not an optional service. A network with a router and no DHCP still works.',
          analogy: 'The building manager publishes the postcode over the tannoy, and everyone writes their own room number on the envelope.',
          terms: [
            { t: 'SLAAC', d: 'Stateless Address Autoconfiguration: host-generated addresses from a router-advertised prefix.' },
            { t: 'DAD', d: 'Duplicate Address Detection: the host solicits its own address before using it.' },
            { t: 'RA flags', d: 'M = use DHCPv6 for addresses, O = use DHCPv6 for other config, A = autonomous (SLAAC allowed).' },
          ],
          packets: [
            { s: 'rtr', d: 'pc', proto: 'NDP', app: 'ndp', t: 0.0, sip: 'fe80::ba27:ebff:fe4c:5d6e', dip: 'ff02::1', info: 'Router Advertisement · prefix 2001:db8:1:2::/64, A=1, lifetime 1800 s', icmp6: { type: 134, prefix: '2001:db8:1:2::', prefixLen: 64, flags: 0xc0 } },
            { s: 'pc', d: 'web', proto: 'TCP', app: 'tcpData', t: 0.02, v6: true, sport: 52344, dport: 443, sip: '2001:db8:1:2::10', dip: '2606:4700::443', info: 'TCP SYN over IPv6 · address built locally, no DHCP lease', tcp: { flags: 'SYN', seq: 0 } },
          ],
        },
        {
          title: 'A fixed header, and no router fragmentation',
          sub: 'Extension headers instead of an options field',
          focus: ['pc', 'web'],
          what: 'The IPv6 header is exactly 40 bytes: version, traffic class, flow label, payload length, next header, hop limit, and two 128-bit addresses. Anything extra — routing, fragmentation, mobility, hop-by-hop options — becomes an extension header chained through the Next Header field. Routers no longer fragment; only the source may.',
          why: 'A fixed header is cheap to process in hardware and easy to extend without growing every packet. Removing router fragmentation forces path MTU discovery, which is why IPv6 depends on ICMPv6 "Packet Too Big" messages arriving.',
          analogy: 'A standard envelope with a list of enclosed notes, instead of an envelope that changes size and shape for every posting.',
          terms: [
            { t: 'Extension header', d: 'An optional header chained after IPv6, indicated by Next Header (0 hop-by-hop, 43 routing, 44 fragment, 50 ESP).' },
            { t: 'Packet Too Big', d: 'ICMPv6 type 2. Blocking it is the classic IPv6 "MTU black hole" — large packets vanish, small ones work.' },
          ],
          packets: [
            { s: 'rtr', d: 'pc', proto: 'ICMPv6', app: 'icmpv6', t: 0.0, sip: '2001:db8:1:2::1', dip: '2001:db8:1:2::10', info: 'ICMPv6 Packet Too Big · MTU 1280 on this link', icmp6: { type: 2, code: 0, data: [0x00, 0x00, 0x05, 0x00] }, note: 'the sender must shrink to 1280 bytes — routers will not fragment for it' },
            { s: 'pc', d: 'web', proto: 'TCP', app: 'tcpData', t: 0.01, v6: true, sip: '2001:db8:1:2::10', dip: '2606:4700::443', info: 'TCP segment of 1220 bytes after the MTU update', tcp: { flags: 'PSH, ACK', seq: 1 }, pay: { label: 'Data', len: 1220 } },
          ],
        },
        {
          title: 'Dual stack and Happy Eyeballs',
          sub: 'How a client chooses between A and AAAA',
          focus: ['pc', 'dns', 'web'],
          what: 'Most clients are dual stack: they resolve both A and AAAA and try IPv6 first. If the IPv6 path is broken, waiting for it to fail would add seconds, so Happy Eyeballs (RFC 8305) starts the IPv6 attempt and begins IPv4 a short moment later, using whichever answers first. A broken IPv6 deployment is therefore survivable — but it still costs latency.',
          why: 'The transition is not a flag day. Everything runs both families for years, and the measurement that matters is whether IPv6 actually beats IPv4 on real paths, not whether it is configured.',
          analogy: 'Two taxis are ordered at once; you take whichever arrives first, and the other is cancelled.',
          terms: [
            { t: 'Dual stack', d: 'A host running IPv4 and IPv6 simultaneously — the normal state of the internet today.' },
            { t: 'Happy Eyeballs', d: 'Racing the two address families so a broken IPv6 path cannot stall the connection.' },
            { t: 'NAT66', d: 'NAT for IPv6. Possible, occasionally deployed, and generally discouraged — it exists only to preserve IPv4 thinking.' },
          ],
          packets: [
            { s: 'pc', d: 'dns', proto: 'DNS', app: 'dnsq', t: 0.0, info: 'A and AAAA queries in parallel', dns: { name: 'www.example.com', qtype: 'AAAA', id: 0x7001 } },
            { s: 'dns', d: 'pc', proto: 'DNS', app: 'dnsr', t: 0.008, info: 'Answer: AAAA 2606:4700::443, A 203.0.113.10', dns: { name: 'www.example.com', qtype: 'AAAA', id: 0x7001, answers: [{ type: 'AAAA', ttl: 300, rdata: [0x26, 0x06, 0x47, 0x00, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0x04, 0x43] }] } },
            { s: 'pc', d: 'web', proto: 'TCP', app: 'tcpData', t: 0.02, v6: true, sip: '2001:db8:1:2::10', dip: '2606:4700::443', info: 'IPv6 SYN first · IPv4 starts ~250 ms later if this stalls', tcp: { flags: 'SYN', seq: 0 } },
          ],
        },
      ],
      quiz: [
        {
          q: 'Which protocol replaces ARP in IPv6?',
          opts: ['DHCPv6', 'ICMPv6 Neighbor Discovery', 'RARP', 'Nothing — ARP still runs'],
          a: 1,
          why: 'NDP (Neighbor Solicitation and Advertisement) runs over ICMPv6 on link-local and solicited-node multicast addresses. There is no separate ARP for IPv6.',
        },
      ],
    },

    {
      id: 'anycast',
      track: 'modern',
      title: 'Anycast, CDNs and DNS steering',
      subtitle: 'One address in many places',
      scenario: 'cdn',
      level: 4,
      minutes: 6,
      goals: ['how anycast works', 'DNS-based steering', 'cache hierarchies and failover'],
      refs: [HPBN, SA, { t: 'Routing TCP/IP Vol. 1 — Doyle', u: 'https://www.ciscopress.com/store/routing-tcp-ip-volume-i-9781587052026', note: 'BGP path selection in depth' }],
      steps: [
        {
          title: 'One address, announced from hundreds of places',
          sub: 'The routing table chooses the nearest copy',
          focus: ['pc', 'edge', 'far'],
          what: 'With anycast, many machines announce the same prefix — say 203.0.113.0/24 — into BGP. Each network\'s routing table carries only the best route, so a client in Chennai reaches the Chennai edge and a client in Frankfurt reaches the Frankfurt one, both using the identical IP address.',
          why: 'It gives you latency reduction, DDoS absorption and simple failover without touching DNS: withdraw the announcement and traffic moves in seconds, not TTL-minutes.',
          analogy: 'One emergency phone number, answered by the nearest call centre. You dial the same digits; the network does the geography.',
          terms: [
            { t: 'Anycast', d: 'The same IP address advertised from multiple locations; routing delivers each client to the topologically nearest one.' },
            { t: 'Unicast', d: 'One address, one owner — the ordinary case for a home router.' },
          ],
          packets: [
            { s: 'pc', d: 'geodns', proto: 'DNS', app: 'dnsq', t: 0.0, sport: 51000, dport: 53, info: 'Standard query A cdn.example.com', dns: { name: 'cdn.example.com', qtype: 'A', id: 0x8a01 } },
            { s: 'geodns', d: 'pc', proto: 'DNS', app: 'dnsr', t: 0.012, sport: 53, dport: 51000, info: 'Answer: A 203.0.113.80 · TTL 30', dns: { name: 'cdn.example.com', qtype: 'A', id: 0x8a01, answers: [{ type: 'A', ttl: 30, rdata: '203.0.113.80' }] } },
            { s: 'pc', d: 'edge', proto: 'TCP', app: 'tcpData', t: 0.03, sport: 52344, dport: 443, info: 'SYN to 203.0.113.80 · lands on the Chennai edge', tcp: { flags: 'SYN', seq: 0 } },
            { s: 'pc', d: 'far', proto: 'TCP', app: 'tcpData', t: 0.03, sport: 52346, dport: 443, dip: '203.0.113.80', info: 'The same IP in Frankfurt answers a different client', tcp: { flags: 'SYN', seq: 0 }, note: 'identical address, different machine — BGP decided which' },
          ],
        },
        {
          title: 'DNS steering is a different tool',
          sub: 'Resolution-time decisions, with TTL trade-offs',
          focus: ['dns', 'geodns', 'pc'],
          what: 'Where anycast steers at the routing layer, GeoDNS steers at resolution: the authoritative server answers with a different A record depending on the resolver\'s location, measured latency, or load. The catch is TTL — a cached answer keeps sending traffic to a place you no longer want.',
          why: 'Routing changes take effect for new packets immediately. DNS changes take effect when caches expire. Choosing which mechanism to use for failover is a design decision with a measurable consequence.',
          analogy: 'Anycast is a road sign at a junction. GeoDNS is a receptionist telling callers which branch to visit — until the note on their fridge goes out of date.',
          terms: [
            { t: 'GeoDNS', d: 'Answers that vary by the client\'s apparent location, derived from the resolver\'s IP.' },
            { t: 'EDNS Client Subnet', d: 'Lets a resolver pass a truncated client subnet so the authoritative server can be more accurate — at a privacy cost.' },
            { t: 'TTL', d: 'How long the answer may be cached. Short TTLs fail over faster but increase query load.' },
          ],
          card: {
            title: 'Failover mechanisms compared',
            cols: ['Mechanism', 'Takes effect', 'Precision', 'Catch'],
            rows: [
              ['BGP withdraw (anycast)', 'seconds', 'per prefix', 'needs your own addressing'],
              ['DNS TTL 30 s', 'up to 30 s + resolver lag', 'per name', 'resolvers ignore TTLs'],
              ['DNS TTL 3600 s', 'up to an hour', 'per name', 'painful emergency changes'],
              ['Load balancer health check', 'seconds', 'per backend', 'only inside one site'],
            ],
            note: '"Fast failover" almost always means routing or a load balancer — not DNS.',
          },
          packets: [
            { s: 'pc', d: 'isdns', proto: 'DNS', app: 'dnsq', t: 0.0, sport: 51000, dport: 53, info: 'Query for cdn.example.com via the ISP resolver', dns: { name: 'cdn.example.com', qtype: 'A', id: 0x8a02 } },
            { s: 'isdns', d: 'geodns', proto: 'DNS', app: 'dnsq', t: 0.004, sport: 33011, dport: 53, info: 'Forwarded query · EDNS Client Subnet 203.0.113.0/24', dns: { name: 'cdn.example.com', qtype: 'A', id: 0x8a03 } },
          ],
        },
        {
          title: 'The cache hierarchy',
          sub: 'Edge, shield, origin — and hit ratio arithmetic',
          focus: ['edge', 'shield', 'origin'],
          what: 'An edge cache serves what it has and forwards misses to an origin shield, which in turn forwards its own misses to the origin. Each layer multiplies the hit ratio rather than adding to it.',
          why: 'A 95% edge hit ratio sounds excellent until you have a million requests per second: 50,000 misses per second would destroy the origin. Adding a shield with an 80% hit ratio cuts that to 10,000 — and the origin sees 1% of total traffic.',
          analogy: 'A local shop, a regional warehouse and a factory. The factory only builds what neither of the others has.',
          terms: [
            { t: 'Hit ratio', d: 'Fraction of requests answered from cache. Layers multiply: 0.95 + 0.8 of the rest = 99% served without the origin.' },
            { t: 'Origin shield', d: 'A single mid-tier cache that collapses duplicate misses from many edges into one origin request.' },
            { t: 'Cache key', d: 'What makes two requests "the same": URL plus chosen headers. Wrong keys cause either misses or wrong content.' },
          ],
          card: {
            title: 'Where 1,000,000 req/s ends up',
            cols: ['Layer', 'Hit ratio', 'Requests reaching it', 'Served here'],
            rows: [
              ['Edge fleet', '95%', '1,000,000', '950,000'],
              ['Origin shield', '80% of misses', '50,000', '40,000'],
              ['Origin', '—', '10,000', '10,000 (1%)'],
            ],
            note: 'This is why a CDN is not "a cache in front" but a hierarchy — and why cache-key mistakes are so expensive.',
          },
          packets: [
            { s: 'pc', d: 'edge', proto: 'HTTP', app: 'httpReq', t: 0.03, info: 'GET /hero.jpg · cache hit at the edge', http: { method: 'GET', path: '/hero.jpg', host: 'cdn.example.com' } },
            { s: 'edge', d: 'shield', proto: 'HTTP', app: 'httpReq', t: 0.05, info: 'GET /product.json · edge miss, asking the shield', http: { method: 'GET', path: '/product.json', host: 'origin.example.com' } },
            { s: 'shield', d: 'origin', proto: 'HTTP', app: 'httpReq', t: 0.09, info: 'GET /product.json · shield miss, asking the origin', http: { method: 'GET', path: '/product.json', host: 'origin.example.com' } },
            { s: 'origin', d: 'shield', proto: 'HTTP', app: 'httpRes', t: 0.16, info: 'HTTP/1.1 200 OK · Cache-Control: max-age=60, s-maxage=600', http: { status: '200 OK', headers: ['Date: Mon, 03 Nov 2025 10:15:32 GMT', 'Content-Type: application/json', 'Content-Length: 812', 'Cache-Control: max-age=60, s-maxage=600', 'Age: 0'] } },
          ],
        },
        {
          title: 'The tax of anycast',
          sub: 'Connection state and routing changes',
          focus: ['pc', 'edge', 'far'],
          what: 'If BGP re-converges while a TCP connection is open, your packets can land on a different anycast node that knows nothing about the session. The connection stalls until it times out. That is why long-lived sessions (websockets, QUIC with connection IDs) need care, and why some networks pin traffic per flow.',
          why: 'Anycast is stateless by design; TCP is not. Every large CDN has an answer to this — connection IDs, consistent hashing, or accepting the occasional reset — and it is a genuinely interesting engineering trade-off.',
          analogy: 'Two call centres share one number. If the switchboard reroutes mid-sentence, the new agent has no idea what you were discussing.',
          terms: [
            { t: 'Connection migration', d: 'QUIC\'s answer: a connection ID lets a session continue across an IP or path change.' },
            { t: 'Route flap', d: 'A prefix repeatedly withdrawn and re-announced, moving traffic back and forth.' },
          ],
          packets: [
            { s: 'pc', d: 'edge', proto: 'TCP', app: 'tcpData', t: 0.03, sport: 52344, dport: 443, info: 'Session established with the Chennai edge', tcp: { flags: 'PSH, ACK', seq: 1, ack: 1 }, pay: { label: 'Request', len: 400 } },
            { s: 'pc', d: 'far', proto: 'TCP', app: 'tcpData', t: 0.60, sport: 52344, dport: 443, dip: '203.0.113.80', info: 'BGP re-converged · packets now land on Frankfurt, which has no state', tcp: { flags: 'ACK', seq: 401, ack: 1 }, dropped: true, note: 'the node replies with RST or ignores it: the session dies' },
          ],
        },
      ],
      quiz: [
        {
          q: 'Two clients in different continents connect to the same IP and reach different servers. How?',
          opts: ['DNS returns different addresses', 'Anycast: the same prefix is announced from many places and BGP picks the nearest', 'The load balancer redirects them', 'Anycast is not possible; this must be DNS'],
          a: 1,
          why: 'With anycast, the address is identical everywhere and the routing system chooses the path. DNS steering is a separate technique that changes the address itself.',
        },
        {
          q: 'Edge hit ratio is 95% and traffic is 1M req/s. Why add an origin shield?',
          opts: ['To reduce latency for hits', 'Because 50,000 misses per second would overload the origin; a shield collapses them by another 80%', 'To shorten DNS TTLs', 'To avoid TLS'],
          a: 1,
          why: 'Hit ratios multiply, not add. The shield turns 50,000 misses/s into 10,000 origin requests/s — the origin sees 1% of traffic.',
        },
      ],
    },

    {
      id: 'middleboxes',
      track: 'modern',
      title: 'Middleboxes: load balancers, proxies, CGNAT',
      subtitle: 'Everything between the client and your code',
      scenario: 'dc',
      level: 4,
      minutes: 6,
      goals: ['TLS termination and SNI routing', 'L4 vs L7 balancing', 'X-Forwarded-For and CGNAT'],
      refs: [SA, HPBN, { t: 'Network Security: A Systems Approach', u: 'https://github.com/SystemsApproach/security', note: 'firewalls, middleboxes, DDoS' }],
      steps: [
        {
          title: 'Two TCP connections, not one',
          sub: 'The client thinks it is talking to the server',
          focus: ['pc', 'lb', 'app1'],
          what: 'Your browser opens a connection to the load balancer, which terminates TLS, reads the HTTP request, and opens a *separate* connection to a backend. Two connections, two sets of sequence numbers, two socket states. The backend never sees your IP address or your TLS session.',
          why: 'Termination is what makes routing decisions possible at all: you cannot inspect an encrypted request without the keys. It also concentrates certificate management in one place — renew once, not on every backend.',
          analogy: 'A receptionist who takes the sealed envelope, opens it, reads the request, and re-sends a summary to the right department.',
          terms: [
            { t: 'TLS termination', d: 'The proxy decrypts client traffic; it may re-encrypt to the backend (TLS re-origination) or forward in clear inside a trusted network.' },
            { t: 'SNI', d: 'Server Name Indication: the hostname sent in the clear in ClientHello, so one IP can serve many certificates.' },
          ],
          packets: [
            { s: 'pc', d: 'lb', proto: 'TCP', app: 'tcpData', t: 0.0, sport: 52344, dport: 443, info: '52344 → 443 [SYN] · client to the LB', tcp: { flags: 'SYN', seq: 0 } },
            { s: 'lb', d: 'pc', proto: 'TCP', app: 'tcpData', t: 0.012, sport: 443, dport: 52344, info: '443 → 52344 [SYN, ACK]', tcp: { flags: 'SYN, ACK', seq: 0, ack: 1 } },
            { s: 'pc', d: 'lb', proto: 'TLS', app: 'tls', t: 0.03, sport: 52344, dport: 443, info: 'ClientHello · SNI = api.example.com', tls: { handshakeType: 1 } },
            { s: 'lb', d: 'app1', proto: 'TCP', app: 'tcpData', t: 0.06, sip: '10.0.2.2', dip: '10.0.2.11', sport: 40211, dport: 8080, info: 'A second connection, LB → backend · different ports, different seq space', tcp: { flags: 'SYN', seq: 0 }, note: 'one client request, two TCP connections' },
          ],
        },
        {
          title: 'Layer 4 versus layer 7',
          sub: 'Routing on bytes, or on meaning',
          focus: ['lb', 'app1', 'app2'],
          what: 'An L4 balancer forwards packets by five-tuple and never looks inside — cheap, fast, protocol-agnostic. An L7 balancer parses HTTP and can route by path, header or cookie, retry individual requests, rewrite, and rate-limit. Most modern stacks are L7 because the flexibility is worth the CPU.',
          why: 'The choice determines what can go wrong. L4 preserves source addresses natively (DSR) but cannot retry a failed request. L7 can retry safely and report precise errors, at the cost of terminating and re-originating connections.',
          analogy: 'L4 is a postal sorter reading only the postcode. L7 opens the letter and files it by subject.',
          terms: [
            { t: 'Health check', d: 'A periodic probe deciding whether a backend receives traffic. A wrong check (e.g. TCP-only) keeps a broken app in rotation.' },
            { t: 'Connection pooling', d: 'The LB reuses a small set of long-lived backend connections instead of one per client — reduces handshakes and protects the backend.' },
            { t: 'DSR', d: 'Direct Server Return: replies bypass the balancer, which is only viable at L4.' },
          ],
          packets: [
            { s: 'lb', d: 'app1', proto: 'HTTP', app: 'httpReq', t: 0.07, sip: '10.0.2.2', dip: '10.0.2.11', sport: 40211, dport: 8080, info: 'GET /api/orders · X-Forwarded-For: 203.0.113.140', http: { method: 'GET', path: '/api/orders', host: 'api.example.com', headers: ['Host: api.example.com', 'X-Forwarded-For: 203.0.113.140', 'X-Forwarded-Proto: https', 'Connection: keep-alive'] } },
            { s: 'lb', d: 'app2', proto: 'TCP', app: 'tcpData', t: 0.07, sip: '10.0.2.2', dip: '10.0.2.12', sport: 40212, dport: 8080, info: 'Health check failing · TCP connects but /healthz returns 500', tcp: { flags: 'SYN', seq: 0 }, dropped: true, note: 'a TCP-only health check would have kept this broken backend in rotation' },
          ],
        },
        {
          title: 'Who is the client, really?',
          sub: 'X-Forwarded-For, PROXY protocol, and trust',
          focus: ['app1', 'lb', 'db'],
          what: 'Inside the data centre every request appears to come from the balancer. X-Forwarded-For carries the original address as text; the PROXY protocol prefixes the connection with a binary header that survives even TLS passthrough. Both are only trustworthy if the proxy strips anything the client sent.',
          why: 'Rate limiting, audit logs and geo rules all depend on knowing the real client. A forged X-Forwarded-For is a trivial way to bypass an IP allowlist or poison logs.',
          analogy: 'A note handed to reception saying "the caller is at this number" — believable only because reception writes the notes itself.',
          terms: [
            { t: 'X-Forwarded-For', d: 'A comma-separated header listing proxies the request passed through, leftmost being the client.' },
            { t: 'PROXY protocol', d: 'A small header prepended by the balancer carrying the original source and destination, works with TLS passthrough.' },
          ],
          card: {
            title: 'What each layer can see',
            cols: ['Observer', 'Sees client IP?', 'Sees URL?', 'Sees body?'],
            rows: [
              ['Router (L3)', 'yes', 'no', 'no'],
              ['L4 balancer', 'yes', 'no', 'no'],
              ['L7 proxy without XFF', 'no', 'yes', 'yes'],
              ['L7 proxy with XFF', 'yes, if trusted', 'yes', 'yes'],
              ['Backend app', 'only via header/protocol', 'yes', 'yes'],
            ],
            note: 'Every layer that can see more is a layer that can also log, alter or block more.',
          },
          packets: [
            { s: 'pc', d: 'lb', proto: 'HTTP', app: 'httpReq', t: 0.0, info: 'Client sends a forged X-Forwarded-For: 1.2.3.4', http: { method: 'GET', path: '/admin', host: 'api.example.com', headers: ['Host: api.example.com', 'X-Forwarded-For: 1.2.3.4'] } },
            { s: 'lb', d: 'app1', proto: 'HTTP', app: 'httpReq', t: 0.01, sip: '10.0.2.2', dip: '10.0.2.11', sport: 40211, dport: 8080, info: 'LB strips it and writes the truth: X-Forwarded-For: 203.0.113.140', http: { method: 'GET', path: '/admin', host: 'api.example.com', headers: ['Host: api.example.com', 'X-Forwarded-For: 203.0.113.140'] }, note: 'the single line of config that makes IP-based auth meaningful' },
          ],
        },
        {
          title: 'Carrier-grade NAT',
          sub: 'Thousands of subscribers behind one address',
          focus: ['pc', 'lb'],
          what: 'ISPs ran out of IPv4 addresses too, so many now place you behind CGNAT: your router\'s "public" address is itself private, and thousands of subscribers share one carrier address. The carrier tracks mappings by port, which is why a home server is unreachable and some games and calls need relaying.',
          why: 'A NAT table has 65,535 ports per (protocol, remote IP, remote port) tuple. That sounds large until it is shared by thousands of users; port exhaustion produces random-looking failures that are hard to debug from the customer side.',
          analogy: 'A large company switchboard with one public number and a fixed number of lines. At peak hours, calls do not connect.',
          terms: [
            { t: 'CGNAT', d: 'Carrier-Grade NAT (RFC 6888): large-scale address sharing inside the ISP.' },
            { t: 'Port exhaustion', d: 'All translation ports for a given remote endpoint are in use, so new connections fail.' },
            { t: 'Hole punching', d: 'Both peers send outward simultaneously so each NAT creates a mapping the other can use — how P2P survives NAT.' },
          ],
          packets: [
            { s: 'pc', d: 'lb', proto: 'IP', app: 'tcpData', t: 0.0, sip: '100.64.12.77', dip: '203.0.113.20', sport: 52344, dport: 443, info: 'Source is 100.64.12.77 — already carrier-NATed before it reaches the internet', tcp: { flags: 'PSH, ACK', seq: 1 }, pay: { label: 'Request', len: 400 }, note: '100.64.0.0/10 is the shared address space reserved for exactly this' },
          ],
        },
        {
          title: 'Where the failures come from',
          sub: '502, 504 and the idle-timeout race',
          focus: ['lb', 'app1', 'app2'],
          what: '504 means the balancer waited for the backend and gave up; 502 means the backend refused or reset the connection. The most common cause of a mystery 5xx every few minutes is a keepalive mismatch: the balancer\'s idle timeout is longer than the backend\'s, so it reuses a connection the backend has just closed.',
          why: 'Every proxy adds a state machine that must agree with the one on the other side. Retries without jitter turn a small failure into a stampede; a health check that only tests TCP turns a partial outage into a full one.',
          analogy: 'Two people ending a phone call at slightly different moments, so one keeps talking into a dead line.',
          terms: [
            { t: 'Idle timeout', d: 'How long an unused connection is kept. Mismatched values cause resets on reused connections.' },
            { t: 'Retry storm', d: 'Clients retrying in sync, multiplying load precisely when the system is weakest; fixed with exponential backoff and jitter.' },
          ],
          card: {
            title: 'Reading proxy errors',
            cols: ['Status', 'Origin', 'Usual cause'],
            rows: [
              ['502 Bad Gateway', 'the proxy', 'backend refused, crashed, or was mid-restart'],
              ['503 Service Unavailable', 'the proxy', 'no healthy backends (health checks failing)'],
              ['504 Gateway Timeout', 'the proxy', 'backend accepted but did not answer in time'],
              ['499 (nginx)', 'the proxy', 'the client gave up before the backend answered'],
              ['500', 'the application', 'the request reached the app and it threw'],
            ],
            note: 'Distinguishing 502 from 504 is the fastest way to know whether to look at the backend\'s process or its performance.',
          },
          packets: [
            { s: 'lb', d: 'pc', proto: 'HTTP', app: 'httpRes', t: 3.0, sport: 443, dport: 52344, info: 'HTTP/1.1 504 Gateway Timeout · backend exceeded 3 s', http: { status: '504 Gateway Timeout', headers: ['Date: Mon, 03 Nov 2025 10:15:35 GMT', 'Content-Type: text/html', 'Content-Length: 176'] } },
            { s: 'lb', d: 'pc', proto: 'HTTP', app: 'httpRes', t: 6.0, sport: 443, dport: 52344, info: 'HTTP/1.1 502 Bad Gateway · keepalive race: backend closed the reused connection', http: { status: '502 Bad Gateway', note: 'set the backend idle timeout longer than the balancer\'s' } },
          ],
        },
      ],
      quiz: [
        {
          q: 'Your app needs the real client IP for rate limiting. What must the load balancer do?',
          opts: ['Nothing, the source IP is preserved end to end', 'Terminate TLS, strip any client-supplied X-Forwarded-For, and set it itself', 'Use DNS', 'Enable IPv6'],
          a: 1,
          why: 'Inside the DC the source is the balancer. The header must be written by the proxy and any client-supplied value discarded, or it can be forged.',
        },
      ],
    },

    {
      id: 'observability',
      track: 'modern',
      title: 'Watching the wire: flows, eBPF, attacks',
      subtitle: 'How large networks see what is happening',
      scenario: 'dc',
      level: 5,
      minutes: 7,
      goals: ['pcap vs flows vs metrics vs traces', 'what eBPF changes', 'recognising attacks in a capture'],
      refs: [
        { t: 'Network Security: A Systems Approach', u: 'https://github.com/SystemsApproach/security', note: 'free micro-book: DDoS, firewalls, middleboxes' },
        { t: 'awesome-ebpf', u: 'https://github.com/qmonnet/awesome-ebpf', note: 'curated eBPF projects and papers' },
        { t: 'pwru — packet, where are you?', u: 'https://github.com/cilium/pwru', note: 'trace a packet through the kernel and find where it is dropped' },
        { t: 'Sample packet captures', u: 'https://github.com/chrissanders/packets', note: 'real pcaps to practise on' },
      ],
      steps: [
        {
          title: 'Four ways to see traffic',
          sub: 'They answer different questions',
          focus: ['lb', 'app1'],
          what: 'A full capture (pcap) gives every byte and is the only way to see retransmissions, resets and payload. Flow records (NetFlow, IPFIX, sFlow) give five-tuple plus counters, sampled, cheap, and what routers can actually produce at line rate. Metrics are aggregate counters. Distributed traces follow one request across services. Real operations use all four, because none of them scales to cover everything.',
          why: 'Full capture is expensive: storage, CPU and privacy. Most fleets sample 1 in 1,000 flows — which is fine for traffic mix and useless for a single unlucky user\'s retransmissions.',
          analogy: 'Photographs, census forms, dashboard gauges and receipts. Each tells you something the others cannot.',
          terms: [
            { t: 'Flow record', d: 'A summary of one connection: five-tuple, timestamps, byte and packet counts, TCP flags seen.' },
            { t: 'Sampling', d: 'Recording only a fraction of packets or flows; cheap, but blind to rare events.' },
            { t: 'Tail latency', d: 'p99/p999 response times — where user-visible pain lives, and what averages hide.' },
          ],
          card: {
            title: 'Coverage versus cost',
            cols: ['Source', 'Fidelity', 'Cost', 'Best for'],
            rows: [
              ['pcap on one host', 'complete', 'high', 'retransmits, resets, one bad flow'],
              ['flow records', 'summary', 'low', 'traffic mix, top talkers, capacity'],
              ['metrics', 'aggregate', 'very low', 'dashboards, alerting, SLOs'],
              ['distributed traces', 'per request', 'medium', 'which service added the 900 ms'],
            ],
            note: 'The skill is knowing which question each source can answer before you go looking.',
          },
          packets: [
            { s: 'lb', d: 'app1', proto: 'TCP', app: 'tcpData', t: 0.0, sip: '10.0.2.2', dip: '10.0.2.11', sport: 40211, dport: 8080, info: 'Reused connection · retransmission after 200 ms', tcp: { flags: 'PSH, ACK', seq: 1461, ack: 1 }, pay: { label: 'Data', len: 1460 }, note: 'only a full capture shows this; a flow record just shows retransmit count 3' },
          ],
        },
        {
          title: 'eBPF: seeing inside the kernel',
          sub: 'Programs attached to kernel hooks, no userspace copies',
          focus: ['lb', 'app1'],
          what: 'eBPF lets you attach verified programs to kernel events — XDP at the driver, tc at the qdisc, kprobes inside functions like tcp_retransmit_skb. You can count, filter, redirect and trace packets in place, at line rate, without copying every packet to a userspace capture tool.',
          why: 'The 1990s answer (tcpdump) copies packets to userspace and cannot keep up with 100 Gbit/s. eBPF answers operational questions the kernel already knows: which function dropped this packet, which socket is retransmitting, which pod is talking to which.',
          analogy: 'Instead of filming the factory floor, you install sensors on the machines that report only when something is wrong.',
          terms: [
            { t: 'XDP', d: 'eXpress Data Path: a hook at the network driver, before the kernel allocates a socket buffer. Used for DDoS filtering and load balancing.' },
            { t: 'kprobe', d: 'A probe attached to a kernel function, used to observe internal state such as retransmit queues.' },
            { t: 'pwru', d: 'A tool that traces a single packet through every kernel function and tells you exactly where it was dropped.' },
          ],
          packets: [
            { s: 'pc', d: 'lb', proto: 'TCP', app: 'tcpData', t: 0.0, sport: 52344, dport: 443, info: 'SYN arrives · XDP program at the driver counts it before the stack sees it', tcp: { flags: 'SYN', seq: 0 } },
            { s: 'lb', d: 'pc', proto: 'TCP', app: 'tcpData', t: 0.02, sport: 443, dport: 52344, info: 'SYN-ACK sent · kprobe records syncookies issued', tcp: { flags: 'SYN, ACK', seq: 0, ack: 1 } },
          ],
        },
        {
          title: 'Attacks that look like traffic',
          sub: 'SYN floods, reflection, and what actually helps',
          focus: ['lb', 'pc'],
          what: 'A SYN flood sends SYNs and never completes the handshake, filling the half-open table until real clients cannot connect. SYN cookies defeat it: the server encodes the connection state into the sequence number and keeps no state until the handshake completes. Amplification attacks spoof the victim\'s source address and send small queries to open resolvers, which return much larger answers to the victim.',
          why: 'Both attack shapes exploit normal protocol behaviour, so "block the attack" is rarely possible. The working answers are absorbing it (anycast, capacity), filtering spoofed sources at the edge (BCP 38), and not keeping state you cannot afford.',
          analogy: 'A restaurant taking reservations it never expects to be honoured, until no table is left for real diners.',
          terms: [
            { t: 'SYN cookie', d: 'A stateless handshake: connection parameters are encoded in the sequence number, so no table entry is needed until the client proves it can reply.' },
            { t: 'Reflection / amplification', d: 'Sending a request with a forged source so a third party sends a larger response to the victim.' },
            { t: 'BCP 38', d: 'Ingress filtering: networks should drop packets whose source address they do not own. Cheap, and still not universal.' },
          ],
          card: {
            title: 'Attack shapes and the right response',
            cols: ['Shape', 'Signature in a capture', 'Mitigation'],
            rows: [
              ['SYN flood', 'many SYNs, no final ACK', 'SYN cookies, XDP filtering, anycast absorption'],
              ['DNS amplification', 'small queries in, huge UDP to victim', 'close open resolvers, BCP 38, RRL'],
              ['Slowloris', 'many half-open slow HTTP requests', 'timeouts, connection limits, L7 rules'],
              ['Volumetric', 'line-rate junk on one prefix', 'upstream scrubbing, anycast spread'],
            ],
            note: 'A capture tells you the shape in seconds. Choosing the response without knowing the shape is guesswork.',
          },
          packets: [
            { s: 'pc', d: 'lb', proto: 'TCP', app: 'tcpData', t: 0.0, sip: '198.51.100.66', sport: 40001, dport: 443, info: 'SYN · source port climbing fast, never completes', tcp: { flags: 'SYN', seq: 0 } },
            { s: 'pc', d: 'lb', proto: 'TCP', app: 'tcpData', t: 0.001, sip: '198.51.100.66', sport: 40002, dport: 443, info: 'SYN · half-open table filling', tcp: { flags: 'SYN', seq: 0 } },
            { s: 'lb', d: 'pc', proto: 'TCP', app: 'tcpData', t: 0.002, sport: 443, dport: 40002, info: 'SYN-ACK with a cookie · no state stored', tcp: { flags: 'SYN, ACK', seq: 0, ack: 1 }, note: 'if the client never sends the final ACK, nothing was allocated' },
          ],
        },
        {
          title: 'A worked diagnosis',
          sub: 'p99 latency tripled. Where do you look?',
          focus: ['lb', 'app1', 'db'],
          what: 'The dashboard shows p99 up from 120 ms to 900 ms, error rate flat, bandwidth flat. Traces show the extra time inside the app, not the database. Flow records show retransmissions between the balancer and one backend. A capture on that backend shows duplicate ACKs and fast retransmits — a single saturated uplink, not a code change. Fix: drain the backend and rebalance, then raise the interface or fix the queue.',
          why: 'The numbers tell you *where* to look before you look. Flat errors plus rising latency means the system is working but queueing; rising retransmits point at a link; time inside one span points at that service.',
          analogy: 'A doctor ordering one test at a time, each chosen to eliminate a category — not a full-body scan on arrival.',
          terms: [
            { t: 'RED methodology', d: 'Rate, Errors, Duration — the three signals to check first for any service.' },
            { t: 'Drain', d: 'Removing a backend from rotation and letting existing connections finish before taking it out.' },
          ],
          card: {
            title: 'Signal → hypothesis',
            cols: ['Observation', 'Hypothesis'],
            rows: [
              ['errors flat, latency up', 'queueing somewhere: link, CPU, or lock'],
              ['retransmits up on one link', 'loss/duplex/MTU on that path'],
              ['time inside app span', 'the service, not the database'],
              ['RSTs on reused connections', 'idle-timeout mismatch between proxy and backend'],
              ['one backend only', 'that host or its uplink — not the code'],
            ],
            note: 'Every row here is visible in the four sources from the first step. The skill is choosing the cheapest one that can rule something out.',
          },
          packets: [
            { s: 'lb', d: 'app1', proto: 'TCP', app: 'tcpData', t: 0.0, sip: '10.0.2.2', dip: '10.0.2.11', sport: 40211, dport: 8080, info: 'Duplicate ACK ×3 from the backend · segment lost on its uplink', tcp: { flags: 'ACK', seq: 1461, ack: 2921 } },
            { s: 'app1', d: 'lb', proto: 'TCP', app: 'tcpData', t: 0.2, sip: '10.0.2.11', dip: '10.0.2.2', sport: 8080, dport: 40211, info: 'Fast retransmit · the link, not the code', tcp: { flags: 'PSH, ACK', seq: 2921, ack: 1 }, pay: { label: 'Response', len: 1460 }, note: 'drain the backend, then fix the queue or the interface' },
          ],
        },
      ],
      quiz: [
        {
          q: 'A SYN flood is filling the half-open table. Which mitigation keeps the service up without keeping state?',
          opts: ['Blocking port 443', 'SYN cookies — encode state in the sequence number until the handshake completes', 'Increasing the timeout', 'Disabling TLS'],
          a: 1,
          why: 'SYN cookies let the server answer validly without allocating per-connection state, so an uncompleted handshake costs nothing. Longer timeouts make it worse.',
        },
        {
          q: 'Why is 1-in-1000 flow sampling bad for debugging one user\'s retransmissions?',
          opts: ['It is illegal', 'The events are rare, so sampling almost never records them', 'Flows do not contain counters', 'Retransmissions are not in flow records'],
          a: 1,
          why: 'Sampling is fine for aggregate traffic mix and useless for rare events. That is when you need a targeted capture on the specific host or path.',
        },
      ],
    },
  ];

  root.PE_LESSONS_ADVANCED = LESSONS;
})(typeof window !== 'undefined' ? window : globalThis);
