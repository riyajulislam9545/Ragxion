# Ragxion — Bangladesh Esports Tournament Platform

A full-stack esports tournament platform for Bangladesh players. Users recharge a wallet via bKash/Nagad mock flows, register for tournaments with entry fee deduction, compete, and withdraw winnings back to bKash/Nagad. Admins manage tournaments, declare winners, and process withdrawals.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, proxied at `/api`)
- `pnpm --filter @workspace/tournament-app run dev` — run the frontend (Vite, proxied at `/`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run typecheck:libs` — rebuild composite libs (run this after changing `lib/db` models)
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- Required env: `MONGODB_URI`, `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`

## Temporary Vercel test deployment

The frontend and Express API must both be deployed; deploying only the Vite frontend does not provide API routes.

- Deploy the repository root as the Vercel project root.
- Build command: `corepack pnpm --filter @workspace/tournament-app run build`
- Output directory: `artifacts/tournament-app/dist/public`
- Set `VITE_CLERK_PUBLISHABLE_KEY` and `VITE_API_BASE_URL` in Vercel. The API base URL is the backend's origin only (for example, `https://your-api.example.com`), without `/api`.
- Deploy `@workspace/api-server` as a separate Node service. Build with `corepack pnpm --filter @workspace/api-server run build` and start with `corepack pnpm --filter @workspace/api-server run start`.
- Set `MONGODB_URI`, `MONGODB_DB_NAME`, `CLERK_SECRET_KEY`, and `CLERK_PUBLISHABLE_KEY` in the backend host. Never put secret keys in Vercel's `VITE_*` variables or commit them.
- Add the deployed frontend URL to the Clerk application's allowed origins/domains.

The object-storage implementation currently authenticates through a Replit sidecar, so tournament image uploads need a separate non-Replit storage configuration before they will work on Vercel/another API host. bKash/Nagad payments are request-and-admin-approval flows, not live gateway integrations.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 + `@clerk/express` v2
- DB: MongoDB Atlas + MongoDB Node.js driver (`lib/db`)
- Validation: Zod (`zod/v4`)
- Auth: Replit-managed Clerk (`@clerk/react` v6, `@clerk/express` v2)
- API codegen: Orval (from OpenAPI spec in `lib/api-spec`)
- Frontend: React + Vite + Tailwind CSS v4 + shadcn/ui + TanStack Query + Wouter
- Build: esbuild (CJS bundle for server)

## Where things live

- `lib/db/src/index.ts` — MongoDB connection, collections, indexes, numeric IDs, and transaction helper
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for API contract)
- `lib/api-client-react/` — Generated TanStack Query hooks (from Orval codegen)
- `lib/api-zod/` — Generated Zod validation schemas (from Orval codegen)
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/api-server/src/lib/auth.ts` — `requireAuth` middleware, `getClerkUserId` helper
- `artifacts/tournament-app/src/pages/` — React pages (home, dashboard, tournaments, tournament-detail, profile, admin)
- `artifacts/tournament-app/src/components/layout.tsx` — Sidebar layout with wallet display

## Architecture decisions

- **Contract-first API**: OpenAPI spec written first → Orval generates typed React Query hooks and Zod schemas
- **Clerk v2/v6 split**: Backend uses `@clerk/express@2.x` (shares `@clerk/shared@4.x`), frontend uses `@clerk/react@6.x` (also needs `@clerk/shared@4.x`) — versions must stay aligned
- **Dark-only UI**: All CSS variables are defined once in `:root` (no `.dark` variant needed); color-scheme: dark enforced globally
- **Wallet as integer TK**: `walletBalance` stored as integer (Taka), no decimal precision needed for BD market
- **Admin via DB flag**: First admin must be set manually in MongoDB: `db.users.updateOne({ clerkId: '<clerk_user_id>' }, { $set: { isAdmin: true } })`
- **Prize pool is dynamic**: `estimatedPrizePool` is computed from `registeredCount * entryFee` on every tournament fetch; `finalPrize*` is computed and frozen when admin closes registration

## Product

- **Landing page**: Public hero showcasing the platform to unauthenticated visitors with tournament listing
- **Dashboard**: Wallet balance, total winnings, active registrations, recent transactions; mock recharge flow
- **Tournaments**: Browse & filter by status (open, upcoming, closed, completed)
- **Tournament Detail**: Full info, registered players roster, dynamic prize pool, registration with entry fee deduction
- **Profile**: Edit in-game name/phone, view registration history, transaction log, submit withdrawal to bKash/Nagad
- **Admin Panel**: Platform stats, create tournament, close registration, declare winners (automated prize distribution), manage withdrawal requests

## User preferences

- Target market: Bangladesh players; payment via bKash/Nagad (mock/simulated)
- Dark gaming aesthetic: deep purples (#a855f7 primary), hot pink (#ec4899 accent), near-black background
- Currency: TK (Bangladeshi Taka), no decimals

## Gotchas

- **Database configuration**: `MONGODB_URI` is required; `MONGODB_DB_NAME` defaults to `ragxion`. Collections and indexes are initialized when the API starts.
- **After changing `lib/db` models**: run `pnpm run typecheck:libs` before `pnpm --filter @workspace/api-server run typecheck` — the composite lib must be rebuilt first
- **Clerk package versions**: `@clerk/react` must stay on `^6.x` (needs `@clerk/shared@^4.x`). Do NOT upgrade to a version released within 24h (minimumReleaseAge: 1440 min blocks it)
- **`@apply dark` is invalid in Tailwind v4**: Use `:root` CSS variables directly; the `dark` custom variant is for component-level selectors only, not `@apply`
- **Do not run `pnpm dev` at workspace root** — use workflow restart instead

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- MongoDB database name: `ragxion` by default; MongoDB creates the database and collections when the application initializes its indexes.
- Codegen: `pnpm --filter @workspace/api-spec run codegen`
