/* ============================================================
   engine.js — compiles a lesson script into real packets
   ============================================================ */
(function (root) {
  'use strict';

  const B = root.PE_BYTES;
  const TOPO = root.PE_TOPO.TOPOLOGIES;

  const APP_DEFAULTS = {
    dnsq: { proto: 'UDP', sport: 51000, dport: 53, label: 'DNS' },
    dnsr: { proto: 'UDP', sport: 53, dport: 51000, label: 'DNS' },
    dhcp: { proto: 'UDP', sport: 68, dport: 67, label: 'DHCP' },
    httpReq: { proto: 'TCP', sport: 52344, dport: 80, label: 'HTTP' },
    httpRes: { proto: 'TCP', sport: 80, dport: 52344, label: 'HTTP' },
    tls: { proto: 'TCP', sport: 52344, dport: 443, label: 'TLS' },
    quic: { proto: 'UDP', sport: 52344, dport: 443, label: 'QUIC' },
    tcpData: { proto: 'TCP', sport: 52344, dport: 443, label: 'TCP' },
    udpData: { proto: 'UDP', sport: 52344, dport: 53, label: 'UDP' },
    icmp: { proto: 'ICMP', sport: null, dport: null, label: 'ICMP' },
    arp: { proto: 'ARP', sport: null, dport: null, label: 'ARP' },
    sshText: { proto: 'TCP', sport: 49812, dport: 22, label: 'SSH' },
    smtpText: { proto: 'TCP', sport: 51121, dport: 587, label: 'SMTP' },
    imapText: { proto: 'TCP', sport: 51800, dport: 993, label: 'IMAP' },
    ftpText: { proto: 'TCP', sport: 51140, dport: 21, label: 'FTP' },
    pop3Text: { proto: 'TCP', sport: 51130, dport: 995, label: 'POP3' },
    bgpText: { proto: 'TCP', sport: 179, dport: 179, label: 'BGP' },
    icmpv6: { proto: 'ICMP', sport: null, dport: null, label: 'ICMPv6' },
    ndp: { proto: 'ICMP', sport: null, dport: null, label: 'NDP' },
  };

  const CATEGORY = {
    DNS: 'dns', DHCP: 'dhcp', ARP: 'arp', ICMP: 'icmp', TLS: 'tls', QUIC: 'quic',
    HTTP: 'http', SMTP: 'smtp', IMAP: 'imap', POP3: 'pop3', FTP: 'ftp', SSH: 'ssh', BGP: 'bgp',
    ICMPv6: 'icmp6', NDP: 'ndp',
    TCP: 'tcp', UDP: 'udp', IP: 'ip',
  };

  const PROTO_COLORS = {
    DNS: '#7c9eff', DHCP: '#f0a95c', ARP: '#b98cff', ICMP: '#ff7b8a', TLS: '#c084fc',
    QUIC: '#2dd4bf', HTTP: '#4ade80', SMTP: '#f59e0b', IMAP: '#38bdf8', POP3: '#60a5fa',
    FTP: '#fb923c', SSH: '#a78bfa', BGP: '#f472b6', TCP: '#22d3ee', UDP: '#94a3b8', IP: '#cbd5e1',
  };

  function deviceIndex(topo) {
    const m = {};
    topo.devices.forEach((d) => { m[d.id] = d; });
    return m;
  }

  function parseIp(s) { return (s || '0.0.0.0').split('.').map(Number); }
  function prefixOf(ip, len) { return parseIp(ip).slice(0, len / 8).join('.'); }
  function sameSubnet(a, b, lan) {
    if (!a || !b || a === '—' || b === '—') return false;
    const pl = lan && lan.prefix ? lan.prefix : 24;
    return prefixOf(a, pl) === prefixOf(b, pl);
  }

  function payloadFor(spec, app, ctx, srcIp, dstIp) {
    const s = spec;
    switch (app) {
      case 'dnsq':
        return B.dnsQuery(Object.assign({ name: 'www.example.com', qtype: 'A' }, s.dns || {}));
      case 'dnsr':
        return B.dnsResponse(Object.assign({ name: 'www.example.com', qtype: 'A' }, s.dns || {}));
      case 'dhcp':
        return B.dhcp(Object.assign({ msgType: 1 }, s.dhcp || {}));
      case 'httpReq':
        return B.http(Object.assign({ method: 'GET', path: '/' }, s.http || {}));
      case 'httpRes':
        return B.http(Object.assign({ status: '200 OK' }, Object.assign({ viaStatus: true }, s.http || {})));
      case 'tls':
        return B.tls(s.tls || {});
      case 'icmpv6':
      case 'ndp':
        return B.icmpv6(Object.assign({ src: srcIp, dst: dstIp }, s.icmp6 || {}));
      case 'icmp':
        return B.icmp(s.icmp || { type: 8 });
      case 'sshText':
        return B.textProto('Secure Shell', s.sshText || 'SSH-2.0-OpenSSH_9.6\r\n');
      case 'smtpText':
        return B.textProto('Simple Mail Transfer', s.smtpText || 'EHLO client\r\n');
      case 'imapText':
        return B.textProto('Internet Message Access', s.imapText || 'a1 LOGIN bob ***\r\n');
      case 'ftpText':
        return B.textProto('File Transfer Protocol', s.ftpText || 'USER anonymous\r\n');
      case 'pop3Text':
        return B.textProto('Post Office Protocol', s.pop3Text || '+OK ready\r\n');
      case 'bgpText':
        return B.textProto('Border Gateway Protocol', s.bgpText || 'UPDATE\r\n');
      case 'quic':
        return B.rawPayload('QUIC', (s.pay && s.pay.len) || 1180, 'quic' + (s.t || 0), 'QUIC packet — TLS 1.3 handshake and STREAM frames inside');
      case 'udpData':
        return B.rawPayload((s.pay && s.pay.label) || 'Datagram', (s.pay && s.pay.len) || 300, 'udp' + (s.t || 0));
      case 'tcpData':
      default:
        return B.rawPayload((s.pay && s.pay.label) || 'Data', (s.pay && s.pay.len) || 300, 'tcp' + (s.t || 0), (s.pay && s.pay.note) || '');
    }
  }

  function compilePacket(spec, ctx, index) {
    const from = ctx.dev[spec.s];
    const to = ctx.dev[spec.d];
    const app = spec.app || 'tcpData';
    const def = APP_DEFAULTS[app] || APP_DEFAULTS.tcpData;

    const srcIp = spec.sip || (from ? from.ip : '0.0.0.0');
    const dstIp = spec.dip || (to ? to.ip : '0.0.0.0');
    const srcMac = spec.smac || (from ? from.mac : '00:00:00:00:00:01');
    const dstMac = spec.dmac || (to ? to.mac : '00:00:00:00:00:02');
    const sport = spec.sport !== undefined ? spec.sport : def.sport;
    const dport = spec.dport !== undefined ? spec.dport : def.dport;

    const label = spec.protoName || spec.proto || def.label;
    const protoKey = label === 'DNS' ? 'DNS' : label;

    const layers = [];
    const payload = payloadFor(spec, app, ctx, srcIp, dstIp);
    let l3 = null;

    // ---- link + network layers
    if (def.proto === 'ARP') {
      layers.push(B.eth({ dst: 'ff:ff:ff:ff:ff:ff', src: srcMac, type: 0x0806 }));
      layers.push(B.arp(spec.arp || {}));
    } else {
      // decide the Ethernet destination: same subnet -> the host, otherwise the gateway
      const behindGateway = !sameSubnet(srcIp, dstIp, ctx.topo.lan) && from && from.ip && to && to.ip && sameSubnet(srcIp, from.ip, ctx.topo.lan);
      const gw = ctx.topo.lan && ctx.topo.lan.gateway;
      const ethDst = behindGateway && gw ? ((ctx.dev.rtr && ctx.dev.rtr.mac) || gw) : dstMac;
      const useV6 = !!spec.v6;
      layers.push(B.eth({ dst: ethDst, src: srcMac, type: useV6 ? 0x86dd : 0x0800 }));

      const ipOpts = {
        src: srcIp,
        dst: dstIp,
        ttl: spec.ttl === undefined ? 64 : spec.ttl,
        dscp: spec.dscp || 0,
        proto: def.proto,
        id: spec.ipId || (0x1000 + index),
        payload: null,
      };

      const push = (l3full, transport, headerLen) => {
        // the IP layer keeps only its own header bytes in the stack view,
        // the transport and application layers each get their own row
        const ipHeaderLen = (l3full.bytes[0] & 0x0f) * 4;
        layers.push(Object.assign({}, l3full, { bytes: l3full.bytes.slice(0, ipHeaderLen) }));
        if (transport) {
          layers.push(Object.assign({}, transport, { bytes: transport.bytes.slice(0, headerLen) }));
          if (payload.bytes.length) layers.push(payload);
        }
      };

      if (useV6) {
        const nh = def.proto === 'TCP' ? 6 : def.proto === 'UDP' ? 17 : 58;
        let transport = null, headerLen = 0;
        if (def.proto === 'TCP') {
          transport = B.tcp({
            srcPort: sport === null ? 443 : sport, dstPort: dport === null ? 443 : dport,
            seq: (spec.tcp && spec.tcp.seq) || 0, ack: (spec.tcp && spec.tcp.ack) || 0,
            flags: (spec.tcp && spec.tcp.flags) || 'ACK',
            window: spec.tcp && spec.tcp.window !== undefined ? spec.tcp.window : 131328,
            srcIp, dstIp, v6: { src: srcIp, dst: dstIp },
            isSyn: !!((spec.tcp && /SYN/.test(spec.tcp.flags || ''))),
            payload: payload.bytes,
          });
          headerLen = (transport.bytes[12] >> 4) * 4;
        } else if (def.proto === 'UDP') {
          transport = B.udp({
            srcPort: sport === null ? 53 : sport, dstPort: dport === null ? 53 : dport,
            srcIp, dstIp, v6: { src: srcIp, dst: dstIp }, payload: payload.bytes,
          });
          headerLen = 8;
        }
        const l3v6 = B.ipv6({
          src: srcIp, dst: dstIp, nextHeader: nh,
          hopLimit: spec.ttl === undefined ? 64 : spec.ttl,
          tclass: spec.tclass || 0,
          payload: transport ? transport.bytes : payload.bytes,
        });
        layers.push(l3v6);
        if (transport) {
          layers.push(Object.assign({}, transport, { bytes: transport.bytes.slice(0, headerLen) }));
          if (payload.bytes.length) layers.push(payload);
        } else {
          layers.push(payload);
        }
      } else if (def.proto === 'TCP') {
        const tcpOver = {
          srcPort: sport === null ? 443 : sport,
          dstPort: dport === null ? 443 : dport,
          seq: (spec.tcp && spec.tcp.seq) || 0,
          ack: (spec.tcp && spec.tcp.ack) || 0,
          flags: (spec.tcp && spec.tcp.flags) || 'ACK',
          window: spec.tcp && spec.tcp.window !== undefined ? spec.tcp.window : 131328,
          srcIp,
          dstIp,
          isSyn: !!((spec.tcp && /SYN/.test(spec.tcp.flags || ''))),
          payload: payload.bytes,
        };
        const tcpLayer = B.tcp(tcpOver);
        const tcpHeaderLen = (tcpLayer.bytes[12] >> 4) * 4;
        l3 = B.ipv4(Object.assign({}, ipOpts, { payload: tcpLayer.bytes }));
        push(l3, tcpLayer, tcpHeaderLen);
      } else if (def.proto === 'UDP') {
        const udpLayer = B.udp({
          srcPort: sport === null ? 53 : sport,
          dstPort: dport === null ? 53 : dport,
          srcIp, dstIp,
          payload: payload.bytes,
        });
        l3 = B.ipv4(Object.assign({}, ipOpts, { payload: udpLayer.bytes }));
        push(l3, udpLayer, 8);
      } else if (def.proto === 'ICMP') {
        l3 = B.ipv4(Object.assign({}, ipOpts, { proto: 'ICMP', payload: payload.bytes }));
        layers.push(Object.assign({}, l3, { bytes: l3.bytes.slice(0, 20) }));
        layers.push(payload);
      }
    }

    const totalBytes = layers.reduce((n, l) => n + l.bytes.length, 0);
    const eth = layers[0];
    const frameLen = totalBytes + 4; // FCS

    // ---- summary line
    let summary = spec.info;
    if (!summary) {
      if (def.proto === 'ARP') summary = 'ARP ' + (spec.arp && spec.arp.op === 2 ? 'reply' : 'request');
      else if (def.proto === 'ICMP') summary = 'ICMP';
      else summary = def.proto + ' ' + srcIp + ':' + sport + ' → ' + dstIp + ':' + dport;
    }

    return {
      no: index + 1,
      t: spec.t === undefined ? index * 0.01 : spec.t,
      src: spec.s,
      dst: spec.d,
      srcLabel: from ? from.label : spec.s,
      dstLabel: to ? to.label : spec.d,
      srcIp, dstIp, srcMac, dstMac,
      sport, dport,
      proto: label,
      protoColor: PROTO_COLORS[label] || '#94a3b8',
      category: CATEGORY[label] || 'tcp',
      summary,
      dropped: !!spec.dropped,
      note: spec.note || '',
      layers,
      payload,
      bytes: totalBytes,
      frameLen,
      hex: layers.flatMap((l) => l.bytes),
      fields: (function () {
        const out = [];
        let base = 0;
        layers.forEach((l) => {
          l.fields.forEach((f) => out.push(Object.assign({}, f, { off: base + f.off, layer: l.name })));
          base += l.bytes.length;
        });
        return out;
      })(),
      app,
    };
  }

  function buildSession(lesson) {
    const topo = TOPO[lesson.scenario] || TOPO.home;
    const dev = deviceIndex(topo);
    const ctx = { topo, dev };
    const packets = [];
    let idx = 0;
    lesson.steps.forEach((step, si) => {
      (step.packets || []).forEach((spec) => {
        const p = compilePacket(spec, ctx, idx);
        p.step = si;
        packets.push(p);
        idx += 1;
      });
    });
    return { lesson, topo, dev, packets };
  }

  function hexDump(bytes, perLine) {
    const n = perLine || 16;
    const lines = [];
    for (let i = 0; i < bytes.length; i += n) {
      const slice = bytes.slice(i, i + n);
      const hex = slice.map((b) => b.toString(16).padStart(2, '0')).join(' ');
      const asc = slice.map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : '·')).join('');
      lines.push({ off: i, hex, asc });
    }
    return lines;
  }

  root.PE_ENGINE = { buildSession, hexDump, PROTO_COLORS, sameSubnet };
})(typeof window !== 'undefined' ? window : globalThis);
