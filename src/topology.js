/* ============================================================
   topology.js — networks, devices and their inventories.
   Every device can be opened and inspected like a real box:
   interfaces, routes, ARP cache, listening services, CLI.
   ============================================================ */
(function (root) {
  'use strict';

  const D = (o) => o;

  const TOPOLOGIES = {
    home: D({
      id: 'home',
      label: 'Home network → internet',
      caption: 'One laptop, one router, and the servers on the other side of the internet.',
      lan: { net: '192.168.1.0', mask: '255.255.255.0', prefix: 24, gateway: '192.168.1.1' },
      devices: [
        D({ id: 'pc', label: 'Your Laptop', kind: 'laptop', ip: '192.168.1.10', mac: 'a4:5e:60:1b:2c:3d', x: 7, y: 80, role: 'Client', os: 'macOS 14.6',
          specs: { cpu: 'Apple M2', note: 'Picks an ephemeral port for every connection it opens.' } }),
        D({ id: 'sw', label: 'Switch', kind: 'switch', ip: '—', mac: 'f0:9f:c2:11:22:33', x: 23, y: 80, role: 'Layer 2 switch',
          specs: { note: 'Forwards frames by MAC address. Has no IP: it never looks inside a packet.' } }),
        D({ id: 'rtr', label: 'Router', kind: 'router', ip: '192.168.1.1', wan: '203.0.113.75', mac: 'b8:27:eb:4c:5d:6e', x: 39, y: 80, role: 'Home gateway / NAT',
          specs: { note: 'Two lives: private LAN on the inside, one public address on the outside.' } }),
        D({ id: 'dns', label: 'DNS Resolver', kind: 'dns', ip: '8.8.8.8', mac: '00:1c:42:aa:bb:cc', x: 53, y: 30, role: 'Recursive resolver',
          specs: { note: 'Does the legwork of the DNS hierarchy for you, then caches the answer.' } }),
        D({ id: 'root', label: 'Root Server', kind: 'server', ip: '198.41.0.4', mac: '00:0a:95:11:11:11', x: 90, y: 12, role: 'DNS root (.)',
          specs: { note: 'Knows only one thing: who runs each top-level domain.' } }),
        D({ id: 'tld', label: '.com TLD Server', kind: 'server', ip: '192.5.6.30', mac: '00:0a:95:22:22:22', x: 90, y: 40, role: '.com registry',
          specs: { note: 'Knows the nameservers for every .com domain. There are 13 root server identities worldwide, hundreds of anycast instances.' } }),
        D({ id: 'auth', label: 'Authoritative NS', kind: 'server', ip: '198.51.100.53', mac: '00:0a:95:33:33:33', x: 90, y: 68, role: 'Authoritative nameserver',
          specs: { note: 'Holds the actual zone file for example.com. Its answer is the truth.' } }),
        D({ id: 'web', label: 'Web Server', kind: 'web', ip: '203.0.113.10', mac: '00:1b:21:aa:bb:01', x: 71, y: 52, role: 'www.example.com',
          specs: { os: 'Linux 6.8 · nginx', note: 'Waits on port 443 for anyone who knows its address.' } }),
        D({ id: 'mail', label: 'Mail Server', kind: 'mail', ip: '198.51.100.25', mac: '00:1b:21:aa:bb:02', x: 28, y: 26, role: 'mx.example.com',
          specs: { note: 'Speaks SMTP on 25 and 587; hands mail to phones with IMAP on 143/993.' } }),
        D({ id: 'ca', label: 'Certificate Authority', kind: 'ca', ip: '198.51.100.90', mac: '00:1b:21:aa:bb:03', x: 70, y: 20, role: 'Trust anchor',
          specs: { note: 'Signs certificates. Its public key ships inside your browser.' } }),
      ],
      links: [['pc', 'sw'], ['sw', 'rtr'], ['rtr', 'dns'], ['rtr', 'web'], ['rtr', 'mail'], ['rtr', 'ca'], ['dns', 'root'], ['root', 'tld'], ['tld', 'auth'], ['dns', 'auth']],
    }),

    lan: D({
      id: 'lan',
      label: 'Home LAN (before the internet)',
      caption: 'Two computers, a switch and a router — everything starts here.',
      lan: { net: '192.168.1.0', mask: '255.255.255.0', prefix: 24, gateway: '192.168.1.1' },
      devices: [
        D({ id: 'pc', label: 'Your Laptop', kind: 'laptop', ip: '192.168.1.10', mac: 'a4:5e:60:1b:2c:3d', x: 9, y: 60, role: 'Client', os: 'macOS 14.6' }),
        D({ id: 'laptop', label: 'Phone', kind: 'phone', ip: '192.168.1.11', mac: 'd0:81:7a:22:33:44', x: 9, y: 84, role: 'Second client' }),
        D({ id: 'sw', label: 'Switch', kind: 'switch', ip: '—', mac: 'f0:9f:c2:11:22:33', x: 34, y: 72, role: 'Layer 2 switch' }),
        D({ id: 'rtr', label: 'Router', kind: 'router', ip: '192.168.1.1', wan: '203.0.113.75', mac: 'b8:27:eb:4c:5d:6e', x: 58, y: 72, role: 'DHCP server + gateway',
          specs: { note: 'Runs a tiny DHCP server for the LAN and NAT for everything leaving it.' } }),
        D({ id: 'web', label: 'Web Server', kind: 'web', ip: '203.0.113.10', mac: '00:1b:21:aa:bb:01', x: 84, y: 72, role: 'www.example.com' }),
        D({ id: 'dns', label: 'DNS Resolver', kind: 'dns', ip: '8.8.8.8', mac: '00:1c:42:aa:bb:cc', x: 84, y: 34, role: 'Recursive resolver' }),
      ],
      links: [['pc', 'sw'], ['laptop', 'sw'], ['sw', 'rtr'], ['rtr', 'web'], ['rtr', 'dns']],
    }),

    mail: D({
      id: 'mail',
      label: 'Sending and reading email',
      caption: 'Two mail servers, one sender, one phone with IMAP.',
      lan: { net: '192.168.1.0', mask: '255.255.255.0', prefix: 24, gateway: '192.168.1.1' },
      devices: [
        D({ id: 'pc', label: 'Mail app', kind: 'laptop', ip: '192.168.1.10', mac: 'a4:5e:60:1b:2c:3d', x: 8, y: 78, role: 'SMTP client' }),
        D({ id: 'rtr', label: 'Router', kind: 'router', ip: '192.168.1.1', wan: '203.0.113.75', mac: 'b8:27:eb:4c:5d:6e', x: 28, y: 78, role: 'Home gateway' }),
        D({ id: 'dns', label: 'DNS Resolver', kind: 'dns', ip: '8.8.8.8', mac: '00:1c:42:aa:bb:cc', x: 28, y: 26, role: 'Recursive resolver' }),
        D({ id: 'smtp', label: 'Sending Server', kind: 'mail', ip: '203.0.113.25', mac: '00:1b:21:aa:bb:04', x: 52, y: 62, role: 'smtp.example.com',
          specs: { note: 'Accepts your outgoing mail on 587 after you log in.' } }),
        D({ id: 'mrecv', label: 'Recipient Server', kind: 'mail', ip: '198.51.100.25', mac: '00:1b:21:aa:bb:02', x: 76, y: 62, role: 'mx.mailhost.net' }),
        D({ id: 'phone', label: 'Recipient Phone', kind: 'phone', ip: '198.51.100.140', mac: 'd0:81:7a:55:66:77', x: 92, y: 84, role: 'IMAP client' }),
      ],
      links: [['pc', 'rtr'], ['rtr', 'dns'], ['rtr', 'smtp'], ['rtr', 'mrecv'], ['smtp', 'mrecv'], ['mrecv', 'phone']],
    }),


    cdn: D({
      id: 'cdn',
      label: 'Anycast CDN and origin',
      caption: 'One IP address in many places, and a cache hierarchy behind it.',
      lan: { net: '192.168.1.0', mask: '255.255.255.0', prefix: 24, gateway: '192.168.1.1' },
      devices: [
        D({ id: 'pc', label: 'Browser', kind: 'laptop', ip: '192.168.1.10', mac: 'a4:5e:60:1b:2c:3d', x: 8, y: 78, role: 'Client', os: 'macOS 14.6' }),
        D({ id: 'rtr', label: 'Home Router', kind: 'router', ip: '192.168.1.1', wan: '203.0.113.75', mac: 'b8:27:eb:4c:5d:6e', x: 26, y: 78, role: 'NAT gateway' }),
        D({ id: 'isdns', label: 'ISP Resolver', kind: 'dns', ip: '8.8.8.8', mac: '00:1c:42:aa:bb:cc', x: 26, y: 30, role: 'Recursive resolver' }),
        D({ id: 'geodns', label: 'Geo DNS', kind: 'dns', ip: '198.51.100.53', mac: '00:0a:95:44:44:44', x: 46, y: 18, role: 'Steers by location', specs: { note: 'Returns a different A record depending on where the query came from.' } }),
        D({ id: 'edge', label: 'CDN Edge · Chennai', kind: 'server', ip: '203.0.113.80', mac: '00:1b:21:cc:00:01', x: 46, y: 70, role: 'Anycast edge', specs: { note: 'The same 203.0.113.80 is announced from hundreds of locations.' } }),
        D({ id: 'far', label: 'CDN Edge · Frankfurt', kind: 'server', ip: '203.0.113.80', mac: '00:1b:21:cc:00:02', x: 46, y: 42, role: 'Same anycast IP', specs: { note: 'Identical address, different machine. BGP decides which one you reach.' } }),
        D({ id: 'shield', label: 'Origin Shield', kind: 'server', ip: '198.51.100.70', mac: '00:1b:21:cc:00:03', x: 66, y: 70, role: 'Mid-tier cache' }),
        D({ id: 'origin', label: 'Origin Server', kind: 'web', ip: '198.51.100.10', mac: '00:1b:21:aa:bb:01', x: 85, y: 70, role: 'The real webserver' }),
      ],
      links: [['pc', 'rtr'], ['rtr', 'isdns'], ['isdns', 'geodns'], ['rtr', 'edge'], ['rtr', 'far'], ['edge', 'shield'], ['shield', 'origin']],
    }),

    dc: D({
      id: 'dc',
      label: 'Behind the load balancer',
      caption: 'What sits between the internet and one line of application code.',
      lan: { net: '10.0.2.0', mask: '255.255.255.0', prefix: 24, gateway: '10.0.2.1' },
      devices: [
        D({ id: 'pc', label: 'Client', kind: 'laptop', ip: '203.0.113.140', mac: 'a4:5e:60:1b:2c:3d', x: 8, y: 76, role: 'On the internet' }),
        D({ id: 'lb', label: 'Load Balancer', kind: 'router', ip: '203.0.113.20', mac: '00:1b:21:dd:00:01', x: 34, y: 76, role: 'TLS + L7 routing', specs: { note: 'Terminates TLS, picks a backend, and re-encrypts to it if you ask.' } }),
        D({ id: 'app1', label: 'App Server 1', kind: 'web', ip: '10.0.2.11', mac: '00:1b:21:dd:00:11', x: 62, y: 48, role: 'Healthy' }),
        D({ id: 'app2', label: 'App Server 2', kind: 'web', ip: '10.0.2.12', mac: '00:1b:21:dd:00:12', x: 62, y: 92, role: 'Failing health check' }),
        D({ id: 'db', label: 'Database', kind: 'server', ip: '10.0.2.21', mac: '00:1b:21:dd:00:21', x: 88, y: 70, role: 'Connection-pooled' }),
      ],
      links: [['pc', 'lb'], ['lb', 'app1'], ['lb', 'app2'], ['app1', 'db'], ['app2', 'db']],
    }),

    k8s: D({
      id: 'k8s',
      label: 'Kubernetes cluster',
      caption: 'From an Ingress URL to a pod IP behind a virtual service address.',
      lan: { net: '10.244.0.0', mask: '255.255.0.0', prefix: 16, gateway: '10.244.0.1' },
      devices: [
        D({ id: 'pc', label: 'Client', kind: 'laptop', ip: '203.0.113.140', mac: 'a4:5e:60:1b:2c:3d', x: 8, y: 74, role: 'On the internet' }),
        D({ id: 'ing', label: 'Ingress Controller', kind: 'router', ip: '203.0.113.21', wan: '10.0.0.11', mac: '00:1b:21:ee:00:01', x: 28, y: 74, role: 'L7 entry point', specs: { note: 'Terminates TLS, then DNATs to a ClusterIP service.' } }),
        D({ id: 'svc', label: 'Service ClusterIP', kind: 'switch', ip: '10.96.0.42', mac: '00:00:00:00:00:00', x: 50, y: 74, role: 'Virtual IP', specs: { note: 'No process ever owns this address. kube-proxy writes iptables rules that rewrite it.' } }),
        D({ id: 'pod1', label: 'Pod · app-7f9c', kind: 'pod', ip: '10.244.1.7', mac: 'c2:5e:9a:11:00:07', x: 74, y: 52, role: 'Backend replica' }),
        D({ id: 'pod2', label: 'Pod · app-7f9c', kind: 'pod', ip: '10.244.2.9', mac: 'c2:5e:9a:11:00:09', x: 74, y: 92, role: 'Backend replica' }),
        D({ id: 'api', label: 'kube-apiserver', kind: 'server', ip: '10.0.0.1', mac: '00:1b:21:ee:00:02', x: 50, y: 30, role: 'Control plane' }),
        D({ id: 'coredns', label: 'CoreDNS', kind: 'dns', ip: '10.96.0.10', mac: '00:00:00:00:00:00', x: 28, y: 30, role: 'Cluster DNS' }),
      ],
      links: [['pc', 'ing'], ['ing', 'svc'], ['svc', 'pod1'], ['svc', 'pod2'], ['pod1', 'api'], ['ing', 'coredns']],
    }),

    cloud: D({
      id: 'cloud',
      label: 'Cloud VPC',
      caption: 'Internet gateway, public and private subnets, NAT gateway, database subnet.',
      lan: { net: '10.10.0.0', mask: '255.255.255.0', prefix: 24, gateway: '10.10.1.1' },
      devices: [
        D({ id: 'pc', label: 'Client', kind: 'laptop', ip: '203.0.113.140', mac: 'a4:5e:60:1b:2c:3d', x: 7, y: 74, role: 'On the internet' }),
        D({ id: 'igw', label: 'Internet Gateway', kind: 'router', ip: '203.0.113.50', mac: '00:1b:21:ff:00:01', x: 24, y: 74, role: 'VPC edge', specs: { note: 'A managed NAT boundary: outside addresses are 1:1 mapped onto instances.' } }),
        D({ id: 'alb', label: 'Load Balancer', kind: 'web', ip: '10.10.1.20', mac: '00:1b:21:ff:00:02', x: 42, y: 40, role: 'Public subnet 10.10.1.0/24' }),
        D({ id: 'nat', label: 'NAT Gateway', kind: 'router', ip: '10.10.1.30', mac: '00:1b:21:ff:00:03', x: 42, y: 92, role: 'Public subnet · egress only', specs: { note: 'Private subnets can reach out through it; nothing can reach in.' } }),
        D({ id: 'app', label: 'App Instance', kind: 'server', ip: '10.10.2.11', mac: '00:1b:21:ff:00:11', x: 66, y: 40, role: 'Private subnet 10.10.2.0/24' }),
        D({ id: 'db', label: 'Database', kind: 'server', ip: '10.10.3.21', mac: '00:1b:21:ff:00:21', x: 88, y: 66, role: 'Data subnet 10.10.3.0/24' }),
      ],
      links: [['pc', 'igw'], ['igw', 'alb'], ['igw', 'nat'], ['alb', 'app'], ['app', 'db'], ['app', 'nat']],
    }),

    wifi: D({
      id: 'wifi',
      label: 'Wi-Fi link',
      caption: 'Association, the WPA2 four-way handshake, and what "connected" really means.',
      lan: { net: '192.168.1.0', mask: '255.255.255.0', prefix: 24, gateway: '192.168.1.1' },
      devices: [
        D({ id: 'pc', label: 'Your Laptop', kind: 'laptop', ip: '192.168.1.10', mac: 'a4:5e:60:1b:2c:3d', x: 12, y: 74, role: 'Station (client)' }),
        D({ id: 'ap', label: 'Access Point', kind: 'ap', ip: '192.168.1.1', mac: 'b8:27:eb:4c:5d:6e', x: 42, y: 74, role: 'AP + DHCP + gateway', specs: { note: 'Bridges 802.11 frames onto Ethernet, and holds the PSK for the WPA handshake.' } }),
        D({ id: 'dns', label: 'DNS Resolver', kind: 'dns', ip: '8.8.8.8', mac: '00:1c:42:aa:bb:cc', x: 70, y: 34, role: 'Recursive resolver' }),
        D({ id: 'web', label: 'Web Server', kind: 'web', ip: '203.0.113.10', mac: '00:1b:21:aa:bb:01', x: 90, y: 74, role: 'www.example.com' }),
      ],
      links: [['pc', 'ap'], ['ap', 'dns'], ['ap', 'web']],
    }),

    mesh: D({
      id: 'mesh',
      label: 'Service mesh (mTLS)',
      caption: 'Two sidecars, one encrypted hop, and identity that is not an IP address.',
      lan: { net: '10.244.0.0', mask: '255.255.0.0', prefix: 16, gateway: '10.244.0.1' },
      devices: [
        D({ id: 'front', label: 'Frontend pod', kind: 'pod', ip: '10.244.1.7', mac: 'c2:5e:9a:11:00:07', x: 10, y: 74, role: 'Application container' }),
        D({ id: 'sf', label: 'Sidecar · front', kind: 'proxy', ip: '10.244.1.7', mac: 'c2:5e:9a:11:00:07', x: 33, y: 74, role: 'Envoy proxy in the same netns' }),
        D({ id: 'cp', label: 'Mesh control plane', kind: 'server', ip: '10.0.0.9', mac: '00:1b:21:ee:00:09', x: 33, y: 30, role: 'Issues SPIFFE certs' }),
        D({ id: 'sb', label: 'Sidecar · backend', kind: 'proxy', ip: '10.244.2.9', mac: 'c2:5e:9a:11:00:09', x: 66, y: 74, role: 'Envoy proxy in the same netns' }),
        D({ id: 'back', label: 'Backend pod', kind: 'pod', ip: '10.244.2.9', mac: 'c2:5e:9a:11:00:09', x: 89, y: 74, role: 'Application container' }),
      ],
      links: [['front', 'sf'], ['sf', 'sb'], ['sb', 'back'], ['sf', 'cp'], ['sb', 'cp']],
    }),
    bgp: D({
      id: 'bgp',
      label: 'Between networks: BGP',
      caption: 'Autonomous systems talking to each other.',
      lan: { net: '10.0.0.0', mask: '255.255.255.0', prefix: 24, gateway: '10.0.0.1' },
      devices: [
        D({ id: 'pc', label: 'Client', kind: 'laptop', ip: '10.0.0.10', mac: 'a4:5e:60:1b:2c:3d', x: 6, y: 78, role: 'Client' }),
        D({ id: 'isp', label: 'AS 64500 · ISP', kind: 'router', ip: '10.0.0.1', wan: '198.51.100.1', mac: 'b8:27:eb:00:00:01', x: 24, y: 78, role: 'Your ISP' }),
        D({ id: 'tier', label: 'AS 64501 · Transit', kind: 'router', ip: '198.51.100.2', wan: '203.0.113.1', mac: 'b8:27:eb:00:00:02', x: 46, y: 50, role: 'Tier-1 transit provider' }),
        D({ id: 'asb', label: 'AS 64502 · Path B', kind: 'router', ip: '203.0.113.2', wan: '192.0.2.1', mac: 'b8:27:eb:00:00:03', x: 70, y: 26, role: 'Peer network' }),
        D({ id: 'asc', label: 'AS 64503 · Path C', kind: 'router', ip: '192.0.2.2', wan: '203.0.113.9', mac: 'b8:27:eb:00:00:04', x: 70, y: 78, role: 'Peer network' }),
        D({ id: 'dest', label: 'Destination', kind: 'web', ip: '203.0.113.10', mac: '00:1b:21:aa:bb:01', x: 91, y: 50, role: '203.0.113.0/24' }),
      ],
      links: [['pc', 'isp'], ['isp', 'tier'], ['tier', 'asb'], ['tier', 'asc'], ['asb', 'dest'], ['asc', 'dest']],
    }),
  };

  /* ---------------- per-device defaults ---------------------------------- */
  const SERVICES_BY_KIND = {
    laptop: [],
    phone: [],
    switch: [],
    router: [
      { port: 53, proto: 'UDP', name: 'dnsmasq', note: 'tiny DNS forwarder for the LAN' },
      { port: 67, proto: 'UDP', name: 'dhcpd', note: 'hands out 192.168.1.100–200' },
      { port: 443, proto: 'TCP', name: 'luci', note: 'admin page (LAN only)' },
    ],
    web: [
      { port: 443, proto: 'TCP', name: 'nginx', note: 'TLS + HTTP/1.1 and HTTP/2' },
      { port: 80, proto: 'TCP', name: 'nginx', note: 'redirects to 443' },
      { port: 22, proto: 'TCP', name: 'sshd', note: 'shell access' },
    ],
    dns: [
      { port: 53, proto: 'UDP', name: 'unbound', note: 'recursive queries' },
      { port: 53, proto: 'TCP', name: 'unbound', note: 'large answers, zone transfers' },
      { port: 853, proto: 'TCP', name: 'DoT', note: 'DNS over TLS' },
    ],
    mail: [
      { port: 25, proto: 'TCP', name: 'postfix', note: 'server-to-server delivery' },
      { port: 587, proto: 'TCP', name: 'postfix', note: 'submission with login' },
      { port: 143, proto: 'TCP', name: 'dovecot', note: 'IMAP' },
      { port: 993, proto: 'TCP', name: 'dovecot', note: 'IMAP over TLS' },
      { port: 110, proto: 'TCP', name: 'dovecot', note: 'POP3' },
    ],
    server: [
      { port: 53, proto: 'UDP', name: 'named', note: 'authoritative DNS for the zone' },
      { port: 22, proto: 'TCP', name: 'sshd', note: 'administration' },
    ],
    ca: [
      { port: 443, proto: 'TCP', name: 'ocsp', note: 'certificate revocation checks' },
    ],
  };

  root.PE_TOPO = { TOPOLOGIES, SERVICES_BY_KIND };
})(typeof window !== 'undefined' ? window : globalThis);
