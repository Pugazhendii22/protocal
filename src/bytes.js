/* ============================================================
   bytes.js — real byte-level packet construction
   Builds Ethernet / IPv4 / TCP / UDP / ICMP / DNS / DHCP / ARP /
   TLS / HTTP / SSH / SMTP headers with correct lengths, correct
   IPv4/TCP/UDP/ICMP checksums, and a field map that links every
   header field to its byte offsets (used by the hex inspector).
   ============================================================ */
(function (root) {
  'use strict';

  const u8 = (n) => [n & 0xff];
  const u16 = (n) => [(n >> 8) & 0xff, n & 0xff];
  const u32 = (n) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
  const mac = (s) => s.split(/[:-]/).map((h) => parseInt(h, 16));
  const ip = (s) => (s || '0.0.0.0').split('.').map((n) => parseInt(n, 10) & 0xff);
  const ascii = (s) => Array.from(s).map((c) => c.charCodeAt(0) & 0xff);
  const concat = (...arrs) => arrs.flat();
  const hexToBytes = (s) => (s.replace(/[^0-9a-f]/gi, '').match(/../g) || []).map((h) => parseInt(h, 16));

  /* deterministic pseudo-random bytes, so the "random" fields of a
     session look stable when you revisit a packet */
  function prng(seedStr) {
    let h = 2166136261;
    for (const ch of seedStr) {
      h ^= ch.charCodeAt(0);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return function () {
      h ^= h << 13; h >>>= 0;
      h ^= h >> 17;
      h ^= h << 5; h >>>= 0;
      return h & 0xff;
    };
  }
  function randomBytes(n, seed) {
    const r = prng(seed || 'seed');
    const out = [];
    for (let i = 0; i < n; i++) out.push(r());
    return out;
  }

  /* RFC 1071 — 16-bit one's complement checksum. Really computed. */
  function checksum(bytes) {
    let sum = 0;
    for (let i = 0; i < bytes.length; i += 2) {
      const hi = bytes[i] & 0xff;
      const lo = i + 1 < bytes.length ? bytes[i + 1] & 0xff : 0;
      sum += (hi << 8) | lo;
      if (sum > 0xffff) sum = (sum & 0xffff) + 1;
    }
    while (sum > 0xffff) sum = (sum & 0xffff) + (sum >> 16);
    return ~sum & 0xffff;
  }

  const protoNum = { ICMP: 1, TCP: 6, UDP: 17, GRE: 47, ESP: 50, OSPF: 89, SCTP: 132 };
  const protoName = { 1: 'ICMP', 6: 'TCP', 17: 'UDP' };

  /* ---------- Layer builders -------------------------------------------
     Each returns { name, bytes, fields:[{name, off, len, value, note}] }
     `off` is relative to the start of the layer's bytes.
  --------------------------------------------------------------------- */
  function eth(o) {
    const bytes = concat(mac(o.dst), mac(o.src), u16(o.type || 0x0800));
    const typeName = o.type === 0x0806 ? 'ARP' : o.type === 0x86dd ? 'IPv6' : 'IPv4';
    return {
      name: 'Ethernet II',
      bytes,
      fields: [
        { name: 'Destination MAC', off: 0, len: 6, value: o.dst, note: 'next hop on this link' },
        { name: 'Source MAC', off: 6, len: 6, value: o.src, note: 'the sender NIC' },
        { name: 'EtherType', off: 12, len: 2, value: '0x' + (o.type || 0x0800).toString(16).padStart(4, '0'), note: typeName },
      ],
    };
  }

  function ipv4(o) {
    const payloadLen = o.payload ? o.payload.length : 0;
    const totalLen = 20 + payloadLen;
    const opts = o.options || [];
    const ihl = 5 + opts.length / 4;
    const head = concat(
      u8((4 << 4) | ihl),
      u8(o.dscp || 0),
      u16(totalLen),
      u16(o.id || 0x1c46),
      u16(o.flagsFrag === undefined ? 0x4000 : o.flagsFrag),
      u8(o.ttl === undefined ? 64 : o.ttl),
      u8(protoNum[o.proto] || o.protoNum || 6),
      u16(0), // checksum placeholder
      ip(o.src),
      ip(o.dst),
      opts
    );
    const sum = checksum(head);
    head[10] = (sum >> 8) & 0xff;
    head[11] = sum & 0xff;
    const fragField = o.flagsFrag === undefined ? 0x4000 : o.flagsFrag;
    const df = (fragField & 0x4000) !== 0;
    const mf = (fragField & 0x2000) !== 0;
    const fragOff = fragField & 0x1fff;
    return {
      name: 'Internet Protocol Version 4',
      bytes: concat(head, o.payload || []),
      fields: [
        { name: 'Version', off: 0, len: 1, value: '4', note: 'upper nibble of byte 0' },
        { name: 'Header Length', off: 0, len: 1, value: ihl * 4 + ' bytes', note: 'lower nibble × 4' },
        { name: 'Differentiated Services', off: 1, len: 1, value: '0x' + (o.dscp || 0).toString(16).padStart(2, '0') },
        { name: 'Total Length', off: 2, len: 2, value: totalLen + ' bytes', note: 'header + payload' },
        { name: 'Identification', off: 4, len: 2, value: '0x' + (o.id || 0x1c46).toString(16).padStart(4, '0'), note: 'groups fragments of one datagram' },
        { name: 'Flags', off: 6, len: 2, value: (df ? 'DF ' : '') + (mf ? 'MF' : df || mf ? '' : 'none'), note: 'DF = do not fragment' },
        { name: 'Fragment Offset', off: 6, len: 2, value: String(fragOff) },
        { name: 'Time to Live', off: 8, len: 1, value: String(o.ttl === undefined ? 64 : o.ttl), note: 'hops left before the packet is dropped' },
        { name: 'Protocol', off: 9, len: 1, value: protoName[protoNum[o.proto]] || o.proto, note: 'what is inside this packet' },
        { name: 'Header Checksum', off: 10, len: 2, value: '0x' + sum.toString(16).padStart(4, '0'), note: 'computed over the header' },
        { name: 'Source Address', off: 12, len: 4, value: o.src },
        { name: 'Destination Address', off: 16, len: 4, value: o.dst },
      ],
    };
  }

  const FLAG_BITS = { FIN: 0x01, SYN: 0x02, RST: 0x04, PSH: 0x08, ACK: 0x10, URG: 0x20, ECE: 0x40, CWR: 0x80 };
  function flagByte(s) {
    return (s || '').split(/[,\s]+/).filter(Boolean).reduce((a, f) => a | (FLAG_BITS[f] || 0), 0);
  }

  function tcp(o) {
    const payload = o.payload || [];
    const opts = o.options === null ? [] : o.options || defaultTcpOptions(o);
    const dataOffset = 5 + opts.length / 4;
    let head = concat(
      u16(o.srcPort),
      u16(o.dstPort),
      u32(o.seq || 0),
      u32(o.ack || 0),
      u8(dataOffset << 4),
      u8(flagByte(o.flags)),
      u16(o.window === undefined ? 64240 : o.window),
      u16(0), // checksum
      u16(o.urgent || 0),
      opts
    );
    // pseudo header + tcp segment, the real way (IPv6 has its own pseudo-header)
    const pseudo = o.v6
      ? concat(ip6bytes(o.v6.src), ip6bytes(o.v6.dst), u32(head.length + payload.length), [0, 0, 0], u8(6))
      : concat(ip(o.srcIp), ip(o.dstIp), u8(0), u8(6), u16(head.length + payload.length));
    const sum = checksum(concat(pseudo, head, payload));
    head[16] = (sum >> 8) & 0xff;
    head[17] = sum & 0xff;
    const fields = [
      { name: 'Source Port', off: 0, len: 2, value: String(o.srcPort), note: 'the sending application' },
      { name: 'Destination Port', off: 2, len: 2, value: String(o.dstPort), note: 'the service being called' },
      { name: 'Sequence Number', off: 4, len: 4, value: String(o.seq || 0), note: 'byte position in the stream' },
      { name: 'Acknowledgment Number', off: 8, len: 4, value: String(o.ack || 0), note: 'next byte expected' },
      { name: 'Data Offset', off: 12, len: 1, value: dataOffset * 4 + ' bytes' },
      { name: 'Flags', off: 13, len: 1, value: o.flags || 'ACK', note: 'SYN/ACK/FIN/RST/PSH control bits' },
      { name: 'Window', off: 14, len: 2, value: String(o.window === undefined ? 64240 : o.window), note: 'how much data we can accept' },
      { name: 'Checksum', off: 16, len: 2, value: '0x' + sum.toString(16).padStart(4, '0'), note: 'covers header, data and a pseudo-header' },
      { name: 'Urgent Pointer', off: 18, len: 2, value: '0' },
    ];
    if (opts.length) {
      fields.push({ name: 'Options', off: 20, len: opts.length, value: tcpOptionNames(o).join(', '), note: 'negotiated once, in the handshake' });
    }
    return { name: 'Transmission Control Protocol', bytes: concat(head, payload), fields };
  }

  function defaultTcpOptions(o) {
    if (!o.isSyn) return [];
    // MSS 1460, SACK permitted, Timestamps, NOP, Window Scale 8 — a typical modern SYN
    return concat(
      [2, 4, 0x05, 0xb4],
      [4, 2],
      [8, 10, 0, 0, 0, 0, 0, 0, 0, 0],
      [1, 3, 3, 8]
    );
  }
  function tcpOptionNames(o) {
    const names = [];
    const opts = o.options || defaultTcpOptions(o);
    let i = 0;
    while (i < opts.length) {
      const kind = opts[i];
      if (kind === 0) { names.push('End of Options'); break; }
      if (kind === 1) { names.push('NOP'); i += 1; continue; }
      const len = opts[i + 1] || 2;
      names.push(
        { 2: 'Maximum Segment Size', 3: 'Window Scale', 4: 'SACK Permitted', 8: 'Timestamps' }[kind] || 'Option ' + kind
      );
      i += len;
    }
    return names;
  }

  function udp(o) {
    const payload = o.payload || [];
    const len = 8 + payload.length;
    let head = concat(u16(o.srcPort), u16(o.dstPort), u16(len), u16(0));
    const pseudo = o.v6
      ? concat(ip6bytes(o.v6.src), ip6bytes(o.v6.dst), u32(len), [0, 0, 0], u8(17))
      : concat(ip(o.srcIp), ip(o.dstIp), u8(0), u8(17), u16(len));
    let sum = checksum(concat(pseudo, head, payload));
    if (sum === 0) sum = 0xffff;
    head[6] = (sum >> 8) & 0xff;
    head[7] = sum & 0xff;
    return {
      name: 'User Datagram Protocol',
      bytes: concat(head, payload),
      fields: [
        { name: 'Source Port', off: 0, len: 2, value: String(o.srcPort) },
        { name: 'Destination Port', off: 2, len: 2, value: String(o.dstPort) },
        { name: 'Length', off: 4, len: 2, value: len + ' bytes', note: 'header + data, no more' },
        { name: 'Checksum', off: 6, len: 2, value: '0x' + sum.toString(16).padStart(4, '0') },
      ],
    };
  }

  function icmp(o) {
    const data = o.data || [];
    const head = concat(u8(o.type), u8(o.code || 0), u16(0), u16(o.id || 0x1234), u16(o.seq || 1));
    const all = concat(head, data);
    const sum = checksum(all);
    all[2] = (sum >> 8) & 0xff;
    all[3] = sum & 0xff;
    const types = { 0: 'Echo Reply', 3: 'Destination Unreachable', 8: 'Echo Request', 11: 'Time Exceeded' };
    return {
      name: 'Internet Control Message Protocol',
      bytes: all,
      fields: [
        { name: 'Type', off: 0, len: 1, value: o.type + ' (' + (types[o.type] || '') + ')' },
        { name: 'Code', off: 1, len: 1, value: String(o.code || 0) },
        { name: 'Checksum', off: 2, len: 2, value: '0x' + sum.toString(16).padStart(4, '0'), note: 'the whole ICMP message' },
        { name: 'Identifier', off: 4, len: 2, value: '0x' + (o.id || 0x1234).toString(16) },
        { name: 'Sequence Number', off: 6, len: 2, value: String(o.seq || 1) },
      ],
    };
  }

  function nameToLabels(name) {
    return name
      .replace(/\.$/, '')
      .split('.')
      .flatMap((label) => concat(u8(label.length), ascii(label)))
      .concat([0]);
  }

  function dnsQNameFields(labelsBytes, baseOff) {
    const fields = [];
    let i = 0;
    let off = baseOff;
    let label = '';
    while (i < labelsBytes.length && labelsBytes[i] !== 0) {
      const len = labelsBytes[i];
      const txt = String.fromCharCode.apply(null, labelsBytes.slice(i + 1, i + 1 + len));
      fields.push({ name: 'Name: ' + txt, off: off, len: len + 1, value: txt, note: 'length byte + ' + len + ' characters' });
      i += len + 1;
      off += len + 1;
      label += txt + '.';
    }
    fields.push({ name: 'Name: terminator', off: off, len: 1, value: '0x00', note: 'end of the ' + label.replace(/\.$/, '') + ' name' });
    return fields;
  }

  const QTYPE = { A: 1, NS: 2, CNAME: 5, SOA: 6, PTR: 12, MX: 15, AAAA: 28, HTTPS: 65 };
  const QTYPE_NAME = { 1: 'A', 2: 'NS', 5: 'CNAME', 6: 'SOA', 12: 'PTR', 15: 'MX', 28: 'AAAA', 65: 'HTTPS' };

  function dnsQuery(o) {
    const id = o.id || 0x1a2b;
    const qname = nameToLabels(o.name);
    const head = concat(u16(id), u16(o.flags === undefined ? 0x0100 : o.flags), u16(1), u16(0), u16(0), u16(0));
    const q = concat(qname, u16(QTYPE[o.qtype || 'A']), u16(1));
    const bytes = concat(head, q);
    const fields = [
      { name: 'Transaction ID', off: 0, len: 2, value: '0x' + id.toString(16).padStart(4, '0'), note: 'matches reply to question' },
      { name: 'Flags', off: 2, len: 2, value: '0x' + (o.flags === undefined ? 0x0100 : o.flags).toString(16).padStart(4, '0'), note: '0x0100 = standard query, recursion desired' },
      { name: 'Questions', off: 4, len: 2, value: '1' },
      { name: 'Answer RRs', off: 6, len: 2, value: '0' },
      { name: 'Authority RRs', off: 8, len: 2, value: '0' },
      { name: 'Additional RRs', off: 10, len: 2, value: '0' },
      ...dnsQNameFields(qname, 12),
    ];
    const qtypeOff = 12 + qname.length;
    fields.push({ name: 'Type', off: qtypeOff, len: 2, value: (o.qtype || 'A') + ' (1 is an IPv4 address)' });
    fields.push({ name: 'Class', off: qtypeOff + 2, len: 2, value: 'IN (internet)' });
    return { name: 'Domain Name System', bytes, fields };
  }

  function dnsResponse(o) {
    const id = o.id || 0x1a2b;
    const qname = nameToLabels(o.name);
    const answers = o.answers || [{ type: 'A', ttl: 300, rdata: '203.0.113.10' }];
    // flags: QR=1 AA maybe, RD=1 RA=1
    const flags = o.flags === undefined ? 0x8180 : o.flags;
    const head = concat(u16(id), u16(flags), u16(1), u16(answers.length), u16(0), u16(0));
    const q = concat(qname, u16(QTYPE[o.qtype || 'A']), u16(1));
    let body = [];
    const ansFields = [];
    let base = 12 + q.length;
    answers.forEach((a, idx) => {
      const rdata =
        a.type === 'A' ? ip(a.rdata)
          : a.type === 'CNAME' ? nameToLabels(a.rdata)
          : a.type === 'AAAA' ? (Array.isArray(a.rdata) ? a.rdata : hexToBytes(a.rdata))
          : a.rdata || [0, 0, 0, 0];
      const rr = concat(
        [0xc0, 0x0c], // compression pointer to the question name
        u16(QTYPE[a.type] || 1),
        u16(1),
        u32(a.ttl === undefined ? 300 : a.ttl),
        u16(rdata.length),
        rdata
      );
      const shown = (a.type === 'AAAA' && Array.isArray(rdata))
        ? rdata.map((x) => x.toString(16).padStart(2, '0')).join('').replace(/(.{4})(?=.)/g, '$1:')
        : a.rdata;
      ansFields.push({
        name: 'Answer ' + (idx + 1) + ' → ' + (a.type || 'A'),
        off: base,
        len: rr.length,
        value: shown,
        note: 'name pointer + type/class/TTL/rdlength + ' + rdata.length + ' data bytes',
      });
      body = body.concat(rr);
      base += rr.length;
    });
    const bytes = concat(head, q, body);
    const fields = [
      { name: 'Transaction ID', off: 0, len: 2, value: '0x' + id.toString(16).padStart(4, '0') },
      { name: 'Flags', off: 2, len: 2, value: '0x' + flags.toString(16).padStart(4, '0'), note: '0x8180 = response, recursion available' },
      { name: 'Questions', off: 4, len: 2, value: '1' },
      { name: 'Answer RRs', off: 6, len: 2, value: String(answers.length) },
      { name: 'Authority RRs', off: 8, len: 2, value: '0' },
      { name: 'Additional RRs', off: 10, len: 2, value: '0' },
      ...dnsQNameFields(qname, 12),
      { name: 'Type', off: 12 + qname.length, len: 2, value: (o.qtype || 'A') + ' (1)' },
      { name: 'Class', off: 14 + qname.length, len: 2, value: 'IN' },
      ...ansFields,
    ];
    return { name: 'Domain Name System', bytes, fields };
  }

  const DHCP_TYPES = { 1: 'Discover', 2: 'Offer', 3: 'Request', 4: 'Decline', 5: 'ACK', 6: 'NAK', 7: 'Release', 8: 'Inform' };
  function dhcp(o) {
    const xid = o.xid || 0x3903f326;
    const opts = [];
    const optFields = [];
    let off = 240;
    const pushOpt = (code, data, label, note) => {
      const seg = concat(u8(code), u8(data.length), data);
      optFields.push({ name: 'Option ' + code + ': ' + label, off, len: seg.length, value: String.fromCharCode.apply(null, data.filter((b) => b >= 32 && b < 127)) || data.map((b) => (b <= 15 ? b.toString(16) : b)).join('.'), note });
      opts.push(...seg);
      off += seg.length;
    };
    pushOpt(53, u8(o.msgType || 1), 'DHCP Message Type', DHCP_TYPES[o.msgType || 1]);
    if (o.clientId) pushOpt(61, concat([1], mac(o.clientId)), 'Client Identifier', 'the MAC address, so the server knows who is asking');
    if (o.requested) pushOpt(50, ip(o.requested), 'Requested IP Address', o.requested);
    if (o.hostname) pushOpt(12, ascii(o.hostname), 'Host Name', o.hostname);
    pushOpt(55, [1, 3, 6, 15, 26, 28], 'Parameter Request List', 'subnet mask, router, DNS, domain, MTU');
    if (o.subnet) pushOpt(1, ip(o.subnet), 'Subnet Mask', o.subnet);
    if (o.router) pushOpt(3, ip(o.router), 'Router', o.router);
    if (o.dns) pushOpt(6, ip(o.dns), 'Domain Name Server', o.dns);
    if (o.lease) pushOpt(51, u32(o.lease), 'IP Address Lease Time', (o.lease / 86400).toFixed(0) + ' days');
    if (o.serverId) pushOpt(54, ip(o.serverId), 'DHCP Server Identifier', o.serverId);
    pushOpt(255, [], 'End', 'end of options');
    const fixed = concat(
      u8(o.op === 'reply' ? 2 : 1),
      u8(1), // htype ethernet
      u8(6), // hlen
      u8(0), // hops
      u32(xid),
      u16(0), // secs
      u16(o.broadcast === false ? 0x0000 : 0x8000),
      ip(o.ciaddr || '0.0.0.0'),
      ip(o.yiaddr || '0.0.0.0'),
      ip(o.siaddr || '0.0.0.0'),
      ip(o.giaddr || '0.0.0.0'),
      mac(o.clientId || '00:1a:2b:3c:4d:5e'),
      new Array(10).fill(0),
      new Array(64).fill(0),
      new Array(128).fill(0),
      [0x63, 0x82, 0x53, 0x63]
    );
    const bytes = concat(fixed, opts);
    const fields = [
      { name: 'Message type', off: 0, len: 1, value: o.op === 'reply' ? '2 (BOOTREPLY)' : '1 (BOOTREQUEST)' },
      { name: 'Hardware type', off: 1, len: 1, value: '1 (Ethernet)' },
      { name: 'Hardware length', off: 2, len: 1, value: '6' },
      { name: 'Transaction ID', off: 4, len: 4, value: '0x' + xid.toString(16) },
      { name: 'Flags', off: 10, len: 2, value: '0x8000', note: 'broadcast flag: reply to everyone, I have no IP yet' },
      { name: 'Client IP (ciaddr)', off: 12, len: 4, value: o.ciaddr || '0.0.0.0' },
      { name: 'Your IP (yiaddr)', off: 16, len: 4, value: o.yiaddr || '0.0.0.0', note: 'the address the server is offering' },
      { name: 'Server IP (siaddr)', off: 20, len: 4, value: o.siaddr || '0.0.0.0' },
      { name: 'Client MAC (chaddr)', off: 28, len: 6, value: o.clientId || '00:1a:2b:3c:4d:5e' },
      { name: 'Magic cookie', off: 236, len: 4, value: '0x63825363', note: 'says "DHCP options follow"' },
      ...optFields,
    ];
    return { name: 'Dynamic Host Configuration Protocol', bytes, fields };
  }

  function arp(o) {
    const bytes = concat(
      u16(1),
      u16(0x0800),
      u8(6),
      u8(4),
      u16(o.op || 1),
      mac(o.senderMac),
      ip(o.senderIp),
      mac(o.targetMac || (o.op === 2 ? o.senderMac : '00:00:00:00:00:00')),
      ip(o.targetIp)
    );
    return {
      name: 'Address Resolution Protocol',
      bytes,
      fields: [
        { name: 'Hardware type', off: 0, len: 2, value: '1 (Ethernet)' },
        { name: 'Protocol type', off: 2, len: 2, value: '0x0800 (IPv4)' },
        { name: 'Operation', off: 6, len: 2, value: o.op === 2 ? '2 (Reply)' : '1 (Request)' },
        { name: 'Sender MAC', off: 8, len: 6, value: o.senderMac },
        { name: 'Sender IP', off: 14, len: 4, value: o.senderIp },
        { name: 'Target MAC', off: 18, len: 6, value: o.targetMac || (o.op === 2 ? o.senderMac : '00:00:00:00:00:00'), note: 'unknown in a request, hence the broadcast' },
        { name: 'Target IP', off: 24, len: 4, value: o.targetIp },
      ],
    };
  }

  const TLS_NAMES = { 1: 'Client Hello', 2: 'Server Hello', 11: 'Certificate', 12: 'Server Key Exchange', 14: 'Server Hello Done', 16: 'Client Key Exchange', 20: 'Finished' };
  function tls(o) {
    const seed = o.seed || 'tls';
    const handshake = !!o.handshakeType;
    let body;
    const fields = [];
    if (handshake) {
      const rand = randomBytes(32, seed + 'rand');
      const content =
        o.handshakeType === 1
          ? concat(
              [0x03, 0x03],
              rand,
              u8(32),
              randomBytes(32, seed + 'sess'),
              u16(o.cipherCount || 17),
              ...Array.from({ length: o.cipherCount || 17 }, (_, i) => [0xc0, 0x2b + i]),
              u8(1),
              [0x00],
              u16(o.extLength || 334),
              randomBytes(o.extLength || 334, seed + 'ext')
            )
          : o.handshakeType === 2
          ? concat([0x03, 0x03], rand, u8(32), randomBytes(32, seed + 'sess'), [0xc0, 0x2f], u8(0), u16(o.extLength || 45), randomBytes(o.extLength || 45, seed + 'sext'))
          : randomBytes(o.length || 1200, seed + 'hs');
      body = concat(u8(o.handshakeType), u24(content.length), content);
      fields.push({ name: 'Handshake Type', off: 5, len: 1, value: o.handshakeType + ' (' + (TLS_NAMES[o.handshakeType] || '') + ')' });
      fields.push({ name: 'Handshake Length', off: 6, len: 3, value: body.length - 4 + ' bytes' });
      fields.push({ name: 'Handshake Body', off: 9, len: body.length - 4, value: (o.handshakeType === 1 || o.handshakeType === 2) ? 'version, 32-byte random, session id, cipher suites, extensions' : 'certificate chain / key material', note: 'the part a browser parses' });
    } else {
      body = randomBytes(o.length || 96, seed + 'app');
      fields.push({ name: 'Encrypted Application Data', off: 5, len: body.length, value: '·· encrypted ··', note: 'unreadable without the session keys — this is the point of HTTPS' });
    }
    const bytes = concat([o.contentType || (handshake ? 22 : 23), 0x03, 0x03], u16(body.length), body);
    return {
      name: 'Transport Layer Security',
      bytes,
      fields: [
        { name: 'Content Type', off: 0, len: 1, value: (o.contentType || (handshake ? 22 : 23)) === 22 ? '22 (Handshake)' : '23 (Application Data)' },
        { name: 'Legacy Version', off: 1, len: 2, value: '0x0303 (TLS 1.2 record, 1.3 inside)' },
        { name: 'Record Length', off: 3, len: 2, value: body.length + ' bytes' },
        ...fields,
      ],
    };
  }
  const u24 = (n) => [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];

  function http(o) {
    let text;
    if (o.status) {
      const headers = o.headers || [
        'Date: Mon, 03 Nov 2025 10:15:32 GMT',
        'Content-Type: text/html; charset=utf-8',
        'Content-Length: 512',
        'Cache-Control: max-age=3600',
        'ETag: "5f8b2c"',
      ];
      text = 'HTTP/1.1 ' + o.status + '\r\n' + headers.join('\r\n') + '\r\n\r\n' + (o.body || '');
    } else {
      const headers = o.headers || [
        'Host: ' + (o.host || 'www.example.com'),
        'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept: text/html,application/xhtml+xml',
        'Accept-Encoding: gzip, deflate, br',
        'Connection: keep-alive',
      ];
      text = (o.method || 'GET') + ' ' + (o.path || '/') + ' HTTP/1.1\r\n' + headers.join('\r\n') + '\r\n\r\n' + (o.body || '');
    }
    const bytes = ascii(text);
    const fields = [];
    let off = 0;
    text.split('\r\n').forEach((line) => {
      if (!line) {
        fields.push({ name: 'End of headers', off: off, len: 2, value: 'CRLF CRLF', note: 'blank line: the body starts here' });
        off += 2;
        return;
      }
      const colon = line.indexOf(':');
      fields.push({
        name: colon > -1 ? line.slice(0, colon) : (o.status ? 'Status line' : 'Request line'),
        off: off,
        len: line.length + 2,
        value: colon > -1 ? line.slice(colon + 1).trim() : line,
        note: colon > -1 ? 'header' : 'method, path, version',
      });
      off += line.length + 2;
    });
    if (o.body) fields.push({ name: 'Body', off: text.length - o.body.length, len: o.body.length, value: o.body.slice(0, 40) + (o.body.length > 40 ? '…' : ''), note: 'the actual content' });
    return { name: 'Hypertext Transfer Protocol', bytes, fields };
  }

  function textProto(name, text) {
    const bytes = ascii(text);
    const fields = text.split('\r\n').filter(Boolean).map((line, i, arr) => {
      const before = arr.slice(0, i).join('\r\n');
      return { name: i === 0 ? 'Command / response' : 'Line ' + (i + 1), off: before.length + (i ? 2 : 0), len: line.length, value: line.slice(0, 60) };
    });
    return { name, bytes, fields };
  }

  function rawPayload(label, len, seed, note) {
    return {
      name: label || 'Data',
      bytes: randomBytes(len, seed || label),
      fields: [{ name: label || 'Data', off: 0, len, value: '·· ' + (note || 'application data') + ' ··', note: 'the bytes a lesson cannot show: encrypted, random, or file contents' }],
    };
  }


  /* ---------------- IPv6 ------------------------------------------------ */
  function ip6bytes(str) {
    const s = String(str || '::').trim();
    const [head, tail] = s.includes('::') ? s.split('::') : [s, null];
    const h = head ? head.split(':').filter((x) => x !== '') : [];
    const t = tail ? tail.split(':').filter((x) => x !== '') : [];
    const missing = 8 - (h.length + t.length);
    const groups = h.concat(new Array(tail === null ? 0 : missing).fill('0'), t);
    const out = [];
    groups.slice(0, 8).forEach((g) => {
      const v = parseInt(g || '0', 16);
      out.push((v >> 8) & 0xff, v & 0xff);
    });
    while (out.length < 16) out.push(0);
    return out;
  }

  function ipv6(o) {
    const payload = o.payload || [];
    const nextHeader = o.nextHeader === undefined ? 6 : o.nextHeader;
    const head = concat(
      u32(((6 << 28) | ((o.tclass || 0) << 20) | (o.flow || 0)) >>> 0),
      u16(payload.length),
      u8(nextHeader),
      u8(o.hopLimit === undefined ? 64 : o.hopLimit),
      ip6bytes(o.src),
      ip6bytes(o.dst)
    );
    const nhName = { 6: 'TCP', 17: 'UDP', 58: 'ICMPv6', 43: 'Routing', 44: 'Fragment', 0: 'Hop-by-Hop', 50: 'ESP', 51: 'AH' }[nextHeader] || String(nextHeader);
    return {
      name: 'Internet Protocol Version 6',
      bytes: head,
      fields: [
        { name: 'Version', off: 0, len: 1, value: '6', note: 'upper nibble of byte 0 — fixed 40-byte header, no IHL' },
        { name: 'Traffic Class', off: 0, len: 2, value: String(o.tclass || 0), note: 'like IPv4 DSCP; shares bytes with the flow label' },
        { name: 'Flow Label', off: 1, len: 3, value: String(o.flow || 0), note: 'lets routers keep a flow on one path' },
        { name: 'Payload Length', off: 4, len: 2, value: payload.length + ' bytes', note: 'everything after this 40-byte header' },
        { name: 'Next Header', off: 6, len: 1, value: nextHeader + ' (' + nhName + ')', note: 'chain of headers instead of IPv4 options' },
        { name: 'Hop Limit', off: 7, len: 1, value: String(o.hopLimit === undefined ? 64 : o.hopLimit), note: 'IPv4 TTL, renamed honestly' },
        { name: 'Source Address', off: 8, len: 16, value: o.src },
        { name: 'Destination Address', off: 24, len: 16, value: o.dst },
      ],
      payloadLen: payload.length,
    };
  }

  /* ICMPv6 — checksum covers an IPv6 pseudo-header, unlike ICMPv4 */
  function icmpv6(o) {
    const type = o.type === undefined ? 128 : o.type;
    const names = { 1: 'Destination Unreachable', 2: 'Packet Too Big', 3: 'Time Exceeded', 128: 'Echo Request', 129: 'Echo Reply', 133: 'Router Solicitation', 134: 'Router Advertisement', 135: 'Neighbor Solicitation', 136: 'Neighbor Advertisement' };
    let body;
    if (type === 135) {
      body = concat(new Array(4).fill(0), ip6bytes(o.target), [1, 1], mac(o.slladdr || 'a4:5e:60:1b:2c:3d'));
    } else if (type === 136) {
      body = concat([o.solicited === false ? 0x20 : 0x60, 0, 0, 0], ip6bytes(o.target), [2, 1], mac(o.tlladdr || 'a4:5e:60:1b:2c:3d'));
    } else if (type === 134) {
      body = concat(u8(64), u8(o.flags === undefined ? 0xc0 : o.flags), u16(1800), u32(o.reachable || 30000), u32(o.retrans || 1000),
        // prefix information option: type 3, len 4, prefix len 64, flags 0xc0 (autonomous + on-link), lifetimes, prefix, reserved
        [3, 4, o.prefixLen || 64, 0xc0], u32(o.valid || 2592000), u32(o.preferred || 604800), new Array(4).fill(0),
        ip6bytes(o.prefix || '2001:db8:1:2::'), new Array(16).fill(0));
    } else {
      body = concat(u16(o.id || 0x1234), u16(o.seq || 1), o.data || []);
    }
    let msg = concat(u8(type), u8(o.code || 0), u16(0), body);
    const pseudo = concat(ip6bytes(o.src), ip6bytes(o.dst), u32(msg.length), [0, 0, 0], u8(58));
    const sum = checksum(concat(pseudo, msg));
    msg[2] = (sum >> 8) & 0xff;
    msg[3] = sum & 0xff;
    const fields = [
      { name: 'Type', off: 0, len: 1, value: type + ' (' + (names[type] || '') + ')' },
      { name: 'Code', off: 1, len: 1, value: String(o.code || 0) },
      { name: 'Checksum', off: 2, len: 2, value: '0x' + sum.toString(16).padStart(4, '0'), note: 'computed over an IPv6 pseudo-header' },
    ];
    if (type === 135 || type === 136) {
      fields.push({ name: type === 135 ? 'Reserved' : 'Flags (R|S|O)', off: 4, len: 4, value: type === 135 ? '0' : (o.solicited === false ? 'S=0' : 'S=1') , note: type === 135 ? 'must be zero' : 'S means "this answers a solicitation"' });
      fields.push({ name: 'Target Address', off: 8, len: 16, value: o.target, note: 'the address being resolved' });
      fields.push({ name: 'Option: Link-Layer Address', off: 24, len: 8, value: (type === 135 ? o.slladdr : o.tlladdr) || 'a4:5e:60:1b:2c:3d', note: 'IPv6 does this inside ICMPv6 — there is no ARP' });
    } else if (type === 134) {
      fields.push({ name: 'Cur Hop Limit', off: 4, len: 1, value: String(o.hop || 64), note: 'the default a host should use' });
      fields.push({ name: 'Flags', off: 5, len: 1, value: '0x' + (o.flags === undefined ? 0xc0 : o.flags).toString(16), note: 'M=managed (DHCPv6), O=other config, A=autonomous SLAAC' });
      fields.push({ name: 'Router Lifetime', off: 6, len: 2, value: '1800 s' });
      fields.push({ name: 'Reachable Time', off: 8, len: 4, value: (o.reachable || 30000) + ' ms' });
      fields.push({ name: 'Retrans Timer', off: 12, len: 4, value: (o.retrans || 1000) + ' ms' });
      fields.push({ name: 'Prefix Information', off: 16, len: 32, value: (o.prefix || '2001:db8:1:2::') + '/' + (o.prefixLen || 64), note: 'the prefix a host uses to build its own address (SLAAC)' });
    } else {
      fields.push({ name: 'Identifier', off: 4, len: 2, value: '0x' + (o.id || 0x1234).toString(16) });
      fields.push({ name: 'Sequence', off: 6, len: 2, value: String(o.seq || 1) });
    }
    return { name: 'Internet Control Message Protocol v6', bytes: msg, fields };
  }

  const Builders = { eth, ipv4, ipv6, icmpv6, ip6bytes, tcp, udp, icmp, dnsQuery, dnsResponse, dhcp, arp, tls, http, textProto, rawPayload, checksum, randomBytes };

  root.PE_BYTES = Builders;
})(typeof window !== 'undefined' ? window : globalThis);
