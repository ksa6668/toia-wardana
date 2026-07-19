# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Toia & Wardana is a mobile-first **Arabic (RTL) PWA** for tracking daily sales and
expenses across two flower-shop branches: **تويا (`toia`)** and **وردانة (`wardana`)**.
It has two roles — **employee (موظف)** who records sales/expenses/WhatsApp data, and
**manager/admin (مدير)** who sees reports, KPIs, and manages settings.

UI text is mostly Arabic. All screens — employee-facing and manager (including the
settings sub-screens, since Batches 83–85) — are bilingual (ar/en) via `src/i18n.js`;
page `dir` follows the language (rtl/ltr). The printable monthly report and stored
notification/Telegram content stay Arabic.

## Commands

```bash
npm run dev       # Vite dev server (HMR)
npm run build     # production build to dist/
npm run preview   # serve the production build locally
npm run lint      # ESLint over the whole repo
```

There is **no test suite or test runner** — verification is manual (see the QA-style
checklists in `INSTALL.md`). Do not assume `npm test` exists.

## Stack

- **React 19** + **Vite 8**, plain `.jsx` (no TypeScript).
- **Tailwind CSS v4** via the `@tailwindcss/vite` plugin (no `tailwind.config.js`). The
  design system lives entirely in `src/index.css`: brand colors are declared under
  `@theme` (e.g. `--color-tw-blue`, `--color-tw-navy`, `--color-tw-green`) and exposed as
  utility classes like `text-tw-blue`, `bg-tw-soft`. Custom component classes are prefixed
  `tw-` (e.g. `tw-form-card`, `tw-chip`, `tw-payment-row`).
- **Firebase** (Auth + Firestore) for client data; **lucide-react** icons; **xlsx** for spreadsheet export.
- **Vercel serverless functions** in `api/` for operations that need server secrets.

## Architecture

### Navigation is a state machine, not a router
There is **no react-router**. `src/App.jsx` is the single root that switches screens by
two pieces of state: `currentView` (`'login' | 'employeeHome' | 'salesForm' | ... | 'adminHome'`)
and, for the admin, `adminTab` (`'home' | 'monthly' | 'whatsapp' | 'kpis' | 'settings'`).
App.jsx also owns the shared `AppHeader`, bottom nav (mobile) / sidebar (`md`+ desktop),
and global overlays (notifications, receipts, logout/profile sheets).

Sub-screens set the header title and back button through **`ScreenCtx`**
(`src/context/ScreenCtx.jsx`) — call `useScreenHeader(title, onBack)` inside a screen; it
auto-clears on unmount. This context exists to break a circular import between App and screens.

### `src/firebase.js` is the whole data layer
This ~1600-line module is the single source of truth for **all** Firestore access and most
business logic. Everything goes through its exported async functions (e.g. `addDailySales`,
`addExpense`, `getSales`, `getExpenses`, `getWhatsappEntries`, `setMonthlyGoal`,
`importHistoricalData`). When adding data features, add a function here rather than calling
Firestore from components.

Firestore collections: `dailySales`, `expenses`, `fixedExpenses`, `whatsapp`,
`whatsappBaseline`, `users`, `branches`, `categories`, `paymentMethods`, `goals`.

Key domain rules baked into firebase.js:
- **Auth is username + 4-digit PIN.** There is no real email. `usernameToEmail` maps a
  username to `<name>@toia-wardana.app`, and the password is `<pin>__twpin` (the
  `__twpin` suffix satisfies Firebase's 6-char minimum). The same `PIN_SUFFIX` is
  duplicated in `api/admin.js` and **must stay in sync**.
- **MADA card fees:** `MADA_FEE_RATE = 0.0092`. Sales store both `total` (gross) and
  `netTotal` (after MADA fees). Use `salesNet(sale)` to read net safely — it falls back to
  recomputing from `cash/mada/transfer` for older records lacking `netTotal`. Treat
  backward compatibility with old records as a real constraint throughout.
- **Session:** `browserLocalPersistence` keeps users logged in; `markActive()` /
  `isSessionExpired()` implement a 30-day inactivity auto-logout.
- Telegram `notify*` calls are fire-and-forget and must never block or fail a write.

### Caching layer (sessionStorage, custom — not a library)
- `useCachedQuery(keyArray, fetcher, { ttl })` (`src/hooks/useCachedQuery.js`) is a small
  stale-while-revalidate cache backed by `sessionStorage` (`tw_cache_` prefix).
- After any mutation, the corresponding cache **must be invalidated**. firebase.js mutations
  already call an internal `_invalidateCachePrefix('sales' | 'expenses' | ...)`; components
  can call `invalidateCache(prefix)`. Forgetting this leaves stale reports.
- `usePersistedState(key, default)` (`tw_state_` prefix) persists UI state (selected period,
  branch, etc.) across remounts within a browser session.
- On logout, App.jsx calls `clearAllPersistedState()` + `clearAllCache()`.

### Dates are local (Saudi UTC+3), never UTC
Helpers in `src/utils/periodHelpers.js` and `src/utils/dateHelpers.js` build `YYYY-MM-DD`
strings directly instead of `toISOString()`, because UTC conversion shifted records to the
previous day. Follow this pattern — do not introduce `toISOString()` for date keys.

### Serverless functions (`api/`, Vercel)
- `api/admin.js` — Firebase **Admin SDK** ops (change another user's PIN, hard-delete a
  user). Verifies the caller's ID token and that their `users/<uid>.role === "admin"`.
- `api/upload.js` — uploads invoice images to **Cloudflare R2** (verifies the Firebase
  token via REST), keeping R2 secrets server-side.
- These read secrets from Vercel env vars (`FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY`,
  `R2_*`, `FIREBASE_API_KEY`). The Firebase **client** config in `src/firebase.js` is public
  by design and is not a secret.

## Component conventions

- `Manager*` = admin/manager screens; `*V2` = the current rebuilt entry forms
  (`SalesFormV2`, `ExpenseFormV2`, `WhatsappFormV2`); `*Sheet` = bottom-sheet modals
  rendered through `SheetPortal` / `BottomSheet`.
- Screens receive props like `setView`, `branch`, `branchId`, `lang` from App.jsx rather
  than reading global state.
- Expense categories are classified by `classifyExpense()` into four primary types
  (`flower`, `delivery`, `customerOrders`, `supplies`) plus `marketing`/`general`; primary
  categories get distinct styling. Some categories set `requiresImage` → the expense form
  forces a camera capture.

## Conventions to follow

- **Commit messages use the `Batch N:` / `Batch N.x:` prefix** matching the existing
  history (e.g. `Batch 60: ...`). Keep that convention. `INSTALL.md` shows the expected
  level of detail (files touched, what was preserved).
- Comments in this codebase are predominantly Arabic; match the surrounding language and
  comment density of the file you edit.
- The repo contains build/snapshot zips (`toia-wardana-*.zip`) — ignore them; they are not source.
