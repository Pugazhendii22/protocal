# Protocol Explorer — packet by packet

A guided, hands-on course on how the internet actually works. Built as a single
static site: no build step, no dependencies, no network calls.

**Easy English, on by default.** Every lesson's explanation is rewritten live
into short lines (13 words or fewer, one idea each), difficult words are swapped
for simple ones ("utilise" → "use", "approximately" → "about", "therefore" →
"so"), and a **Word help** row under each step explains the jargon that has to
stay ("sequence number", "TLS", "conntrack") in one plain sentence. Toggle it
from the top bar or the home page; the choice is remembered.

**Light, beginner-first UI.** Plain-language navigation (*Start here · Lessons ·
Explore devices · Practice test*), four "where would you like to start?" paths on
the home page, and a lesson layout where the explanation, the animated network,
the packet list and the byte inspector never move around between steps.

Open `index.html`, or serve the folder:

```bash
python3 -m http.server 8080
```

## What is inside

**Guided course — 8 tracks, 37 lessons, 158 steps, 46 quiz questions, in order**

| Track | Lessons |
| --- | --- |
| 1 · Foundations | packets · MAC/IP/port addressing · LAN vs WAN |
| 2 · Getting online | DHCP · ARP · DNS · TCP handshake · HTTP · NAT |
| 3 · Security | TLS · certificates & chain of trust · SSH |
| 4 · Mail & files | SMTP · IMAP/POP3 · FTP |
| 5 · Going deeper | UDP/QUIC · ICMP · TCP recovery & congestion · BGP · diagnosis |
| 6 · Advanced & modern | performance (latency, BDP, bufferbloat) · IPv6 & NDP · anycast/CDN/DNS steering · middleboxes & CGNAT · observability, eBPF & attacks |
| 7 · Protocol deep dives | TLS 1.3 handshake internals · QUIC & HTTP/3 · HTTP/2 multiplexing · DNSSEC & DNS privacy · Wi-Fi association & WPA2 · time and NTP |
| 8 · Cloud, containers & ops | Kubernetes pod networking & ClusterIPs · cloud VPCs, routes and two kinds of firewall · netfilter & conntrack · mTLS and service mesh · QoS and queueing · RTP/ICE/TURN real-time media |

The diagram draws curved links so crossings stay readable, numbers the route
(1 → 2 → 3) in a breadcrumb above the canvas, labels the moving packet
("TCP · 3 hops"), and pulses every device it passes through.

The animated diagram is routed on the real topology: a packet travels
**hop by hop along the drawn links** (284 packets → 623 link segments, verified
in `tools/crawl.js`), the path stays highlighted while it moves, intermediate
routers pulse as it passes through them, and the dropped packets stop mid-path
with a red ✕ instead of vanishing.

Every lesson is a scenario with steps. Each step has an explanation, a
"why it works this way", an analogy, the terms it introduces, an animated
diagram, the packet list, and a byte-level inspector.

**Free explore**

- **Device lab** — pick any device in **ten topologies** (home, LAN, mail, CDN,
  datacenter, Kubernetes, cloud VPC, Wi-Fi, service mesh, BGP) and look inside
  it: interfaces, routing table, ARP cache, listening services, traffic filtered
  to that box, a path tracer, and a shell with working commands (`ip addr`,
  `ip -6 addr`, `ip route`, `arp -a`, `ss -tulpn`, `dig`, `dig +trace`, `ping`,
  `traceroute`, `curl -v`, `tcpdump`, `conntrack -L`, `conntrack -S`,
  `iptables -t nat -L`, `bridge fdb`, `bridge link`, `ethtool`,
  `openssl s_client -connect host:443`, `show interfaces`,
  `show interface counters`, `show bgp summary`).
- **Exam mode** — a timed, mixed quiz sampled from every track (45 s per
  question, any scope, 8/12/20 questions), scored with a per-track breakdown and
  every question reviewed against the lesson it came from.
- **Protocol library** — 30 protocols with their wire fields, RFC and gotcha.
- **Protocol timeline** — 23 milestones from ARPANET to HTTP/3, each linked to
  the protocol it produced.
- **Glossary** — every term used anywhere in the course, searchable.
- **Ports & cheat sheet** — ports, the layer model, symptom → cause, commands.
- **Sources & further reading** — the books, GitHub repositories and RFCs the course
  is written against, each with a note on what it is actually for, plus a table
  showing which lesson points at which source.

## References the advanced track is built on

Every lesson in track 6 renders its own **further reading** block, and the
Sources page collects them all. The core references:

| Source | Role |
| --- | --- |
| Kurose & Ross, *Computer Networking: A Top-Down Approach* | the structure of the course |
| Peterson & Davie, *Computer Networks: A Systems Approach* ([free](https://book.systemsapproach.org/), [source](https://github.com/SystemsApproach/book)) | design rationale, modern topics |
| Stevens & Fall, *TCP/IP Illustrated Vol. 1* | field-by-field protocol depth |
| Grigorik, *High Performance Browser Networking* ([free](https://hpbn.co/)) | latency, TCP, TLS, HTTP/2, QUIC |
| *TCP Congestion Control: A Systems Approach* ([repo](https://github.com/SystemsApproach/tcpcc)) | congestion control, BBR |
| *Network Security: A Systems Approach* ([repo](https://github.com/SystemsApproach/security)) | firewalls, DDoS, middleboxes |
| *Software-Defined Networks: A Systems Approach* ([repo](https://github.com/SystemsApproach/sdn)) | control planes, overlays |
| RFC 8200 / 4861 / 4862, RFC 7323, RFC 8305, RFC 6888 | IPv6, NDP, SLAAC, window scaling, Happy Eyeballs, CGNAT |
| [chrissanders/packets](https://github.com/chrissanders/packets), [Unit42 Wireshark tutorials](https://github.com/PaloAltoNetworks/Unit42-Wireshark-tutorials), [IPv6 extension-header pcaps](https://github.com/amwalding/IPv6_Extension_Header_PCAPs) | real captures to practise on |
| [awesome-ebpf](https://github.com/qmonnet/awesome-ebpf), [pwru](https://github.com/cilium/pwru) | eBPF, and finding where a packet is dropped |

## Details worth knowing

- **Checksums are real.** IPv4, TCP, UDP, ICMP and ICMPv6 checksums are computed
  with RFC 1071 over the actual bytes, including the IPv4 pseudo-header and the
  IPv6 pseudo-header used by ICMPv6 and by TCP/UDP over IPv6.
- **IPv6 is real too.** 40-byte fixed header, 128-bit addresses, NDP (Neighbor
  Solicitation/Advertisement), Router Advertisements with SLAAC prefixes, and
  ICMPv6 "Packet Too Big".
- **Byte map is real.** Clicking any field highlights its exact byte range in the
  hex dump; offsets are from the start of the frame.
- **Nothing is fetched.** All content and code ship in `src/` as plain scripts,
  so it works offline, from `file://`, or from any static host.
- Progress is stored in `localStorage` only.

## Files

```
index.html            shell + design system
src/bytes.js          header builders, real checksums, byte maps
src/topology.js       networks, devices, services
src/data.js           tracks, protocol reference, glossary extras
src/lessons-basics.js lessons 1-9   (tracks 1-2)
src/lessons-more.js   lessons 10-20 (tracks 3-5)
src/lessons-advanced.js lessons 21-25 (track 6), each with a refs[] array
src/lessons-deep.js   lessons 26-31 (track 7): TLS 1.3, QUIC, HTTP/2, DNSSEC, Wi-Fi, time
src/lessons-ops.js    lessons 32-37 (track 8): Kubernetes, cloud VPC, netfilter, mesh, QoS, WebRTC
src/engine.js         compiles lesson scripts into real packets
src/ui.js             state, shell, icons
src/lesson-view.js    explainer, canvas, pcap table, inspector
src/lab-view.js       device inspector + shell
src/ref-view.js       library, glossary, cheat sheet
src/tour-view.js      course overview / syllabus
src/sources-view.js   books, repositories and RFCs
src/extras.js         exam mode, protocol timeline, command palette
src/app.js            router, events, keyboard
```

Keyboard: `Ctrl/Cmd+K` (or `/`) opens the command palette — search every lesson,
step, protocol and glossary term; `←` `→` step, `1`–`9` jump to a step, `space`
auto-play.

## Two ways to open it

- `protocol-explorer.html` — the whole app in one file (everything inlined). Double-click it, or preview it without a server. Best for sharing.
- `index.html` — the same app with `src/*.js` loaded separately, for reading and editing. Serve the folder with `python3 -m http.server`.

## QA

```bash
node tools/build.js     # regenerate the single-file bundle
node tools/smoke.js     # boot counts, IPv6 layers, lab shell, sources, single file
node tools/crawl.js     # walks all 37 lessons x 158 steps, 10 topologies x 63 devices x 8 tabs,
                        # 26 shell commands per topology, exam mode, timeline, palette,
                        # and proves every packet is routed over links that exist → 0 errors
node tools/interact.js  # clicks things: 47 assertions that each control actually changes
                        # state (step nav, packet select, field highlight, quiz, CLI, exam,
                        # palette, drawer, persistence, reset)
node tools/audit.js     # screenshots every view + DOM audit: stray "undefined/NaN",
                        # horizontal overflow, clipped text, dead links, unhandled
                        # data-act handlers, and 390/820px layouts → 0 issues
```

Current inventory: **8 tracks / 37 lessons / 158 steps / 46 quiz questions /
30 protocols / 10 topologies / 63 devices / 284 packets / 36 source cards.**

## Restarting the preview

Background processes stop between sessions. To bring the preview back:

```bash
cd /home/user && python3 -m http.server 8080 --bind 0.0.0.0
```

Then open `http://localhost:8080/`. To regenerate the single-file bundle after
editing anything in `src/`:

```bash
node tools/build.js
```

## Phone / mobile design (new)

The phone layout is now a first-class design, not a squeeze of the desktop one.

- **Bottom tab bar** (Home · Lessons · Devices · Test · Search) shows at `<=1020px`, with the active tab highlighted and every button 48px tall. The hamburger drawer still opens the full lesson list; it now closes on `Escape`, on a tap outside it (scrim), and covers the tab bar while open.
- **Easy English is always reachable** on a phone: the topbar toggle is hidden there, so the switch sits at the bottom of the drawer as a full-width button.
- **Device lab uses native dropdowns** on a phone (`Network` + `Device`) instead of a clipped horizontal scroller, and the eight device tabs become a 4x2 grid of 44px cells with short labels (Info / Shell / Ports / Routes / ARP / Doors / Traffic / Path).
- **The diagram fits the screen.** Under 760px the canvas has no `min-width`: `layoutPx()` switches to a smaller node footprint (106x82) and the layout is vertically centred, so every device and label is visible with no sideways panning and no clipped `.pkttag` (the packet tag flips to the left of the dot near the right edge and slides down near the top).
- **Reading order on a phone:** step text first, then the animated map, then packet flow, then the inspector.
- **Type and targets scale up:** body 14.5px, 44px buttons, 42px icon buttons, wrapping step chips (2 lines) instead of "A name is not an…", and a scrolling step strip with 44px rows.
- Wide tables wrap instead of squashing; the packet-info column gets two lines.

### QA

```
node tools/build.js      # single-file build
node tools/crawl.js      # link + routing crawl
node tools/interact.js   # 47 click assertions
node tools/audit.js      # DOM audit at 3 widths
node tools/mobile.js     # NEW: phone gate at 320 / 390 / 820
```

`tools/mobile.js` fails if the page scrolls sideways, if the tab bar is missing or has sub-44px buttons, if the diagram is wider than its box, if the lab pickers are absent, or if the drawer will not open and close.
