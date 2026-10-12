// Room to Walk: "comments sent" counter.
// A tiny Cloudflare Worker (free plan is plenty). It stores one number in Workers KV.
//
// DEV NOTES
//   One namespace, a few keys:
//     count                 the number the page displays
//     plan:<id>             how many increments came from that comment form
//                           (seatp, stip, or unknown). Not shown on the page;
//                           useful when you open KV in the dashboard.
//     seen:<plan>:<YYYY-MM-DD>:<ip>
//                           dedupe marker. The day is UTC, from toISOString(),
//                           not Alaska time, and it is part of the key — so the
//                           next UTC date is a new key and can count again even
//                           while yesterday's marker still exists.
//                           expirationTtl is 36h: longer than the rest of the UTC
//                           day the key covers, then KV drops it on its own.
//   GET  is a read and never counts. POST counts at most once per visitor IP,
//   per plan, per UTC day. A second click, a refresh, or a replay of the same
//   POST returns the current count without adding. There is no decrement: the
//   page's "I sent it" toggle turning off does not call this Worker.
//   The plan id is truncated to 12 characters and is not authenticated. It only
//   picks the plan:<id> bucket. Anything other than the two form ids still
//   increments `count` the first time that IP/plan/day is seen.
//   CORS is wide open (ALLOWED_ORIGIN = '*') because the page is a static file
//   that may be opened from the public host or a preview. Tighten it to
//   https://mitchelturner.com once that is the only origin you care about.
//   count is a read-modify-write with no transaction. Two first-time POSTs at
//   the same moment can both read n and both write n+1. That is acceptable for
//   a public tally; do not treat the number as exact.
//
// Setup (about 5 minutes):
//   1. In the Cloudflare dashboard: Workers & Pages > Create > Worker. Paste this file and deploy.
//   2. Storage & Databases > KV > Create namespace, e.g. "rtw".
//   3. In the Worker's Settings > Bindings, add a KV binding named COUNTER pointing at that namespace.
//   4. Copy the Worker's URL (https://<name>.<you>.workers.dev) into the page:
//        <meta name="rtw-counter" content="https://<name>.<you>.workers.dev">
//      Or rebuild the export so that meta tag is filled in:
//        python3 build_export.py https://mitchelturner.com/room-to-walk/ https://<name>.<you>.workers.dev
//      The page hides the tally until the URL is set and the count is at least 1.
//
// GET  returns {"count": n}
// POST body {"plan":"seatp"|"stip"} adds one, subject to the dedupe above, and returns {"count": n}
const ALLOWED_ORIGIN = '*'; // set to 'https://mitchelturner.com' once the site is live

export default {
  async fetch(req, env) {
    const cors = {
      'access-control-allow-origin': ALLOWED_ORIGIN,
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type',
      'content-type': 'application/json',
    };
    // Preflight from the page's POST. No body, and don't touch KV.
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });

    // Missing key reads as 0. A non-numeric value becomes NaN and is returned as null.
    let count = parseInt((await env.COUNTER.get('count')) || '0', 10);

    if (req.method === 'POST') {
      // Bad JSON, a missing plan, or a non-object body all become "unknown"
      // and still count once. slice() keeps a hostile or accidental plan id
      // from creating an unbounded key.
      let plan = 'unknown';
      try { plan = String((await req.json()).plan || 'unknown').slice(0, 12); } catch (e) {}

      // cf-connecting-ip is set by Cloudflare's edge. Without it (local wrangler
      // without the header, or a non-CF host) every visitor shares "anon", so
      // the daily dedupe collapses to one increment per plan.
      const ip = req.headers.get('cf-connecting-ip') || 'anon';
      const day = new Date().toISOString().slice(0, 10); // UTC date
      const key = `seen:${plan}:${day}:${ip}`;

      // If the marker exists, skip the increment but still return the current
      // count so the page can refresh its label. Two first-time requests can
      // both pass this check; see the note above.
      if (!(await env.COUNTER.get(key))) {
        await env.COUNTER.put(key, '1', { expirationTtl: 60 * 60 * 36 }); // 36 hours
        count += 1;
        await env.COUNTER.put('count', String(count));
        const pk = `plan:${plan}`;
        await env.COUNTER.put(pk, String(parseInt((await env.COUNTER.get(pk)) || '0', 10) + 1));
      }
    }
    // GET, POST, and any other method all return the count. Other methods do not increment.
    return new Response(JSON.stringify({ count }), { headers: cors });
  },
};
