<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Lumora Studio — notes for coding agents

- Read `docs/ARCHITECTURE.md` first. The scene graph in `src/lib/schema.ts` is the single source of truth; UI never talks to Fabric directly (go through `src/lib/engine`).
- Run `npm run verify` (typecheck + lint + format check + unit tests) before calling work done; `npm run test:e2e` for the Playwright smoke suite.
- Every user-facing string goes in **both** `messages/en.json` and `messages/ar.json` (a unit test enforces matching keys).
- RTL: use logical Tailwind utilities (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`, `text-start`) — never `ml-*`/`mr-*`/`left-*`/`right-*` for layout.
- Dark mode is `<html data-theme="dark">` (see `src/lib/theme.ts`), not a `.dark` class.
- Secrets: server-only code reads env through `src/lib/env.ts`. Never prefix a secret with `NEXT_PUBLIC_`. Never log key values.
- The Content-Security-Policy is built in `src/lib/security/csp.ts`; add any new external host there.
- `npx shadcn add …` writes `import { cn } from "cn"` in this repo — fix it to `@/lib/utils` after adding components.
- AI calls only from `/api/ai/*` server routes; validate model output with Zod.
