# AGENTS.md

## Cursor Cloud specific instructions

### Overview

HitFM is a **client-side-only React SPA** (no backend/database). It uses Vite as the build tool and runs on port 3000.

### Key commands

| Task | Command |
|------|---------|
| Install deps | `npm install` |
| Dev server | `npm run dev` (port 3000, host 0.0.0.0) |
| Build | `npm run build` |
| Type check | `npx tsc --noEmit` |

There are no lint or test scripts configured in `package.json`.

### Environment variables

Copy `.env.example` to `.env`. The only required key is `GEMINI_API_KEY` for the YunWu AI gateway. Without it, the app still loads and falls back to a static YouTube/SoundCloud playlist.

### Gotchas

- Tailwind CSS is loaded via CDN (`<script src="https://cdn.tailwindcss.com">`), not as an npm dependency. Do not look for a `tailwind.config` file.
- YouTube IFrame API and SoundCloud Widget API are loaded from external CDNs in `index.html`.
- All AI API calls (Gemini, SUNO, TTS) go through the YunWu gateway (`yunwu.ai`) directly from the browser — there is no backend proxy.
- The `@google/genai` package is listed as a dependency but the code uses raw `fetch` calls instead of the SDK.
- Vite reads `.env` at startup via `loadEnv`; if you change `.env` you must restart the dev server.
- The SUNO music generation endpoint may return 503 intermittently; the app handles this gracefully by falling back to the built-in YouTube/SoundCloud playlist defined in `constants.ts`.
- TTS uses `gemini-2.5-flash-preview-tts` which has strict quota limits; QUOTA_EXCEEDED errors are expected under heavy use and the app continues without voice synthesis.
