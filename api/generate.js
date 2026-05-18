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
  '5. REVENUE AT STAKE - estimate Year-1 revenue opportunity in real dollars with a one-sentence label and one-sentence breakdown explaining how you derived the number. If insufficient data, provide a category-based estimate using industry benchmarks (e.g., for a Honolulu hair braider: 15-20 clients/week at $60-80 = $43K-77K solo; with help, $120K-180K).',
            '',
            '6. PRESENCE SCORE - calculate a 0-100 score based on online presence completeness. Subtract from 100 for each missing item: claimed GBP (15 pts), active website (15 pts), Yelp reviews 20+ (10 pts), Google reviews 5+ (10 pts), Facebook page (5 pts), Instagram (5 pts), Nextdoor (5 pts), BBB listing (5 pts), 50+ total reviews (10 pts), recent photos/portfolio (5 pts), up-to-date hours (5 pts), responsive social posts (10 pts). Convert: 90+ = A+, 85-89 = A, 80-84 = B+, 75-79 = B, 70-74 = C+, 60-69 = C, 50-59 = D, under 50 = F.',
            '',
            '7. SOLUTIONS - generate 4-6 specific actions WE (RedFlag.biz) would take for THIS business. Each solution must reference what competitors do/dont do and how our action will make THIS business BETTER than competitors. Use category catch-up (matching what competitors already have) or leapfrog (doing something none of the competitors do). Be concrete and specific (e.g., We will claim and optimize your Google Business Profile, add 20+ professional photos, and set service categories for African braiding, natural hair, and protective styles. You will appear in Honolulu Local Pack within 30-60 days, matching all 3 of your top competitors).',
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
  '  "score": {',
  '    "presence": "number 0-100",',
  '    "grade": "string - one of: A+, A, B+, B, C+, C, D, F",',
  '    "label": "string - short description like Online presence"',
  '  },',
  '  "wedge": {',
  '    "title": "string - the wedge in one phrase, e.g., Mobile concierge braiding for tourist hotels",',
  '    "rationale": "string - why this wedge works given competitor analysis",',
  '    "playbook": ["string", "string", "string"],',
  '    "revenue": "string - revenue impact, e.g., +$30-50K/yr from premium mobile pricing"',
  '  },',
  '  "solutions": [',
  '    { "title": "string - short solution name", "competitorContext": "string - what competitors do/dont do", "ourMove": "string - what we will do for THIS business that makes them BETTER than competitors", "category": "string - catch-up or leapfrog" }',
  '  ],',
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
  '8. WEDGE IDENTIFICATION - THE MOST IMPORTANT STRATEGIC INSIGHT. Identify ONE specific underserved angle this business can dominate. Look at what ALL competitors share (saturation) and what NONE of them do (gap). Examples:',
            '   - Mobile/concierge service (when all competitors are fixed location)',
            '   - Hotel/AirBnB partnerships for tourists (when all competitors only serve walk-ins)',
            '   - Late-night hours 8pm-midnight (when all competitors close by 7pm)',
            '   - Bridal/event specialty (when all do general walk-in only)',
            '   - Home studio for intimate appointments (when all are salon-based)',
            '   - Multi-city/multi-market expertise (when local competitors only have local experience)',
            'The wedge should be a 1-line strategic position that no competitor occupies. Provide a rationale grounded in the competitor data, a 3-5 step playbook, and a revenue impact estimate.',
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
