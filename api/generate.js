// RedFlag.biz - AI-driven business research API
// Calls Claude (Sonnet 4.5) with the web_search tool to generate a real, factual
// one-page Red Flag Report for any business by name + city.

import Anthropic from '@anthropic-ai/sdk';

export const config = {
  maxDuration: 90
};

const SYSTEM_PROMPT = [
  'You are RedFlag.biz - an AI business-research analyst that produces factual, one-page audits of small businesses.',
  '',
  'Your job: research the business by name + city, then produce a structured Red Flag Report covering:',
  '',
  '1. BUSINESS IDENTIFICATION - verify the business exists. Find its category, address, years in business, and review aggregate (e.g., "4.8 star Yelp - 42 reviews").',
  '',
  '2. ONLINE PRESENCE RED FLAGS - based on your research, list 4-6 specific factual gaps. Examples:',
  '   - Not in Google\'s Local Pack for [category] [city]',
  '   - No claimed Google Business Profile',
  '   - No active website found',
  '   - Reputation concentrated on one platform',
  '   - Limited social-media inventory',
  '   - Listed hours suggest competitors capture after-hours',
  '',
  '3. LOCAL COMPETITORS - find the top 3 nearest competitors in the same city/area + same category. For each: name, rating, review count, key differentiator, and presence indicators. Plus one entry for the target business marked "isYou": true with their stats.',
  '',
  '4. 2025-2026 REGULATORY TAILWINDS - federal, state, county, and city laws / mandates / rebates / tax credits relevant to this business category. Lean toward concrete dollar amounts when possible. 3-5 entries.',
  '',
  '5. REVENUE AT STAKE - estimate Year-1 revenue opportunity in real dollars with a one-sentence label and one-sentence breakdown explaining how you derived the number.',
  '',
  'Be RIGOROUSLY factual. Use web_search aggressively (3-6 searches). Cite real sources by name in your "sources" array. Where you cannot verify something, mark it "pending verification" - never fabricate.',
  '',
  'Your output must be ONLY valid JSON matching this exact schema (no preamble, no markdown fences, no explanation - just JSON):',
  '',
  '{',
  '  "business": {',
  '    "name": "string",',
  '    "address": "string - full address if found, else city, state",',
  '    "category": "string",',
  '    "years": "string - e.g., 17 years or unknown",',
  '    "rating": "string - e.g., 4.9 star Yelp - 86 reviews or no reviews found"',
  '  },',
  '  "redFlags": ["string", "string", "string", "string", "string"],',
  '  "competitors": [',
  '    { "name": "string", "stats": "string", "isYou": false },',
  '    { "name": "string", "stats": "string", "isYou": false },',
  '    { "name": "string", "stats": "string", "isYou": false },',
  '    { "name": "string (you)", "stats": "string", "isYou": true }',
  '  ],',
  '  "tailwinds": [',
  '    { "name": "string", "detail": "string" }',
  '  ],',
  '  "revenue": {',
  '    "headline": "string - e.g., $500K+",',
  '    "label": "string - what this number represents",',
  '    "breakdown": "string - one or two sentences on how this was derived"',
  '  },',
  '  "sources": ["string", "string", "string", "string", "string"]',
  '}',
  '',
  'Return ONLY the JSON object. No other text.'
].join('\n');

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'ANTHROPIC_API_KEY not configured on server',
      hint: 'Set the env var in Vercel project settings'
    });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  const { biz, city, email } = body || {};
  if (!biz || !city) {
    return res.status(400).json({ error: 'biz and city are required' });
  }

  const client = new Anthropic({ apiKey });

  const userPrompt = 'Generate a Red Flag Report for: **' + biz + '** in **' + city + '**.\n\n' +
    'Use the web_search tool to gather current, factual data. Start with searches like:\n' +
    '- "' + biz + ' ' + city + '" (verify existence + identity)\n' +
    '- "' + biz + ' ' + city + ' yelp" (reviews)\n' +
    '- "' + biz + ' ' + city + ' google business profile" (GBP status)\n' +
    '- "[their category] ' + city + '" (competitors in Local Pack)\n' +
    '- "' + city + ' 2026 business code rebate [their category]" (regulatory tailwinds)\n' +
    '- Any category-specific rebate or law searches relevant to what you discover\n\n' +
    'Then return ONLY the JSON report. No markdown, no preamble.';

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      tools: [
        {
          type: 'web_search_20250305',
          name: 'web_search',
          max_uses: 6
        }
      ],
      messages: [
        { role: 'user', content: userPrompt }
      ]
    });

    const textBlocks = (response.content || []).filter(c => c.type === 'text');
    const fullText = textBlocks.map(b => b.text).join('\n').trim();

    let json;
    try {
      const cleaned = fullText.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
      json = JSON.parse(cleaned);
    } catch (e) {
      const m = fullText.match(/\{[\s\S]*\}/);
      if (!m) {
        console.error('No JSON in response:', fullText.slice(0, 500));
        return res.status(500).json({
          error: 'AI returned non-JSON response',
          raw: fullText.slice(0, 800)
        });
      }
      try {
        json = JSON.parse(m[0]);
      } catch (e2) {
        return res.status(500).json({
          error: 'AI returned malformed JSON',
          parseError: e2.message,
          raw: m[0].slice(0, 800)
        });
      }
    }

    const required = ['business', 'redFlags', 'competitors', 'tailwinds', 'revenue', 'sources'];
    for (const k of required) {
      if (!(k in json)) {
        return res.status(500).json({
          error: 'AI response missing required field: ' + k,
          got: Object.keys(json)
        });
      }
    }

    return res.status(200).json(json);
  } catch (err) {
    console.error('Anthropic API error:', err);
    return res.status(500).json({
      error: err.message || 'Unknown error',
      type: err.constructor && err.constructor.name
    });
  }
}
