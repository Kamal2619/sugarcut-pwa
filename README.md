# SugarCut PWA

An AI-powered personal sugar tracker PWA built with vanilla HTML/CSS/JS, deployed on Vercel with Gemini AI integration.

## Features

- **Streak Tracker** — Log clean days, build streaks, earn milestones
- **AI Food Scanner** — Upload food photos or describe food; Gemini 2.5 Flash estimates sugar content
- **Geo-Fence Alert** — Warns when near sugar-heavy café zones (Anna Nagar, Chennai)
- **Evening Protocol** — Reminds you to switch to black coffee at 18:00
- **PWA** — Installable, offline-capable via Service Worker

## Tech Stack

- Vanilla HTML / CSS / JavaScript
- Three.js (animated 3D background)
- Google Gemini 2.5 Flash (via Vercel serverless proxy)
- Vercel (hosting + serverless functions)

## Local Development

```bash
npm install -g vercel
vercel dev
```

> The `/api/gemini` route requires a Vercel project with `GEMINI_API_KEY` set in environment variables. Running without Vercel CLI will result in API errors.

## Deployment

```bash
vercel --prod
```

Set the following environment variable in your Vercel project dashboard:

| Key | Value |
|-----|-------|
| `GEMINI_API_KEY` | Your Google Gemini API key |

## Project Structure

```
├── index.html       # App shell & UI
├── app.js           # Core logic (streak, AI, geo-fence, routines)
├── styles.css       # Full design system (cyberpunk/glassmorphism)
├── sw.js            # Service worker for PWA offline support
├── manifest.json    # PWA manifest
├── package.json     # Node config for Vercel
└── api/
    └── gemini.js    # Vercel serverless function (API proxy)
```
