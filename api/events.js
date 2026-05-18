export const config = { maxDuration: 20 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
  const key = (req.query && req.query.key) || '';
  const expected = process.env.DASHBOARD_KEY;
  if (!expected || key !== expected) return res.status(401).json({ error: 'invalid or missing key' });
  const token = process.env.GITHUB_TOKEN;
  if (!token) return res.status(500).json({ error: 'GITHUB_TOKEN not set' });
  const url = 'https://api.github.com/repos/rogergrubb/RedFlagLocal/contents/analytics/events.ndjson';
  const ghHead = { 'Authorization': 'token ' + token, 'Accept': 'application/vnd.github+json', 'User-Agent': 'RedFlag-events' };
  try {
    const r = await fetch(url, { headers: ghHead });
    if (r.status === 404) return res.status(200).json({ events: [], note: 'no events yet' });
    if (!r.ok) return res.status(500).json({ error: 'GH GET ' + r.status });
    const d = await r.json();
    const content = Buffer.from(d.content, 'base64').toString('utf-8');
    const lines = content.split('\n').filter(Boolean);
    const events = lines.map(function(l) { try { return JSON.parse(l); } catch(e) { return null; } }).filter(Boolean);
    return res.status(200).json({ events: events, totalCount: events.length });
  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
}