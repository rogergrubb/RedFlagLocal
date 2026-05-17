export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch(e) { body = {}; } }
  const message = body && body.message;
  const context = body && body.context;
  if (!message || String(message).trim().length < 3) {
    return res.status(400).json({ error: "Message too short" });
  }
  const token = process.env.GITHUB_TOKEN;
  if (!token) return res.status(500).json({ error: "GITHUB_TOKEN not configured" });
  const msg = String(message).trim();
  const ts = new Date().toISOString();
  const title = "Feedback: " + msg.slice(0, 80) + (msg.length > 80 ? "..." : "");
  const issueBody = "**Feedback received at " + ts + "**\n\n" +
    "## Message\n\n" + msg + "\n\n" +
    (context ? "## Context\n\n\`\`\`\n" + JSON.stringify(context, null, 2) + "\n\`\`\`\n\n" : "") +
    "_Submitted via RedFlag.biz feedback form_";
  try {
    const ghRes = await fetch("https://api.github.com/repos/rogergrubb/RedFlagLocal/issues", {
      method: "POST",
      headers: { "Authorization": "token " + token, "Accept": "application/vnd.github+json", "Content-Type": "application/json", "User-Agent": "RedFlag.biz-feedback" },
      body: JSON.stringify({ title: title, body: issueBody, labels: ["user-feedback"] })
    });
    if (!ghRes.ok) {
      const err = await ghRes.text();
      return res.status(500).json({ error: "GitHub: HTTP " + ghRes.status, detail: err.slice(0, 300) });
    }
    const issue = await ghRes.json();
    return res.status(200).json({ ok: true, issueUrl: issue.html_url, issueNumber: issue.number });
  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
}