/* ============================================================
   lessons-basics.js — Track 1 (Foundations) and Track 2 (Getting online)
   Packet spec keys:  s,d (devices) · proto · info · t (seconds)
   app: dnsq | dnsr | dhcp | httpReq | httpRes | tls | tcpData | udpData |
        icmp | arp | sshText | smtpText | imapText | ftpText | quic
   overrides: sport, dport, ttl, sip, dip, tcp{}, dns{}, dhcp{}, tls{},
              http{}, icmp{}, arp{}, pay{label,len,note}, dropped, note
   ============================================================ */
(function (root) {
  'use strict';

  const LESSONS = [

    /* ================= TRACK 1 · FOUNDATIONS ================= */
    {
      id: 'packets',
      track: 'basics',
      title: 'A message becomes packets',
      subtitle: 'Why the internet chops everything into pieces',
      scenario: 'lan',
      level: 1,
      minutes: 4,
      goals: ['what a packet is', 'header vs payload', 'why messages are split up'],
      steps: [
        {
          title: 'One file, many envelopes',
          sub: 'The reply you asked for is far too big for one frame',
          focus: ['pc', 'sw', 'web'],
          what: 'You click a link and the server sends back a 6 KB page. A single Ethernet frame can carry about 1,500 bytes, so the data is sliced into segments — and each segment travels in its own packet.',
          why: 'Small pieces can be interleaved with everyone else\'s traffic. Nobody has to wait for your 6 KB to finish before their email goes out.',
          analogy: 'You would not mail a piano in one crate. You send it as parts, each with a label saying which piano it belongs to and where it goes in the assembly.',
          terms: [
            { t: 'Packet', d: 'A small, self-contained chunk of data with an address label on the front. The internet\'s unit of transport.' },
            { t: 'Segment', d: 'The name for a packet when TCP cuts your data stream into pieces. Same idea, more precise word.' },
          ],
          packets: [
            { s: 'pc', d: 'web', proto: 'TCP', app: 'tcpData', t: 0.0, proto2: 'Data', info: '52344 → 80 [PSH, ACK] Seq=2 Len=1460 · 1/4 of the page', tcp: { flags: 'PSH, ACK', seq: 2, ack: 1 }, pay: { label: 'Data 1/4', len: 1460 } },
            { s: 'web', d: 'pc', proto: 'TCP', app: 'tcpData', t: 0.02, info: '80 → 52344 [PSH, ACK] Seq=1 Len=1460 · 2/4 of the page', tcp: { flags: 'PSH, ACK', seq: 1, ack: 1462 }, pay: { label: 'Data 2/4', len: 1460 } },
            { s: 'web', d: 'pc', proto: 'TCP', app: 'tcpData', t: 0.03, info: '80 → 52344 [PSH, ACK] Seq=1461 Len=1460 · 3/4 of the page', tcp: { flags: 'PSH, ACK', seq: 1461, ack: 1462 }, pay: { label: 'Data 3/4', len: 1460 } },
            { s: 'web', d: 'pc', proto: 'TCP', app: 'tcpData', t: 0.04, info: '80 → 52344 [PSH, ACK] Seq=2921 Len=512 · 4/4 of the page', tcp: { flags: 'PSH, ACK', seq: 2921, ack: 1462 }, pay: { label: 'Data 4/4', len: 512 } },
          ],
        },
        {
          title: 'Front of the envelope: the header',
          sub: 'Open the byte view of any packet',
          focus: ['web', 'pc'],
          what: 'Every packet has a header and a payload. The header holds what the network needs — addresses, port numbers, sequence numbers, checksums. The payload is your actual data. Select a packet below and read its bytes: the coloured rows are headers, the grey rows are the page itself.',
          why: 'A network device never needs to understand your data. It only reads the header, which is why one wire can carry web pages, video calls and bank transfers at the same time.',
          analogy: 'A shipping label does not need to know what is inside the box — it only needs the destination, the sender, and a tracking number.',
          terms: [
            { t: 'Header', d: 'Structured metadata at the front of a packet: who sent it, where it goes, and how to check it arrived intact.' },
            { t: 'Payload', d: 'The actual content being carried — part of a web page, a photo, a video frame.' },
            { t: 'MTU', d: 'Maximum Transmission Unit. The biggest frame a link can carry, usually 1,500 bytes on Ethernet. Anything bigger gets split.' },
          ],
          packets: [
            { s: 'web', d: 'pc', proto: 'TCP', app: 'tcpData', t: 0.05, info: '80 → 52344 [PSH, ACK] Seq=4381 Len=1460', tcp: { flags: 'PSH, ACK', seq: 4381, ack: 1462 }, pay: { label: 'Data 5/8', len: 1460 } },
          ],
        },
        {
          title: 'Pieces can arrive out of order',
          sub: 'The sequence number is how the pieces find their place',
          focus: ['web', 'pc'],
          what: 'Two packets can take different routes and arrive swapped. Look at the sequence numbers: the laptop receives Seq=2921 before Seq=1461, holds the second one in a buffer, and puts the stream back together byte by byte.',
          why: 'Routing decisions are made per packet, per hop, at the moment they happen. Order is not guaranteed by the network — it is guaranteed by TCP on your machine.',
          analogy: 'Numbered pages of a manuscript mailed in separate envelopes. They can arrive in any order; you sort them by page number.',
          terms: [
            { t: 'Sequence number', d: 'A counter on every TCP byte, so the receiver can reorder pieces and spot gaps.' },
            { t: 'Reassembly', d: 'Putting the pieces back in order at the destination.' },
          ],
          packets: [
            { s: 'web', d: 'pc', proto: 'TCP', app: 'tcpData', t: 0.06, info: '80 → 52344 [PSH, ACK] Seq=2921 Len=1460', tcp: { flags: 'PSH, ACK', seq: 2921, ack: 1462 }, pay: { label: 'Data 6/8', len: 1460 }, note: 'arrives before Seq=1461 — held in the reorder buffer' },
            { s: 'pc', d: 'web', proto: 'TCP', app: 'tcpData', t: 0.07, info: '52344 → 80 [ACK] Ack=4381 · duplicate, out of order', tcp: { flags: 'ACK', seq: 1462, ack: 4381 }, note: 'same ACK twice: "I am still waiting for the missing piece"' },
          ],
        },
        {
          title: 'And if one never arrives?',
          sub: 'The gap is noticed and the piece is sent again',
          focus: ['pc', 'web'],
          what: 'Suppose Seq=4381 is lost at a congested router. The receiver keeps acknowledging the last good byte, and after three duplicate ACKs the sender retransmits immediately instead of waiting for a timeout. Nothing in your download is corrupted or missing — it is just a little late.',
          why: 'This is why a TCP download can survive a terrible Wi-Fi link and still produce a perfect file. UDP has no such repair service.',
          analogy: 'Reading out a list of numbers, hearing "wait, I missed 47", and repeating just that one number.',
          terms: [{ t: 'Retransmission', d: 'Sending a lost packet again, either after a timeout or after duplicate ACKs.' }],
          packets: [
            { s: 'pc', d: 'web', proto: 'TCP', app: 'tcpData', t: 0.08, info: '52344 → 80 [ACK] Ack=4381 · duplicate ACK ×3', tcp: { flags: 'ACK', seq: 1462, ack: 4381 } },
            { s: 'web', d: 'pc', proto: 'TCP', app: 'tcpData', t: 0.09, info: '80 → 52344 [PSH, ACK] Seq=4381 Len=1460 · retransmission', tcp: { flags: 'PSH, ACK', seq: 4381, ack: 1462 }, pay: { label: 'Data 5/8 (again)', len: 1460 }, note: 'fast retransmit: the loss was inferred, not timed out' },
          ],
        },
      ],
      quiz: [
        {
          q: 'A 6 KB web page arrives as four packets. What decides the order they are put back together in?',
          opts: ['The order they arrive in', 'Their TCP sequence numbers', 'Their IP addresses', 'The router between them'],
          a: 1,
          why: 'IP does not promise order. TCP numbers every byte, so the receiver sorts them and detects gaps.',
        },
      ],
    },

    {
      id: 'addressing',
      track: 'basics',
      title: 'Three addresses on every packet',
      subtitle: 'MAC, IP and port — who, where, and which app',
      scenario: 'lan',
      level: 1,
      minutes: 5,
      goals: ['the difference between MAC and IP', 'what a port identifies', 'how a frame is re-addressed at every hop'],
      steps: [
        {
          title: 'MAC address — who, on this wire',
          sub: 'Burned into the network card',
          focus: ['pc', 'sw', 'rtr'],
          what: 'The Ethernet header at the very front of the frame carries a 48-bit hardware address. This one belongs to the laptop (a4:5e:60:1b:2c:3d) and is handed to the switch, which forwards by MAC only.',
          why: 'MAC addresses are flat and local — they only have meaning on the link you are on. They get rewritten at every router hop.',
          analogy: 'A name badge you wear inside one building. Outside the building nobody recognises it.',
          terms: [{ t: 'MAC address', d: 'A 48-bit hardware address burned into the network interface, written like a4:5e:60:1b:2c:3d. Only meaningful on the local link.' }],
          packets: [
            { s: 'pc', d: 'rtr', proto: 'IP', app: 'tcpData', t: 0.0, info: 'Ethernet frame, destination b8:27:eb:4c:5d:6e (router)', tcp: { flags: 'PSH, ACK', seq: 1, ack: 1 }, pay: { label: 'Data', len: 300 } },
          ],
        },
        {
          title: 'IP address — where, end to end',
          sub: 'Unchanged from your laptop all the way to the server',
          focus: ['pc', 'rtr', 'web'],
          what: 'Inside the frame is an IP header with the source 192.168.1.10 and destination 203.0.113.10. No router on the way may change these two fields — they identify the two ends of the conversation.',
          why: 'Two address systems, two jobs. MAC gets the frame across one link; IP gets the packet across the whole internet.',
          analogy: 'The destination street address written on the parcel stays the same even though every delivery van that carries it has a different licence plate.',
          terms: [{ t: 'IP address', d: 'A logical address that routers use to move a packet between networks. It survives for the whole journey.' }],
          packets: [
            { s: 'pc', d: 'web', proto: 'IP', app: 'tcpData', t: 0.001, info: '192.168.1.10 → 203.0.113.10 · TTL 64', ttl: 64, tcp: { flags: 'PSH, ACK', seq: 1, ack: 1 }, pay: { label: 'Data', len: 300 } },
            { s: 'rtr', d: 'web', proto: 'IP', app: 'tcpData', t: 0.004, info: '192.168.1.10 → 203.0.113.10 · TTL 63 (decremented)', ttl: 63, pay: { label: 'Data', len: 300 }, note: 'same source and destination IP — but a new Ethernet header' },
          ],
        },
        {
          title: 'Port — which program on that machine',
          sub: 'One IP can run a hundred services',
          focus: ['web', 'pc'],
          what: 'The TCP header adds two ports: your laptop chose 52344 and the server listens on 443. The pair (IP, port) identifies a conversation, which is how one server can serve thousands of clients at once.',
          why: 'Ports are how an operating system decides which application gets the data. Without them, the OS could not tell a web page from an SSH session.',
          analogy: 'An apartment block has one street address but many door numbers. The porter needs both.',
          terms: [
            { t: 'Port', d: 'A 16-bit number identifying a program on a host. 0–1023 are well-known services, 49152+ are ephemeral client ports.' },
            { t: 'Ephemeral port', d: 'A temporary port your OS picks for an outgoing connection so the reply has somewhere to land.' },
          ],
          packets: [
            { s: 'pc', d: 'web', proto: 'TCP', app: 'tcpData', t: 0.002, sport: 52344, dport: 443, info: '52344 → 443 [PSH, ACK] Seq=1 Len=300', tcp: { flags: 'PSH, ACK', seq: 1, ack: 1 }, pay: { label: 'Data', len: 300 } },
          ],
        },
        {
          title: 'All three, on one packet',
          sub: 'Read the layers top to bottom',
          focus: ['pc', 'sw', 'rtr', 'web'],
          what: 'Click this packet and expand Ethernet, IPv4 and TCP. Three nested labels, three different scopes: link, network, transport. The byte view shows them in exactly the order they travel down the wire.',
          why: 'Once you can point at a packet and say "this part is for the switch, this part is for the router, this part is for the app", the whole rest of networking becomes readable.',
          analogy: 'Nested envelopes: the outer one for the courier, the middle one for the building, the innermost for the person.',
          terms: [
            { t: 'Encapsulation', d: 'Each layer wraps the layer above it in its own header. Reading a packet is reading those wrappers.' },
            { t: 'Layer', d: 'A slice of networking with one job: link (Ethernet), network (IP), transport (TCP/UDP), application (HTTP/DNS).' },
          ],
          packets: [
            { s: 'pc', d: 'web', proto: 'TCP', app: 'tcpData', t: 0.003, sport: 52344, dport: 443, info: '52344 → 443 [PSH, ACK] Seq=1 Len=517 · full stack', tcp: { flags: 'PSH, ACK', seq: 1, ack: 1 }, pay: { label: 'Data', len: 517 } },
          ],
        },
      ],
      quiz: [
        {
          q: 'A packet leaves your laptop for a server on another continent. Which address is rewritten at every router?',
          opts: ['The destination IP', 'The destination MAC', 'Both', 'Neither'],
          a: 1,
          why: 'Each hop builds a new Ethernet frame addressed to the next router\'s MAC. The IP pair stays put from end to end (barring NAT).',
        },
        {
          q: 'Your laptop opens 52344 → 443. What does the 52344 identify?',
          opts: ['The web server', 'The laptop\'s network card', 'The browser\'s socket on your machine', 'The router\'s port'],
          a: 2,
          why: 'It is an ephemeral port chosen by your OS so the reply can be handed back to the exact socket that opened it.',
        },
      ],
    },

    {
      id: 'lan-wan',
      track: 'basics',
      title: 'Your LAN, your router, the internet',
      subtitle: 'Private addresses, one public door',
      scenario: 'home',
      level: 1,
      minutes: 4,
      goals: ['private vs public addresses', 'what a default gateway does', 'why NAT exists'],
      steps: [
        {
          title: 'Inside the house, everyone is 192.168.x.x',
          sub: 'Private addresses are yours to reuse',
          focus: ['pc', 'sw', 'rtr'],
          what: 'Your laptop is 192.168.1.10. That address is private: it appears in millions of homes at the same time and never travels across the internet. Your router is 192.168.1.1 — the default gateway, the only way out.',
          why: 'IPv4 ran out of addresses in 2011. Private ranges plus translation let billions of devices share the few billion public addresses that exist.',
          analogy: 'Flat numbers inside a building. "Flat 4" exists in every building; the postal service only needs the building\'s street address.',
          terms: [
            { t: 'Private address', d: 'Reserved ranges 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16. Routers on the internet will not forward them.' },
            { t: 'Default gateway', d: 'The router a host sends to when the destination is not on its own subnet.' },
          ],
          packets: [
            { s: 'pc', d: 'rtr', proto: 'IP', app: 'tcpData', t: 0.0, info: '192.168.1.10 → 203.0.113.10 · leaving the LAN', pay: { label: 'Request', len: 400 } },
          ],
        },
        {
          title: 'The router has two faces',
          sub: 'Private on the inside, public on the outside',
          focus: ['rtr'],
          what: 'Open the router: it has a LAN interface (192.168.1.1) and a WAN interface (203.0.113.75, given to it by your ISP). Every packet your home sends out leaves through that one public address.',
          why: 'The router is the boundary between two addressing worlds. This is the single most useful device to understand in any network.',
          analogy: 'A receptionist with an internal extension and one public phone number.',
          terms: [{ t: 'WAN', d: 'Wide area network — the link from your router out to the ISP.' }],
          packets: [
            { s: 'rtr', d: 'web', proto: 'IP', app: 'tcpData', t: 0.002, sip: '203.0.113.75', info: '203.0.113.75 → 203.0.113.10 · source rewritten', pay: { label: 'Request', len: 400 }, note: 'the private source address is gone — this is NAT' },
          ],
        },
        {
          title: 'One public IP, many conversations',
          sub: 'NAT keeps a table so replies find their way home',
          focus: ['rtr'],
          what: 'Because the router rewrites the source, it must remember that 203.0.113.75:52344 really means 192.168.1.10:52344. The port number is the trick that lets many devices share one address.',
          why: 'This translation table is why the reply from the internet arrives at the right laptop, and why unsolicited traffic from outside cannot reach a device inside.',
          analogy: 'A hotel switchboard: one public number, and the operator remembers which room asked for which call.',
          terms: [{ t: 'NAT', d: 'Network Address Translation. The router rewrites private source addresses and ports, tracking each mapping in a table.' }],
          card: {
            title: 'Router NAT table',
            cols: ['Inside', 'Outside', 'Remote'],
            rows: [
              ['192.168.1.10:52344', '203.0.113.75:52344', '203.0.113.10:443'],
              ['192.168.1.11:49211', '203.0.113.75:49212', '198.51.100.25:993'],
            ],
            note: 'Open the Router in the inspector and the same table is there, with a countdown for each mapping.',
          },
          packets: [
            { s: 'pc', d: 'web', proto: 'IP', app: 'tcpData', t: 0.001, info: '192.168.1.10:52344 → 203.0.113.10:443', sport: 52344, dport: 443, pay: { label: 'Request', len: 400 } },
          ],
        },
        {
          title: 'The reply comes home',
          sub: 'Destination rewritten on the way back',
          focus: ['rtr', 'pc'],
          what: 'The server answers 203.0.113.75:52344 — the only address it knows. Your router looks in its table, sees that port belongs to 192.168.1.10, rewrites the destination, and hands it to the switch.',
          why: 'Two translations, one round trip, and the two machines inside and outside have no idea the other addressing scheme exists.',
          analogy: 'The operator recognises the caller, and forwards the call to the right room.',
          terms: [],
          packets: [
            { s: 'web', d: 'rtr', proto: 'IP', app: 'tcpData', t: 0.030, sip: '203.0.113.10', dip: '203.0.113.75', info: '203.0.113.10 → 203.0.113.75:52344 · reply to the public address', sport: 443, dport: 52344, pay: { label: 'Response', len: 900 } },
            { s: 'rtr', d: 'pc', proto: 'IP', app: 'tcpData', t: 0.031, sip: '203.0.113.10', dip: '192.168.1.10', info: '203.0.113.10 → 192.168.1.10:52344 · destination rewritten', sport: 443, dport: 52344, pay: { label: 'Response', len: 900 }, note: 'the packet is home' },
          ],
        },
      ],
      quiz: [
        {
          q: 'Why can ten devices in your home share one public IP address?',
          opts: ['They take turns using it', 'The router rewrites addresses and tracks ports in a NAT table', 'They all have the same MAC address', 'DNS gives them each a public address'],
          a: 1,
          why: 'The NAT table maps each (private IP, port) pair to a public port, so replies can be matched back to the right device.',
        },
      ],
    },

    /* ================= TRACK 2 · GETTING ONLINE ================= */
    {
      id: 'dhcp',
      track: 'online',
      title: 'Getting an address: DHCP',
      subtitle: 'Four broadcasts before you can even speak',
      scenario: 'lan',
      level: 2,
      minutes: 5,
      goals: ['the DORA exchange', 'why it is broadcast', 'what a lease is'],
      steps: [
        {
          title: 'A machine with no address',
          sub: 'Wi-Fi connected, still useless',
          focus: ['pc'],
          what: 'Your laptop joins the network but has no IP, no subnet mask, no gateway and no DNS server. Without those four facts it can reach nothing — not even the router.',
          why: 'A computer can only send to addresses it can name. It knows its own MAC, so it starts from there.',
          analogy: 'You have moved into a new flat and have no idea what your address is, so you cannot even write a return address on an envelope.',
          terms: [{ t: 'DHCP', d: 'Dynamic Host Configuration Protocol. Hands a device its IP address, gateway and DNS servers automatically.' }],
          packets: [],
        },
        {
          title: 'DISCOVER — shouting into the dark',
          sub: 'From 0.0.0.0 to 255.255.255.255',
          focus: ['pc', 'sw', 'rtr'],
          what: 'The client broadcasts a DHCP DISCOVER: source 0.0.0.0:68, destination 255.255.255.255:67, Ethernet destination ff:ff:ff:ff:ff:ff. Every device on the LAN receives it; only a DHCP server answers.',
          why: 'It has no address to put in the source, so it uses all zeroes. It does not know where the server is, so it shouts to everyone.',
          analogy: 'Walking into a hotel lobby and calling out "is there a room for me?"',
          terms: [
            { t: 'Broadcast', d: 'A frame sent to ff:ff:ff:ff:ff:ff, delivered to every device on the local network.' },
            { t: 'BOOTP relay', d: 'A router can forward DHCP to a server on another subnet, which is how offices centralise it.' },
          ],
          packets: [
            { s: 'pc', d: 'rtr', proto: 'DHCP', app: 'dhcp', t: 0.0, sport: 68, dport: 67, dip: '255.255.255.255', info: 'DHCP Discover · 0.0.0.0 → 255.255.255.255', dhcp: { msgType: 1, clientId: 'a4:5e:60:1b:2c:3d', hostname: 'laptop' } },
          ],
        },
        {
          title: 'OFFER — "here is one you could have"',
          sub: 'The server proposes an address',
          focus: ['rtr', 'pc'],
          what: 'The router replies with a lease offer: 192.168.1.10, mask 255.255.255.0, gateway 192.168.1.1, DNS 8.8.8.8, valid for 24 hours. Nothing is committed yet.',
          why: 'The offer is a proposal. Several DHCP servers can offer at once, and the client picks one.',
          analogy: 'The receptionist says "I could give you room 10, is that all right?"',
          terms: [{ t: 'Lease', d: 'An address is rented, not owned. Before it expires the client renews it.' }],
          packets: [
            { s: 'rtr', d: 'pc', proto: 'DHCP', app: 'dhcp', t: 0.012, sport: 67, dport: 68, info: 'DHCP Offer · 192.168.1.10 lease 24h', dhcp: { op: 'reply', msgType: 2, clientId: 'a4:5e:60:1b:2c:3d', yiaddr: '192.168.1.10', siaddr: '192.168.1.1', serverId: '192.168.1.1', subnet: '255.255.255.0', router: '192.168.1.1', dns: '8.8.8.8', lease: 86400 } },
          ],
        },
        {
          title: 'REQUEST — "I will take that one"',
          sub: 'Still broadcast, so other servers stand down',
          focus: ['pc', 'sw', 'rtr'],
          what: 'The client broadcasts a REQUEST naming the address it accepted. The broadcast is deliberate: any other DHCP server that made an offer hears it and withdraws its own.',
          why: 'One broadcast resolves the question for everyone. Without it, a second server would keep a reservation open for nothing.',
          analogy: 'Announcing "I am taking room 10" in the lobby, so the other receptionists stop holding rooms for you.',
          terms: [],
          packets: [
            { s: 'pc', d: 'rtr', proto: 'DHCP', app: 'dhcp', t: 0.024, sport: 68, dport: 67, dip: '255.255.255.255', info: 'DHCP Request · requested-ip 192.168.1.10', dhcp: { msgType: 3, clientId: 'a4:5e:60:1b:2c:3d', requested: '192.168.1.10', serverId: '192.168.1.1' } },
          ],
        },
        {
          title: 'ACK — the address is yours',
          sub: 'And the last hop before the internet',
          focus: ['rtr', 'pc'],
          what: 'The server confirms with an ACK. Now the laptop has an address, can ARP for the router and can resolve names. Half its questions were answered by this one exchange.',
          why: 'Everything that follows — DNS, TCP, HTTPS — assumes these four facts exist. When "the internet is broken", DHCP is the first thing to check.',
          analogy: 'The key is handed over and the room is officially yours until checkout time.',
          terms: [],
          packets: [
            { s: 'rtr', d: 'pc', proto: 'DHCP', app: 'dhcp', t: 0.036, sport: 67, dport: 68, info: 'DHCP ACK · 192.168.1.10 leased 24h', dhcp: { op: 'reply', msgType: 5, clientId: 'a4:5e:60:1b:2c:3d', yiaddr: '192.168.1.10', siaddr: '192.168.1.1', serverId: '192.168.1.1', subnet: '255.255.255.0', router: '192.168.1.1', dns: '8.8.8.8', lease: 86400 } },
          ],
        },
      ],
      quiz: [
        {
          q: 'Why is the DHCP REQUEST broadcast rather than sent only to the chosen server?',
          opts: ['Because the client has no address yet', 'So every other DHCP server knows its offer was declined', 'Because broadcasts are faster', 'It is not broadcast, it is unicast'],
          a: 1,
          why: 'The client is telling all servers which offer it accepted, so the others release their reservations. (It is also still broadcast because the client cannot yet use the address.)',
        },
      ],
    },

    {
      id: 'arp',
      track: 'online',
      title: 'Finding the MAC: ARP',
      subtitle: 'The bridge between IP and Ethernet',
      scenario: 'lan',
      level: 2,
      minutes: 3,
      goals: ['why ARP is needed', 'why requests are broadcast', 'how the ARP cache works'],
      steps: [
        {
          title: 'I know the IP, not the hardware',
          sub: 'The frame needs a MAC before it can leave',
          focus: ['pc', 'rtr'],
          what: 'Your laptop decides the web server is reached through 192.168.1.1. But the Ethernet frame it is about to build needs the router\'s MAC address, and the ARP cache is empty.',
          why: 'IP is a logical address. The wire only understands hardware addresses. Something has to translate, and that something is ARP.',
          analogy: 'You know the company name and the street address, but the courier still needs the loading-bay number.',
          terms: [{ t: 'ARP', d: 'Address Resolution Protocol. Asks "who has this IP?" and learns the matching MAC address.' }],
          packets: [],
        },
        {
          title: 'The shout: "who has 192.168.1.1?"',
          sub: 'Broadcast, because you do not know who to ask',
          focus: ['pc', 'sw', 'rtr'],
          what: 'An ARP request is a tiny 28-byte protocol inside an Ethernet frame sent to ff:ff:ff:ff:ff:ff. Every device on the LAN reads it; only the owner of 192.168.1.1 replies.',
          why: 'It is conversational and stateless: no connection, no handshake, no authentication — which is also why ARP spoofing exists.',
          analogy: 'Announcing over a tannoy: "would the owner of this phone number please come to reception?"',
          terms: [{ t: 'ARP cache', d: 'A short-lived table of IP → MAC mappings, usually a few minutes old before it is refreshed.' }],
          packets: [
            { s: 'pc', d: 'rtr', proto: 'ARP', app: 'arp', t: 0.0, info: 'Who has 192.168.1.1? Tell 192.168.1.10', arp: { op: 1, senderMac: 'a4:5e:60:1b:2c:3d', senderIp: '192.168.1.10', targetIp: '192.168.1.1' } },
          ],
        },
        {
          title: 'The reply, sent directly back',
          sub: 'Unicast, because now the answerer knows where to send it',
          focus: ['rtr', 'pc'],
          what: 'The router answers with its MAC (b8:27:eb:4c:5d:6e). That reply is unicast — the request told it exactly who was asking.',
          why: 'One exchange and both sides can now fill their caches. The next frame goes straight out with the right destination MAC.',
          analogy: 'Reception calls your number directly: "this is the loading bay, here is the code".',
          terms: [],
          packets: [
            { s: 'rtr', d: 'pc', proto: 'ARP', app: 'arp', t: 0.001, info: '192.168.1.1 is at b8:27:eb:4c:5d:6e', arp: { op: 2, senderMac: 'b8:27:eb:4c:5d:6e', senderIp: '192.168.1.1', targetMac: 'a4:5e:60:1b:2c:3d', targetIp: '192.168.1.10' } },
          ],
        },
        {
          title: 'Cached for next time',
          sub: 'Now the real packet can go',
          focus: ['pc', 'rtr'],
          what: 'The mapping is stored for a few minutes. Your laptop can now wrap the IP packet in a frame addressed to the router, and the journey continues. Open the laptop\'s ARP tab to see the entry.',
          why: 'ARP runs constantly but invisibly. When you see "no route to host" or duplicate address warnings on a LAN, this is the layer to inspect.',
          analogy: 'You wrote the loading-bay number in your contacts so you do not have to call reception again.',
          terms: [{ t: 'Gratuitous ARP', d: 'An unsolicited ARP announcement, used to detect duplicate addresses or to update caches after a change.' }],
          packets: [
            { s: 'pc', d: 'rtr', proto: 'IP', app: 'tcpData', t: 0.002, info: '192.168.1.10 → 203.0.113.10 · destination MAC now resolved', pay: { label: 'Request', len: 400 } },
          ],
        },
      ],
      quiz: [
        {
          q: 'An ARP request is addressed to which Ethernet destination?',
          opts: ['The router\'s MAC', 'ff:ff:ff:ff:ff:ff (broadcast)', 'The DNS server\'s MAC', '00:00:00:00:00:00'],
          a: 1,
          why: 'The sender does not know the target MAC — that is the whole problem — so it broadcasts and hopes the right device answers.',
        },
      ],
    },

    {
      id: 'dns',
      track: 'online',
      title: 'DNS: the internet\'s phone book',
      subtitle: 'A name is not an address',
      scenario: 'home',
      level: 2,
      minutes: 6,
      goals: ['recursive vs iterative queries', 'the root → TLD → authoritative walk', 'what caching and TTL do'],
      steps: [
        {
          title: 'A name is not an address',
          sub: 'www.example.com means nothing to a router',
          focus: ['pc', 'dns'],
          what: 'Routers forward packets by IP address. Your browser has a name, so before any web traffic can leave, something has to turn www.example.com into 203.0.113.10. That is DNS, riding on UDP port 53.',
          why: 'Names are for humans and for stable branding; addresses are for machines. DNS is the mapping, and it is the most heavily used protocol on the internet.',
          analogy: 'You keep names in your contacts app, but the phone network only dials numbers.',
          terms: [
            { t: 'DNS', d: 'Domain Name System. A distributed, hierarchical database mapping names to addresses and much more.' },
            { t: 'Recursive resolver', d: 'The server you ask (often your ISP or 8.8.8.8) that does all the chasing on your behalf.' },
          ],
          packets: [],
        },
        {
          title: 'Ask the resolver',
          sub: 'One UDP packet, one question',
          focus: ['pc', 'rtr', 'dns'],
          what: 'The laptop sends a standard query for an A record. Inside the packet: a query ID, the name split into length-prefixed labels, and the record type. No handshake — UDP just fires it off.',
          why: 'A query is small and the answer is urgent. UDP\'s lack of handshake saves a round trip, and a lost query is simply re-sent by the resolver logic.',
          analogy: 'Posting a postcard: no delivery confirmation, but it is cheap and fast.',
          terms: [
            { t: 'A record', d: 'Maps a name to an IPv4 address. AAAA is the IPv6 equivalent, MX is for mail servers, CNAME is an alias.' },
            { t: 'Recursion desired', d: 'The RD flag asking the resolver to do the full lookup rather than just point at another server.' },
          ],
          packets: [
            { s: 'pc', d: 'dns', proto: 'DNS', app: 'dnsq', t: 0.0, sport: 51000, dport: 53, info: 'Standard query 0x1a2b A www.example.com', dns: { name: 'www.example.com', qtype: 'A', id: 0x1a2b } },
          ],
        },
        {
          title: 'The resolver has to start at the root',
          sub: '"Ask .com" — it does not know the answer either',
          focus: ['dns', 'root'],
          what: 'The resolver asks a root server. The root does not know example.com, but it knows who runs .com, so it returns a referral: go ask 192.5.6.30.',
          why: 'No single machine holds the whole internet. The tree is split by domain level, and each level knows only the next one down.',
          analogy: 'You ask a librarian, who says "not my shelf — the .com section, aisle 5".',
          terms: [{ t: 'Root server', d: 'The top of the DNS tree. 13 identities, hundreds of anycast instances, reachable at well-known addresses such as 198.41.0.4.' }],
          packets: [
            { s: 'dns', d: 'root', proto: 'DNS', app: 'dnsq', t: 0.008, sport: 33011, dport: 53, info: 'Standard query A www.example.com', dns: { name: 'www.example.com', qtype: 'A', id: 0x77c1 } },
            { s: 'root', d: 'dns', proto: 'DNS', app: 'dnsr', t: 0.019, sport: 53, dport: 33011, info: 'Response: referral to .com NS 192.5.6.30', dns: { name: 'com', qtype: 'A', id: 0x77c1, answers: [{ type: 'A', ttl: 172800, rdata: '192.5.6.30' }] }, note: 'a referral, not the answer: "the .com servers are over there"' },
          ],
        },
        {
          title: 'The TLD points further down',
          sub: '.com knows who is authoritative for example.com',
          focus: ['dns', 'tld'],
          what: 'Asking the .com servers gets another referral — the nameservers of example.com, at 198.51.100.53. Two hops down the tree and still no answer.',
          why: 'Each level delegates. That is what makes DNS scale: 1,500 TLD servers can keep track of billions of domains because they only store pointers.',
          analogy: 'Aisle 5 gives you the exact shelf, and the shelf label points at the right book.',
          terms: [{ t: 'Delegation', d: 'Handing control of a subdomain to another set of nameservers, recorded as NS records.' }],
          packets: [
            { s: 'dns', d: 'tld', proto: 'DNS', app: 'dnsq', t: 0.024, sport: 33012, dport: 53, info: 'Standard query A www.example.com', dns: { name: 'www.example.com', qtype: 'A', id: 0x77c2 } },
            { s: 'tld', d: 'dns', proto: 'DNS', app: 'dnsr', t: 0.035, sport: 53, dport: 33012, info: 'Response: NS a.iana-servers.net 198.51.100.53', dns: { name: 'example.com', qtype: 'A', id: 0x77c2, answers: [{ type: 'A', ttl: 172800, rdata: '198.51.100.53' }] } },
          ],
        },
        {
          title: 'The authoritative answer',
          sub: 'This server owns the zone file',
          focus: ['dns', 'auth'],
          what: 'The authoritative server for example.com returns the actual A record: 203.0.113.10, TTL 300 seconds. This answer is the truth — it is not cached hearsay.',
          why: 'Authoritative servers are the source of record. Everything above them is delegation; everything below you is caching.',
          analogy: 'Finally the actual book, not a shelf label.',
          terms: [{ t: 'TTL', d: 'Time To Live on a DNS record: how long resolvers may cache it. Short TTLs allow fast changes, long ones reduce load.' }],
          packets: [
            { s: 'dns', d: 'auth', proto: 'DNS', app: 'dnsq', t: 0.041, sport: 33013, dport: 53, info: 'Standard query A www.example.com', dns: { name: 'www.example.com', qtype: 'A', id: 0x77c3 } },
            { s: 'auth', d: 'dns', proto: 'DNS', app: 'dnsr', t: 0.052, sport: 53, dport: 33013, info: 'Response: A 203.0.113.10 · TTL 300', dns: { name: 'www.example.com', qtype: 'A', id: 0x77c3, answers: [{ type: 'A', ttl: 300, rdata: '203.0.113.10' }] } },
          ],
        },
        {
          title: 'Cached on the way back',
          sub: 'The second visit takes 0 ms',
          focus: ['pc', 'dns'],
          what: 'The resolver caches the answer for 300 seconds and sends it to you. Ask again in a minute and the answer comes from cache — no root, no TLD, no authoritative server involved.',
          why: 'Caching is why DNS feels instant. It is also why a changed record can take a while to be seen everywhere, and why "propagation" is really just cache expiry.',
          analogy: 'The librarian writes the shelf location on a sticky note so the next visitor does not have to ask three people.',
          terms: [
            { t: 'Propagation', d: 'The popular name for old answers sitting in caches until their TTL runs out.' },
            { t: 'Negative caching', d: 'Even "this name does not exist" gets cached, briefly, so typos are cheap.' },
          ],
          packets: [
            { s: 'dns', d: 'pc', proto: 'DNS', app: 'dnsr', t: 0.053, sport: 53, dport: 51000, info: 'Standard query response A 203.0.113.10 · TTL 300', dns: { name: 'www.example.com', qtype: 'A', id: 0x1a2b, answers: [{ type: 'A', ttl: 300, rdata: '203.0.113.10' }] } },
          ],
        },
      ],
      quiz: [
        {
          q: 'Who gives the final, authoritative answer for www.example.com?',
          opts: ['The root server', 'The .com TLD server', 'The resolver\'s cache', 'The authoritative nameserver for example.com'],
          a: 3,
          why: 'Root and TLD servers only delegate. The authoritative server holds the zone file and returns the real A record.',
        },
        {
          q: 'Which one is your laptop actually talking to?',
          opts: ['Each server in turn', 'Only the recursive resolver', 'Only the root server', 'The authoritative server directly'],
          a: 1,
          why: 'Your laptop makes one recursive query. The resolver does the iterative walking on your behalf.',
        },
      ],
    },

    {
      id: 'tcp-handshake',
      track: 'online',
      title: 'The three-way handshake',
      subtitle: 'Agreeing before you speak',
      scenario: 'home',
      level: 2,
      minutes: 5,
      goals: ['SYN, SYN-ACK, ACK', 'why three packets and not two', 'what gets negotiated'],
      steps: [
        {
          title: 'Why bother?',
          sub: 'TCP promises a reliable, ordered stream',
          focus: ['pc', 'web'],
          what: 'You now have an IP address for the server. TCP turns unreliable packets into a reliable byte stream: it numbers bytes, acknowledges them, retransmits losses and respects the receiver\'s buffer. But first, both sides must agree to talk.',
          why: 'Everything above TCP — HTTP, TLS, SSH — relies on that promise. It costs one round trip at the start and repays it millions of times over.',
          analogy: 'A phone call that starts with "can you hear me?" / "yes, can you hear me?" / "yes" before anyone says anything useful.',
          terms: [
            { t: 'TCP', d: 'A connection-oriented transport protocol: ordered, reliable, flow-controlled bytes.' },
            { t: 'Socket', d: 'The pairing of an IP address and a port, identifying one end of a connection.' },
          ],
          packets: [],
        },
        {
          title: 'SYN — "I would like to open"',
          sub: 'And here is what I can do',
          focus: ['pc', 'web'],
          what: 'The client sends SYN with a random initial sequence number (1000 here) plus options: maximum segment size 1460, window scale 8, SACK permitted, timestamps. These are the terms of the conversation.',
          why: 'A random ISN makes off-path injection of believable packets much harder. The options are negotiated once, here, and apply to every packet afterwards.',
          analogy: 'Opening a negotiation with your number and your terms on the table.',
          terms: [
            { t: 'SYN', d: 'Synchronise. The opening flag; carries the initial sequence number.' },
            { t: 'MSS', d: 'Maximum Segment Size — the largest payload the sender wants to receive in one segment.' },
          ],
          packets: [
            { s: 'pc', d: 'web', proto: 'TCP', app: 'tcpData', t: 0.0, sport: 52344, dport: 443, info: '52344 → 443 [SYN] Seq=0 Win=64240 Len=0', tcp: { flags: 'SYN', seq: 0, ack: 0, window: 64240 }, note: 'options: MSS=1460, SACK permitted, Timestamps, NOP, WS=8' },
          ],
        },
        {
          title: 'SYN-ACK — "yes, and here are mine"',
          sub: 'Two flags in one packet',
          focus: ['web', 'pc'],
          what: 'The server replies SYN-ACK: it acknowledges the client\'s SYN (Ack=1, meaning "I have your byte 0, next I expect 1") and offers its own sequence number 5000 with its own options.',
          why: 'Both directions are initialised in a single packet. That efficiency is exactly why the handshake is three ways, not four.',
          analogy: '"I hear you, and here is my number too."',
          terms: [{ t: 'SYN-ACK', d: 'One packet carrying both an acknowledgement and a new SYN.' }],
          packets: [
            { s: 'web', d: 'pc', proto: 'TCP', app: 'tcpData', t: 0.012, sport: 443, dport: 52344, info: '443 → 52344 [SYN, ACK] Seq=0 Ack=1 Win=65160 Len=0', tcp: { flags: 'SYN, ACK', seq: 0, ack: 1, window: 65160 } },
          ],
        },
        {
          title: 'ACK — "then we are agreed"',
          sub: 'State becomes ESTABLISHED',
          focus: ['pc', 'web'],
          what: 'The client acknowledges the server\'s SYN. Both sides are now ESTABLISHED and data can flow. From here on, every packet carries ACK.',
          why: 'Each side has proved it can send and receive on this path. One round trip, three packets, and a reliable stream exists.',
          analogy: 'Both parties have confirmed the line is good. Start talking.',
          terms: [{ t: 'ESTABLISHED', d: 'The TCP state where data may be exchanged. You can watch states change in the device inspector.' }],
          packets: [
            { s: 'pc', d: 'web', proto: 'TCP', app: 'tcpData', t: 0.024, sport: 52344, dport: 443, info: '52344 → 443 [ACK] Seq=1 Ack=1 Win=131328 Len=0', tcp: { flags: 'ACK', seq: 1, ack: 1, window: 131328 } },
          ],
        },
        {
          title: 'What the numbers actually mean',
          sub: 'Counters of bytes, not of packets',
          focus: ['pc', 'web'],
          what: 'Sequence and acknowledgement numbers count bytes. That is why the ACK after a 1,460-byte segment is 1462 and not 2. Click any packet and look at the TCP layer to see how seq and ack move together.',
          why: 'Because they count bytes, TCP can say precisely "I have everything up to byte N", which is what makes loss detection and retransmission possible.',
          analogy: 'A page number, not a sentence number — you always know exactly how much you have read.',
          terms: [{ t: 'Relative sequence', d: 'Wireshark shows seq/ack relative to the ISN so you read small numbers instead of billions.' }],
          packets: [
            { s: 'pc', d: 'web', proto: 'TCP', app: 'tcpData', t: 0.025, sport: 52344, dport: 443, info: '52344 → 443 [PSH, ACK] Seq=1 Ack=1 Len=517', tcp: { flags: 'PSH, ACK', seq: 1, ack: 1 }, pay: { label: 'ClientHello', len: 517 }, note: 'relative Seq 1 — the first data byte after the SYN' },
            { s: 'web', d: 'pc', proto: 'TCP', app: 'tcpData', t: 0.038, sport: 443, dport: 52344, info: '443 → 52344 [ACK] Seq=1 Ack=518 Len=0', tcp: { flags: 'ACK', seq: 1, ack: 518, window: 131328 }, note: '518 = 1 + 517 bytes received' },
          ],
        },
      ],
      quiz: [
        {
          q: 'Why does the handshake need three packets instead of two?',
          opts: ['To exchange encryption keys', 'Each side must have its own SYN acknowledged, and the server\'s SYN-ACK does both jobs in one packet', 'To choose a port number', 'To measure the latency'],
          a: 1,
          why: 'SYN opens the client direction, SYN-ACK acknowledges it while opening the server direction, and the final ACK confirms that. Two directions, three packets.',
        },
      ],
    },

    {
      id: 'http',
      track: 'online',
      title: 'HTTP: request, response, render',
      subtitle: 'What actually happens when you press Enter',
      scenario: 'home',
      level: 2,
      minutes: 5,
      goals: ['read a request and a response', 'status codes and headers', 'how a page becomes pixels'],
      steps: [
        {
          title: 'The request',
          sub: 'Plain readable text over TCP',
          focus: ['pc', 'web'],
          what: 'A GET request is text: a request line (GET / HTTP/1.1), a Host header, a User-Agent, what content types are acceptable, and a blank line. In HTTP/1.1 it is not encrypted, so you can read every byte in the hex view.',
          why: 'HTTP/1.1 is deliberately human-readable, which made the web debuggable and easy to build. HTTP/2 and HTTP/3 keep the same semantics but are binary on the wire.',
          analogy: 'A postcard with the instruction written in plain language on the back.',
          terms: [
            { t: 'HTTP', d: 'Hypertext Transfer Protocol. The request/response protocol of the web, defined in RFC 9110 and 9112.' },
            { t: 'Header', d: 'A name: value line in an HTTP message carrying metadata — host, content type, caching, cookies.' },
          ],
          packets: [
            { s: 'pc', d: 'web', proto: 'HTTP', app: 'httpReq', t: 0.0, sport: 52344, dport: 80, info: 'GET / HTTP/1.1 · Host: www.example.com', http: { method: 'GET', path: '/', host: 'www.example.com' } },
          ],
        },
        {
          title: 'The response',
          sub: 'A status code and a set of promises',
          focus: ['web', 'pc'],
          what: '200 OK, plus Content-Type: text/html, Content-Length, Cache-Control: max-age=3600 and an ETag. The headers tell the browser how to interpret the body and whether it may reuse it later.',
          why: 'The status code is a single number that summarises the outcome — which is why monitoring tools, proxies and caches can all reason about a response without reading it.',
          analogy: 'A delivery note: what is inside, how much of it, and how long it stays fresh.',
          terms: [
            { t: 'Status code', d: '2xx success, 3xx redirect, 4xx client error, 5xx server error.' },
            { t: 'Content-Length', d: 'How many bytes the body has, so the receiver knows where the message ends.' },
          ],
          packets: [
            { s: 'web', d: 'pc', proto: 'HTTP', app: 'httpRes', t: 0.018, sport: 80, dport: 52344, info: 'HTTP/1.1 200 OK (text/html)', http: { status: '200 OK' } },
          ],
        },
        {
          title: 'The body, in pieces',
          sub: 'One response, several packets',
          focus: ['web', 'pc'],
          what: 'The HTML body arrives as a sequence of segments. Note they are TCP packets whose payload happens to be HTML — the network never has to know what is in them.',
          why: 'This is encapsulation in practice: the same frame structure carries a web page, a video or a database query.',
          analogy: 'The parcel arrives in several boxes; only the recipient opens them.',
          terms: [],
          packets: [
            { s: 'web', d: 'pc', proto: 'TCP', app: 'tcpData', t: 0.020, port: 80, info: '80 → 52344 [PSH, ACK] Seq=584 Len=1460 · HTML body 1/2', tcp: { flags: 'PSH, ACK', seq: 584, ack: 518 }, pay: { label: 'HTML body 1/2', len: 1460 } },
            { s: 'web', d: 'pc', proto: 'TCP', app: 'tcpData', t: 0.021, info: '80 → 52344 [PSH, ACK] Seq=2044 Len=812 · HTML body 2/2', tcp: { flags: 'PSH, ACK', seq: 2044, ack: 518 }, pay: { label: 'HTML body 2/2', len: 812 } },
            { s: 'pc', d: 'web', proto: 'TCP', app: 'tcpData', t: 0.022, info: '52344 → 80 [ACK] Ack=2856 · everything received', tcp: { flags: 'ACK', seq: 518, ack: 2856 } },
          ],
        },
        {
          title: 'From bytes to pixels',
          sub: 'The browser starts work immediately',
          focus: ['pc'],
          what: 'The browser parses HTML into a DOM, discovers CSS, images and scripts, and issues more requests — often over the same kept-alive connection, or over HTTP/2 and HTTP/3 for the HTTPS origin.',
          why: 'A single page is typically dozens to hundreds of requests. That is why latency and connection reuse matter so much more than bandwidth for perceived speed.',
          analogy: 'Reading a recipe that tells you to go and fetch three more ingredients.',
          terms: [
            { t: 'DOM', d: 'The in-memory tree the browser builds from HTML; CSS and scripts act on it.' },
            { t: 'Keep-alive', d: 'Reusing one TCP connection for many requests instead of reconnecting for each.' },
          ],
          packets: [
            { s: 'pc', d: 'web', proto: 'HTTP', app: 'httpReq', t: 0.026, info: 'GET /assets/app.css HTTP/1.1 · same connection', http: { method: 'GET', path: '/assets/app.css', host: 'www.example.com' } },
          ],
        },
        {
          title: 'Closing politely',
          sub: 'FIN, FIN-ACK, and a lingering state',
          focus: ['pc', 'web'],
          what: 'When done, the client sends FIN. The server acknowledges and sends its own FIN; the client ACKs and waits briefly in TIME_WAIT so any stray packets cannot confuse a future connection on the same ports.',
          why: 'A clean close prevents half-open connections from leaking memory on either side.',
          analogy: 'Saying goodbye properly rather than hanging up mid-sentence.',
          terms: [{ t: 'TIME_WAIT', d: 'A short waiting state after closing, so duplicate packets from the old connection expire.' }],
          packets: [
            { s: 'pc', d: 'web', proto: 'TCP', app: 'tcpData', t: 0.4, info: '52344 → 80 [FIN, ACK] Seq=518 Ack=2856', tcp: { flags: 'FIN, ACK', seq: 518, ack: 2856 } },
            { s: 'web', d: 'pc', proto: 'TCP', app: 'tcpData', t: 0.412, info: '80 → 52344 [FIN, ACK] Seq=2856 Ack=519', tcp: { flags: 'FIN, ACK', seq: 2856, ack: 519 } },
          ],
        },
      ],
      quiz: [
        {
          q: 'You see "HTTP/1.1 404 Not Found". Who is reporting the problem?',
          opts: ['The network', 'The server — it understood the request but has no such resource', 'Your router', 'DNS'],
          a: 1,
          why: '4xx means the request was fine but the client asked for something that does not exist. The connection and DNS both worked.',
        },
      ],
    },

    {
      id: 'nat',
      track: 'online',
      title: 'NAT in detail',
      subtitle: 'How one address serves a whole house',
      scenario: 'home',
      level: 2,
      minutes: 4,
      goals: ['the translation table', 'source NAT vs port forwarding', 'why inbound connections are hard'],
      steps: [
        {
          title: 'Outbound: rewrite the source',
          sub: 'Private address disappears',
          focus: ['pc', 'rtr'],
          what: 'Your packet leaves with source 192.168.1.10:52344. The router replaces it with 203.0.113.75:52344 and records the mapping. The server sees only the router.',
          why: 'The public address is not yours — it belongs to the router and, above it, to the ISP. Rewriting is the only way to share it.',
          analogy: 'All letters leaving an office go out with the company stamp, and the mailroom logs who sent what.',
          terms: [{ t: 'PAT / masquerade', d: 'Port Address Translation — many private hosts multiplexed onto one public address by port.' }],
          packets: [
            { s: 'pc', d: 'web', proto: 'IP', app: 'tcpData', t: 0.0, info: '192.168.1.10:52344 → 203.0.113.10:443', sport: 52344, dport: 443, pay: { label: 'ClientHello', len: 517 } },
            { s: 'rtr', d: 'web', proto: 'IP', app: 'tcpData', t: 0.001, sip: '203.0.113.75', info: '203.0.113.75:52344 → 203.0.113.10:443 · translated', sport: 52344, dport: 443, pay: { label: 'ClientHello', len: 517 } },
          ],
        },
        {
          title: 'The table does the remembering',
          sub: 'Five-tuple in, five-tuple out',
          focus: ['rtr'],
          what: 'The router keys the mapping on protocol, inside address, inside port and the remote address and port. That is why two laptops can use the same port number without colliding.',
          why: 'A NAT table is stateful. Reboot the router and every open connection dies, because the memory of who is who is gone.',
          analogy: 'A receptionist who remembers not just the call but which caller and which room.',
          terms: [{ t: 'Five-tuple', d: 'Protocol, source IP, source port, destination IP, destination port — the identity of a connection.' }],
          card: {
            title: 'NAT table on 203.0.113.75',
            cols: ['Proto', 'Inside', 'Outside', 'Remote', 'State', 'Expires'],
            rows: [
              ['TCP', '192.168.1.10:52344', '203.0.113.75:52344', '203.0.113.10:443', 'ESTABLISHED', '1h 59m'],
              ['TCP', '192.168.1.11:49211', '203.0.113.75:49212', '198.51.100.25:993', 'ESTABLISHED', '1h 41m'],
              ['UDP', '192.168.1.10:51000', '203.0.113.75:51000', '8.8.8.8:53', '—', '28s'],
            ],
            note: 'UDP mappings are short-lived because UDP has no connection to close. Open the Router device to see the same table.',
          },
          packets: [],
        },
        {
          title: 'Inbound: the problem NAT creates',
          sub: 'Unsolicited traffic has nowhere to go',
          focus: ['rtr', 'web'],
          what: 'A packet from the internet addressed to 203.0.113.75:8080 arrives. There is no mapping for it, and the router has no idea which device should get it — so it is dropped. That is a firewall by accident.',
          why: 'NAT accidentally provides security, but it also breaks peer-to-peer, VoIP and self-hosting unless you add a port forward or use hole punching.',
          analogy: 'Someone calls the office switchboard asking for a room number they were never given. The operator hangs up.',
          terms: [
            { t: 'Port forwarding', d: 'A static NAT rule: "anything arriving on public port 8080 goes to 192.168.1.20:80".' },
            { t: 'Hole punching', d: 'Both peers send outward at the same time so each NAT creates a mapping the other can use.' },
          ],
          packets: [
            { s: 'web', d: 'rtr', proto: 'TCP', app: 'tcpData', t: 5.0, dip: '203.0.113.75', dport: 8080, info: '203.0.113.10:41022 → 203.0.113.75:8080 [SYN] · no mapping, dropped', tcp: { flags: 'SYN', seq: 0 }, dropped: true, note: 'the router silently drops it — nothing is listening and no rule points anywhere' },
          ],
        },
        {
          title: 'And the reply finds its way home',
          sub: 'Reverse translation',
          focus: ['rtr', 'pc'],
          what: 'When the answer comes back to 203.0.113.75:52344, the router looks up the port, finds 192.168.1.10, rewrites the destination and forwards it on the LAN.',
          why: 'The same table entry serves both directions. One mechanism, two translations, millions of homes.',
          analogy: 'The switchboard recognises the returning call and routes it back to the room that placed it.',
          terms: [],
          packets: [
            { s: 'web', d: 'rtr', proto: 'IP', app: 'tcpData', t: 0.03, sip: '203.0.113.10', dip: '203.0.113.75', sport: 443, dport: 52344, info: '203.0.113.10:443 → 203.0.113.75:52344', pay: { label: 'ServerHello', len: 1400 } },
            { s: 'rtr', d: 'pc', proto: 'IP', app: 'tcpData', t: 0.031, sip: '203.0.113.10', dip: '192.168.1.10', sport: 443, dport: 52344, info: '203.0.113.10:443 → 192.168.1.10:52344 · reverse translation', pay: { label: 'ServerHello', len: 1400 } },
          ],
        },
      ],
      quiz: [
        {
          q: 'Why does an unsolicited connection from the internet usually fail to reach your laptop?',
          opts: ['The laptop firewall blocks it', 'There is no NAT table entry, so the router has no idea which inside host should receive it', 'DNS cannot resolve it', 'The port is always 0'],
          a: 1,
          why: 'NAT only forwards traffic that matches an existing outbound mapping. Inbound needs an explicit port-forward rule.',
        },
      ],
    },
  ];

  root.PE_LESSONS_BASICS = LESSONS;
})(typeof window !== 'undefined' ? window : globalThis);
