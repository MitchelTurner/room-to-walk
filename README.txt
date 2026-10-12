Room to Walk: self-hosted copy
================================
Upload the room-to-walk folder so it is served at https://mitchelturner.com/room-to-walk/
(if the address differs, rebuild or edit the canonical, og:url and sitemap entries in index.html).

Comments-sent counter (optional)
  1. Deploy counter-worker.js as a Cloudflare Worker (steps at the top of that file).
  2. In room-to-walk/index.html, put the Worker URL in:  <meta name="rtw-counter" content="https://...workers.dev">
  The counter stays hidden until the URL is set and at least one comment has been recorded.

Visitor stats (optional)
  Sign up at plausible.io for the domain, then add before </head>:
  <script defer data-domain="mitchelturner.com" src="https://plausible.io/js/script.js"></script>

Flyer: room-to-walk/room-to-walk-flyer.pdf (its QR code points to https://mitchelturner.com/room-to-walk/).

Developer notes
  index.html opens with an HTML comment: stop keys, the duplicated FAQ, deadlines,
  pin positions, and the counter meta tag. The script at the bottom has a longer
  block comment (localStorage keys, the pin editor, fullscreen) plus notes on the
  slider, map clustering, comment builder, and chart.
  counter-worker.js documents the KV keys, the once-per-IP-per-plan-per-UTC-day
  rule, and why the tally is not exact under two simultaneous first counts.
