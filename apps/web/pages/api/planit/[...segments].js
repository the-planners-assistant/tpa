// PlanIt proxy API route to bypass browser CORS limitations.
// Usage (client): /api/planit/api/applics/json?search=foo
// Maps to: https://www.planit.org.uk/api/applics/json?search=foo
export default async function handler(req, res) {
  const { segments = [] } = req.query; // dynamic path parts
  const path = '/' + (Array.isArray(segments) ? segments.join('/') : segments);
  const upstreamBase = 'https://www.planit.org.uk';

  // Reconstruct query string excluding 'segments'
  const searchParams = new URLSearchParams();
  for (const [k, v] of Object.entries(req.query)) {
    if (k === 'segments') continue;
    if (Array.isArray(v)) v.forEach(val => searchParams.append(k, val));
    else if (v != null) searchParams.append(k, v);
  }

  const targetUrl = `${upstreamBase}${path}${searchParams.size ? '?' + searchParams.toString() : ''}`;

  try {
    const upstreamRes = await fetch(targetUrl, { headers: { 'Accept': 'application/json' } });
    const contentType = upstreamRes.headers.get('content-type') || '';
    const status = upstreamRes.status;

    if (!contentType.includes('application/json')) {
      const text = await upstreamRes.text();
      res.status(status).json({ error: 'Non-JSON response from PlanIt', status, body: text.slice(0, 2000) });
      return;
    }

    const data = await upstreamRes.json();
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.status(status).json(data);
  } catch (err) {
    res.status(502).json({ error: 'Proxy fetch failed', message: err.message, targetUrl });
  }
}
