export const config = { maxDuration: 20 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch(e) { body = {}; } }
  const token = process.env.GITHUB_TOKEN;
  if (!token) return res.status(500).json({ error: 'GITHUB_TOKEN not set' });
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const ua = req.headers['user-agent'] || '';
  const ref = req.headers['referer'] || '';
  const event = {
    ts: new Date().toISOString(),
    event: body.event || 'page_view',
    biz: body.biz || '',
    city: body.city || '',
    from: body.from || '',
    page: body.page || '',
    ip: ip,
    ua: ua.slice(0, 200),
    ref: ref.slice(0, 200)
  };
  const repo = 'rogergrubb/RedFlagLocal';
  const path = 'analytics/events.ndjson';
  const url = 'https://api.github.com/repos/' + repo + '/contents/' + path;
  const ghHead = { 'Authorization': 'token ' + token, 'Accept': 'application/vnd.github+json', 'User-Agent': 'RedFlag-tracker' };
  for (let attempt = 0; attempt < 3; attempt++) {
    let sha = null;
    let existingContent = '';
    try {
      const getRes = await fetch(url, { headers: ghHead });
      if (getRes.ok) {
        const data = await getRes.json();
        sha = data.sha;
        existingContent = Buffer.from(data.content, 'base64').toString('utf-8');
      }
    } catch(e) {}
    const newContent = existingContent + JSON.stringify(event) + '\n';
    const b64 = Buffer.from(newContent, 'utf-8').toString('base64');
    const putBody = { message: 'track: ' + event.event, content: b64 };
    if (sha) putBody.sha = sha;
    const putRes = await fetch(url, {
      method: 'PUT',
      headers: Object.assign({}, ghHead, { 'Content-Type': 'application/json' }),
      body: JSON.stringify(putBody)
    });
    if (putRes.ok) return res.status(200).json({ ok: true, attempt: attempt + 1 });
    if (putRes.status === 409 || putRes.status === 422) continue;
    const err = await putRes.text();
    return res.status(500).json({ error: 'GH PUT ' + putRes.status, detail: err.slice(0, 200) });
  }
  return res.status(500).json({ error: 'too many SHA conflicts' });
}