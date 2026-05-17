# RedFlag.biz

AI-driven small-business research tool. Enter a business name + city, get a one-page Red Flag Report covering online-presence gaps, local competitors, 2025-2026 regulatory tailwinds, and revenue at stake.

## Business model

- First report (your own business): FREE -- the hook
- Every report after that: $19.99 -- the curiosity-driven competitor research

## Architecture

- `index.html` -- single-page frontend
- `api/generate.js` -- Vercel serverless function calling Claude with web_search
- Static + serverless on Vercel

## Required env var

- `ANTHROPIC_API_KEY` -- set in Vercel project settings

## Author

Roger Grubb -- Number One Son Software Development -- roger@grubb.net
