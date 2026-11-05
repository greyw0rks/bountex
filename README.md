# Bountex

**Good work pays.** A Nimiq Mini App for useful tasks and direct NIM rewards.

[Open the mainnet demo](https://bountex.vercel.app) · [Watch the walkthrough](https://bountex.vercel.app/walkthrough.html) · [Competition entry draft](docs/SUBMISSION.md)

Bountex lets a creator post a small bounty, a worker claim it and submit evidence, and the creator review and pay the agreed reward through Nimiq Pay. A returned wallet hash stays pending until the backend verifies successful execution, the exact reward and recipient, the task reference, and a canonical macro-block checkpoint.

The interface uses React, custom CSS, Framer Motion, and a lazy-loaded Three.js / React Three Fiber reward sculpture. Fonts are self-hosted. It includes desktop and mobile layouts, keyboard dialogs, reduced motion, and a WebGL fallback.

## Run locally

Requires Node.js 22 and npm.

```bash
npm ci
npm run dev
```

Open **http://127.0.0.1:5175**. The API runs on port 4174 through Vite's proxy.

Without backend credentials the app opens in **Preview mode**. Choose **Try as a worker** or **Try as a creator** from the account dialog. The sample workspace is saved on this device; it does not represent public tasks, connected wallets, stored file uploads, or actual NIM payments. A preview payout produces a labeled sample receipt. Reset the sample workspace from “How Bountex works.”

## Enable live mode

1. Create a Supabase project and run [001_bountex.sql](supabase/migrations/001_bountex.sql) in its SQL editor.
2. Copy `.env.example` to `.env` and set `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (or the legacy `SUPABASE_SERVICE_ROLE_KEY`), and `APP_ORIGIN`.
3. Set `NIMIQ_NETWORK` to `testnet` or `mainnet`. Provide `NIMIQ_RPC_URL` for a trusted history-enabled Albatross node supporting `getAccountByAddress`, `getTransactionByHash`, `getLatestBlock`, `getLastMacroBlock`, and `getBlockByNumber`. The server verifies the network from block headers and checks a canonical macro checkpoint before enabling payouts. Optional RPC Basic authentication is server-only.
4. Restart the app. Use “Browse live bounties” in the account dialog if you previously chose preview mode.
5. Open the HTTPS deployment inside a compatible Nimiq Pay host on the same network. Connect and approve the one-time sign-in message.

The `.env` file is hidden by default. Open it with VS Code's **Ctrl+P** or show hidden files in your file manager. `SUPABASE_ACCESS_TOKEN` is an optional local setup credential for the Supabase Management API; the running app does not use it.

The service-role key belongs **only on the server**. The app uses its own signed-wallet, HttpOnly-cookie sessions; it does not use Supabase Auth. All database tables enable RLS and deny anonymous/authenticated access. The server enforces wallet ownership and task permissions, and uses private, signed URLs for evidence files.

The demo is deployed on Vercel: `npm run build` produces the frontend, and `api/[...path].ts` serves the API. Set the server environment variables in Vercel and set `APP_ORIGIN` to the exact HTTPS origin. Server imports include `.js` extensions so emitted modules resolve correctly in Node's ESM runtime. Production uses mainnet. The builder confirmed successful native signed-wallet login on November 5, 2026; a complete native task-to-payout acceptance run is still required.

## Verify

```bash
npm test
npm run test:browser
npm run build
npm audit
```

Domain tests verify real Nimiq signatures, RPC transaction and finality handling, and SQL lifecycle rules against embedded PostgreSQL (PGlite). Browser tests cover filtering, posting, claim → submission → revision → approval → preview receipt, draft persistence, keyboard dialogs, responsive widths, and accessibility.

These tests do not establish that a native wallet payment works on a deployed host. Finish the [live acceptance checklist](docs/MVP.md) using two separate wallets before presenting actual payouts.

## Product boundaries

- One task, one worker, one reward. No bidding or custodial escrow.
- Rewards are **offered**, not funded or guaranteed. Creators pay directly after approval.
- Creators can have at most three active unpaid bounties; workers can hold five unfinished claims.
- Requirements and reward remain fixed after posting. Revision requests provide at least 48 more hours to submit.
- Uncertain payments stay locked. Recover the existing hash rather than sending a second payment.
- Workers can record a non-payment/abuse report. Reports are stored for the maintainer; automated arbitration is not included.
- Wallet identity proves account ownership, not a unique human. Sample activity must not be counted as adoption.

See [architecture](docs/ARCHITECTURE.md), [design direction](docs/DESIGN.md), and [MVP status](docs/MVP.md).

Technical references: [Mini App provider](https://nimiq.dev/mini-apps/api-reference/nimiq-provider), [SDK source](https://github.com/nimiq/trust-web3-provider/tree/nimiq/packages/mini-app-sdk), [RPC interfaces](https://github.com/nimiq/core-rs-albatross/tree/albatross/rpc-interface).

MIT license.
