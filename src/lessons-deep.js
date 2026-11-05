/* ============================================================
   lessons-deep.js — Track 7 · Protocol deep dives
   TLS 1.3 internals, QUIC/HTTP3, HTTP/2, DNSSEC, Wi-Fi, time.
   ============================================================ */
(function (root) {
  'use strict';

  const RFC8446 = { t: 'RFC 8446 — TLS 1.3', u: 'https://datatracker.ietf.org/doc/html/rfc8446', note: 'the key schedule in §7.1' };
  const BULLET = { t: 'Bulletproof SSL and TLS — Ristić', u: 'https://www.feistyduck.com/books/bulletproof-ssl-and-tls/', note: 'practical TLS' };
  const HPBN = { t: 'High Performance Browser Networking (free)', u: 'https://hpbn.co/', note: 'Grigorik' };
  const SA = { t: 'Computer Networks: A Systems Approach (free)', u: 'https://book.systemsapproach.org/', note: 'Peterson & Davie' };

  const LESSONS = [

    {
      id: 'tls13',
      track: 'deep',
      title: 'TLS 1.3 inside the handshake',
      subtitle: 'Key schedule, 0-RTT and what 1.3 actually removed',
      scenario: 'home',
      level: 5,
      minutes: 7,
      goals: ['HKDF key schedule', 'why RSA key exchange died', '0-RTT and its replay risk', 'resumption and PSK'],
      refs: [RFC8446, BULLET, HPBN],
      steps: [
        {
          title: 'One round trip, two messages',
          sub: 'ClientHello carries the key share',
          focus: ['pc', 'web'],
          what: 'In TLS 1.3 the client guesses the key exchange group and sends its ephemeral key share inside ClientHello. The server replies with its own share in ServerHello, and both can compute the handshake secret immediately — one round trip, and everything after ServerHello is encrypted, including the certificate.',
          why: 'TLS 1.2 needed two round trips and sent the certificate in the clear. Collapsing the exchange removed both a round trip and a metadata leak: with 1.3, a passive observer cannot even see which certificate a server presented.',
          analogy: 'Two people each shouting half of a colour-mixing recipe at the same time, instead of taking turns.',
          terms: [
            { t: 'Key share', d: 'The client\'s ephemeral Diffie-Hellman public value, sent in ClientHello so no extra round trip is needed.' },
            { t: 'Encrypted Extensions', d: 'In 1.3, almost every ServerHello extension is encrypted — SNI stays in the clear only because the server needs it to pick a certificate.' },
          ],
          packets: [
            { s: 'pc', d: 'web', proto: 'TLS', app: 'tls', t: 0.024, sport: 52344, dport: 443, info: 'ClientHello · TLS 1.3, key_share x25519, 17 suites, SNI in the clear', tls: { handshakeType: 1, cipherCount: 17 } },
            { s: 'web', d: 'pc', proto: 'TLS', app: 'tls', t: 0.036, sport: 443, dport: 52344, info: 'ServerHello + key_share · handshake secret computable now', tls: { handshakeType: 2 } },
          ],
        },
        {
          title: 'The key schedule',
          sub: 'HKDF-Expand-Label, four secrets, one transcript',
          focus: ['pc', 'web'],
          what: 'Handshake messages feed a running transcript hash. From the shared ECDHE secret and that transcript, HKDF derives the early secret, handshake secret and master secret; each in turn derives write keys with an explicit label such as "c ap traffic". Because the transcript is an input, tampering with any handshake byte produces different keys and the peers cannot talk.',
          why: 'Separate keys per direction per epoch means a compromise or nonce reuse in one phase cannot expose another. It also gives forward secrecy for free: the master secret depends on ephemeral keys that are then discarded.',
          analogy: 'A recipe where each course is cooked from the previous one plus a random ingredient, so no single leaked ingredient recreates the meal.',
          terms: [
            { t: 'HKDF', d: 'HMAC-based key derivation: extract then expand. TLS 1.3 uses it with an explicit label and context for every key.' },
            { t: 'Transcript hash', d: 'A running hash of every handshake message so far; binding keys to the exact conversation prevents tampering.' },
            { t: 'Forward secrecy', d: 'Old sessions stay secret even if the server\'s long-term key is later stolen.' },
          ],
          card: {
            title: 'The four secrets (RFC 8446 §7.1)',
            cols: ['Secret', 'Derived from', 'Protects'],
            rows: [
              ['Early secret', 'PSK or 0', '0-RTT data'],
              ['Handshake secret', 'ECDHE + transcript', 'EncryptedExtensions → Finished'],
              ['Master secret', 'handshake secret', 'application data keys'],
              ['Resumption secret', 'master secret', 'PSKs for the next connection'],
            ],
            note: 'Each direction gets its own keys ("c ap traffic", "s ap traffic"), so a nonce collision in one direction cannot break the other.',
          },
          packets: [
            { s: 'pc', d: 'web', proto: 'TLS', app: 'tls', t: 0.05, info: 'EncryptedExtensions + Certificate + CertificateVerify + Finished', tls: { handshakeType: 20, length: 380 }, note: 'all encrypted: an observer sees only opaque records' },
            { s: 'web', d: 'pc', proto: 'TLS', app: 'tls', t: 0.051, sport: 443, dport: 52344, info: 'Client Finished · transcript verified, application keys in use', tls: { handshakeType: 20, length: 52 } },
          ],
        },
        {
          title: 'What 1.3 deleted, and why',
          sub: 'CBC, RC4, RSA key exchange, renegotiation',
          focus: ['pc', 'web'],
          what: 'TLS 1.3 removed static RSA key exchange, all CBC-mode ciphers, RC4, SHA-1, compression, renegotiation and the separate ChangeCipherSpec dance. What survives is five cipher suites, all of them AEAD with an ephemeral key exchange.',
          why: 'Static RSA key exchange encrypted the session key with the server\'s permanent public key — so anyone who recorded traffic and later stole that key could decrypt everything retroactively. Deleting it removed an entire class of breach impact, not just a weak algorithm.',
          analogy: 'Throwing out every lock that could be opened later with a copy of one master key.',
          terms: [
            { t: 'AEAD', d: 'Authenticated encryption with associated data: AES-GCM or ChaCha20-Poly1305. Tampering is detected, not just hidden.' },
            { t: 'Downgrade protection', d: 'The ServerHello random and transcript hash pin the negotiated version, so an attacker cannot force a weaker protocol without detection.' },
          ],
          card: {
            title: 'TLS 1.2 versus 1.3',
            cols: ['', 'TLS 1.2', 'TLS 1.3'],
            rows: [
              ['Handshake round trips', '2 (1 with resumption)', '1 (0 with 0-RTT)'],
              ['Certificate sent', 'in clear', 'encrypted'],
              ['Key exchange', 'RSA or (EC)DHE', 'ephemeral only'],
              ['Cipher suites', 'many, incl. broken', '5, all AEAD'],
              ['Renegotiation', 'allowed', 'gone (post-handshake auth instead)'],
            ],
            note: 'If a capture shows CBC or RSA key exchange, the client is old or something is intercepting.',
          },
          packets: [],
        },
        {
          title: 'Resumption and 0-RTT',
          sub: 'The PSK, and the replay problem it creates',
          focus: ['pc', 'web'],
          what: 'The server can hand out a session ticket bound to a PSK. On the next connection the client sends a pre_shared_key with early data — 0-RTT — so it can transmit an HTTP request before the handshake finishes. The server must accept that request knowing it is replayable: an observer can capture and resend it.',
          why: 'This is the cleanest example of a security-versus-latency trade-off in modern networking. 0-RTT is therefore restricted to idempotent requests, and servers often reject it for state-changing endpoints.',
          analogy: 'Posting a letter before confirming the recipient is home — they will get it, but someone could post the same letter twice.',
          terms: [
            { t: 'PSK', d: 'Pre-shared key: the resumption secret from a previous handshake, identified by a ticket.' },
            { t: '0-RTT', d: 'Early data sent with the first flight. Saves a round trip, and is replayable by design.' },
            { t: 'Anti-replay window', d: 'A server-side record of seen tickets; only effective across instances that share state.' },
          ],
          packets: [
            { s: 'pc', d: 'web', proto: 'TCP', app: 'tcpData', t: 0.0, sport: 52344, dport: 443, info: 'SYN · second visit to the same server', tcp: { flags: 'SYN', seq: 0 } },
            { s: 'web', d: 'pc', proto: 'TCP', app: 'tcpData', t: 0.012, sport: 443, dport: 52344, info: 'SYN-ACK', tcp: { flags: 'SYN, ACK', seq: 0, ack: 1 } },
            { s: 'pc', d: 'web', proto: 'TLS', app: 'tls', t: 0.013, info: 'ClientHello + PSK + early data · GET already sent (0-RTT)', tls: { handshakeType: 1 }, note: 'the request left before the server confirmed the session' },
            { s: 'web', d: 'pc', proto: 'TLS', app: 'tls', t: 0.026, sport: 443, dport: 52344, info: 'ServerHello · PSK accepted, response follows immediately', tls: { handshakeType: 2 } },
          ],
        },
      ],
      quiz: [
        {
          q: 'Why did TLS 1.3 remove static RSA key exchange?',
          opts: ['It was too slow to compute', 'Anyone who recorded traffic and later obtained the private key could decrypt it retroactively', 'It used too much bandwidth', 'It conflicted with certificate chains'],
          a: 1,
          why: 'Static RSA wrapped the session key in the server\'s permanent key. Without forward secrecy, a later key compromise decrypts years of recorded sessions. Ephemeral (EC)DHE removes that whole class of impact.',
        },
        {
          q: 'What is the inherent risk of 0-RTT data?',
          opts: ['It is unencrypted', 'It is replayable — an attacker can resend the captured early data', 'It disables forward secrecy forever', 'It cannot use certificates'],
          a: 1,
          why: 'Early data must be accepted before the handshake is authenticated, so it cannot be proven fresh. Servers restrict it to safe, idempotent requests.',
        },
      ],
    },

    {
      id: 'quic',
      track: 'deep',
      title: 'QUIC and HTTP/3',
      subtitle: 'TCP\'s job, rebuilt on top of UDP',
      scenario: 'home',
      level: 5,
      minutes: 7,
      goals: ['streams without head-of-line blocking', 'connection IDs and migration', 'why middleboxes matter'],
      refs: [{ t: 'RFC 9000 — QUIC transport', u: 'https://datatracker.ietf.org/doc/html/rfc9000', note: 'the spec' }, { t: 'RFC 9114 — HTTP/3', u: 'https://datatracker.ietf.org/doc/html/rfc9114', note: 'the mapping' }, HPBN],
      steps: [
        {
          title: 'Everything TCP does, in userspace',
          sub: 'Over UDP, on port 443',
          focus: ['pc', 'web'],
          what: 'QUIC implements streams, acknowledgements, retransmission, congestion control and flow control itself, and carries TLS 1.3 inside its own handshake. To the network it is just UDP datagrams on port 443; to the application it is a reliable, multiplexed, encrypted transport.',
          why: 'Because QUIC runs in userspace rather than the kernel, browsers and CDNs can ship improvements without waiting for operating-system releases. And because it owns both layers, the transport handshake and the crypto handshake happen together — one round trip, not two.',
          analogy: 'Instead of asking the postal service to invent a new delivery standard, you build your own courier service that uses ordinary parcels.',
          terms: [
            { t: 'Stream', d: 'An independent ordered byte sequence inside one QUIC connection; losing a packet on one stream does not block the others.' },
            { t: 'Connection ID', d: 'A QUIC-level identifier that survives changing IP address or port — the basis of migration.' },
          ],
          packets: [
            { s: 'pc', d: 'web', proto: 'QUIC', app: 'quic', t: 0.0, sport: 52344, dport: 443, info: 'Initial · DCID abc1… · CRYPTO frame with ClientHello inside', pay: { label: 'QUIC Initial', len: 1180 }, note: 'transport and TLS handshake travel in the same flight' },
            { s: 'web', d: 'pc', proto: 'QUIC', app: 'quic', t: 0.014, sport: 443, dport: 52344, info: 'Initial + Handshake · 1-RTT keys established, server cert (encrypted)', pay: { label: 'QUIC Handshake', len: 1400 } },
          ],
        },
        {
          title: 'The head-of-line problem it solves',
          sub: 'One lost packet blocks one stream, not all of them',
          focus: ['pc', 'web'],
          what: 'TCP delivers one ordered byte stream, so a lost segment stalls every response multiplexed behind it. QUIC numbers packets and streams separately: a gap on stream 4 only delays stream 4. Streams 6 and 8 keep delivering.',
          why: 'HTTP/2 solved the application-level queueing of HTTP/1.1 but inherited TCP\'s queueing. That is why HTTP/3 exists: the multiplexing is only as good as the transport underneath it.',
          analogy: 'One blocked road versus four separate roads: a jam on one no longer stops the other three.',
          terms: [
            { t: 'Head-of-line blocking', d: 'One missing piece stalling everything queued behind it — at the transport (TCP) or application (HTTP/1.1) layer.' },
            { t: 'QPACK', d: 'HTTP/3\'s header compression; a re-design of HPACK because streams can arrive out of order.' },
          ],
          packets: [
            { s: 'web', d: 'pc', proto: 'QUIC', app: 'quic', t: 0.05, sport: 443, dport: 52344, info: 'STREAM id=4 offset=2048 · delivered, other streams unaffected', pay: { label: 'STREAM 4', len: 1200 } },
            { s: 'web', d: 'pc', proto: 'QUIC', app: 'quic', t: 0.051, sport: 443, dport: 52344, info: 'Packet 118 lost · only stream 4 waits for the retransmission', pay: { label: 'STREAM 6 (ok)', len: 1200 }, note: 'compare with TCP: this gap would have stalled every stream' },
            { s: 'web', d: 'pc', proto: 'QUIC', app: 'quic', t: 0.07, sport: 443, dport: 52344, info: 'Retransmission of packet 118 · stream 4 resumes', pay: { label: 'STREAM 4 (again)', len: 1200 } },
          ],
        },
        {
          title: 'Migration: changing address mid-session',
          sub: 'Your phone moves from Wi-Fi to cellular',
          focus: ['pc', 'web'],
          what: 'When your phone leaves Wi-Fi for 4G, its IP address changes. A TCP connection would break — the four-tuple no longer matches. QUIC identifies the connection by connection ID, so the same session continues on the new path, re-validating it with a PATH_CHALLENGE.',
          why: 'This is why a video call or download survives the walk out of your front door. It is also why QUIC is preferred for mobile: path changes are normal, not exceptional.',
          analogy: 'Being reachable by a personal number rather than a desk extension.',
          terms: [
            { t: 'Connection migration', d: 'Continuing a QUIC session over a new four-tuple, validated with a path challenge and response.' },
            { t: 'Path validation', d: 'Proving the new address belongs to the peer before sending real data to it, which prevents traffic redirection attacks.' },
          ],
          packets: [
            { s: 'pc', d: 'web', proto: 'QUIC', app: 'quic', t: 0.0, sport: 52344, dport: 443, info: 'On Wi-Fi · source 192.168.1.10', pay: { label: 'STREAM data', len: 1200 } },
            { s: 'pc', d: 'web', proto: 'QUIC', app: 'quic', t: 2.4, sip: '100.64.12.77', sport: 51000, dport: 443, info: 'Now on cellular · new source address, same connection ID', pay: { label: 'PATH_CHALLENGE + data', len: 900 }, note: 'a TCP connection would have failed here' },
            { s: 'web', d: 'pc', proto: 'QUIC', app: 'quic', t: 2.42, dip: '100.64.12.77', sport: 443, dport: 51000, info: 'PATH_RESPONSE · session continues on the new path', pay: { label: 'PATH_RESPONSE', len: 40 } },
          ],
        },
        {
          title: 'Why some networks hate it',
          sub: 'UDP 443 is now a protocol nobody can inspect',
          focus: ['web', 'pc'],
          what: 'To a firewall, QUIC is UDP on 443. Some networks block UDP broadly or rate-limit it; some middleboxes also break QUIC by rewriting connection IDs. Clients therefore implement fallback: they attempt HTTP/3 and, if it fails, quietly retry over HTTP/2 on TCP.',
          why: 'Encrypting more of the transport moves functionality out of the network\'s reach — good for privacy, awkward for operators who relied on inspecting TCP headers. The deployment answer is measurement and fallback rather than argument.',
          analogy: 'A courier that refuses to describe its parcels at the checkpoint. Faster, and the checkpoint has to trust it.',
          terms: [
            { t: 'Fallback', d: 'Retrying over TCP if QUIC is blocked or too slow; every HTTP/3 implementation has one.' },
            { t: 'Alt-Svc', d: 'The HTTP header (or DNS HTTPS record) announcing "this origin is also reachable over HTTP/3".' },
          ],
          packets: [
            { s: 'pc', d: 'web', proto: 'QUIC', app: 'quic', t: 0.0, sport: 52344, dport: 443, info: 'QUIC Initial · no response from a UDP-blocking network', pay: { label: 'Initial', len: 1180 }, dropped: true, note: 'silent drop: the path filters UDP' },
            { s: 'pc', d: 'web', proto: 'TCP', app: 'tcpData', t: 0.3, sport: 52345, dport: 443, info: 'Fallback to TCP 443 · HTTP/2 handshake begins', tcp: { flags: 'SYN', seq: 0 } },
          ],
        },
      ],
      quiz: [
        {
          q: 'What problem does QUIC solve that HTTP/2 could not?',
          opts: ['TLS encryption', 'Transport-level head-of-line blocking: TCP still stalled every stream on one lost segment', 'DNS resolution', 'Congestion control entirely'],
          a: 1,
          why: 'HTTP/2 multiplexes streams but still rides one ordered TCP stream. QUIC numbers streams independently, so a loss only delays the stream it belongs to.',
        },
      ],
    },

    {
      id: 'http2',
      track: 'deep',
      title: 'HTTP/2: multiplexing and its limits',
      subtitle: 'Binary framing, HPACK, and where it still queues',
      scenario: 'dc',
      level: 4,
      minutes: 5,
      goals: ['frames and streams', 'HPACK header compression', 'flow control per stream and connection'],
      refs: [{ t: 'RFC 9113 — HTTP/2', u: 'https://datatracker.ietf.org/doc/html/rfc9113', note: 'framing and streams' }, HPBN, SA],
      steps: [
        {
          title: 'One connection, many streams',
          sub: 'Frames instead of text',
          focus: ['pc', 'lb'],
          what: 'HTTP/2 breaks every message into frames (HEADERS, DATA, SETTINGS, RST_STREAM, WINDOW_UPDATE) each tagged with a stream id. Dozens of requests can be in flight on one TCP connection at once, and responses can interleave.',
          why: 'HTTP/1.1 needed six connections per host to avoid one slow response blocking the others — each costing a handshake and its own congestion window. One multiplexed connection removes that overhead entirely.',
          analogy: 'A single phone line carrying several simultaneous conversations, each tagged by topic, instead of six separate phone lines.',
          terms: [
            { t: 'Frame', d: 'The unit of HTTP/2: a 9-byte header with length, type, flags and a 31-bit stream id, plus payload.' },
            { t: 'Stream', d: 'An independent request/response exchange inside the connection; odd ids are client-initiated.' },
          ],
          packets: [
            { s: 'pc', d: 'lb', proto: 'TCP', app: 'tcpData', t: 0.0, sport: 52344, dport: 443, info: 'HEADERS stream 1 (GET /) + HEADERS stream 3 (GET /app.css) + HEADERS stream 5 (GET /app.js)', tcp: { flags: 'PSH, ACK', seq: 1 }, pay: { label: 'HTTP/2 frames', len: 640 } },
            { s: 'lb', d: 'pc', proto: 'TCP', app: 'tcpData', t: 0.02, sport: 443, dport: 52344, info: 'DATA stream 3 (css, small) then DATA stream 1 — out of request order', tcp: { flags: 'PSH, ACK', seq: 1, ack: 641 }, pay: { label: 'DATA ×2', len: 1460 } },
          ],
        },
        {
          title: 'HPACK: headers without repeating yourself',
          sub: 'A dynamic table shared by both ends',
          focus: ['pc', 'lb'],
          what: 'Headers repeat constantly — cookies, user-agent, accept. HPACK keeps an indexed static table plus a dynamic table that both sides update in lockstep, so the second request for /app.js can send a handful of bytes instead of a 700-byte header block.',
          why: 'Without compression, HTTP/2\'s framing overhead would outweigh its wins on small requests. HPACK is also why HTTP/2 servers are more sensitive to header size limits — decompression bombs and table-size mismatches are real attack surfaces (CRIME was the TLS-level version of the same idea).',
          analogy: 'Two people agreeing shorthand codes for the phrases they repeat most.',
          terms: [
            { t: 'HPACK', d: 'Header compression with a static table, a dynamic table and Huffman coding.' },
            { t: 'QPACK', d: 'HTTP/3\'s version, redesigned because streams can arrive out of order over QUIC.' },
          ],
          card: {
            title: 'What a header block costs',
            cols: ['Header', 'HTTP/1.1', 'HTTP/2 (HPACK)'],
            rows: [
              [':method GET', 'part of request line', '1 byte, static index 2'],
              ['accept-encoding: gzip, deflate, br', '31 bytes', '2 bytes, static index 16'],
              ['cookie: session=…', 'often 500+ bytes', 'first request full, then 1–3 bytes'],
              ['user-agent (long)', '100+ bytes', 'first request full, then indexed'],
            ],
            note: 'The win is in the repeats: a page with 80 requests sends most headers once.',
          },
          packets: [
            { s: 'pc', d: 'lb', proto: 'TCP', app: 'tcpData', t: 0.03, info: 'HEADERS stream 7 · indexed fields only, 34 bytes', tcp: { flags: 'PSH, ACK', seq: 2101, ack: 1461 }, pay: { label: 'HEADERS (HPACK)', len: 34 }, note: 'all the repetition is now an index, not text' },
          ],
        },
        {
          title: 'Flow control you have to manage',
          sub: 'Both per stream and per connection',
          focus: ['lb', 'pc'],
          what: 'HTTP/2 has its own flow control on top of TCP\'s: each stream and the whole connection has a window, replenished with WINDOW_UPDATE frames. A client that reads slowly or an app that forgets to send window updates can stall one stream — or the entire connection.',
          why: 'Double buffering means a bug in either layer shows up as "the site hangs, but only sometimes". This is a common cause of 504s behind a proxy whose HTTP/2 window is smaller than the response.',
          analogy: 'A conveyor belt with a second, narrower belt feeding it — either one can become the bottleneck.',
          terms: [
            { t: 'WINDOW_UPDATE', d: 'A frame granting the peer more allowance for a stream or the connection.' },
            { t: 'SETTINGS_INITIAL_WINDOW_SIZE', d: 'The starting per-stream window, default 65,535 bytes; too small for large responses.' },
          ],
          packets: [
            { s: 'lb', d: 'pc', proto: 'TCP', app: 'tcpData', t: 0.05, info: 'DATA stream 1 · blocked at the stream window (65,535 bytes)', tcp: { flags: 'PSH, ACK', seq: 1461 }, pay: { label: 'DATA (stream 1)', len: 1460 }, note: 'waiting for a WINDOW_UPDATE that never comes' },
            { s: 'pc', d: 'lb', proto: 'TCP', app: 'tcpData', t: 0.9, info: 'WINDOW_UPDATE stream 1 +0 · the classic stall', tcp: { flags: 'PSH, ACK', seq: 3001 }, pay: { label: 'WINDOW_UPDATE', len: 13 }, note: 'a zero increment means the sender cannot continue' },
          ],
        },
        {
          title: 'Where HTTP/2 still queues',
          sub: 'One TCP connection is also one point of failure',
          focus: ['pc', 'lb'],
          what: 'All those streams share one TCP connection, so one lost segment blocks delivery of every stream until it is retransmitted. On a lossy mobile link, HTTP/2 can therefore be slower than the six-connection HTTP/1.1 it replaced.',
          why: 'This single flaw is the reason HTTP/3 exists. It is also why "enable HTTP/2" is not universally a win: on a clean path it is a large improvement; on a lossy one it can be a regression.',
          analogy: 'One shared delivery van: efficient until it gets a flat tyre, at which point every parcel waits.',
          terms: [{ t: 'Head-of-line blocking (TCP)', d: 'The transport\'s own ordering requirement stalling upper-layer streams.' }],
          card: {
            title: 'Latency profile by protocol',
            cols: ['Path', 'HTTP/1.1 (6 conns)', 'HTTP/2 (1 conn)', 'HTTP/3'],
            rows: [
              ['clean, 20 ms', 'good', 'best', 'best'],
              ['clean, 150 ms', 'handshake ×6', 'best', 'best'],
              ['1% loss, 20 ms', 'ok', 'worse', 'best'],
              ['2% loss, 150 ms', 'ok', 'much worse', 'good'],
            ],
            note: 'Loss, not bandwidth, is what reorders this table.',
          },
          packets: [
            { s: 'lb', d: 'pc', proto: 'TCP', app: 'tcpData', t: 0.0, info: 'Segment lost · every stream now waits', tcp: { flags: 'PSH, ACK', seq: 2921 }, dropped: true, note: 'streams 1, 3 and 5 are all blocked behind this one gap' },
            { s: 'pc', d: 'lb', proto: 'TCP', app: 'tcpData', t: 0.05, info: 'ACK stalls at the gap · nothing new is delivered for 200 ms', tcp: { flags: 'ACK', seq: 3001, ack: 2921 } },
          ],
        },
      ],
      quiz: [
        {
          q: 'Why can HTTP/2 be slower than HTTP/1.1 on a lossy mobile link?',
          opts: ['HPACK is slow', 'All streams share one TCP connection, so a single lost segment blocks every stream', 'HTTP/2 requires more round trips', 'It cannot use TLS'],
          a: 1,
          why: 'Multiplexing rides on a single ordered byte stream. One loss stalls delivery to all streams — the problem HTTP/3 solves by moving reliability above the stream layer.',
        },
      ],
    },

    {
      id: 'dnssec',
      track: 'deep',
      title: 'DNSSEC, DoH and DNS attacks',
      subtitle: 'Proving an answer is real',
      scenario: 'home',
      level: 5,
      minutes: 7,
      goals: ['cache poisoning and Kaminsky', 'RRSIG, DNSKEY and the DS chain', 'DoT/DoH differences'],
      refs: [{ t: 'RFC 4033-4035 — DNSSEC', u: 'https://datatracker.ietf.org/doc/html/rfc4033', note: 'the architecture' }, { t: 'RFC 8484 — DNS over HTTPS', u: 'https://datatracker.ietf.org/doc/html/rfc8484', note: 'DoH' }, SA],
      steps: [
        {
          title: 'The original DNS had no authentication',
          sub: 'Any packet that matches the ID wins',
          focus: ['pc', 'dns'],
          what: 'A classic DNS resolver accepts the first response that matches the query ID (16 bits) and source port. An off-path attacker who guesses both can inject a forged answer, and the resolver caches it. Kaminsky\'s 2008 attack made this practical at scale by forcing the resolver to make many fresh queries.',
          why: 'DNS is the single point where a name becomes an address — poisoning it lets an attacker redirect, intercept or block any name. This is why source-port randomisation, 0x20 encoding and eventually DNSSEC all exist.',
          analogy: 'A phone book anyone can mail corrections to, and the directory believes whoever answers first.',
          terms: [
            { t: 'Cache poisoning', d: 'Injecting a forged record into a resolver so every client behind it gets the wrong address.' },
            { t: '0x20 encoding', d: 'Randomising the case of letters in the query name, so the reply must echo the exact case — extra entropy against blind spoofing.' },
            { t: 'Source-port randomisation', d: 'Turning a 16-bit ID into roughly 32 bits of guessing difficulty with a random port.' },
          ],
          packets: [
            { s: 'pc', d: 'dns', proto: 'DNS', app: 'dnsq', t: 0.0, sport: 51000, dport: 53, info: 'query A bank.example · ID 0x1a2b', dns: { name: 'bank.example', qtype: 'A', id: 0x1a2b } },
            { s: 'pc', d: 'dns', proto: 'DNS', app: 'dnsr', t: 0.001, sip: '198.51.100.66', info: 'FORGED reply: A 198.51.100.66 · no signature', dns: { name: 'bank.example', qtype: 'A', id: 0x1a2b, answers: [{ type: 'A', ttl: 86400, rdata: '198.51.100.66' }] }, note: 'a resolver cannot tell this from the real answer unless the zone is signed' },
          ],
        },
        {
          title: 'Signing the zone',
          sub: 'RRSIG and DNSKEY',
          focus: ['dns', 'auth'],
          what: 'With DNSSEC the zone signs every record set. The answer arrives with an RRSIG (a signature over the records, with validity dates) and the DNSKEY that verifies it. A validating resolver checks the signature before caching or returning anything.',
          why: 'This gives integrity and authenticity, not confidentiality: anyone can still read the answer, but nobody can change it. DNSSEC answers "is this record really from the zone?", not "who is asking?".',
          analogy: 'A wax seal on a public notice: everyone can read it, nobody can alter it unnoticed.',
          terms: [
            { t: 'RRSIG', d: 'The signature record covering one record set, including an inception and expiration time.' },
            { t: 'DNSKEY', d: 'The zone\'s public key. Its own hash is published by the parent as a DS record.' },
            { t: 'Validation', d: 'A resolver verifying signatures up the chain; a failure means the data is provably modified — which is why DNSSEC failures cause hard SERVFAILs.' },
          ],
          packets: [
            { s: 'pc', d: 'dns', proto: 'DNS', app: 'dnsq', t: 0.0, sport: 51000, dport: 53, info: 'query A bank.example with DO bit (DNSSEC OK)', dns: { name: 'bank.example', qtype: 'A', id: 0x1a2c } },
            { s: 'dns', d: 'pc', proto: 'DNS', app: 'dnsr', t: 0.012, sport: 53, dport: 51000, info: 'Answer + RRSIG · signature verified up the chain', dns: { name: 'bank.example', qtype: 'A', id: 0x1a2c, answers: [{ type: 'A', ttl: 300, rdata: '203.0.113.10' }] } },
          ],
        },
        {
          title: 'The chain: DS records and trust anchors',
          sub: 'Signed from the root down',
          focus: ['root', 'tld', 'auth'],
          what: 'The root zone is signed and its key is a trust anchor built into validating resolvers. The root publishes a DS record — a hash of the .com DNSKEY — so the chain continues: root → .com → example.com → bank.example. Break any link and the answer is provably unverifiable.',
          why: 'This is the same chain-of-trust idea as X.509 certificates, without a live CA system: everything is published in DNS itself. The cost is why adoption is partial — signing, key rollover and the hard-fail behaviour are operationally demanding.',
          analogy: 'A notarised signature that is itself notarised, up to an office everyone already trusts.',
          terms: [
            { t: 'DS record', d: 'Delegation Signer: a digest of the child zone\'s DNSKEY, published in the parent.' },
            { t: 'Trust anchor', d: 'A key a validator takes as true without proof — for DNSSEC, the root KSK.' },
            { t: 'NSEC3', d: 'Signed denial of existence that avoids listing every name in the zone ("zone walking").' },
          ],
          card: {
            title: 'A validating chain',
            cols: ['Zone', 'Provides', 'Verified by'],
            rows: [
              ['. (root)', 'DNSKEY + DS for com', 'trust anchor in the resolver'],
              ['com', 'DS for example.com', 'root DNSKEY'],
              ['example.com', 'DS for bank.example', 'com DNSKEY'],
              ['bank.example', 'A + RRSIG', 'example.com DNSKEY'],
            ],
            note: 'A missing or expired signature anywhere in this column turns into SERVFAIL — deliberately, because failing open would make DNSSEC pointless.',
          },
          packets: [
            { s: 'root', d: 'dns', proto: 'DNS', app: 'dnsr', t: 0.02, sport: 53, dport: 33011, info: 'Referral + DS(com) + RRSIG, signed by the root KSK', dns: { name: 'com', qtype: 'A', id: 0x1a2d, answers: [{ type: 'A', ttl: 172800, rdata: '192.5.6.30' }] } },
            { s: 'auth', d: 'dns', proto: 'DNS', app: 'dnsr', t: 0.03, sport: 53, dport: 33012, info: 'A bank.example + RRSIG · chain complete', dns: { name: 'bank.example', qtype: 'A', id: 0x1a2e, answers: [{ type: 'A', ttl: 300, rdata: '203.0.113.10' }] } },
          ],
        },
        {
          title: 'DoT and DoH: hiding the question',
          sub: 'Confidentiality is the other half',
          focus: ['pc', 'dns'],
          what: 'DNSSEC protects answers, but plain DNS still exposes every name you look up. DNS over TLS (port 853) wraps queries in TLS; DNS over HTTPS (RFC 8484) sends them as HTTPS requests, indistinguishable from ordinary web traffic on port 443.',
          why: 'DoH is better for privacy and worse for network operators: a corporate or school resolver can no longer see or filter by name. That is the entire public argument about it, and both sides are describing the same property.',
          analogy: 'Sealed envelopes instead of postcards. Good for you, inconvenient for the mailroom that used to read them.',
          terms: [
            { t: 'DoT', d: 'DNS over TLS on port 853. Encrypted, but on a dedicated port that is trivial to block or identify.' },
            { t: 'DoH', d: 'DNS over HTTPS on 443, blended with web traffic. Hard to block without blocking the resolver\'s whole domain.' },
            { t: 'Oblivious DoH', d: 'Splitting client identity from query content across two parties so neither sees both.' },
          ],
          packets: [
            { s: 'pc', d: 'dns', proto: 'TCP', app: 'tcpData', t: 0.0, sport: 52344, dport: 853, info: 'DoT · TLS to the resolver, then length-prefixed DNS inside', tcp: { flags: 'SYN', seq: 0 } },
            { s: 'pc', d: 'dns', proto: 'TLS', app: 'tls', t: 0.03, sport: 52344, dport: 853, info: 'TLS 1.3 session · ALPN "dot"', tls: { handshakeType: 1 } },
            { s: 'pc', d: 'dns', proto: 'TLS', app: 'tls', t: 0.05, sport: 52344, dport: 853, info: 'Application Data · encrypted DNS query', tls: { length: 96 }, note: 'a passive observer learns the resolver, not the name' },
          ],
        },
      ],
      quiz: [
        {
          q: 'DNSSEC gives you integrity and authenticity. What does it not give you?',
          opts: ['Proof the record came from the zone', 'Confidentiality — queries and answers are still readable', 'Protection against cache poisoning', 'A chain of trust from the root'],
          a: 1,
          why: 'DNSSEC signs records; it does not encrypt them. Confidentiality comes from DoT or DoH, which are a separate choice.',
        },
      ],
    },

    {
      id: 'wifi',
      track: 'deep',
      title: 'Wi-Fi: association and the 4-way handshake',
      subtitle: 'What "connected to Wi-Fi" actually takes',
      scenario: 'wifi',
      level: 4,
      minutes: 6,
      goals: ['scan, auth, associate', 'the WPA2 4-way handshake', 'why roaming drops packets'],
      refs: [{ t: 'IEEE 802.11 (Wi-Fi)', u: 'https://en.wikipedia.org/wiki/IEEE_802.11', note: 'the family of standards' }, { t: 'WPA2 4-way handshake explained', u: 'https://en.wikipedia.org/wiki/IEEE_802.11i-2004', note: '802.11i' }, SA],
      steps: [
        {
          title: 'Before you can send a packet',
          sub: 'Scan → authenticate → associate',
          focus: ['pc', 'ap'],
          what: 'The client scans channels for beacons, sends an authentication frame (open, even for WPA2), then an association request naming the SSID and its capabilities. Only after the association response does the AP consider the client a member of the BSS — and still no user traffic is allowed.',
          why: '802.11 is a shared medium with its own link-layer state machine, entirely separate from IP. A client can be "associated" and still have no IP address, no gateway and no internet — four independent stages that users experience as one word.',
          analogy: 'Getting into a building: find the address, show your face at reception, sign the visitor book — and then still wait for a badge that opens the doors.',
          terms: [
            { t: 'Beacon', d: 'A periodic frame the AP broadcasts advertising the SSID and capabilities.' },
            { t: 'Association', d: 'The link-layer registration that makes the client a member of the AP\'s basic service set.' },
            { t: 'BSSID', d: 'The AP\'s MAC address, identifying one specific radio rather than the network name (SSID).' },
          ],
          packets: [
            { s: 'pc', d: 'ap', proto: 'ARP', app: 'arp', t: 0.0, info: 'Probe request · looking for SSID "home-5G" (802.11 management)', arp: { op: 1, senderMac: 'a4:5e:60:1b:2c:3d', senderIp: '0.0.0.0', targetIp: '192.168.1.1' } },
            { s: 'ap', d: 'pc', proto: 'ARP', app: 'arp', t: 0.004, info: 'Probe response + capabilities (802.11 management)', arp: { op: 2, senderMac: 'b8:27:eb:4c:5d:6e', senderIp: '0.0.0.0', targetMac: 'a4:5e:60:1b:2c:3d', targetIp: '0.0.0.0' } },
          ],
        },
        {
          title: 'The four-way handshake',
          sub: 'Turning a passphrase into session keys',
          focus: ['pc', 'ap'],
          what: 'Both sides derive a pairwise master key from the passphrase and SSID. The AP then sends a random ANonce; the client replies with its SNonce plus a MIC proving it holds the PMK; the AP sends the group key and its own MIC; the client acknowledges. Afterwards, traffic is encrypted with fresh per-session keys.',
          why: 'The passphrase is never sent. And because both nonces are fresh, an attacker who captures one handshake cannot decrypt another session. This is exactly why WPA2 can be cracked offline only by guessing the passphrase — the handshake gives you the material to test guesses, not the key.',
          analogy: 'Two people who share a secret word each pick a random number, then prove they know the word by mixing it with the numbers — without ever saying the word.',
          terms: [
            { t: 'PMK / PTK', d: 'The pairwise master key from the passphrase, and the per-session pairwise transient key actually used for encryption.' },
            { t: 'ANonce / SNonce', d: 'Fresh random values from the authenticator and the supplicant; together they guarantee a unique session key.' },
            { t: 'MIC', d: 'Message Integrity Code — proof that the sender holds the PMK, without revealing it.' },
          ],
          packets: [
            { s: 'ap', d: 'pc', proto: 'ARP', app: 'arp', t: 0.02, info: 'EAPOL msg 1/4 · ANonce', arp: { op: 2, senderMac: 'b8:27:eb:4c:5d:6e', senderIp: '0.0.0.0', targetMac: 'a4:5e:60:1b:2c:3d', targetIp: '0.0.0.0' } },
            { s: 'pc', d: 'ap', proto: 'ARP', app: 'arp', t: 0.024, info: 'EAPOL msg 2/4 · SNonce + MIC', arp: { op: 1, senderMac: 'a4:5e:60:1b:2c:3d', senderIp: '0.0.0.0', targetIp: '192.168.1.1' } },
            { s: 'ap', d: 'pc', proto: 'ARP', app: 'arp', t: 0.028, info: 'EAPOL msg 3/4 · install keys + GTK', arp: { op: 2, senderMac: 'b8:27:eb:4c:5d:6e', senderIp: '0.0.0.0', targetMac: 'a4:5e:60:1b:2c:3d', targetIp: '0.0.0.0' } },
            { s: 'pc', d: 'ap', proto: 'ARP', app: 'arp', t: 0.030, info: 'EAPOL msg 4/4 · ACK, encrypted traffic begins', arp: { op: 1, senderMac: 'a4:5e:60:1b:2c:3d', senderIp: '0.0.0.0', targetIp: '192.168.1.1' } },
          ],
        },
        {
          title: 'Only now does IP begin',
          sub: 'DHCP over an encrypted link',
          focus: ['pc', 'ap'],
          what: 'With the link encrypted, the client finally sends its DHCP DISCOVER — and every packet after this point is protected by the pairwise key. From here the story is the same as the wired lessons: DHCP, ARP, DNS, TCP, TLS.',
          why: 'Order matters when diagnosing: a client that cannot associate never sends DHCP, and a client with an address but no traffic may have failed the handshake. The layer where it stopped tells you which log to read.',
          analogy: 'The badge finally opens the doors, and only then does the receptionist tell you your desk number.',
          terms: [{ t: 'Layered failure domains', d: 'Radio → association → 802.1X/WPA → DHCP → DNS → routing. Each stage has its own symptoms and its own fix.' }],
          packets: [
            { s: 'pc', d: 'ap', proto: 'DHCP', app: 'dhcp', t: 0.05, sport: 68, dport: 67, dip: '255.255.255.255', info: 'DHCP Discover · first IP packet, now inside WPA2 encryption', dhcp: { msgType: 1, clientId: 'a4:5e:60:1b:2c:3d' } },
            { s: 'ap', d: 'pc', proto: 'DHCP', app: 'dhcp', t: 0.07, sport: 67, dport: 68, info: 'DHCP Offer 192.168.1.10', dhcp: { op: 'reply', msgType: 2, clientId: 'a4:5e:60:1b:2c:3d', yiaddr: '192.168.1.10', subnet: '255.255.255.0', router: '192.168.1.1', dns: '8.8.8.8', lease: 86400 } },
          ],
        },
        {
          title: 'Roaming: the invisible outage',
          sub: 'Why calls drop when you walk to the kitchen',
          focus: ['pc', 'ap'],
          what: 'Moving between access points means leaving one BSS and joining another. A full re-association plus a fresh WPA handshake takes hundreds of milliseconds, during which packets are lost. 802.11r (fast roaming) pre-authenticates with the new AP so the switch costs only a few frames.',
          why: 'Latency-sensitive applications feel the gap even when "the internet is fine". This is also why enterprise networks deploy more APs at lower power, and why roaming decisions belong to the client, not the network.',
          analogy: 'Handing over a phone call between two operators — seamless if they planned it, a click and a gap if they did not.',
          terms: [
            { t: '802.11r', d: 'Fast BSS Transition: pre-established keys so roaming does not require a full handshake.' },
            { t: 'Sticky client', d: 'A device that clings to a distant AP instead of roaming, producing terrible throughput while showing full bars.' },
          ],
          packets: [
            { s: 'pc', d: 'ap', proto: 'ARP', app: 'arp', t: 0.0, info: 'Deauth from AP-1 · signal too weak', arp: { op: 1, senderMac: 'a4:5e:60:1b:2c:3d', senderIp: '192.168.1.10', targetIp: '192.168.1.1' } },
            { s: 'pc', d: 'ap', proto: 'ARP', app: 'arp', t: 0.35, info: 'Re-association to AP-2 + 4-way handshake · ~300 ms of loss', arp: { op: 1, senderMac: 'a4:5e:60:1b:2c:3d', senderIp: '192.168.1.10', targetIp: '192.168.1.1' }, note: 'with 802.11r this gap shrinks to a few frames' },
          ],
        },
      ],
      quiz: [
        {
          q: 'A laptop shows "connected" with full bars but nothing loads. What is the most useful next question?',
          opts: ['Is the router on?', 'Did it get an IP address by DHCP, and can it reach the gateway?', 'Is the Wi-Fi password correct?', 'Which channel is it on?'],
          a: 1,
          why: '"Connected" only means associated. Association, the WPA handshake, DHCP, routing and DNS are separate stages — the address and gateway test locates which one failed.',
        },
      ],
    },

    {
      id: 'time',
      track: 'deep',
      title: 'Time: NTP and why clocks matter',
      subtitle: 'A networking problem hiding in every system',
      scenario: 'home',
      level: 4,
      minutes: 5,
      goals: ['how NTP estimates time', 'skew, drift and stratum', 'what breaks when clocks disagree'],
      refs: [{ t: 'RFC 5905 — NTPv4', u: 'https://datatracker.ietf.org/doc/html/rfc5905', note: 'the protocol and algorithms' }, { t: 'RFC 8633 — NTP best practice', u: 'https://datatracker.ietf.org/doc/html/rfc8633', note: 'BCP 223' }, SA],
      steps: [
        {
          title: 'You cannot measure a clock with one message',
          sub: 'Four timestamps, one estimate',
          focus: ['pc', 'dns'],
          what: 'NTP sends a request stamped t1, the server stamps t2 (receive) and t3 (send), and the client stamps t4 on arrival. The round trip is (t4−t1) − (t3−t2); the offset is estimated assuming the path is roughly symmetric. Multiple samples let the client reject outliers and converge.',
          why: 'The estimate is only as good as the assumption of symmetry. An asymmetric path (one direction slower) introduces a systematic error — which is why real NTP deployments use several servers and pick the best subset rather than trusting one.',
          analogy: 'Timing a phone call: you know the total elapsed time but not how the delay splits between you and them.',
          terms: [
            { t: 'Offset', d: 'The estimated difference between your clock and the server\'s.' },
            { t: 'Stratum', d: 'Distance from a reference clock: stratum 0 is the atomic source, stratum 1 is directly attached, and each hop adds one.' },
            { t: 'Slew vs step', d: 'Speeding or slowing the clock gradually (slew) versus jumping it (step). Systems slew to keep timestamps monotonic.' },
          ],
          card: {
            title: 'The four timestamps',
            cols: ['Stamp', 'Taken by', 'Meaning'],
            rows: [
              ['t1', 'client', 'request sent'],
              ['t2', 'server', 'request received'],
              ['t3', 'server', 'reply sent'],
              ['t4', 'client', 'reply received'],
            ],
            note: 'RTT = (t4−t1) − (t3−t2). Offset = ((t2−t1) + (t3−t4)) / 2.',
          },
          packets: [
            { s: 'pc', d: 'dns', proto: 'UDP', app: 'udpData', t: 0.0, sport: 123, dport: 123, info: 'NTP request · t1 = 0.000000', pay: { label: 'NTP client', len: 48 } },
            { s: 'dns', d: 'pc', proto: 'UDP', app: 'udpData', t: 0.024, sport: 123, dport: 123, info: 'NTP reply · t2/t3 server stamps, stratum 2', pay: { label: 'NTP server', len: 48 } },
          ],
        },
        {
          title: 'What actually breaks',
          sub: 'Silent, intermittent and very expensive',
          focus: ['pc', 'web'],
          what: 'A clock that is minutes out breaks certificate validity checks, Kerberos (which rejects tickets outside a five-minute window), OAuth token lifetimes, log correlation, and distributed databases that order writes by time. A clock that is seconds out breaks distributed tracing and makes cache expiry behave strangely.',
          why: 'Almost nothing reports "the clock is wrong". You get a TLS error, an authentication failure or a mysterious data inconsistency — which is why checking time is early in every good troubleshooting checklist.',
          analogy: 'A building where every clock disagrees: nobody notices until someone misses a deadline they thought they had.',
          terms: [
            { t: 'Clock skew', d: 'A constant offset between two clocks.' },
            { t: 'Clock drift', d: 'A rate difference, so skew grows over time — crystal oscillators typically drift tens of ppm, seconds per day.' },
            { t: 'Monotonic clock', d: 'A clock that never goes backwards, used for timeouts and measuring durations so a time step cannot break them.' },
          ],
          card: {
            title: 'Symptoms of a bad clock',
            cols: ['Symptom', 'Look at'],
            rows: [
              ['TLS certificate "not yet valid" or expired', 'local time vs cert dates'],
              ['Kerberos / AD login failures', 'skew > 5 minutes'],
              ['Tokens rejected immediately', 'issuer vs verifier clocks'],
              ['Logs out of order across hosts', 'NTP sync on every host'],
              ['Cache serving stale content', 'TTL comparisons'],
            ],
            note: 'Blocking outbound UDP 123 is a common, quiet cause of all of the above.',
          },
          packets: [
            { s: 'pc', d: 'web', proto: 'TLS', app: 'tls', t: 0.0, sport: 52344, dport: 443, info: 'Handshake aborted · certificate not valid at the local clock time', tls: { handshakeType: 11, length: 1180 }, dropped: true, note: 'the certificate is fine; the clock is three days behind' },
          ],
        },
        {
          title: 'Keeping time in a large estate',
          sub: 'TrueTime, PTP and the honest limits',
          focus: ['pc'],
          what: 'Public NTP gives you milliseconds. Precision Time Protocol (IEEE 1588) with hardware timestamping gives microseconds. Google\'s TrueTime goes further: it does not pretend to know the time exactly, it returns an interval and waits out the uncertainty before committing a transaction.',
          why: 'The engineering lesson generalises: when you cannot bound an error, design the system to be correct inside the bound rather than assuming the error is zero. That is why Spanner can offer external consistency while ordinary systems quietly reorder events.',
          analogy: 'Instead of claiming to know the exact time, you say "sometime in the next 7 milliseconds" and act accordingly.',
          terms: [
            { t: 'PTP', d: 'IEEE 1588: hardware-timestamped time sync, sub-microsecond on a LAN.' },
            { t: 'Uncertainty interval', d: 'TrueTime\'s explicit error bound, used to wait out ambiguity before ordering events.' },
            { t: 'Leap smear', d: 'Spreading a leap second over hours instead of inserting it, so software never sees 23:59:60.' },
          ],
          packets: [],
        },
      ],
      quiz: [
        {
          q: 'Users report TLS "certificate expired" errors on one machine while everyone else is fine. First thing to check?',
          opts: ['Renew the certificate', 'That machine\'s clock — it is probably wrong, not the certificate', 'The DNS records', 'The firewall'],
          a: 1,
          why: 'If one host and not others sees an expiry error, the certificate is fine and the local clock is wrong. Time is part of the trust chain.',
        },
      ],
    },
  ];

  root.PE_LESSONS_DEEP = LESSONS;
})(typeof window !== 'undefined' ? window : globalThis);
