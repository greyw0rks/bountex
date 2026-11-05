# Bountex MVP status

The application and backend are built and deployed at [bountex.vercel.app](https://bountex.vercel.app), with [public MIT source](https://github.com/greyw0rks/bountex). Supabase is configured; the public mainnet history RPC and hosted API readiness are verified. Native-wallet acceptance remains required.

## Implemented

- [x] React / TypeScript / Vite application.
- [x] Original dark navy, periwinkle and lime design system.
- [x] Responsive desktop navigation and mobile bottom navigation.
- [x] Custom Three.js reward sculpture, lazy loading and WebGL fallback.
- [x] Framer Motion transitions and reduced-motion support.
- [x] Search, category filters and newest/reward/quickest sorting.
- [x] Task details, requirements, reward, creator, deadline and effort.
- [x] Bounty creation with a live preview and validation.
- [x] Atomic single-worker claiming and unsubmitted-work release.
- [x] Working and created task dashboards.
- [x] Evidence notes, HTTPS links, upload tickets and private read URLs.
- [x] Local text/link draft preservation.
- [x] Creator approval, rejection and revision with reasons.
- [x] At least 48 hours to submit a requested revision.
- [x] Offered-reward disclosures and three-active-bounty cap.
- [x] Worker non-payment/problem reports stored for the maintainer.
- [x] Nimiq SDK initialization, account access and native transaction adapter.
- [x] One-time signed-wallet authentication and expiring HttpOnly sessions.
- [x] Server-side authorization, rate limits and deny-by-default database access.
- [x] Frozen payout recipient, sender, amount, network and task reference.
- [x] Atomic payout lock and duplicate hash protection.
- [x] Independent execution, field matching and macro-checkpoint verification.
- [x] Pending receipt checks and unknown-outcome hash recovery.
- [x] Verified earnings and receipt history screens.
- [x] Clearly separated local preview roles, sample tasks and sample receipts.
- [x] SQL, signature, RPC and browser acceptance tests.
- [x] MIT license and Vercel deployment configuration.

## Live acceptance still required

- [x] Configure a real Supabase project and apply the migration.
- [x] Verify a public testnet history RPC for local development.
- [x] Verify a public mainnet history RPC for the requested regular Nimiq Pay demo.
- [ ] Configure a production history RPC on the final deployment's network.
- [x] Host an HTTPS deployment.
- [ ] Open the deployment inside Nimiq Pay and verify native signed login.
- [ ] Use two independently controlled wallets for creator and worker.
- [ ] Connect, sign in, publish, claim, upload, submit and review actual work.
- [ ] Confirm the host's active HTLC ownership fields match the sender adapter.
- [ ] Send a real, explicitly approved NIM reward and verify its complete receipt.
- [ ] Reject a native wallet prompt and verify that retry is safe.
- [ ] Interrupt after sending and verify recovery without a second payment.
- [ ] Inspect live Storage access from an unrelated account.
- [x] Publish the repository and deploy the current app build.
- [ ] Recruit genuine creators and workers; classify builder tests separately.
- [ ] Verify the current official competition rules and exact cutoff.
- [ ] Complete the competition entry and authorized promotion.

## Live backend checks · November 5, 2026

[Verification evidence](live-backend-setup.json) records the installed migration hash, database grants and RLS, private storage configuration, and live RPC checks. Temporary generated builder wallets exercised real signed login, replay rejection, task creation and claiming, private file upload and download, revision, approval, and logout. All temporary profiles, sessions, task and evidence files were removed afterward. These checks establish backend behavior; they do not establish native Nimiq Pay acceptance, independent users, or a Bountex payout.

The Nimiq Watch testnet endpoint is listed by the official developer center for development. Header and checkpoint checks reject the wrong network; transaction and account lookups succeeded. Macro heights come from the node's policy to account for testnet's genesis offset. A historical transaction read is recorded only as RPC evidence and is not presented as a task payment.

## Remaining delivery plan

| Milestone                 | Outcome                                                                                      |
| ------------------------- | -------------------------------------------------------------------------------------------- |
| Backend configuration     | Live discovery and signed sessions use persistent PostgreSQL                                 |
| Native testnet acceptance | Complete two-wallet task and payment journey with actual transaction evidence                |
| Pilot tasks               | Small useful tasks from real creators, with fulfilled submissions and feedback               |
| Production acceptance     | Same tested code, correct host/network, confirmed receipts and recoverable errors            |
| Submission                | Current README, public source, deployment URL, genuine demo and verified competition details |

No competition entry or real funds transfer has occurred. The official rules and FAQ were inspected on November 5; their Cycle III date text says October 14–November 11 without establishing the exact year and cutoff time zone. The form currently requires a walkthrough URL, despite the rules describing video as optional.
