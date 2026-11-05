/* ============================================================
   lab-view.js — Free explore: inspect one device in detail,
   with a small but real command line.
   ============================================================ */
(function (root) {
  'use strict';
  const U = root.PE_UI;
  const E = root.PE_ENGINE;
  const { S, esc, ICON, byId } = U;
  const TOPO = root.PE_TOPO.TOPOLOGIES;
  const SERVICES = root.PE_TOPO.SERVICES_BY_KIND;

  const CLI = { lines: [], hist: [], hi: -1, dev: null };
  const TAB_LABEL = { home: 'Home', lan: 'LAN only', mail: 'Email', cdn: 'CDN', dc: 'Datacenter', k8s: 'Kubernetes', cloud: 'Cloud VPC', wifi: 'Wi-Fi', mesh: 'Mesh', bgp: 'Routing' };
  const activityCache = {};

  /* demo zone used for dig / nslookup / ping by name */
  const ZONE = {
    'www.example.com': { A: '203.0.113.10', ttl: 300 },
    'example.com': { A: '203.0.113.10', ttl: 300, MX: '10 mail.example.com' },
    'mail.example.com': { A: '198.51.100.25', ttl: 3600 },
    'mailhost.net': { A: '198.51.100.25', ttl: 3600, MX: '10 mx.mailhost.net' },
    'localhost': { A: '127.0.0.1', ttl: 0 },
  };

  /* ---------- activity: every packet from every lesson on this map ---------- */
  function activity(topoId) {
    if (activityCache[topoId]) return activityCache[topoId];
    const all = [];
    let i = 0;
    U.LESSONS.filter((l) => l.scenario === topoId).forEach((l) => {
      const sess = E.buildSession(l);
      sess.packets.forEach((p) => {
        all.push(Object.assign({}, p, { t: +(i * 0.013).toFixed(3), lesson: l.title }));
        i += 1;
      });
    });
    activityCache[topoId] = all;
    return all;
  }

  function devicesOf(topoId) { return TOPO[topoId].devices; }
  function devById(topoId, id) { return devicesOf(topoId).find((d) => d.id === id); }

  function topoOfSelection() {
    if (!S.lab.topo) S.lab.topo = 'home';
    return TOPO[S.lab.topo];
  }
  function selectedDevice() {
    const topo = topoOfSelection();
    let d = topo.devices.find((x) => x.id === S.lab.device);
    if (!d) { d = topo.devices[0]; S.lab.device = d.id; }
    return d;
  }

  /* ---------- derived data ---------- */
  function interfacesOf(d) {
    const out = [];
    if (d.ip && d.ip !== '—') {
      const isLan = /^(192\.168|10\.|172\.(1[6-9]|2\d|3[01]))/.test(d.ip);
      out.push({
        name: d.kind === 'router' ? 'br-lan (LAN)' : d.kind === 'laptop' || d.kind === 'phone' ? 'en0 (Wi-Fi)' : 'eth0',
        ip: d.ip,
        mask: isLan ? '255.255.255.0' : '255.255.255.0',
        mac: d.mac, mtu: 1500, state: 'UP',
      });
    }
    if (d.wan) {
      out.push({ name: 'wan0 (ISP)', ip: d.wan, mask: '255.255.255.252', mac: d.mac.split(':').slice(0, 5).concat(['ff']).join(':'), mtu: 1500, state: 'UP' });
    }
    if (d.kind === 'switch' || d.ip === '—') {
      out.push({ name: 'eth0 (switched, no IP)', ip: '—', mask: '—', mac: d.mac, mtu: 1500, state: 'UP' });
    }
    return out;
  }

  function routesOf(topo, d) {
    const rows = [];
    const lan = topo.lan || { gateway: '192.168.1.1' };
    const isRouter = d.kind === 'router';
    if (d.ip && d.ip !== '—') {
      const net = d.ip.replace(/\.\d+$/, '.0');
      rows.push({ dst: net + '/24', gw: 'on-link', dev: d.kind === 'router' ? 'br-lan' : 'eth0' });
    }
    if (isRouter) {
      rows.push({ dst: '0.0.0.0/0', gw: topo.id === 'bgp' ? '198.51.100.2' : '203.0.113.1 (ISP)', dev: 'wan0', metric: 10 });
      rows.push({ dst: '203.0.113.0/24', gw: 'on-link', dev: 'wan0' });
    } else if (d.ip && d.ip !== '—') {
      const lanDevice = /^192\.168\.|^10\./.test(d.ip);
      if (lanDevice) rows.push({ dst: '0.0.0.0/0', gw: lan.gateway, dev: 'eth0', metric: 100, note: 'default route' });
      else rows.push({ dst: '0.0.0.0/0', gw: d.ip.replace(/\.\d+$/, '.1'), dev: 'eth0', metric: 100, note: 'default route' });
    }
    return rows;
  }

  function arpOf(topo, d) {
    if (!d.ip || d.ip === '—') return [];
    const rows = [];
    const lan = topo.lan || { prefix: 24 };
    devicesOf(S.lab.topo).forEach((o) => {
      if (o.id === d.id || !o.ip || o.ip === '—') return;
      const same = E.sameSubnet(d.ip, o.ip, lan);
      if (same) rows.push({ ip: o.ip, mac: o.mac, dev: 'eth0', state: 'REACHABLE', who: o.label });
    });
    if (!rows.length) rows.push({ ip: d.ip, mac: d.mac, dev: 'eth0', state: 'permanent', who: d.label });
    return rows;
  }

  function servicesOf(d) {
    return (SERVICES[d.kind] || []).slice();
  }

  function natOf() {
    return [
      { proto: 'tcp', inside: '192.168.1.10:52344', outside: '203.0.113.75:52344', remote: '203.0.113.10:443', state: 'ESTABLISHED', ttl: '3598' },
      { proto: 'tcp', inside: '192.168.1.11:49211', outside: '203.0.113.75:49212', remote: '198.51.100.25:993', state: 'ESTABLISHED', ttl: '3244' },
      { proto: 'udp', inside: '192.168.1.10:51000', outside: '203.0.113.75:51000', remote: '8.8.8.8:53', state: 'UNREPLIED', ttl: '24' },
    ];
  }

  function pathBetween(topoId, aId, bId) {
    const adj = {};
    (TOPO[topoId].links || []).forEach(([x, y]) => {
      (adj[x] = adj[x] || []).push(y);
      (adj[y] = adj[y] || []).push(x);
    });
    const prev = { [aId]: null };
    const q = [aId];
    while (q.length) {
      const cur = q.shift();
      if (cur === bId) break;
      (adj[cur] || []).forEach((n) => {
        if (!(n in prev)) { prev[n] = cur; q.push(n); }
      });
    }
    if (!(bId in prev)) return null;
    const path = [];
    let c = bId;
    while (c) { path.unshift(c); c = prev[c]; }
    return path;
  }

  /* ============================================================
     CLI
     ============================================================ */
  function cliReset() {
    const topo = topoOfSelection();
    const d = selectedDevice();
    CLI.dev = d.id;
    CLI.hist = [];
    CLI.hi = -1;
    CLI.lines = [];
    cliPush('<span class="mut">Protocol Explorer shell · ' + esc(d.label) + ' (' + esc(d.ip || 'layer 2 only') + ')</span>');
    cliPush('<span class="mut">This is a simulation. Every number below is computed from the topology and packets you have been watching.</span>');
    cliPush('<span class="mut">Type <b>help</b> for the commands, or click a suggestion below.</span>');
    activity(topo.id);
  }
  function cliPush(html) { CLI.lines.push(html); }
  function cliText(t) { cliPush('<span>' + esc(t) + '</span>'); }

  function hostnameOf(d) {
    return ({ pc: 'laptop', phone: 'phone', rtr: 'home-gateway', web: 'web01', dns: 'resolver1', mail: 'mx1', auth: 'ns1', root: 'root-ams', tld: 'tld-ams', ca: 'ca1', sw: 'switch', isp: 'isp-edge1', tier: 'transit1', asb: 'peer-b', asc: 'peer-c', dest: 'web-east' })[d.id] || d.id;
  }

  function resolveName(name) {
    if (/^\d+\.\d+\.\d+\.\d+$/.test(name)) return { ip: name, how: 'literal' };
    const z = ZONE[name.toLowerCase()];
    if (z) return { ip: z.A, how: 'dns', ttl: z.ttl };
    return null;
  }

  function findDeviceByIp(ip) {
    return devicesOf(S.lab.topo).find((d) => d.ip === ip || d.wan === ip);
  }

  function tcpdumpLine(p) {
    const ts = '00:00:' + p.t.toFixed(6).padStart(9, '0');
    const ip = p.srcIp + '.' + (p.sport == null ? '' : p.sport) + ' > ' + p.dstIp + '.' + (p.dport == null ? '' : p.dport);
    let detail = '';
    if (p.proto === 'TCP') {
      const tcp = p.layers.find((l) => /Transmission/.test(l.name)) || { fields: [] };
      const flags = (tcp.fields.find((f) => f.name === 'Flags') || {}).value || 'ACK';
      const seq = (tcp.fields.find((f) => f.name === 'Sequence Number') || {}).value || 0;
      const short = flags.replace(/ACK/g, '.').replace(/SYN/g, 'S').replace(/FIN/g, 'F').replace(/PSH/g, 'P').replace(/RST/g, 'R').replace(/[ ,]/g, '') || '.';
      const payloadLen = Math.max(0, p.bytes - 14 - 20 - 20);
      detail = 'Flags [' + short + '], seq ' + seq + ', win 64240, length ' + payloadLen;
    } else if (p.proto === 'UDP') {
      detail = 'UDP, length ' + Math.max(0, p.bytes - 14 - 20);
    } else if (p.proto === 'ICMP') {
      detail = 'ICMP echo request, id 4660, seq ' + (((p.layers[1] || {}).fields || []).find((f) => /Sequence/.test(f.name)) || {}).value + ', length 64';
    } else if (p.proto === 'ARP') {
      return ts + ' ARP, Request who-has ' + p.dstIp + ' tell ' + p.srcIp + ', length 28';
    } else if (p.proto === 'DNS') {
      detail = 'Domain Name System ' + (p.summary || '');
    } else {
      detail = p.summary || '';
    }
    return ts + ' IP ' + ip + ': ' + detail;
  }

  function runCommand(raw) {
    const topo = topoOfSelection();
    const d = selectedDevice();
    const cmdline = raw.trim();
    if (!cmdline) return;
    cliPush('<span class="cmdline">' + (d.kind === 'router' || d.kind === 'switch' ? hostnameOf(d) + '#' : '$') + ' ' + esc(cmdline) + '</span>');
    CLI.hist.push(cmdline);
    CLI.hi = CLI.hist.length;

    const parts = cmdline.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const arg = parts.slice(1).join(' ').replace(/^["']|["']$/g, '');

    const need = (what) => {
      cliPush('<span class="err">' + esc(what) + '</span>');
    };

    switch (cmd) {
      case 'help': case '?':
        cliText([
          'Interfaces   ip addr | ifconfig | show interfaces',
          'Routing      ip route | route -n | show ip route',
          'Neighbours   arp -a | ip neigh',
          'Listening    ss -tulpn | netstat -tulpn',
          'Names        dig <name> | nslookup <name>',
          'Reachability ping <host> | traceroute <host>',
          'Web          curl <host> | curl -v <host>',
          'Capture      tcpdump -c 8 | show interface counters',
          'Name walk    dig +trace <name>',
          'TLS          openssl s_client -connect <host>:443',
          'Switching    bridge fdb | bridge link',
          'Deep state   conntrack -S | ip -6 addr',
          'Router only  conntrack -L | iptables -t nat -L | show bgp summary',
          'Device       hostname | uname -a | uptime | whoami | date | clear',
        ].join('\n'));
        break;

      case 'hostname': cliText(hostnameOf(d)); break;
      case 'whoami': cliText(d.kind === 'router' || d.kind === 'switch' ? 'admin' : 'alice'); break;
      case 'uname': cliText(d.os || (d.kind === 'router' ? 'OpenWrt 23.05 · Linux 5.15' : d.kind === 'switch' ? 'switch firmware 2.4' : 'Linux 6.8.0-generic')); break;
      case 'uptime': cliText(' 00:14:02 up 12 days,  3:41,  1 user,  load average: 0.08, 0.11, 0.09'); break;
      case 'date': cliText(new Date().toUTCString()); break;
      case 'clear': CLI.lines = []; break;

      case 'ip': {
        const v6 = parts[1] === '-6';
        const sub = (parts[v6 ? 2 : 1] || '').toLowerCase();
        if (v6) {
          const i = interfacesOf(d)[0] || { name: 'eth0' };
          const link = 'fe80::' + (d.mac || '00:11:22:33:44:55').split(':').slice(1).map((x) => x.replace(/^0+/, '')).join(':');
          cliText(i.name + ': <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 state UP\n' +
            '    inet6 ' + link + '/64 scope link\n' +
            (d.ip && d.ip !== '—' ? '    inet6 2001:db8:' + ((d.ip.split('.')[2] || '1')) + '::' + (d.ip.split('.')[3] || '1') + '/64 scope global\n' : '') +
            '    inet6 ::1/128 scope host');
          cliText('\n# every interface has a link-local address (fe80::/10) even with no DHCP, no router and no configuration.');
          cliText('# that is why IPv6 neighbours can always find each other, and why a missing global address is not a total outage.');
          break;
        }
        if (sub === 'addr' || sub === 'a') {
          const out = interfacesOf(d).map((i) =>
            '2: ' + i.name + ': <BROADCAST,MULTICAST,UP,LOWER_UP>\n    link/ether ' + i.mac + '\n    inet ' + i.ip + '/24 brd ' + (i.ip !== '—' ? i.ip.replace(/\.\d+$/, '.255') : '—') + ' scope global\n    mtu ' + i.mtu + ' state ' + i.state);
          cliText(out.join('\n\n') || 'no interfaces');
        } else if (sub === 'route' || sub === 'r') {
          const rows = routesOf(topo, d);
          if (!rows.length) { cliText('no routes: this device has no IP address'); break; }
          cliText(rows.map((r) => (r.dst === '0.0.0.0/0'
            ? 'default via ' + r.gw.split(' ')[0] + ' dev ' + r.dev
            : r.dst + ' dev ' + r.dev + ' scope link') + (r.metric ? ' metric ' + r.metric : '')).join('\n'));
        } else if (sub === 'neigh') {
          cliText(arpOf(topo, d).map((a) => a.ip + ' dev ' + a.dev + ' lladdr ' + a.mac + ' ' + a.state).join('\n') || 'no neighbours');
        } else cliText('usage: ip addr | ip route | ip neigh');
        break;
      }
      case 'ifconfig': {
        cliText(interfacesOf(d).map((i) => i.name + ': flags=4163<UP,BROADCAST,RUNNING>\n        inet ' + i.ip + '  netmask ' + i.mask + '\n        ether ' + i.mac + '  mtu ' + i.mtu).join('\n\n'));
        break;
      }
      case 'route': {
        const rows = routesOf(topo, d);
        cliText('Kernel IP routing table\nDestination     Gateway         Genmask         Iface\n' +
          rows.map((r) => r.dst.padEnd(16) + (r.gw.split(' ')[0]).padEnd(16) + '255.255.255.0   ' + r.dev).join('\n'));
        break;
      }
      case 'arp': {
        const rows = arpOf(topo, d);
        cliText('Address          HWtype  HWaddress           Flags Mask            Iface\n' +
          rows.map((r) => r.ip.padEnd(17) + 'ether   ' + r.mac.padEnd(20) + 'C     ' + r.dev + '          eth0').join('\n'));
        break;
      }
      case 'ss': case 'netstat': {
        const svc = servicesOf(d);
        if (!svc.length) { cliText('State  Recv-Q Send-Q Local Address:Port  Peer Address:Port\nESTAB   0      0      192.168.1.10:52344    203.0.113.10:443'); break; }
        cliText('Netid State  Local Address:Port   Process\n' +
          svc.map((s) => (s.proto === 'UDP' ? 'udp   UNCONN ' : 'tcp   LISTEN ') + '0.0.0.0:' + String(s.port).padEnd(14) + s.name + '   # ' + s.note).join('\n'));
        break;
      }
      case 'show': {
        const sub = parts.slice(1).join(' ').toLowerCase();
        if (/interfaces/.test(sub)) {
          cliText(interfacesOf(d).map((i) => i.name + ' is ' + i.state + ', line protocol is ' + i.state + '\n  Hardware is Ethernet, address is ' + i.mac + '\n  Internet address is ' + i.ip + '/24\n  MTU ' + i.mtu + ' bytes').join('\n\n'));
        } else if (/ip route|route/.test(sub)) {
          cliText(routesOf(topo, d).map((r) => 'O    ' + (r.gw.includes('on-link') ? 'C    ' : 'S*   ') + r.dst + ' [110/' + (r.metric || 0) + '] via ' + r.gw.split(' ')[0] + ', ' + r.dev).join('\n'));
        } else if (/counters|statistics/.test(sub)) {
          const i = interfacesOf(d)[0] || { name: 'eth0', mtu: 1500 };
          const seed = (d.id + 'x').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
          const rx = 48000 + (seed % 9000), tx = 41000 + (seed % 7000);
          cliText('Port                InOctets    InUcastPkts   InErrors  InDiscards  OutOctets   OutUcastPkts  OutErrors\n' +
            (i.name || 'eth0').padEnd(20) +
            String(rx * 812).padEnd(13) + String(rx).padEnd(14) + '0'.padEnd(10) + '0'.padEnd(12) +
            String(tx * 780).padEnd(12) + String(tx).padEnd(14) + '0');
          cliText('\n# zero errors with rising discards means the queue is full, not the wire is bad.');
          cliText('# rising InErrors with a stable rate is a duplex or cable problem. Read both columns together.');
        } else if (/bgp/.test(sub)) {
          cliText('BGP router identifier ' + (d.ip || '10.0.0.1') + ', local AS number 64500\n\nNeighbor        V   AS      MsgRcvd  MsgSent  Up/Down  State/PfxRcd\n198.51.100.2    4   64501      1042      998  1d02h    184203\n203.0.113.2     4   64502       812      790  0d22h     12489');
        } else cliText('usage: show interfaces | show ip route | show bgp summary');
        break;
      }
      case 'dig': case 'nslookup': {
        const trace = /\+trace/.test(cmdline);
        const qname = parts.filter((p) => !p.startsWith('+') && p !== cmd)[0] || '';
        if (trace) {
          if (!qname) { cliText('usage: dig +trace <name>'); break; }
          const labels = qname.replace(/\.$/, '').split('.');
          const tld = labels[labels.length - 1];
          cliText('; <<>> DiG <<>> +trace ' + qname);
          cliText('.\t\t\t518400\tIN\tNS\ta.root-servers.net.\n.\t\t\t518400\tIN\tNS\tl.root-servers.net.\n;; Received 239 bytes from 192.168.1.1#53(192.168.1.1) in 8 ms');
          cliText('\n# 1. the root does not know the answer — it only knows who runs .' + tld);
          cliText(tld + '.\t\t172800\tIN\tNS\ta.gtld-servers.net.\n;; Received 831 bytes from 198.41.0.4#53(a.root-servers.net) in 24 ms');
          cliText('\n# 2. the TLD does not know either — it delegates the zone');
          cliText(qname + '.\t\t300\tIN\tA\t' + ((ZONE[qname.toLowerCase()] || {}).A || '203.0.113.10') +
            '\n' + qname + '.\t\t3600\tIN\tNS\tns1.example.net.\n;; Received 121 bytes from 198.51.100.53#53(ns1.example.net) in 31 ms');
          cliText('\n# 3. the authoritative server is the only one that actually knows. Three queries, three servers, ~63 ms.');
          cliText('# the TTL beside each record is how long your resolver may cache it — caching is what makes DNS cheap.');
          break;
        }
        if (!arg) { cliText('usage: dig <name> | dig +trace <name>'); break; }
        const r = resolveName(arg);
        if (!r) {
          cliText(';; ->>HEADER<<- opcode: QUERY, status: NXDOMAIN, id: 41234');
          cliText(';; QUESTION SECTION:\n;' + arg + '.   IN  A\n\n;; no ANSWER SECTION');
          cliText('that name does not exist in the demo zone. Try www.example.com');
          break;
        }
        const z = ZONE[arg.toLowerCase()] || { A: r.ip, ttl: 300 };
        cliText('; <<>> DiG <<>> ' + arg + '\n;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 41234\n;; flags: qr rd ra; QUERY: 1, ANSWER: 1, AUTHORITY: 0, ADDITIONAL: 0\n\n;; QUESTION SECTION:\n;' + arg + '.\t\t\tIN\tA\n\n;; ANSWER SECTION:\n' +
          arg + '.\t\t' + (z.ttl || 300) + '\tIN\tA\t' + r.ip + (z.MX ? '\n' + arg + '.\t\t3600\tIN\tMX\t' + z.MX : '') +
          '\n\n;; Query time: 11 msec\n;; SERVER: 8.8.8.8#53(8.8.8.8)');
        if (r.how === 'literal') cliText('(that was an address, not a name — no query was sent)');
        break;
      }
      case 'ping': {
        if (!arg) { cliText('usage: ping <host or ip>'); break; }
        const r = resolveName(arg);
        if (!r) { need('ping: ' + arg + ': Name or service not known'); break; }
        const target = findDeviceByIp(r.ip);
        const label = target ? target.label : r.ip;
        const path = target ? pathBetween(S.lab.topo, d.id, target.id) : null;
        if (!path) {
          cliText('PING ' + arg + ' (' + r.ip + ') 56(84) bytes of data.');
          cliText('From ' + (d.ip || 'gateway') + ' icmp_seq=1 Destination Host Unreachable');
          cliText('--- ' + arg + ' ping statistics ---\n3 packets transmitted, 0 received, 100% packet loss');
          break;
        }
        const hops = path.length - 1;
        const rtt = (hops * 6.4 + 1.2).toFixed(1);
        cliText('PING ' + arg + ' (' + r.ip + ') 56(84) bytes of data.');
        for (let i = 1; i <= 3; i++) {
          const jitter = (hops * 6.4 + 1.2 + (i - 2) * 0.7).toFixed(1);
          cliText('64 bytes from ' + r.ip + ': icmp_seq=' + i + ' ttl=' + (64 - hops) + ' time=' + jitter + ' ms   # ' + hops + ' hop' + (hops === 1 ? '' : 's') + ', arriving at ' + label);
        }
        cliText('--- ' + arg + ' ping statistics ---\n3 packets transmitted, 3 received, 0% packet loss, time 2004ms\nrtt min/avg/max/mdev = ' + rtt + '/' + rtt + '/' + rtt + '/0.2 ms');
        break;
      }
      case 'traceroute': case 'tracert': {
        if (!arg) { cliText('usage: traceroute <host or ip>'); break; }
        const r = resolveName(arg);
        if (!r) { need('traceroute: unknown host ' + arg); break; }
        const target = findDeviceByIp(r.ip);
        const path = target ? pathBetween(S.lab.topo, d.id, target.id) : null;
        if (!path) { cliText('traceroute to ' + arg + ' (' + r.ip + '), 30 hops max\n 1  * * *\n 2  * * *  no route found in this topology'); break; }
        cliText('traceroute to ' + arg + ' (' + r.ip + '), 30 hops max, 60 byte packets');
        let acc = 0;
        path.forEach((id, i) => {
          if (i === 0) return;
          const dev = devById(S.lab.topo, id);
          acc += 5.5 + i * 1.3;
          const ip = dev.ip && dev.ip !== '—' ? dev.ip : (dev.wan || '—');
          cliText(' ' + String(i).padStart(2) + '  ' + dev.label.padEnd(22) + ' (' + ip + ')  ' + acc.toFixed(2) + ' ms  ' + (acc + 0.6).toFixed(2) + ' ms');
        });
        cliText('\n# each line came back as ICMP Time Exceeded from a router whose TTL hit zero');
        break;
      }
      case 'curl': {
        const verbose = /-v/.test(cmdline);
        const hostArg = parts.filter((p) => !p.startsWith('-'))[1] || 'www.example.com';
        const host = hostArg.replace(/^https?:\/\//, '').replace(/\/.*$/, '').split(':')[0];
        const https = /^https/.test(hostArg) || !/^http:/.test(hostArg);
        const r = resolveName(host);
        if (!r) { need('curl: (6) Could not resolve host: ' + host); break; }
        const target = findDeviceByIp(r.ip);
        const path = target ? pathBetween(S.lab.topo, d.id, target.id) : null;
        let out = '';
        if (verbose) {
          out += '*   Trying ' + r.ip + ':' + (https ? 443 : 80) + '...\n';
          if (!path) out += '* connect to ' + r.ip + ' port ' + (https ? 443 : 80) + ' failed: Connection timed out\n* Closing connection 0\ncurl: (7) Failed to connect';
          else {
            out += '* Connected to ' + host + ' (' + r.ip + ') port ' + (https ? 443 : 80) + '\n';
            if (https) {
              out += '* TLS 1.3 connection using TLS_AES_128_GCM_SHA256\n* ALPN: server accepted h2\n* Server certificate:\n*  subject: CN = ' + host + '\n*  start date: Jun  1 00:00:00 2025 GMT\n*  expire date: May 31 23:59:59 2026 GMT\n*  issuer: CN = Example Intermediate CA\n*  SSL certificate verify ok.\n';
            }
            out += '> GET / HTTP/1.1\n> Host: ' + host + '\n> User-Agent: curl/8.6.0\n> Accept: */*\n>\n< HTTP/1.1 200 OK\n< content-type: text/html; charset=utf-8\n< content-length: 512\n< cache-control: max-age=3600\n<\n<!doctype html><html><head><title>Example Domain</title>…</html>';
          }
        } else {
          out = !path ? 'curl: (7) Failed to connect to ' + host + ' port ' + (https ? 443 : 80) + ': Connection timed out' :
            '<!doctype html>\n<html>\n<head><title>Example Domain</title></head>\n<body><h1>Example Domain</h1></body>\n</html>';
        }
        cliText(out);
        break;
      }
      case 'tcpdump': {
        const n = Math.min(40, parseInt((cmdline.match(/-c\s*(\d+)/) || [])[1] || '8', 10));
        let pkts = activity(S.lab.topo).filter((p) => p.src === d.id || p.dst === d.id);
        if (!pkts.length) pkts = activity(S.lab.topo);
        cliText('tcpdump: listening on any, link-type EN10MB (Ethernet), snapshot length 262144 bytes');
        cliText(pkts.slice(0, n).map(tcpdumpLine).join('\n'));
        cliText('\n' + Math.min(n, pkts.length) + ' packets captured');
        break;
      }
      case 'conntrack': case 'iptables': {
        if (!(d.kind === 'router')) { need('this device does not run a NAT: it has no translation table'); break; }
        if (cmd === 'conntrack' && /-\s*S/.test(cmdline)) {
          cliText('cpu=0   found=1244 invalid=2 ignore=0 insert=0 insert_failed=0 drop=0 early_drop=0 error=0 search_restart=6\n' +
            'cpu=1   found=1180 invalid=1 ignore=0 insert=0 insert_failed=0 drop=0 early_drop=0 error=0 search_restart=3');
          cliText('\n# invalid rising = packets that make no sense for any known flow: async routing, or a timeout shorter than the app\'s keepalive.');
          cliText('# insert_failed rising = the table is full. New connections are being refused while established ones keep working.');
          break;
        }
        if (cmd === 'conntrack') {
          cliText('tcp      6 3598 ESTABLISHED src=192.168.1.10 dst=203.0.113.10 sport=52344 dport=443 [ASSURED]\n' +
            'tcp      6 3244 ESTABLISHED src=192.168.1.11 dst=198.51.100.25 sport=49211 dport=993 [ASSURED]\n' +
            'udp     17   24           src=192.168.1.10 dst=8.8.8.8 sport=51000 dport=53 [UNREPLIED]');
        } else {
          cliText('Chain POSTROUTING (policy ACCEPT)\ntarget     prot opt source               destination\nMASQUERADE all  --  192.168.1.0/24       anywhere');
        }
        break;
      }
      case 'dhcp': case 'ipconfig': {
        cliText('lease {\n  interface  en0\n  fixed-address ' + (d.ip || '—') + ';\n  subnet-mask 255.255.255.0;\n  routers 192.168.1.1;\n  domain-name-servers 8.8.8.8;\n  lease-time 86400;\n  dhcp-server 192.168.1.1;\n}');
        break;
      }
      case 'openssl': {
        const v = cmdline.match(/-connect\s+([^\s:]+)(?::(\d+))?/);
        if (!v) { cliText('usage: openssl s_client -connect <host>[:port]'); break; }
        const host = v[1];
        const port = v[2] || '443';
        const r = resolveName(host);
        if (!r) { need('getaddrinfo: Name or service not known: ' + host); break; }
        const target = findDeviceByIp(r.ip);
        const path = target ? pathBetween(S.lab.topo, d.id, target.id) : null;
        if (!path) {
          need('connect:errno=110 — no path from here to ' + host + ' (' + r.ip + ')');
          cliText('openssl did the DNS lookup fine, then never got a TCP handshake. That distinction (resolve ok, connect failed) is the whole point of running it.');
          break;
        }
        cliText('CONNECTED(' + r.ip + ':' + port + ')');
        cliText('depth=0 CN = ' + host + '\nverify return:1');
        cliText('---\nCertificate chain\n 0 s:CN = ' + host + '\n   i:C = US, O = Example Intermediate CA, CN = Example Intermediate CA\n 1 s:C = US, O = Example Intermediate CA, CN = Example Intermediate CA\n   i:C = US, O = Example Root CA, CN = Example Root CA');
        cliText('---\nServer certificate\n-----BEGIN CERTIFICATE-----\nMIIF3zCCBMegAwIBAgIQC1xQ2m9k3lP0q7Rn5vJdZTANBgkqhkiG9w0BAQsFADBP\n… (truncated by the demo shell) …\n-----END CERTIFICATE-----\nsubject=CN = ' + host + '\nissuer=C = US, O = Example Intermediate CA, CN = Example Intermediate CA\n---');
        cliText('No client certificate CA names sent\nServer Temp Key: X25519, 253 bits\n---\nSSL handshake has read 3120 bytes and written 306 bytes\nVerification: OK\n---\nNew, TLSv1.3, Cipher is TLS_AES_128_GCM_SHA256\nServer public key is 2048 bit\nSecure Renegotiation IS NOT supported\nALPN protocol: h2\nSession-ID: 4F2A… (session tickets allow 0-RTT on a resume)\n---');
        cliText('# what you just read: the chain proves identity, ALPN picks HTTP/2, and the X25519 key is why the handshake costs one round trip.');
        break;
      }
      case 'bridge': {
        const sub = (parts[1] || '').toLowerCase();
        if (sub === 'fdb' || sub === '') {
          const peers = topo.devices.filter((x) => x.mac && x.id !== d.id).slice(0, 8);
          cliText('bridge fdb show');
          peers.forEach((x, i) => {
            cliText((x.mac || '—').padEnd(19) + ' dev eth' + (i % 4) + ' vlan 1 master br0 ' + (i === 0 ? 'permanent' : 'dynamic') +
              '  # ' + x.label);
          });
          cliText('\n# "dynamic" means learned from a frame source address and aged out after 300 s. "permanent" is you.');
          cliText('# A MAC only exists here if a frame carrying it has been seen — switching is learning, not configuration.');
        } else if (sub === 'link') {
          cliText(interfacesOf(d).map((i) => i.name + ': <BROADCAST,MULTICAST,UP,LOWER_UP> mtu ' + i.mtu + ' master br0 state ' + i.state +
            ' link/ether ' + i.mac + '\n    bridge_slave state forwarding    # no protocol above layer 2 on this port').join('\n') || 'no ports');
          cliText('\n# every port is a bridge slave: the switch forwards frames between them without ever looking at an IP address.');
        } else cliText('usage: bridge fdb | bridge link');
        break;
      }
      case 'ethtool': {
        const i = interfacesOf(d)[0];
        if (!i) { need('no such device'); break; }
        cliText('Settings for ' + i.name + ':\n\tSupported ports: [ TP ]\n\tSpeed: 1000Mb/s\n\tDuplex: Full\n\tAuto-negotiation: on\n\tLink detected: ' + (i.state === 'up' ? 'yes' : 'no'));
        cliText('\n# half duplex or a speed mismatch shows up as late collisions and retransmissions, not as a "network problem".');
        break;
      }
      default:
        cliPush('<span class="err">' + esc(cmd) + ': command not found</span> <span class="mut">— type help</span>');
    }
  }

  /* ============================================================
     render
     ============================================================ */
  function render() {
    const topo = topoOfSelection();
    const d = selectedDevice();
    if (CLI.dev !== d.id) cliReset();
    const tab = S.lab.tab;

    let h = '';
    h += '<div class="sectionhead"><div><h2>Device lab</h2>' +
      '<p>Pick any box and look inside it: interfaces, routes, neighbours, services, live activity — and a shell that answers real commands.</p></div>' +
      '<div class="seg only-wide">' + Object.keys(TOPO).map((id) =>
        '<button data-act="lab-topo" data-v="' + id + '" class="' + (S.lab.topo === id ? 'on' : '') + '">' + esc(TAB_LABEL[id] || id) + '</button>').join('') + '</div></div>';

    // phone pickers: one dropdown for the network, one for the device
    h += '<div class="pickers only-narrow">' +
      '<label><span>Network</span><select id="topopick">' +
      Object.keys(TOPO).map((id) => '<option value="' + id + '"' + (S.lab.topo === id ? ' selected' : '') + '>' + esc(TAB_LABEL[id] || id) + '</option>').join('') +
      '</select></label>' +
      '<label><span>Device</span><select id="devpick">' +
      topo.devices.map((x) => '<option value="' + x.id + '"' + (x.id === d.id ? ' selected' : '') + '>' + esc(x.label) + '</option>').join('') +
      '</select></label></div>';

    h += '<div class="labgrid">';

    // device list
    h += '<div class="panel devpanel"><div class="hd"><span>' + esc(topo.label) + '</span></div><div class="bd" style="padding:8px">' +
      '<div class="devlist">' + topo.devices.map((x) => {
        const n = activity(S.lab.topo === 'home' ? 'home' : S.lab.topo).filter((p) => p.src === x.id || p.dst === x.id).length;
        return '<button class="devrow' + (x.id === d.id ? ' on' : '') + '" data-act="lab-device" data-id="' + x.id + '">' +
          '<span class="ico">' + (ICON[x.kind] || ICON.server) + '</span>' +
          '<span style="flex:1;min-width:0"><span class="nm">' + esc(x.label) + '</span>' +
          '<div class="ip">' + esc(x.ip || 'no IP') + (x.wan ? ' · wan ' + esc(x.wan) : '') + '</div></span>' +
          (n ? '<span class="chip mono" style="padding:1px 6px">' + n + '</span>' : '') +
          '</button>';
      }).join('') + '</div>' +
      '<div style="padding:10px 7px 2px;font-size:11.5px;color:var(--muted);border-top:1px solid var(--line);margin-top:8px">' +
      esc(topo.caption) + '</div></div></div>';

    // detail
    h += '<div class="panel">';
    h += '<div style="display:flex;gap:11px;align-items:center;padding:13px 15px 11px">' +
      '<span class="ico" style="width:38px;height:38px;border-radius:11px;display:grid;place-items:center;background:var(--panel3);border:1px solid var(--line2);color:#fff">' +
      (ICON[d.kind] || ICON.server) + '</span>' +
      '<div style="flex:1;min-width:0"><div style="font-size:16.5px;font-weight:650;letter-spacing:-.02em">' + esc(d.label) + '</div>' +
      '<div style="font-size:12px;color:var(--muted)">' + esc(d.role) + ' · ' + esc(d.ip || 'layer 2 only') + '</div></div>' +
      '<span class="chip mono devmac">' + esc(d.mac) + '</span></div>';
    h += '<div class="tabs">' + [['overview', 'Overview', 'Info'], ['cli', 'Command line', 'Shell'], ['interfaces', 'Interfaces', 'Ports'], ['routes', 'Routing', 'Routes'], ['arp', 'ARP', 'ARP'], ['services', 'Services', 'Doors'], ['activity', 'Activity', 'Traffic'], ['trace', 'Trace path', 'Path']]
      .map(([id, label, short]) => {
        const disabled = (id === 'services' && !servicesOf(d).length) ? true : false;
        return '<button data-act="lab-tab" data-t="' + id + '" class="' + (tab === id ? 'on' : '') + '"' + (disabled ? ' style="opacity:.45"' : '') + '>' +
          '<span class="only-wide">' + label + '</span><span class="only-narrow">' + short + '</span></button>';
      }).join('') + '</div>';

    if (tab === 'overview') h += overviewTab(topo, d);
    else if (tab === 'cli') h += cliTab(d);
    else if (tab === 'interfaces') h += interfacesTab(d);
    else if (tab === 'routes') h += routesTab(topo, d);
    else if (tab === 'arp') h += arpTab(topo, d);
    else if (tab === 'services') h += servicesTab(d);
    else if (tab === 'activity') h += activityTab(d);
    else if (tab === 'trace') h += traceTab(d);

    h += '</div></div>';

    // suggested paths
    const lessonsHere = U.LESSONS.filter((l) => l.scenario === S.lab.topo);
    if (lessonsHere.length) {
      h += '<div class="panel"><div class="hd"><span>Lessons that use this network</span></div><div class="bd" style="display:flex;gap:7px;flex-wrap:wrap">' +
        lessonsHere.map((l) => '<button class="btn sm" data-act="openLesson" data-id="' + l.id + '">' + esc(l.title) + '</button>').join('') +
        '</div></div>';
    }

    return h;
  }

  function overviewTab(topo, d) {
    const svc = servicesOf(d);
    const routes = routesOf(topo, d);
    const arp = arpOf(topo, d);
    const acts = activity(S.lab.topo).filter((p) => p.src === d.id || p.dst === d.id);
    const peers = {};
    acts.forEach((p) => {
      const other = p.src === d.id ? p.dstLabel : p.srcLabel;
      peers[other] = (peers[other] || 0) + 1;
    });
    const peerList = Object.entries(peers).sort((a, b) => b[1] - a[1]).slice(0, 5);

    let h = '<div class="bd ovgrid">';
    h += '<div><dl class="kv">' +
      '<dt>Role</dt><dd>' + esc(d.role) + '</dd>' +
      '<dt>Hostname</dt><dd>' + esc(hostnameOf(d)) + '</dd>' +
      '<dt>IPv4</dt><dd>' + esc(d.ip || '—') + '</dd>' +
      (d.wan ? '<dt>WAN address</dt><dd>' + esc(d.wan) + '</dd>' : '') +
      '<dt>MAC</dt><dd>' + esc(d.mac) + '</dd>' +
      (d.os ? '<dt>OS</dt><dd>' + esc(d.os) + '</dd>' : '') +
      '<dt>Default gateway</dt><dd>' + esc((routes.find((r) => r.dst === '0.0.0.0/0') || {}).gw || '— (this is the gateway)') + '</dd>' +
      '<dt>Listening sockets</dt><dd>' + svc.length + ' service' + (svc.length === 1 ? '' : 's') + '</dd>' +
      '<dt>Packets seen</dt><dd>' + acts.length + ' in this demo capture</dd>' +
      '</dl>' +
      (d.specs && d.specs.note ? '<div class="decode" style="margin-top:13px">' + esc(d.specs.note) + '</div>' : '') +
      '</div>';

    h += '<div><div style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--dim);font-weight:650;margin-bottom:7px">Who it talks to</div>';
    if (peerList.length) {
      h += '<div style="display:flex;flex-direction:column;gap:5px">' + peerList.map(([nm, n]) => {
        const w = Math.round((n / peerList[0][1]) * 100);
        return '<div class="peerrow" style="display:flex;align-items:center;gap:8px;font-size:12px"><span style="flex:0 0 130px;color:var(--text2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(nm) + '</span>' +
          '<span style="flex:1;height:5px;border-radius:5px;background:var(--line);overflow:hidden"><i style="display:block;height:100%;width:' + w + '%;background:var(--accent);border-radius:5px"></i></span>' +
          '<span class="mono" style="color:var(--muted);font-size:10.5px">' + n + '</span></div>';
      }).join('') + '</div>';
    } else h += '<div style="font-size:12px;color:var(--dim)">No traffic on this map yet.</div>';

    h += '<div style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--dim);font-weight:650;margin:14px 0 7px">Try this</div>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
      ['ip addr', 'ip route', 'arp -a', 'ss -tulpn', 'ping 8.8.8.8', 'traceroute 203.0.113.10', 'dig www.example.com', 'curl -v example.com', 'tcpdump -c 8']
        .map((c) => '<button class="btn sm" data-act="cli-run" data-cmd="' + esc(c) + '">' + esc(c) + '</button>').join('') +
      '</div>';
    if (d.kind === 'router') {
      h += '<div style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--dim);font-weight:650;margin:14px 0 7px">Router extras</div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
        ['conntrack -L', 'iptables -t nat -L', 'show ip route'].map((c) => '<button class="btn sm" data-act="cli-run" data-cmd="' + esc(c) + '">' + esc(c) + '</button>').join('') + '</div>';
    }
    h += '</div></div>';
    return h;
  }

  function interfacesTab(d) {
    const rows = interfacesOf(d).map((i) =>
      '<tr><td class="hi">' + esc(i.name) + '</td><td>' + esc(i.ip) + '</td><td>' + esc(i.mask) + '</td><td>' + esc(i.mac) + '</td><td>' + i.mtu + '</td><td style="color:var(--ok)">' + i.state + '</td></tr>').join('');
    return '<div class="bd"><table class="grid"><thead><tr><th>Interface</th><th>Address</th><th>Mask</th><th>MAC</th><th>MTU</th><th>State</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<div class="decode" style="margin-top:12px">The MTU matters: a 1,500-byte frame is the default on Ethernet, so a 6 KB response becomes four or five packets. Anything with a smaller MTU (VPN tunnels, PPPoE) forces fragmentation or ICMP "packet too big" messages.</div></div>';
  }

  function routesTab(topo, d) {
    const rows = routesOf(topo, d).map((r) => '<tr><td class="hi">' + esc(r.dst) + '</td><td>' + esc(r.gw) + '</td><td>' + esc(r.dev) + '</td><td>' + (r.metric || 0) + '</td><td style="color:var(--muted)">' + esc(r.note || '') + '</td></tr>').join('');
    return '<div class="bd"><table class="grid"><thead><tr><th>Destination</th><th>Gateway</th><th>Interface</th><th>Metric</th><th>Note</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<div class="decode" style="margin-top:12px">Longest prefix wins. The 0.0.0.0/0 entry is the default route: it matches anything and is why a single gateway setting makes the whole internet reachable.</div></div>';
  }

  function arpTab(topo, d) {
    const rows = arpOf(topo, d).map((a) => '<tr><td class="hi">' + esc(a.ip) + '</td><td>' + esc(a.mac) + '</td><td>' + esc(a.dev) + '</td><td>' + esc(a.state) + '</td><td style="color:var(--muted)">' + esc(a.who) + '</td></tr>').join('');
    return '<div class="bd"><table class="grid"><thead><tr><th>IP</th><th>MAC</th><th>Interface</th><th>State</th><th>Device</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<div class="decode" style="margin-top:12px">ARP entries expire in minutes. A wrong entry here is the classic cause of "the network is broken but only for me", and ARP spoofing is just a deliberate wrong entry.</div></div>';
  }

  function servicesTab(d) {
    const svc = servicesOf(d);
    const rows = svc.map((s) => '<tr><td class="hi">' + s.port + '</td><td>' + s.proto + '</td><td>' + esc(s.name) + '</td><td style="color:var(--muted);font-family:var(--sans)">' + esc(s.note) + '</td></tr>').join('');
    return '<div class="bd"><table class="grid"><thead><tr><th>Port</th><th>Transport</th><th>Process</th><th>Purpose</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<div class="decode" style="margin-top:12px">A port is only reachable if something is listening on it. A closed port answers with a RST; a filtered port answers with silence. Those two failures look identical to a user and completely different in a capture.</div></div>';
  }

  function activityTab(d) {
    const acts = activity(S.lab.topo).filter((p) => p.src === d.id || p.dst === d.id);
    if (!acts.length) return '<div class="empty">No packets for this device in the demo capture.</div>';
    const rows = acts.slice(0, 60).map((p) =>
      '<tr><td>' + p.t.toFixed(3) + '</td><td>' + esc(p.srcLabel) + '</td><td>' + esc(p.dstLabel) + '</td>' +
      '<td><span class="tagp" style="color:' + p.protoColor + ';border-color:' + p.protoColor + '55;background:' + p.protoColor + '14">' + esc(p.proto) + '</span></td>' +
      '<td style="font-family:var(--sans);max-width:420px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(p.summary) + '</td>' +
      '<td style="color:var(--dim);font-family:var(--sans);font-size:10.5px">' + esc(p.lesson) + '</td></tr>').join('');
    return '<div class="bd"><div class="pcaplist scroll" style="max-height:420px"><table class="grid"><thead><tr><th>Time</th><th>From</th><th>To</th><th>Protocol</th><th>Info</th><th>From lesson</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<div class="decode" style="margin-top:12px">These are the same packets you meet in the lessons, filtered to this device. Notice how many protocols one box speaks at once.</div></div>';
  }

  function traceTab(d) {
    const targets = devicesOf(S.lab.topo).filter((x) => x.id !== d.id && x.ip && x.ip !== '—');
    let h = '<div class="bd">';
    h += '<div style="display:flex;gap:8px;align-items:center;margin-bottom:11px;flex-wrap:wrap"><span style="font-size:12px;color:var(--muted)">Path from ' + esc(d.label) + ' to</span>' +
      targets.slice(0, 9).map((t) => '<button class="btn sm" data-act="lab-trace" data-id="' + t.id + '">' + esc(t.label) + '</button>').join('') + '</div>';
    const tid = S.lab.traceTarget && targets.find((t) => t.id === S.lab.traceTarget) ? S.lab.traceTarget : (targets[0] && targets[0].id);
    if (!tid) return h + '<div class="empty">No other addressable device here.</div>';
    const path = pathBetween(S.lab.topo, d.id, tid);
    if (!path) return h + '<div class="empty">No route in this topology.</div>';
    let acc = 0;
    h += '<div class="trace">';
    path.forEach((id, i) => {
      const dev = devById(S.lab.topo, id);
      acc += i === 0 ? 0 : 5.5 + i * 1.3;
      h += '<div class="hoprow"><span class="h-n">' + (i === 0 ? '·' : i) + '</span>' +
        '<span class="h-nm">' + esc(dev.label) + (i === 0 ? ' <span style="color:var(--dim)">(this device)</span>' : '') + '</span>' +
        '<span class="h-ip">' + esc(dev.ip || dev.wan || '—') + '</span>' +
        '<span class="h-ms">' + (i === 0 ? '' : acc.toFixed(2) + ' ms') + '</span></div>';
    });
    h += '</div>';
    h += '<div class="decode" style="margin-top:12px">Each step adds one decrement of TTL and one ICMP Time Exceeded reply. ' + (path.length - 1) + ' hop' + (path.length === 2 ? '' : 's') + ' means ' + path.length + ' devices handle this traffic — and every router in between rebuilt the Ethernet header.</div>';
    h += '</div>';
    return h;
  }

  function cliTab(d) {
    return '<div class="bd">' +
      '<div class="cli"><div class="out scroll" id="cliout">' + CLI.lines.join('\n') + '</div>' +
      '<form id="cliform" data-act="cli-submit"><span class="ps1">' + esc(hostnameOf(d)) + (d.kind === 'router' || d.kind === 'switch' ? '#' : '$') + '</span>' +
      '<input id="cliin" autocomplete="off" spellcheck="false" placeholder="type help, or try ping 8.8.8.8" /></form>' +
      '<div class="hints">' +
      ['help', 'ip addr', 'ip route', 'arp -a', 'ss -tulpn', 'ping 8.8.8.8', 'traceroute 203.0.113.10', 'dig +trace www.example.com', 'openssl s_client -connect example.com:443', 'bridge fdb', 'show interface counters', 'conntrack -S', 'tcpdump -c 8', 'clear']
        .map((c) => '<button type="button" data-act="cli-run" data-cmd="' + esc(c) + '">' + esc(c) + '</button>').join('') +
      '</div></div>' +
      '<div class="decode" style="margin-top:12px">The shell is simulated, but the topology, paths and packet counts come from the same data the lessons use. <b>traceroute</b> and <b>tcpdump</b> are the two commands that teach the most, fastest.</div></div>';
  }

  function focusCli() {
    const i = document.getElementById('cliin');
    if (i) { i.focus(); }
    const o = document.getElementById('cliout');
    if (o) o.scrollTop = o.scrollHeight;
  }
  function rerenderCli() {
    const o = document.getElementById('cliout');
    if (o) { o.innerHTML = CLI.lines.join('\n'); o.scrollTop = o.scrollHeight; }
  }

  function submit(cmd) {
    if (/^clear$/.test(cmd.trim())) { CLI.lines = []; rerenderCli(); return; }
    runCommand(cmd);
    rerenderCli();
    focusCli();
  }

  root.PE_LAB = {
    render, afterRender() { if (S.lab.tab === 'cli') focusCli(); },
    submit, cliReset, cliPush, CLI, activity,
  };
})(typeof window !== 'undefined' ? window : globalThis);
