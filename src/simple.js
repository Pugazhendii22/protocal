/* ============================================================
   simple.js — plain-English layer
   Turns lesson prose into short, easy lines and decodes jargon.
   Used by the lesson view; toggled with the "Easy English" button.
   ============================================================ */
(function (root) {
  'use strict';

  /* --- safe word swaps: same meaning, much easier words --- */
  const SWAPS = [
    [/\butilise[sd]?\b/gi, 'use'], [/\butilize[sd]?\b/gi, 'use'], [/\butilisation\b/gi, 'use'],
    [/\bapproximately\b/gi, 'about'], [/\binitiate[sd]?\b/gi, 'start'], [/\binitiates\b/gi, 'starts'],
    [/\bterminate[sd]?\b/gi, 'end'], [/\btermination\b/gi, 'ending'],
    [/\bsubsequent(ly)?\b/gi, 'next'], [/\bprior to\b/gi, 'before'], [/\bin order to\b/gi, 'to'],
    [/\bcommence[sd]?\b/gi, 'start'], [/\bendeavour\b/gi, 'try'], [/\battempt to\b/gi, 'try to'],
    [/\bnumerous\b/gi, 'many'], [/\badditional\b/gi, 'extra'], [/\bsufficient\b/gi, 'enough'],
    [/\bobtain[sd]?\b/gi, 'get'], [/\btransmit[s]?ted?\b/gi, 'send'], [/\btransmit[s]?\b/gi, 'send'],
    [/\btransmission\b/gi, 'sending'], [/\breceive[sd]?\b/gi, 'get'], [/\bregarding\b/gi, 'about'],
    [/\bhowever\b/gi, 'but'], [/\btherefore\b/gi, 'so'], [/\bthus\b/gi, 'so'], [/\bhence\b/gi, 'so'],
    [/\bfurthermore\b/gi, 'also'], [/\bmoreover\b/gi, 'also'], [/\bnevertheless\b/gi, 'still'],
    [/\bprimarily\b/gi, 'mostly'], [/\btypically\b/gi, 'usually'], [/\bfrequently\b/gi, 'often'],
    [/\bimmediately\b/gi, 'right away'], [/\bsimultaneously\b/gi, 'at the same time'],
    [/\bdetermine[sd]?\b/gi, 'decide'], [/\bidentify\b/gi, 'find'], [/\bidentifies\b/gi, 'finds'],
    [/\bguarantee[sd]?\b/gi, 'promise'], [/\bnegotiate[sd]?\b/gi, 'agree on'], [/\bnegotiation\b/gi, 'agreement'],
    [/\bencapsulate[sd]?\b/gi, 'wrap'], [/\bencapsulates\b/gi, 'wraps'], [/\bencapsulation\b/gi, 'wrapping'],
    [/\bpropagate[sd]?\b/gi, 'spread'], [/\bpropagation\b/gi, 'spreading'],
    [/\bverification\b/gi, 'checking'], [/\bvalidat(e|es|ion)\b/gi, 'check'],
    [/\bunauthorised\b/gi, 'not allowed'], [/\bunauthorized\b/gi, 'not allowed'],
    [/\bprivilege[sd]?\b/gi, 'rights'], [/\bexecute[sd]?\b/gi, 'run'],
    [/\bgenerate[sd]?\b/gi, 'make'], [/\bgeneration\b/gi, 'making'], [/\bconstruct(s|ed)?\b/gi, 'build'],
    [/\bmodify\b/gi, 'change'], [/\bmodifies\b/gi, 'changes'], [/\bmodification\b/gi, 'change'],
    [/\bcontain(s)?\b/gi, 'have'], [/\bincludes?\b/gi, 'has'], [/\bcomprises\b/gi, 'is made of'],
    [/\bentire\b/gi, 'whole'], [/\bremainder\b/gi, 'rest'], [/\bcommonly\b/gi, 'usually'],
    [/\bessentially\b/gi, 'basically'], [/\bultimately\b/gi, 'in the end'],
    [/\boptimi[sz]ed?\b/gi, 'made faster'], [/\befficient\b/gi, 'quick'], [/\befficiency\b/gi, 'speed'],
    [/\bterminology\b/gi, 'words'], [/\bimplement(s|ed|ation)?\b/gi, 'build'],
    [/\bconsequently\b/gi, 'so'], [/\bpursuant\b/gi, 'following'],
    [/\bconcerning\b/gi, 'about'], [/\bprovided that\b/gi, 'as long as'],
    [/\bwhether or not\b/gi, 'if'], [/\bin the event that\b/gi, 'if'],
    [/\bat this point in time\b/gi, 'now'], [/\bin the near future\b/gi, 'soon'],
    [/\bprior\b/gi, 'earlier'], [/\bsubsequently\b/gi, 'later'],
  ];

  /* --- jargon decoder: term → plain meaning (shown as chips) --- */
  const DICT = [
    // basics
    ['packet', 'a small piece of a message, with an address on it'],
    ['frame', 'the packet as it travels on the wire, with link addresses added'],
    ['header', 'the label at the front of a packet that says where it is going'],
    ['payload', "the actual data you are sending — everything after the label"],
    ['checksum', 'a maths result used to check the data arrived without damage'],
    ['byte', '8 bits; one character of text is usually one byte'],
    ['bit', 'the smallest unit: a 0 or a 1'],
    ['bandwidth', 'how much data can flow per second'],
    ['latency', 'how long one message takes to go and come back'],
    ['jitter', 'how much the delay keeps changing'],
    ['protocol', 'an agreed set of rules two machines follow to talk'],
    ['port', 'a numbered door on a machine, so replies reach the right app'],
    ['socket', 'one machine, one port, one conversation'],
    ['localhost', 'the machine itself (address 127.0.0.1)'],
    ['loopback', 'address 127.0.0.1 — the machine talking to itself'],
    ['ttl', 'a count that drops by one at every router, so packets cannot loop forever'],
    ['mtu', 'the biggest packet a link can carry in one go'],
    ['fragment', 'a packet cut into smaller pieces because the link could not carry it whole'],
    ['subnet', 'a group of addresses inside one network'],
    ['subnet mask', 'the number that tells which part of an address is the network and which is the machine'],
    ['gateway', 'the door out of your network — usually your router'],
    ['router', 'the device that moves packets from one network to another'],
    ['switch', 'the device that moves frames inside one network'],
    ['mac address', "a device's permanent hardware name, like 00:1a:2b:3c:4d:5e"],
    ['ip address', 'the address a device uses so packets can find it'],
    ['dhcp', 'the service that hands out IP addresses automatically'],
    ['dns', 'the internet phone book: name → IP address'],
    ['resolver', 'the helper server that looks up names for you'],
    ['recursive', 'it goes and asks others until it gets the full answer'],
    ['authoritative', 'the server that actually owns the answer for that name'],
    ['ttl expiry', 'the packet lived too long, so a router threw it away'],
    ['cache', 'a small store of recent answers so you do not have to ask again'],
    ['arp', 'on a local network, the question "who has this IP?" answered with a MAC address'],
    ['broadcast', 'sending to every device on the local network at once'],
    ['icmp', 'the small message system used for ping and error reports'],
    // transport
    ['tcp', 'the careful transport: it numbers, orders and re-sends data'],
    ['udp', 'the quick transport: it just sends and does not look back'],
    ['handshake', 'the hello exchange before two sides start talking'],
    ['syn', '"I want to start a connection"'],
    ['ack', '"I got what you sent"'],
    ['fin', '"I am finished sending"'],
    ['sequence number', 'a counter on every byte so the receiver can put things in order'],
    ['window', 'how much data the receiver can take before it must reply'],
    ['retransmission', 'sending the same data again because no reply came'],
    ['timeout', 'giving up and waiting no more'],
    ['congestion', 'too much traffic in the pipes, so things slow down'],
    ['flow control', 'the receiver telling the sender to slow down'],
    ['congestion window', 'the sender\'s own guess about how much the network can take'],
    ['slow start', 'beginning carefully and speeding up as replies come back'],
    ['triple duplicate ack', 'three "got it, but I am missing one" replies — the signal to re-send'],
    ['buffer', 'a holding area for data that has arrived but is not used yet'],
    ['bufferbloat', 'big buffers making everything feel slow and laggy'],
    ['keep-alive', 'a small periodic message so the connection is not dropped'],
    ['ephemeral port', 'a temporary high-numbered port picked for one connection'],
    // naming and web
    ['http', 'the language browsers and websites use to ask and answer'],
    ['request', 'what the browser asks for'],
    ['response', 'what the server sends back'],
    ['status code', 'a number saying what happened: 200 ok, 404 not found, 500 server error'],
    ['header field', 'one line of extra information in a request or response'],
    ['cookie', 'a small note a site asks the browser to keep and send back'],
    ['tls', 'the encryption layer that makes https private'],
    ['certificate', 'a signed digital id card that proves a site is who it says'],
    ['certificate authority', 'the trusted company that signs those id cards'],
    ['chain of trust', 'certificate, signed by a middle authority, signed by a root you already trust'],
    ['cipher suite', 'the exact set of maths rules used for one encrypted connection'],
    ['key exchange', 'how two sides agree on a secret key they never send'],
    ['forward secrecy', 'old recorded traffic stays safe even if the key leaks later'],
    ['sni', 'the name of the site, sent in the open at the start of a TLS connection'],
    ['alpn', 'the part of the hello where both sides agree on the protocol version'],
    ['http/2', 'a faster version of http that sends many requests at once on one connection'],
    ['http/3', 'http running on quic over udp'],
    ['quic', 'a new transport that is reliable but built on udp, and encrypted by default'],
    ['multiplexing', 'many conversations sharing one connection at the same time'],
    ['head-of-line blocking', 'one lost piece holding up everything behind it'],
    ['dnssec', 'digital signatures on DNS answers, so they cannot be faked'],
    ['doh', 'DNS inside https, so nobody can read your lookups'],
    ['anycast', 'many servers sharing one IP address; you reach the nearest'],
    ['cdn', 'a network of servers close to users that keeps copies of content'],
    // security
    ['encryption', 'scrambling data so only the right person can read it'],
    ['decryption', 'unscrambling it again'],
    ['symmetric', 'both sides use the same key'],
    ['asymmetric', 'two keys: one public, one private'],
    ['public key', 'a key you can share with anyone'],
    ['private key', 'a key you keep secret'],
    ['signature', 'a maths proof that this data came from the holder of a key'],
    ['hash', 'a fixed-size fingerprint of some data'],
    ['ssh', 'an encrypted way to log in to another machine'],
    ['firewall', 'a filter that allows or blocks traffic by rule'],
    ['nat', 'network address translation: many devices share one public IP'],
    ['pat', 'port address translation: the same, using port numbers to tell connections apart'],
    ['cgnat', 'carrier-grade NAT: the ISP puts many customers behind one address'],
    ['mtls', 'both sides show certificates, so both prove who they are'],
    ['zero trust', 'do not trust anything just because it is inside the network'],
    ['load balancer', 'a device that shares incoming traffic across several servers'],
    // routing
    ['bgp', 'the protocol ISPs use to tell each other which addresses they can reach'],
    ['as number', 'a number that identifies one network on the internet'],
    ['ospf', 'a routing protocol used inside one organisation'],
    ['hop', 'one step from one router to the next'],
    ['routing table', 'the list of "to reach X, send it to Y"'],
    ['default route', 'where to send anything you have no better answer for'],
    ['longest prefix match', 'the most specific route wins'],
    ['next hop', 'the very next router on the way'],
    ['convergence', 'everyone finishing updating their routes after a change'],
    ['ipv6', 'the newer IP with much longer addresses (128 bits)'],
    ['slaac', 'a device making up its own IPv6 address from the router announcement'],
    ['ndp', 'IPv6\'s version of ARP plus router discovery'],
    ['ra', 'router advertisement: the message that tells devices the network details'],
    ['dual stack', 'a machine running IPv4 and IPv6 at the same time'],
    // modern / ops
    ['kubernetes', 'a system that runs many containers and connects them'],
    ['pod', 'the smallest unit in kubernetes: usually one container with its own IP'],
    ['clusterip', 'a fake internal IP that forwards to real pods'],
    ['sidecar', 'a helper container that sits beside your app and handles its traffic'],
    ['service mesh', 'a layer of proxies that adds encryption and control between services'],
    ['veth', 'a virtual cable inside the kernel connecting two places'],
    ['overlay', 'a virtual network built on top of a real one'],
    ['vpc', 'your own private slice of a cloud network'],
    ['security group', 'a stateful firewall attached to one machine'],
    ['nacl', 'a stateless firewall attached to a whole subnet'],
    ['conntrack', 'the kernel remembering which connections are open'],
    ['dnat', 'rewriting the destination address of a packet'],
    ['snat', 'rewriting the source address of a packet'],
    ['qdisc', 'the queue rules deciding which packet leaves next'],
    ['dscp', 'a 6-bit label in the packet saying how important it is'],
    ['rtp', 'the format used to carry live audio and video'],
    ['ice', 'the process of finding a path that works between two devices'],
    ['stun', 'a server that tells you what address the outside world sees'],
    ['turn', 'a relay server used when two devices cannot reach each other'],
    ['wi-fi', 'the wireless link between your device and the access point'],
    ['ssid', 'the name of a wi-fi network'],
    ['wpa2', 'the encryption standard used on most wi-fi'],
    ['association', 'joining a wi-fi network'],
    ['ebpf', 'a way to run small programs inside the kernel to see or filter traffic'],
    ['slo', 'a target for how reliable a service should be'],
    ['error budget', 'how much unreliability you are allowed before you must stop changing things'],
    ['observability', 'being able to answer "why is it slow?" from logs, metrics and traces'],
    ['runbook', 'the step-by-step notes for handling a known problem'],
  ];

  const DICT_MAP = {};
  DICT.forEach((d) => { DICT_MAP[d[0]] = d[1]; });

  /* --- text helpers --- */
  function plainSwap(t) {
    let s = t;
    SWAPS.forEach(([re, to]) => {
      s = s.replace(re, (m) => {
        if (m[0] === m[0].toUpperCase() && m.slice(1) === m.slice(1).toLowerCase()) {
          return to[0].toUpperCase() + to.slice(1);
        }
        return to;
      });
    });
    return s;
  }

  const ABBR = /\b(e\.g|i\.e|etc|vs|approx|no)\.$/i;

  /* split prose into short sentences; long ones get broken at , and / , so / because */
  function toLines(text) {
    let t = plainSwap(String(text || '').trim());
    if (!t) return [];
    // protect decimals and dotted names
    const guards = [];
    t = t.replace(/\b\d+\.\d+\b|\b[a-z0-9-]+(\.[a-z0-9-]+)+\b/gi, (m) => {
      guards.push(m);
      return '\u0001' + (guards.length - 1) + '\u0001';
    });
    const MAXW = 13;
    const words = (x) => x.trim().split(/\s+/).filter(Boolean).length;
    const splitOnce = (b) => {
      if (words(b) <= MAXW) return [b];
      // break at a colon or semicolon first — that is a natural pause
      let m = b.match(/^(.{8,140}?)[:;]\s+(\S.*)$/);
      if (m && words(m[2]) >= 3) return [m[1].trim(), m[2].trim()];
      // then at a linking word, but never inside brackets
      const safe = (x) => (x.split('(').length === x.split(')').length);
      m = b.match(/^(.{12,}?)\s+(?:—|but|so|because|which means|and then|while)\s+(\S.*)$/i);
      if (m && safe(m[1]) && words(m[2]) >= 3) return [m[1].trim(), m[2].trim()];
      m = b.match(/^(\S.{10,}?)\s+and\s+(\S.*)$/i);
      if (m && safe(m[1]) && words(m[2]) >= 4) return [m[1].trim(), 'and ' + m[2].trim()];
      return [b];
    };

    let parts = t.split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean);
    const out = [];
    parts.forEach((p) => {
      let bits = [p];
      for (let k = 0; k < 4; k++) {
        const next = [];
        let changed = false;
        bits.forEach((b) => {
          const r = splitOnce(b);
          if (r.length > 1) changed = true;
          r.forEach((x) => next.push(x));
        });
        bits = next;
        if (!changed) break;
      }
      bits.forEach((b, bi) => {
        if (!b) return;
        const isCont = bi > 0 && !/^[A-Z0-9]/.test(b) && !/^and /i.test(b);
        out.push(isCont ? '→ ' + b : b);
      });
    });

    const merged = [];
    out.forEach((l) => {
      if (words(l) < 4 && merged.length && !/^[A-Z]/.test(l)) merged[merged.length - 1] += ' ' + l;
      else merged.push(l);
    });
    return merged.map((l) => l.replace(/[,;:]\s*$/, '')
      .replace(/\u0001(\d+)\u0001/g, (m, i) => guards[+i])
      .replace(/\s+/g, ' ')
      .trim());
  }

  /* which jargon words appear in this text (for the "word help" chips) */
  function jargonIn(text) {
    const low = String(text || '').toLowerCase();
    const hits = [];
    DICT.forEach(([term, meaning]) => {
      if (low.indexOf(term) >= 0) hits.push({ term, meaning });
    });
    // prefer longer terms, keep at most 5
    hits.sort((a, b) => b.term.length - a.term.length);
    const seen = new Set();
    return hits.filter((h) => {
      if (seen.has(h.term)) return false;
      seen.add(h.term);
      return true;
    }).slice(0, 5);
  }

  /* render prose as short lines */
  function lines(text) {
    const ls = toLines(text);
    if (!ls.length) return '';
    if (ls.length === 1) return '<p>' + esc(ls[0]) + '</p>';
    return '<ul class="plainlist">' + ls.map((l) => '<li>' + esc(l) + '</li>').join('') + '</ul>';
  }

  const esc = (s) => String(s == null ? '' : s)
    .replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function wordHelp(text) {
    const hits = jargonIn(text);
    if (!hits.length) return '';
    return '<div class="wordhelp"><span class="wh-lab">Word help</span>' +
      hits.map((h) => '<span class="wh"><b>' + esc(h.term) + '</b> ' + esc(h.meaning) + '</span>').join('') +
      '</div>';
  }

  root.PE_SIMPLE = { lines, toLines, jargonIn, wordHelp, plainSwap, DICT };
})(typeof window !== 'undefined' ? window : globalThis);
