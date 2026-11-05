# Bountex competition entry

Prepared for [the submission form](https://miniappscompetition.com/submit) on November 5, 2026. This is a draft; no entry has been submitted.

## About your app

**App name**

Bountex

**Category**

Earn

**Tagline**

Good work pays.

**Short description**

Bountex helps builders and communities turn small tasks into NIM rewards. Workers claim bounties and submit proof; creators review the work and pay directly through Nimiq Pay, with clear progress and on-chain payment verification.

**Pricing**

Free

The current MVP has no subscription, paid tier or platform fee. Creators pay the offered NIM reward and applicable wallet/network fees. Select Freemium only after a paid tier exists.

## Links and demo

| Field             | Current status                                                     | Required value                              |
| ----------------- | ------------------------------------------------------------------ | ------------------------------------------- |
| Repo URL          | Public MIT source repository.                                      | https://github.com/greyw0rks/bountex        |
| Demo URL          | Public HTTPS deployment; mainnet API readiness verified.           | https://bountex.vercel.app                  |
| Video walkthrough | Public captioned walkthrough; labeled sample workflow and receipt. | https://bountex.vercel.app/walkthrough.html |

The current form requires all three links. Its video validation requires a URL, although the general rules page describes a video as optional. Use the requirements of the form when preparing this entry.

## Media attachments

Upload the files in [submission/](submission/) or extract [bountex-submission-assets.zip](submission/bountex-submission-assets.zip).

| Field                              | File                                                        | Dimensions         |
| ---------------------------------- | ----------------------------------------------------------- | ------------------ |
| App icon / favicon                 | [app-icon-512.png](submission/app-icon-512.png)             | 512 × 512          |
| Thumbnail                          | [thumbnail-240.png](submission/thumbnail-240.png)           | 240 × 240          |
| Screenshot 1 · Social preview      | [01-explore.png](submission/01-explore.png)                 | See media manifest |
| Screenshot 2 · Task requirements   | [02-task-details.png](submission/02-task-details.png)       | See media manifest |
| Screenshot 3 · Posting a bounty    | [03-create-bounty.png](submission/03-create-bounty.png)     | See media manifest |
| Screenshot 4 · Evidence submission | [04-submit-work.png](submission/04-submit-work.png)         | See media manifest |
| Screenshot 5 · Sample receipt      | [05-preview-receipt.png](submission/05-preview-receipt.png) | See media manifest |

These are application screenshots using the explicitly labeled local preview workspace. Sample tasks and the preview receipt demonstrate the interface. They are not live marketplace activity or proof of a NIM transfer. Replace them with native-wallet screenshots when that acceptance run is complete.

## About you

**GitHub username**

greyw0rks

**E-mail address**

The builder has confirmed a contact email. The completed contact field is kept in the local submission draft.

**Team name / members**

Leave blank for a solo entry, or enter the actual team details.

**X account**

Enter your actual handle if you want to include it; otherwise leave blank.

**Builder story · optional draft**

I built Bountex around a simple idea: people should be able to earn NIM by doing useful work. Builders need testers, writers, designers and researchers, and community members need a clear way to contribute and get paid.

The MVP follows a focused task flow: publish, claim, submit proof, review and pay. Nimiq Pay provides wallet access, signed login and the payment adapter. Private evidence uploads, clear task status and independent transaction checks support the work from submission to payment. Rewards are offered by creators and paid directly after approval.

The dark navy, periwinkle and lime interface uses Three.js and Framer Motion to make the experience approachable. I focused on keeping offered rewards, approvals and verified payments clear throughout the journey.

## Promotion and discovery

Leave the two post-link fields blank until the corresponding posts exist. Publishing a draft text locally does not earn promotion points.

**Skool post draft**

I'm building Bountex for the Earn category: a NIM bounty board where builders post useful tasks and contributors submit proof of their work. The MVP supports task creation, claiming, private evidence, review and a direct Nimiq Pay payment adapter. The current preview demonstrates the workflow; native-wallet payout acceptance is next. I'd welcome feedback from people who need help testing, writing, designing or researching. Demo: [add the actual hosted URL].

**Social post draft**

Building Bountex for the Nimiq Mini Apps Competition. Small tasks, useful work, NIM rewards. Post a bounty, submit proof, review and pay through Nimiq Pay. Preview: [add the actual hosted URL]. Native-wallet payout testing is next. #Nimiq

**How did you hear about the competition?**

Enter the actual source, or leave blank. No discovery source is assumed.

## Walkthrough

The [public walkthrough](https://bountex.vercel.app/walkthrough.html) is 69.67 seconds at 1920 × 1080 and 30 fps. It includes narration, 22 English caption cues, and a downloadable MP4. Public playback, byte-range delivery, captions and the hosted mainnet API were verified. The recording uses visible preview labels and does not show a real NIM transfer. Native signed login has been confirmed by the builder separately.

The editable project and review notes are in [demo-video/hyperframes/](../demo-video/hyperframes/). The following plan can be used when replacing the preview footage with a completed native-wallet test.

Record a 60–90 second product walkthrough. Use visible preview labels when demonstrating sample data.

1. Introduce Bountex: “Good work pays. Bountex connects small useful tasks with NIM rewards.”
2. Show discovery, category filtering, task requirements, deadline and offered reward.
3. Show creating a bounty and the live task-card preview.
4. Show a worker claiming the task and submitting evidence.
5. Show creator review and approval.
6. For a preview recording, say: “This sample receipt demonstrates the interface; no NIM was sent.” For a completed native-wallet test, show the host's payment approval and the independently confirmed receipt instead.
7. Close with the actual public demo and source URLs.

Do not describe a sample receipt as a completed native payment. The [live acceptance checklist](MVP.md) identifies the remaining native-wallet checks.

## Verified form requirements

The form's published client validation was inspected on November 5, 2026:

| Field                               | Limit / requirement                                        |
| ----------------------------------- | ---------------------------------------------------------- |
| App name                            | 80 characters                                              |
| Tagline                             | 120 characters                                             |
| Short description                   | 280 characters                                             |
| Pricing                             | Free, Freemium or Paid                                     |
| Repo / demo / video                 | Required valid HTTP(S) URLs; use public, accessible links  |
| Contact email                       | Required email address                                     |
| Icon                                | PNG, JPG or WebP; 512 × 512                                |
| Thumbnail                           | PNG, JPG, WebP or GIF; 240 × 240                           |
| Screenshots                         | 3–5 PNG, JPG or WebP images; first used for social preview |
| Team name / each member / X account | 80 characters each                                         |
| Builder story                       | 4,000 characters                                           |
| Discovery source                    | 200 characters                                             |

The [rules](https://miniappscompetition.com/rules) require a public MIT repository and Nimiq Pay integration. The [FAQ](https://miniappscompetition.com/faq) lists Cycle III as October 14–November 11 and explains that the form opens a pull request to the competition repository. The exact year and submission cutoff time zone have not been established by the date-only text inspected here.

## Remaining before entry

- [x] Publish the actual MIT source repository.
- [x] Deploy the current build to a public HTTPS URL.
- Complete native Nimiq Pay wallet and reward-transfer acceptance.
- [x] Record, export and host the labeled preview walkthrough with captions.
- Replace preview media with native-wallet evidence when the acceptance run is complete.
- [x] Enter the confirmed contact email.
- Enter any actual team / social details.
- Add promotion URLs if posts have been published.
- Re-attach the seven media files; saved text does not retain image attachments.
- Review the completed form and submit it.
