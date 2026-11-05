/* ============================================================
   lessons-ops.js — Track 8 · Cloud, containers & operations
   Kubernetes networking, VPC, netfilter, service mesh, QoS, WebRTC.
   ============================================================ */
(function (root) {
  'use strict';

  const SA = { t: 'Computer Networks: A Systems Approach (free)', u: 'https://book.systemsapproach.org/', note: 'Peterson & Davie' };
  const SDN = { t: 'Software-Defined Networks: A Systems Approach (free)', u: 'https://github.com/SystemsApproach/sdn', note: 'control planes and overlays' };
  const SEC = { t: 'Network Security: A Systems Approach (free)', u: 'https://github.com/SystemsApproach/security', note: 'firewalls and middleboxes' };
  const HPBN = { t: 'High Performance Browser Networking (free)', u: 'https://hpbn.co/', note: 'Grigorik' };

  const LESSONS = [

    {
      id: 'k8s',
      track: 'ops',
      title: 'Kubernetes networking',
      subtitle: 'Pod IPs, virtual services and where the packets really go',
      scenario: 'k8s',
      level: 5,
      minutes: 7,
      goals: ['veth pairs and namespaces', 'what a ClusterIP actually is', 'CNI overlays and encapsulation'],
      refs: [{ t: 'Kubernetes networking model (docs)', u: 'https://kubernetes.io/docs/concepts/services-networking/', note: 'the contract' }, SDN, SA],
      steps: [
        {
          title: 'Every pod believes it has a real network',
          sub: 'A netns, a veth pair, and a bridge',
          focus: ['pod1', 'svc'],
          what: 'A pod is a network namespace with its own interfaces, routes and ARP table. A veth pair connects it to the node: one end inside the namespace, the other a port on the node bridge. The pod sees a normal eth0 with an IP and a default route — it has no idea it is virtualised.',
          why: 'The Kubernetes model states three rules: every pod gets its own IP, every pod can reach every other pod without NAT, and nodes can reach pods. Implementations may disagree on how, but applications rely only on those rules.',
          analogy: 'Every office in a building has its own phone number and its own extension dialling; the internal wiring is somebody else\'s problem.',
          terms: [
            { t: 'Network namespace', d: 'An isolated set of interfaces, routes and sockets; what makes a container "look like" a machine.' },
            { t: 'veth pair', d: 'Two virtual interfaces permanently linked; a packet in one comes out the other. Used to wire a namespace to its host.' },
            { t: 'CNI', d: 'Container Network Interface: the plugin contract that creates and configures pod networking.' },
          ],
          packets: [
            { s: 'ing', d: 'pod1', proto: 'TCP', app: 'tcpData', t: 0.0, sip: '10.0.0.11', dip: '10.244.1.7', sport: 40211, dport: 8080, info: 'Request to the pod IP · 10.244.1.7 is a veth inside a namespace', tcp: { flags: 'PSH, ACK', seq: 1 }, pay: { label: 'HTTP request', len: 400 } },
          ],
        },
        {
          title: 'The service address nobody owns',
          sub: 'ClusterIP is an iptables rule',
          focus: ['svc', 'ing', 'pod1'],
          what: 'A Service gets a stable virtual IP from the service CIDR, say 10.96.0.42. No interface holds that address. kube-proxy installs DNAT rules so that a connection to 10.96.0.42:80 is rewritten to one healthy pod IP:8080 — chosen at random from the Endpoints list.',
          why: 'Pods are ephemeral; their IPs churn. The Service is the stable name and the stable address, and the data plane (iptables, IPVS or eBPF) maps it onto wherever the pods happen to be. That indirection is the entire point.',
          analogy: 'One switchboard number that always reaches the right department, no matter which staff member is on shift.',
          terms: [
            { t: 'ClusterIP', d: 'A virtual IP inside the cluster; reachable from pods, never from outside.' },
            { t: 'kube-proxy', d: 'The component that programs DNAT rules for services — iptables, IPVS, or replaced entirely by eBPF (Cilium).' },
            { t: 'Endpoints', d: 'The live list of pod IPs behind a service, maintained by watching readiness.' },
          ],
          packets: [
            { s: 'ing', d: 'svc', proto: 'TCP', app: 'tcpData', t: 0.0, sip: '10.0.0.11', dip: '10.96.0.42', sport: 40211, dport: 80, info: 'SYN to the ClusterIP 10.96.0.42 — no host owns this address', tcp: { flags: 'SYN', seq: 0 } },
            { s: 'svc', d: 'pod1', proto: 'TCP', app: 'tcpData', t: 0.001, sip: '10.0.0.11', dip: '10.244.1.7', sport: 40211, dport: 8080, info: 'DNAT rewrite: destination now a pod IP, port 80 → 8080', tcp: { flags: 'SYN', seq: 0 }, note: 'the client still believes it is talking to 10.96.0.42' },
          ],
        },
        {
          title: 'Crossing nodes: encapsulation',
          sub: 'VXLAN, Geneve or plain routing',
          focus: ['pod1', 'pod2'],
          what: 'If the destination pod is on another node, the packet must cross the physical network. Overlay CNIs wrap the whole packet in a VXLAN or Geneve header addressed to the destination node, send it, then unwrap it and deliver to the pod veth. Non-overlay CNIs instead advertise pod routes over BGP and keep the packets whole.',
          why: 'Encapsulation costs about 50 bytes of overhead per packet, which is why CNI MTU is usually 1,450 or less, and why path MTU problems appear first in clusters. Routing-based CNIs avoid the overhead but demand control of the underlying network.',
          analogy: 'Posting a sealed envelope inside another envelope addressed to the destination building.',
          terms: [
            { t: 'VXLAN', d: 'A UDP tunnel (port 4789) that carries Ethernet frames across an IP network with a 24-bit VNI for tenant separation.' },
            { t: 'Overlay MTU', d: 'Underlay MTU minus encapsulation overhead. Getting this wrong causes "small requests work, big ones hang".' },
            { t: 'BGP-based CNI', d: 'A plugin (e.g. Calico) that routes pod IPs natively by advertising them, avoiding encapsulation.' },
          ],
          packets: [
            { s: 'pod1', d: 'pod2', proto: 'IP', app: 'tcpData', t: 0.0, sip: '10.244.1.7', dip: '10.244.2.9', sport: 8080, dport: 51234, info: 'Inner packet: pod → pod on another node', tcp: { flags: 'PSH, ACK', seq: 1 }, pay: { label: 'HTTP response', len: 900 } },
            { s: 'pod1', d: 'ing', proto: 'UDP', app: 'udpData', t: 0.001, sip: '10.0.0.11', dip: '10.0.0.21', sport: 40211, dport: 4789, info: 'Outer packet: VXLAN to the destination node, original frame inside', pay: { label: 'VXLAN frame', len: 1450 }, note: '50 bytes of overhead — hence the smaller cluster MTU' },
          ],
        },
        {
          title: 'Cluster DNS breaks in four predictable ways',
          sub: 'ndots, search domains, latency and CoreDNS',
          focus: ['coredns', 'pod1'],
          what: 'Pods query CoreDNS through another virtual IP (usually 10.96.0.10). Because resolv.conf has ndots:5 and a list of search domains, a lookup for an external name is attempted as several suffix variations first — multiplying query volume. CoreDNS latency or a wrong upstream then looks like "the app is slow to start".',
          why: 'This is the most common "my cluster is broken" ticket, and it has nothing to do with the application. If you can resolve names from one pod and not another, look at resolv.conf and CoreDNS before anything else.',
          analogy: 'A directory assistant who checks five possible surnames before asking the actual national directory.',
          terms: [
            { t: 'ndots', d: 'How many dots a name must contain before it is tried as absolute first. ndots:5 means almost every external name is prefixed first.' },
            { t: 'Search domain', d: 'Suffixes appended during lookup: <ns>.svc.cluster.local, svc.cluster.local, cluster.local.' },
            { t: 'NodeLocal DNSCache', d: 'A per-node DNS cache that removes one hop and a conntrack entry per query.' },
          ],
          packets: [
            { s: 'pod1', d: 'coredns', proto: 'DNS', app: 'dnsq', t: 0.0, sip: '10.244.1.7', dip: '10.96.0.10', sport: 51234, dport: 53, info: 'query api.example.com.prod.svc.cluster.local · attempt 1 of 5', dns: { name: 'api.example.com.prod.svc.cluster.local', qtype: 'A', id: 0x1f01 }, note: 'ndots:5 causes this before the real question' },
            { s: 'coredns', d: 'pod1', proto: 'DNS', app: 'dnsr', t: 0.004, sip: '10.96.0.10', dip: '10.244.1.7', sport: 53, dport: 51234, info: 'NXDOMAIN · now try the next suffix', dns: { name: 'api.example.com.prod.svc.cluster.local', qtype: 'A', id: 0x1f01, flags: 0x8183, answers: [] } },
            { s: 'pod1', d: 'coredns', proto: 'DNS', app: 'dnsq', t: 0.008, sip: '10.244.1.7', dip: '10.96.0.10', sport: 51234, dport: 53, info: 'finally the absolute name · answered upstream', dns: { name: 'api.example.com', qtype: 'A', id: 0x1f02 } },
          ],
        },
      ],
      quiz: [
        {
          q: 'A Service ClusterIP 10.96.0.42 works, but no interface has that address. Why?',
          opts: ['It is a DNS alias', 'It is a virtual IP: kube-proxy programs DNAT rules that rewrite it to a real pod IP', 'It is assigned to the node', 'It only exists in IPv6'],
          a: 1,
          why: 'ClusterIP never belongs to a host. The data plane rewrites the destination to a healthy endpoint, which is what lets services survive pods being replaced.',
        },
        {
          q: 'Small requests to a pod work, large responses hang. Most likely cluster-specific cause?',
          opts: ['DNS resolution', 'Overlay MTU — the encapsulation overhead makes large packets exceed the path MTU', 'The service CIDR', 'kube-proxy mode'],
          a: 1,
          why: 'Overlays add ~50 bytes. If the CNI MTU is misconfigured, big packets are dropped while small ones pass — the classic MTU black hole inside a cluster.',
        },
      ],
    },

    {
      id: 'cloud',
      track: 'ops',
      title: 'Cloud VPC networking',
      subtitle: 'Subnets, route tables and two kinds of firewall',
      scenario: 'cloud',
      level: 4,
      minutes: 6,
      goals: ['public vs private subnets', 'route tables and NAT gateways', 'security groups vs network ACLs'],
      refs: [{ t: 'AWS VPC concepts', u: 'https://docs.aws.amazon.com/vpc/latest/userguide/what-is-amazon-vpc.html', note: 'vendor docs, but the model is universal' }, SA, SEC],
      steps: [
        {
          title: 'A subnet is public because of its route table',
          sub: 'Not because of its name',
          focus: ['igw', 'alb'],
          what: 'Every subnet has an associated route table. A subnet is "public" only because its table has 0.0.0.0/0 → internet gateway. A "private" subnet points 0.0.0.0/0 at a NAT gateway instead — or has no default route at all.',
          why: 'This is the single most misunderstood piece of cloud networking. Subnets do not have an inherent security property; routing does. Mislabel one and you have either an unreachable service or an accidental exit to the internet.',
          analogy: 'A room is not "outside" because of its label — it is outside because of the corridor it opens onto.',
          terms: [
            { t: 'Route table', d: 'A list of destination prefixes and targets, associated with subnets. The only thing that decides reachability.' },
            { t: 'Internet gateway', d: 'A managed, horizontally scaled NAT boundary between the VPC and the internet.' },
            { t: 'NAT gateway', d: 'Outbound-only translation for private subnets: replies work, inbound connections do not.' },
          ],
          card: {
            title: 'Two subnets, one difference',
            cols: ['', 'Public 10.10.1.0/24', 'Private 10.10.2.0/24'],
            rows: [
              ['0.0.0.0/0 →', 'internet gateway', 'NAT gateway'],
              ['Inbound from internet', 'possible (if allowed)', 'impossible'],
              ['Outbound to internet', 'direct', 'via NAT, source rewritten'],
              ['Public IP on instances', 'typically yes', 'no'],
            ],
            note: 'The only line that differs is the default route. Everything else follows from it.',
          },
          packets: [
            { s: 'app', d: 'nat', proto: 'IP', app: 'tcpData', t: 0.0, sip: '10.10.2.11', dip: '10.10.1.30', sport: 40211, dport: 443, info: 'Private instance sending out via the NAT gateway', tcp: { flags: 'PSH, ACK', seq: 1 }, pay: { label: 'Data', len: 400 } },
            { s: 'nat', d: 'igw', proto: 'IP', app: 'tcpData', t: 0.001, sip: '203.0.113.50', dip: '93.184.216.34', sport: 51234, dport: 443, info: 'Source rewritten to the NAT public address — replies have somewhere to land', tcp: { flags: 'PSH, ACK', seq: 1 }, pay: { label: 'Data', len: 400 } },
          ],
        },
        {
          title: 'Security groups and network ACLs',
          sub: 'Stateful and stateless, at different layers',
          focus: ['alb', 'app', 'db'],
          what: 'A security group attaches to an instance or interface and is stateful: allowing the inbound request automatically allows the reply. A network ACL attaches to a subnet and is stateless: you must allow both directions explicitly, and rules are evaluated in order by number.',
          why: 'Statefulness is what makes security groups manageable — you never write return rules. ACLs are the blunter instrument you use when you need a subnet-level deny that instances cannot override. Getting this backwards produces "the request arrives but the response is dropped".',
          analogy: 'A doorman who remembers you (security group) versus a turnstile that must be opened in each direction separately (ACL).',
          terms: [
            { t: 'Security group', d: 'Stateful, allow-only rules attached to an interface; return traffic is automatic.' },
            { t: 'Network ACL', d: 'Stateless, ordered allow/deny rules attached to a subnet; both directions must be permitted.' },
            { t: 'Ephemeral port range', d: 'The high ports used for replies. A stateless ACL that forgets them silently drops every response.' },
          ],
          card: {
            title: 'Which one is dropping it?',
            cols: ['Symptom', 'Suspect'],
            rows: [
              ['request arrives, no reply', 'stateless ACL missing the ephemeral-port return rule'],
              ['connection times out with no log', 'security group has no inbound rule'],
              ['connection refused (RST)', 'reached the host; nothing listening'],
              ['works from one subnet only', 'the other subnet\'s ACL'],
            ],
            note: 'VPC flow logs tell you ACCEPT or REJECT per packet, which shortens this table to one lookup.',
          },
          packets: [
            { s: 'alb', d: 'app', proto: 'TCP', app: 'tcpData', t: 0.0, sip: '10.10.1.20', dip: '10.10.2.11', sport: 40211, dport: 8080, info: 'Allowed by the security group: stateful, replies will not need a rule', tcp: { flags: 'SYN', seq: 0 } },
            { s: 'app', d: 'alb', proto: 'TCP', app: 'tcpData', t: 12.0, sip: '10.10.2.11', dip: '10.10.1.20', sport: 8080, dport: 40211, info: 'Reply dropped by a stateless ACL that never allowed high ports', tcp: { flags: 'SYN, ACK', seq: 0, ack: 1 }, dropped: true, note: 'the classic "the request arrives, the response never returns"' },
          ],
        },
        {
          title: 'Reaching a service privately',
          sub: 'Peering, endpoints and the cost of crossing an AZ',
          focus: ['app', 'db'],
          what: 'Services are reached either through a public endpoint, a VPC endpoint (private link to a managed service), a peering connection to another VPC, or a transit gateway when many VPCs must interconnect. Data crossing an availability zone or leaving the VPC is billed, and the latency is real even inside one region.',
          why: 'Cloud network design is largely about which traffic crosses which boundary — for latency, for cost, and for blast radius. A chatty service accidentally crossing an AZ can add milliseconds per call and a surprising line to the bill.',
          analogy: 'Internal post inside one office is free and instant; between buildings it is a courier service with a fee.',
          terms: [
            { t: 'VPC endpoint', d: 'A private route to a managed service that never traverses the public internet.' },
            { t: 'Transit gateway', d: 'A hub connecting many VPCs and on-premises networks with central routing policy.' },
            { t: 'Cross-AZ traffic', d: 'Traffic between availability zones: billed, and typically a fraction of a millisecond to a few milliseconds added.' },
          ],
          packets: [
            { s: 'app', d: 'db', proto: 'TCP', app: 'tcpData', t: 0.0, sip: '10.10.2.11', dip: '10.10.3.21', sport: 40211, dport: 5432, info: 'Database connection across subnets, inside one AZ: ~0.3 ms', tcp: { flags: 'SYN', seq: 0 } },
            { s: 'app', d: 'db', proto: 'TCP', app: 'tcpData', t: 0.0003, sip: '10.10.2.11', dip: '10.10.3.21', sport: 40211, dport: 5432, info: 'If the replica were in another AZ: ~1.2 ms per round trip, and billed', tcp: { flags: 'SYN, ACK', seq: 0, ack: 1 }, note: 'multiplied by every database round trip in the request' },
          ],
        },
        {
          title: 'The pieces that make it observable',
          sub: 'Flow logs, reachability analyser, and DNS',
          focus: ['pc', 'app'],
          what: 'Without packet capture you need three things: flow logs (who talked to whom, ACCEPT or REJECT), a reachability check that simulates a path before you deploy, and correct private DNS so names resolve inside the VPC. When a connection fails, flow logs answer "did the packet even arrive?" in one query.',
          why: 'In a cloud you cannot run tcpdump on the fabric. Weakening that blindness with purpose-built telemetry is the operational skill, and it is why cloud network troubleshooting looks like data analysis rather than packet reading.',
          analogy: 'Instead of standing at the door, you read the building\'s access logs — less detail, but covering every door at once.',
          terms: [
            { t: 'Flow log', d: 'Per-connection records with five-tuple, bytes, packets and ACCEPT/REJECT verdict.' },
            { t: 'Reachability analysis', d: 'A static evaluation of route tables, ACLs and security groups for a hypothetical path.' },
            { t: 'Private DNS zone', d: 'Names that resolve only inside the VPC, so internal services never need public records.' },
          ],
          packets: [
            { s: 'pc', d: 'igw', proto: 'TCP', app: 'tcpData', t: 0.0, sip: '203.0.113.140', dip: '203.0.113.50', sport: 52344, dport: 443, info: 'Inbound to the load balancer · flow log verdict ACCEPT', tcp: { flags: 'SYN', seq: 0 } },
            { s: 'pc', d: 'igw', proto: 'TCP', app: 'tcpData', t: 9.0, sip: '203.0.113.140', dip: '203.0.113.50', sport: 52345, dport: 22, info: 'SSH attempt · flow log verdict REJECT, security group', tcp: { flags: 'SYN', seq: 0 }, dropped: true, note: 'the REJECT row tells you it was a rule, not a routing problem' },
          ],
        },
      ],
      quiz: [
        {
          q: 'What makes a cloud subnet "public"?',
          opts: ['Its name', 'Its route table has a default route to an internet gateway', 'It has a public IP range', 'A security group allows 0.0.0.0/0'],
          a: 1,
          why: 'Reachability is decided by routing. A subnet is public if 0.0.0.0/0 points at an internet gateway — the name is only a label.',
        },
      ],
    },

    {
      id: 'netfilter',
      track: 'ops',
      title: 'Linux firewalls and conntrack',
      subtitle: 'What nftables actually does to a packet',
      scenario: 'dc',
      level: 5,
      minutes: 6,
      goals: ['tables, chains, hooks and priorities', 'conntrack states', 'DNAT/SNAT in practice'],
      refs: [{ t: 'nftables wiki', u: 'https://wiki.nftables.org/wiki-nftables/index.php/Main_Page', note: 'the modern tool' }, SEC, { t: 'Netfilter architecture', u: 'https://www.netfilter.org/documentation/HOWTO/netfilter-hacking-HOWTO-3.html', note: 'hooks and priorities' }],
      steps: [
        {
          title: 'Five hooks on the way through',
          sub: 'prerouting, input, forward, output, postrouting',
          focus: ['lb', 'app1'],
          what: 'Netfilter exposes five points in the kernel path. A packet arrives at prerouting, is routed, then goes to input (for this host) or forward (for another), and finally leaves via postrouting. DNAT belongs in prerouting (before routing), SNAT in postrouting (after routing).',
          why: 'Position determines capability. Changing the destination before the routing decision makes the kernel route to the new destination — which is exactly how a service virtual IP works. Doing the same thing later would be too late.',
          analogy: 'A sorting office with checkpoints: before routing, at the counter, in transit, and at dispatch. What you can do depends on where you stand.',
          terms: [
            { t: 'Hook', d: 'A fixed point in the kernel packet path where a chain can be evaluated.' },
            { t: 'Prerouting', d: 'Before the routing decision — where DNAT and port redirection must happen.' },
            { t: 'Forward', d: 'The path for packets that are routed through this host rather than delivered to it.' },
          ],
          card: {
            title: 'Where to put what',
            cols: ['Goal', 'Hook', 'Because'],
            rows: [
              ['redirect a destination port', 'prerouting', 'must happen before routing picks an interface'],
              ['rewrite the source address', 'postrouting', 'after routing, so replies are symmetric'],
              ['filter traffic to this host', 'input', 'it is addressed to us'],
              ['filter traffic through this host', 'forward', 'we are a router'],
              ['DNAT back (conntrack)', 'automatic', 'the reply path is reversed for you'],
            ],
            note: 'Getting the hook wrong is a silent failure: the rule exists, the counters stay at zero.',
          },
          packets: [
            { s: 'lb', d: 'app1', proto: 'TCP', app: 'tcpData', t: 0.0, sip: '10.0.2.2', dip: '10.0.2.11', sport: 40211, dport: 8080, info: 'In prerouting the destination is still the virtual IP; routing follows the rewrite', tcp: { flags: 'SYN', seq: 0 } },
          ],
        },
        {
          title: 'conntrack: the state machine behind the rules',
          sub: 'NEW, ESTABLISHED, RELATED, INVALID',
          focus: ['lb', 'app1'],
          what: 'The kernel keeps a table of connections. A SYN creates a NEW entry; the reply makes it ESTABLISHED; a second, related connection (FTP data, ICMP error) is RELATED. INVALID matches packets that make no sense in the current state — a common sign of async routing or a firewall timeout shorter than the application\'s.',
          why: 'One rule — "allow ESTABLISHED,RELATED" — does the work of hundreds of return-path rules. It is also where firewalls break in surprising ways: table exhaustion, timeouts that silently drop long-lived idle connections, and asymmetric routing that loses the reverse half.',
          analogy: 'A receptionist who remembers ongoing conversations, so they do not ask for your name again on every reply.',
          terms: [
            { t: 'conntrack', d: 'Connection tracking: per-flow state kept by the kernel, consulted by rules and by NAT.' },
            { t: 'RELATED', d: 'A new connection that is expected because of an existing one — the classic example being FTP data channels.' },
            { t: 'Table exhaustion', d: 'nf_conntrack_full: new connections dropped because the state table is full, usually from a flood or a leak.' },
          ],
          packets: [
            { s: 'pc', d: 'lb', proto: 'TCP', app: 'tcpData', t: 0.0, sport: 52344, dport: 443, info: 'SYN · conntrack state NEW', tcp: { flags: 'SYN', seq: 0 } },
            { s: 'lb', d: 'pc', proto: 'TCP', app: 'tcpData', t: 0.012, sport: 443, dport: 52344, info: 'SYN-ACK · ESTABLISHED, and the reply rule is automatic', tcp: { flags: 'SYN, ACK', seq: 0, ack: 1 } },
            { s: 'lb', d: 'pc', proto: 'ICMP', app: 'icmp', t: 20.0, info: 'ICMP error for the flow · state RELATED, permitted', icmp: { type: 3, seq: 1 }, note: 'RELATED is why ICMP errors do not need their own rule' },
          ],
        },
        {
          title: 'DNAT and SNAT together',
          sub: 'A load balancer in six lines',
          focus: ['lb', 'app1', 'pc'],
          what: 'A transparent balancer DNATs the destination to a backend and SNATs the source to itself, so the reply comes back through it rather than straight to the client. If it does not SNAT, the backend sees the client address and replies directly — which usually fails, because the client expects the answer from the virtual IP.',
          why: 'This is why so many "the connection opens but the response never arrives" bugs are address-rewriting bugs. Asymmetric routing is easy to create and hard to see without capture.',
          analogy: 'A translator who must also be the return address, or the reply goes to someone who cannot understand it.',
          terms: [
            { t: 'DNAT', d: 'Rewrite the destination; the reply is automatically reverse-translated by conntrack.' },
            { t: 'SNAT / masquerade', d: 'Rewrite the source. Masquerade picks the outgoing interface\'s address dynamically.' },
            { t: 'Asymmetric routing', d: 'Forward and return paths differ, so stateful devices see only half the conversation and drop it.' },
          ],
          card: {
            title: 'A minimal balancer ruleset',
            cols: ['Chain', 'Rule', 'Effect'],
            rows: [
              ['prerouting', 'dnat to 10.0.2.11:8080', 'traffic for the VIP goes to a backend'],
              ['postrouting', 'masquerade', 'replies come back through the balancer'],
              ['forward', 'accept ct state new,established', 'permit the forwarded flow'],
              ['input', 'accept ct state established,related', 'allow the returns to us'],
            ],
            note: 'Delete the postrouting line and you get intermittent hangs that look like application timeouts.',
          },
          packets: [
            { s: 'pc', d: 'lb', proto: 'TCP', app: 'tcpData', t: 0.0, sip: '203.0.113.140', dip: '203.0.113.20', sport: 52344, dport: 443, info: 'Client → virtual IP', tcp: { flags: 'PSH, ACK', seq: 1 }, pay: { label: 'HTTP request', len: 400 } },
            { s: 'lb', d: 'app1', proto: 'TCP', app: 'tcpData', t: 0.001, sip: '10.0.2.2', dip: '10.0.2.11', sport: 40211, dport: 8080, info: 'After DNAT + SNAT: backend sees the balancer, not the client', tcp: { flags: 'PSH, ACK', seq: 1 }, pay: { label: 'HTTP request', len: 400 } },
            { s: 'app1', d: 'lb', proto: 'TCP', app: 'tcpData', t: 0.004, sip: '10.0.2.11', dip: '10.0.2.2', sport: 8080, dport: 40211, info: 'Reply to the balancer, which reverses both translations', tcp: { flags: 'PSH, ACK', seq: 1, ack: 401 }, pay: { label: 'HTTP response', len: 900 } },
          ],
        },
      ],
      quiz: [
        {
          q: 'A DNAT rule to a backend works, but replies never reach the client. What is missing?',
          opts: ['An input rule', 'SNAT on the balancer, so the reply path comes back through it', 'A forward rule for ICMP', 'IPv6'],
          a: 1,
          why: 'Without SNAT the backend replies directly to the client\'s address, which the client discards because it expects an answer from the virtual IP. The return path must be symmetric.',
        },
      ],
    },

    {
      id: 'mesh',
      track: 'ops',
      title: 'mTLS and service mesh',
      subtitle: 'Identity that is a certificate, not an IP',
      scenario: 'mesh',
      level: 5,
      minutes: 6,
      goals: ['how sidecars intercept traffic', 'SPIFFE identities', 'why zero trust changes design'],
      refs: [{ t: 'SPIFFE/SPIRE', u: 'https://spiffe.io/', note: 'workload identity standard' }, SEC, SDN],
      steps: [
        {
          title: 'Redirecting traffic nobody meant to redirect',
          sub: 'iptables inside the pod netns',
          focus: ['front', 'sf'],
          what: 'The sidecar injector adds an init container that writes iptables rules into the pod\'s network namespace: outbound TCP is redirected to Envoy on 15001, inbound to 15006. The application connects normally to its destination and never knows the connection was captured.',
          why: 'This is how a mesh adds encryption and policy without changing a line of application code — and also why a broken sidecar redirect makes the whole pod unreachable while the app looks healthy.',
          analogy: 'Every letter in the building is quietly routed through a mailroom that opens, checks and reseals it — without the sender changing their habits.',
          terms: [
            { t: 'Sidecar', d: 'A proxy container in the same network namespace as the application, so it can intercept its traffic.' },
            { t: 'Traffic interception', d: 'iptables REDIRECT rules in the pod netns, applied to outbound and inbound flows.' },
            { t: 'Envoy', d: 'The L7 proxy most meshes use; listeners, clusters, filters, and a config API driven by a control plane.' },
          ],
          packets: [
            { s: 'front', d: 'sf', proto: 'TCP', app: 'tcpData', t: 0.0, sip: '10.244.1.7', dip: '10.244.1.7', sport: 40211, dport: 15001, info: 'App thinks it is connecting to the backend; iptables redirects to Envoy', tcp: { flags: 'SYN', seq: 0 }, note: 'loopback-looking traffic that actually leaves the pod' },
          ],
        },
        {
          title: 'Identity: a SPIFFE ID, not an IP',
          sub: 'Certificates issued per workload, rotated hourly',
          focus: ['sf', 'cp', 'sb'],
          what: 'The control plane issues each workload a short-lived X.509 certificate whose subject is a SPIFFE ID — spiffe://cluster.local/ns/prod/sa/backend — not a hostname or IP. Both sidecars present these certificates, so each end verifies the other\'s identity and the transport is mutually authenticated.',
          why: 'In Kubernetes, IP addresses are recycled constantly and any pod can spoof a source address. A cryptographic identity tied to the service account is the only claim that survives an attacker who controls the network.',
          analogy: 'Checking a signed passport instead of trusting the return address written on an envelope.',
          terms: [
            { t: 'SPIFFE ID', d: 'A URI identity such as spiffe://trust-domain/ns/namespace/sa/service-account.' },
            { t: 'mTLS', d: 'TLS where both sides present and verify certificates — the server authenticates the client too.' },
            { t: 'Certificate rotation', d: 'Short lifetimes (often 1 hour) so a stolen key expires quickly; the control plane handles renewal.' },
          ],
          packets: [
            { s: 'sf', d: 'sb', proto: 'TCP', app: 'tcpData', t: 0.0, sip: '10.244.1.7', dip: '10.244.2.9', sport: 50001, dport: 15006, info: 'Sidecar → sidecar, on the inbound redirect port', tcp: { flags: 'SYN', seq: 0 } },
            { s: 'sf', d: 'sb', proto: 'TLS', app: 'tls', t: 0.012, sip: '10.244.1.7', dip: '10.244.2.9', sport: 50001, dport: 15006, info: 'mTLS handshake · client cert = spiffe://cluster.local/ns/prod/sa/frontend', tls: { handshakeType: 1 } },
            { s: 'sb', d: 'sf', proto: 'TLS', app: 'tls', t: 0.024, sip: '10.244.2.9', dip: '10.244.1.7', sport: 15006, dport: 50001, info: 'Server cert = spiffe://cluster.local/ns/prod/sa/backend · both verified', tls: { handshakeType: 2 } },
          ],
        },
        {
          title: 'Policy becomes declarative',
          sub: 'Authorization at the proxy, not in the app',
          focus: ['sb', 'back'],
          what: 'Because the proxy sees a verified identity and a complete HTTP request, policy can be expressed as "allow GET /api from ns/prod/sa/frontend". The backend receives only permitted traffic and does no authentication work of its own.',
          why: 'This is the practical meaning of zero trust: the network is assumed hostile, and every request carries proof of identity that is checked at each hop. The network perimeter stops being the security boundary; identity becomes it.',
          analogy: 'Every door checks your badge against a central list, instead of relying on the fact that you got past the front gate.',
          terms: [
            { t: 'AuthorizationPolicy', d: 'A declarative rule matching identity, namespace, method and path, enforced by the sidecar.' },
            { t: 'Zero trust', d: 'No implicit trust from network location; every request is authenticated and authorised.' },
            { t: 'Identity-aware proxy', d: 'A proxy that makes decisions from cryptographic identity rather than addresses.' },
          ],
          packets: [
            { s: 'sb', d: 'back', proto: 'HTTP', app: 'httpReq', t: 0.03, sip: '10.244.2.9', dip: '10.244.2.9', sport: 50002, dport: 8080, info: 'Forwarded to the app over loopback after policy allowed it', http: { method: 'GET', path: '/api/orders', host: 'backend', headers: ['Host: backend', 'X-Forwarded-Client-Cert: spiffe://cluster.local/ns/prod/sa/frontend'] } },
            { s: 'sf', d: 'sb', proto: 'TLS', app: 'tls', t: 5.0, sip: '10.244.1.7', dip: '10.244.2.9', sport: 50003, dport: 15006, info: 'Denied: identity not allowed for POST /api/admin', tls: { length: 120 }, dropped: true, note: 'the proxy rejects it; the application never sees the request' },
          ],
        },
        {
          title: 'What the mesh costs you',
          sub: 'Two extra proxies, one extra hop, more things to debug',
          focus: ['sf', 'sb'],
          what: 'Every request now passes through two proxies, adding a connection, a TLS handshake (usually reused) and a decision. Failures multiply: a stale sidecar config, an expired certificate, or a policy that is too narrow all look like "the service is down" while the application logs show nothing at all.',
          why: 'This is a genuine trade-off, not a sales pitch. Meshes buy uniform encryption and identity at the cost of latency, complexity and a new class of outage. Many teams use them for mTLS and observability and deliberately keep policy simple.',
          analogy: 'Two translators between two people who speak the same language: more safety checks, more delay, more ways to misunderstand.',
          terms: [
            { t: 'Ambient mesh', d: 'A newer design that moves interception into the node (ztunnel) instead of per-pod sidecars, cutting overhead.' },
            { t: 'Control-plane outage', d: 'Proxies keep running with their last config; new pods and rotations fail — a subtle partial failure.' },
          ],
          card: {
            title: 'Sidecars: the honest ledger',
            cols: ['You gain', 'You pay'],
            rows: [
              ['mTLS everywhere, automatically', '+1 hop, ~0.2–1 ms per call'],
              ['identity-based policy', 'a new config language to get wrong'],
              ['uniform L7 telemetry', 'proxies to keep patched and sized'],
              ['traffic shifting and retries', 'retries can amplify an incident'],
            ],
            note: 'Measure the added latency before and after. If nobody measured, nobody can justify it.',
          },
          packets: [],
        },
      ],
      quiz: [
        {
          q: 'Why is a SPIFFE certificate a better identity than a pod IP address?',
          opts: ['It is faster', 'Pod IPs are recycled and can be spoofed; a cryptographic identity tied to the service account cannot', 'It compresses better', 'It avoids TLS entirely'],
          a: 1,
          why: 'Someone who controls the network can forge a source IP. Only a signed identity proves which workload is on the other end, which is the whole premise of zero trust.',
        },
      ],
    },

    {
      id: 'qos',
      track: 'ops',
      title: 'QoS and traffic shaping',
      subtitle: 'Deciding which packets matter',
      scenario: 'home',
      level: 4,
      minutes: 5,
      goals: ['DSCP classes', 'policing vs shaping', 'queueing and why small buffers win'],
      refs: [{ t: 'RFC 2474 — DSCP', u: 'https://datatracker.ietf.org/doc/html/rfc2474', note: 'the class field' }, { t: 'TCP Congestion Control: A Systems Approach', u: 'https://github.com/SystemsApproach/tcpcc', note: 'queues and AQM' }, SA],
      steps: [
        {
          title: 'Marking: six bits with a meaning',
          sub: 'DSCP in the IP header',
          focus: ['pc', 'rtr'],
          what: 'The Traffic Class field in IPv6, or the ToS byte in IPv4, holds a 6-bit DSCP value. Expedited Forwarding (46) means "low latency, low loss", Assured Forwarding classes give relative priority, and 0 is best effort. Marking alone does nothing — a queue has to honour it somewhere.',
          why: 'Every network needs a way to say what matters, and trust boundaries decide who is allowed to say it. If you honour markings from the internet, anyone can mark their traffic EF; therefore marking is trusted only at the edge you control.',
          analogy: 'Coloured tags on parcels: only useful if a sorter actually reads them, and only safe if senders cannot choose their own colour.',
          terms: [
            { t: 'DSCP', d: 'Differentiated Services Code Point: 6 bits in the IP header carrying a per-hop behaviour hint.' },
            { t: 'EF / AF', d: 'Expedited Forwarding (46) for low-latency traffic; Assured Forwarding (10–46) for classes with relative drop preference.' },
            { t: 'Trust boundary', d: 'The point where markings start being believed — usually your own hardware, never the incoming internet.' },
          ],
          packets: [
            { s: 'pc', d: 'rtr', proto: 'IP', app: 'udpData', t: 0.0, info: 'Voice packet marked EF (46) · tiny, 20 ms cadence', dscp: 0xb8, sport: 40000, dport: 40001, pay: { label: 'RTP audio', len: 172 }, note: 'marking is only meaningful if the queue honours it' },
            { s: 'pc', d: 'rtr', proto: 'IP', app: 'tcpData', t: 0.02, info: 'Bulk upload marked best effort (0) · fills every queue it meets', dscp: 0, pay: { label: 'Backup data', len: 1460 } },
          ],
        },
        {
          title: 'Policing versus shaping',
          sub: 'Drop the excess, or delay it',
          focus: ['rtr'],
          what: 'A policer measures a rate and drops or re-marks packets that exceed it — traffic stays out of the queue but suffers loss. A shaper buffers and delays excess traffic to smooth it to the target rate, producing delay instead of loss.',
          why: 'TCP reacts to loss by halving its window, so policing TCP is a blunt instrument that damages throughput. Shaping is friendlier for TCP but needs a buffer, and a too-large buffer produces bufferbloat. The right answer is shaping at the edge plus AQM in the queue.',
          analogy: 'A policer turns away extra cars at the entrance; a shaper holds them in a queue and releases them at a steady rate.',
          terms: [
            { t: 'Policer', d: 'Rate limiter that discards or marks excess traffic.' },
            { t: 'Shaper', d: 'Rate limiter that queues excess traffic and releases it later.' },
            { t: 'AQM', d: 'Active Queue Management: dropping or marking early to keep queueing delay small (fq_codel, CAKE).' },
          ],
          card: {
            title: 'Policing vs shaping',
            cols: ['', 'Policer', 'Shaper'],
            rows: [
              ['Excess traffic', 'dropped or re-marked', 'delayed'],
              ['TCP response', 'window halved — throughput collapses', 'window preserved'],
              ['Buffer needed', 'no', 'yes (and its size matters)'],
              ['Use at', 'network edge, ingress', 'customer edge, egress'],
            ],
            note: 'Shaping your own egress plus fq_codel is what actually fixes a video call while a backup runs.',
          },
          packets: [
            { s: 'pc', d: 'rtr', proto: 'TCP', app: 'tcpData', t: 0.0, info: 'Egress shaped to 20 Mbit/s · excess is delayed, not dropped', tcp: { flags: 'PSH, ACK', seq: 1 }, pay: { label: 'Backup data', len: 1460 } },
            { s: 'rtr', d: 'web', proto: 'TCP', app: 'tcpData', t: 0.004, info: 'Shaped release keeps the queue short, so voice stays low-latency', tcp: { flags: 'PSH, ACK', seq: 2921 }, pay: { label: 'Backup data', len: 1460 }, note: 'same bandwidth, far less queueing delay' },
          ],
        },
        {
          title: 'Queue discipline decides the experience',
          sub: 'FIFO, HTB, and fq_codel',
          focus: ['rtr', 'pc'],
          what: 'A single FIFO queue is what most cheap routers ship: everything waits in arrival order, so one bulk flow delays voice packets by hundreds of milliseconds. HTB gives you classes with rates and priorities; fq_codel gives every flow its own queue and keeps each short, so a bulk flow can only delay itself.',
          why: 'Bandwidth allocation and latency are different problems. fq_codel solves the latency one almost for free — which is why it became the default on Linux, OpenWrt and many ISPs\' CPE.',
          analogy: 'One checkout queue for everyone versus a queue per shopper: the one with a full trolley no longer blocks the person buying milk.',
          terms: [
            { t: 'qdisc', d: 'Queueing discipline: the algorithm deciding what leaves an interface next.' },
            { t: 'fq_codel', d: 'Fair queueing with controlled delay: per-flow queues, short, with early drops.' },
            { t: 'HTB', d: 'Hierarchical Token Bucket: class-based shaping with guaranteed and maximum rates.' },
          ],
          packets: [
            { s: 'rtr', d: 'pc', proto: 'UDP', app: 'udpData', t: 0.0, info: 'Voice packet leaves immediately under fq_codel despite the bulk flow', sport: 40001, dport: 40000, pay: { label: 'RTP audio', len: 172 }, note: 'per-flow queueing is why latency survives saturation' },
          ],
        },
      ],
      quiz: [
        {
          q: 'Why is a policer a bad fit for TCP traffic on a customer uplink?',
          opts: ['It uses too much CPU', 'It drops packets, and TCP responds to loss by halving its window, so throughput collapses', 'It cannot mark DSCP', 'It only works on UDP'],
          a: 1,
          why: 'TCP interprets drops as congestion. Shaping delays excess instead, keeping loss (and therefore the window) intact while still enforcing the rate.',
        },
      ],
    },

    {
      id: 'webrtc',
      track: 'ops',
      title: 'Real-time media: RTP, ICE and NAT traversal',
      subtitle: 'Why calls need UDP and what STUN is for',
      scenario: 'home',
      level: 4,
      minutes: 6,
      goals: ['RTP/RTCP roles', 'ICE, STUN and TURN', 'what loss and jitter do'],
      refs: [{ t: 'RFC 3550 — RTP', u: 'https://datatracker.ietf.org/doc/html/rfc3550', note: 'media transport' }, { t: 'RFC 8445 — ICE', u: 'https://datatracker.ietf.org/doc/html/rfc8445', note: 'NAT traversal' }, HPBN],
      steps: [
        {
          title: 'Media does not want TCP',
          sub: 'RTP over UDP with its own clock',
          focus: ['pc', 'web'],
          what: 'RTP carries audio and video as small UDP datagrams, each with a sequence number and a timestamp from a media clock. RTCP is the control channel: it reports loss, jitter and round-trip time so both ends can adapt their bitrate.',
          why: 'A late frame is worthless, so retransmitting it wastes bandwidth that could carry the next one. TCP\'s reliability is actively harmful here — it would stall delivery to preserve order. Real-time media wants timeliness, not completeness.',
          analogy: 'A live broadcast: if the feed breaks, you want to jump to the present, not replay what you missed.',
          terms: [
            { t: 'RTP', d: 'Real-time Transport Protocol: sequenced, timestamped media over UDP with a payload-type field.' },
            { t: 'RTCP', d: 'The companion control protocol reporting loss, jitter and RTT for adaptive bitrate.' },
            { t: 'Jitter buffer', d: 'A small buffer that absorbs variable arrival times, trading latency for smoothness.' },
          ],
          packets: [
            { s: 'pc', d: 'web', proto: 'UDP', app: 'udpData', t: 0.0, sport: 40000, dport: 40001, info: 'RTP audio · seq 1042, ts 88200, 20 ms of G.711', pay: { label: 'RTP audio', len: 172 } },
            { s: 'pc', d: 'web', proto: 'UDP', app: 'udpData', t: 0.02, sport: 40000, dport: 40001, info: 'RTP audio · seq 1043 — one every 20 ms, loss is tolerated', pay: { label: 'RTP audio', len: 172 } },
            { s: 'web', d: 'pc', proto: 'UDP', app: 'udpData', t: 1.0, sport: 40001, dport: 40000, info: 'RTCP receiver report · 1.2% loss, jitter 8 ms, RTT 43 ms', pay: { label: 'RTCP RR', len: 72 }, note: 'this report is what drives the encoder down to a lower bitrate' },
          ],
        },
        {
          title: 'Both sides are behind NAT',
          sub: 'ICE: try every path, use the first that works',
          focus: ['pc', 'rtr', 'web'],
          what: 'A client gathers candidate addresses: local ones, ones discovered through STUN (its public IP and port as seen from outside), and relayed addresses on a TURN server. Candidates are exchanged in the signalling channel, then pairs are tested with connectivity checks. Media flows on the first pair that answers.',
          why: 'This solves the problem NAT created in the very first lessons: neither peer can accept an unsolicited inbound connection. STUN discovers the mapping; TURN relays when even that fails — which is why TURN servers are expensive but mandatory for reliability.',
          analogy: 'Two people behind locked doors shouting out of windows, trying each other\'s suggested routes until one shout is heard.',
          terms: [
            { t: 'STUN', d: 'Asks a server "what address and port do you see me coming from?" — discovering your NAT mapping.' },
            { t: 'TURN', d: 'A relay that forwards media when direct paths fail. Bandwidth-expensive, so a last resort.' },
            { t: 'ICE candidate', d: 'One possible (address, port, transport) pair to test, with a priority reflecting its likely quality.' },
          ],
          packets: [
            { s: 'pc', d: 'dns', proto: 'UDP', app: 'udpData', t: 0.0, sport: 51000, dport: 3478, info: 'STUN Binding Request to a public STUN server', pay: { label: 'STUN request', len: 28 } },
            { s: 'dns', d: 'pc', proto: 'UDP', app: 'udpData', t: 0.024, sport: 3478, dport: 51000, info: 'STUN response · your mapping is 203.0.113.75:51000', pay: { label: 'STUN response', len: 60 }, note: 'this is the address the peer must try' },
            { s: 'pc', d: 'web', proto: 'UDP', app: 'udpData', t: 0.05, sport: 40000, dport: 40001, info: 'ICE connectivity check succeeded · media flows directly, peer to peer', pay: { label: 'RTP audio', len: 172 } },
          ],
        },
        {
          title: 'What 2% loss actually does',
          sub: 'Concealment, bitrate, and the limit of repair',
          focus: ['pc', 'web'],
          what: 'A missing audio packet is not retransmitted; the receiver conceals it by repeating the previous frame or interpolating, which sounds like a small click. Sustained loss makes RTCP reports push the encoder to a lower bitrate — automatically trading quality for continuity. Video reacts by dropping frames and reducing resolution.',
          why: 'The system is designed to degrade, never to stall. This is the same design axis as QUIC and UDP generally: choose what you do with missing data instead of pretending it will always arrive.',
          analogy: 'A radio with static: you keep listening, and the station lowers its transmission quality rather than pausing entirely.',
          terms: [
            { t: 'Packet loss concealment', d: 'Filling a gap with a plausible substitute so the listener hears a click, not a pause.' },
            { t: 'Adaptive bitrate', d: 'Reducing encoder output in response to RTCP loss and jitter reports.' },
            { t: 'FEC', d: 'Forward error correction: sending redundant data so some loss needs no repair at all.' },
          ],
          card: {
            title: 'What the numbers mean for a call',
            cols: ['Condition', 'Audio', 'Video'],
            rows: [
              ['1% loss', 'inaudible', 'minor artefacts'],
              ['3% loss', 'occasional clicks', 'visible blockiness'],
              ['10% loss', 'words missing', 'unusable without FEC'],
              ['150 ms jitter', 'stutter without a buffer', 'freezing'],
              ['300 ms one-way latency', 'talk-over collisions', 'noticeable lag'],
            ],
            note: 'Latency is the harder limit: no buffer, codec or repair can undo distance.',
          },
          packets: [
            { s: 'web', d: 'pc', proto: 'UDP', app: 'udpData', t: 0.0, sport: 40001, dport: 40000, info: 'RTP audio seq 1044 · lost in the network', pay: { label: 'RTP audio', len: 172 }, dropped: true },
            { s: 'web', d: 'pc', proto: 'UDP', app: 'udpData', t: 0.02, sport: 40001, dport: 40000, info: 'seq 1045 arrives · receiver conceals 1044 rather than asking for it', pay: { label: 'RTP audio', len: 172 }, note: 'no retransmission: the moment has passed' },
          ],
        },
      ],
      quiz: [
        {
          q: 'What is a TURN server for?',
          opts: ['Compressing video', 'Relaying media when no direct path between two peers can be found', 'Resolving DNS', 'Encrypting RTP'],
          a: 1,
          why: 'STUN discovers a possible direct path. When both peers are behind unfriendly NATs, TURN relays the traffic — reliable, but expensive in bandwidth, so it is the fallback rather than the default.',
        },
      ],
    },
  ];

  root.PE_LESSONS_OPS = LESSONS;
})(typeof window !== 'undefined' ? window : globalThis);
