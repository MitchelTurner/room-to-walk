// Room to Walk: "comments sent" counter.
// A tiny Cloudflare Worker (free plan is plenty). It stores one number in Workers KV.
//
// Setup (about 5 minutes):
//   1. In the Cloudflare dashboard: Workers & Pages > Create > Worker. Paste this file and deploy.
//   2. Storage & Databases > KV > Create namespace, e.g. "rtw".
//   3. In the Worker's Settings > Bindings, add a KV binding named COUNTER pointing at that namespace.
//   4. Copy the Worker's URL (https://<name>.<you>.workers.dev) and rebuild the site with it:
//        python3 build_export.py https://mitchelturner.com/room-to-walk/ https://<name>.<you>.workers.dev
//
// GET  returns {"count": n}
// POST adds one (at most once per visitor IP per plan per day) and returns {"count": n}
const ALLOWED_ORIGIN = '*'; // set to 'https://mitchelturner.com' once the site is live

export default {
  async fetch(req, env) {
    const cors = {
      'access-control-allow-origin': ALLOWED_ORIGIN,
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type',
      'content-type': 'application/json',
    };
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    let count = parseInt((await env.COUNTER.get('count')) || '0', 10);
    if (req.method === 'POST') {
      let plan = 'unknown';
      try { plan = String((await req.json()).plan || 'unknown').slice(0, 12); } catch (e) {}
      const ip = req.headers.get('cf-connecting-ip') || 'anon';
      const day = new Date().toISOString().slice(0, 10);
      const key = `seen:${plan}:${day}:${ip}`;
      if (!(await env.COUNTER.get(key))) {
        await env.COUNTER.put(key, '1', { expirationTtl: 60 * 60 * 36 });
        count += 1;
        await env.COUNTER.put('count', String(count));
        const pk = `plan:${plan}`;
        await env.COUNTER.put(pk, String(parseInt((await env.COUNTER.get(pk)) || '0', 10) + 1));
      }
    }
    return new Response(JSON.stringify({ count }), { headers: cors });
  },
};
