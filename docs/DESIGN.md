# Bountex design

## Feel

A calm, capable marketplace with a playful reward moment. Dark navy surfaces, clear task information, and a custom floating blue Bountex sculpture give it a recognizable identity. Lime marks rewards and decisive actions. Typography and spacing carry the everyday interface; the 3D scene introduces the product.

Primary copy: **Good work pays.** Discovery headline: **Small tasks. Big possibilities.** Product promise: useful work earns NIM through direct creator payments.

## Palette

| Token               | Color     | Usage                                       |
| ------------------- | --------- | ------------------------------------------- |
| Background          | `#0C1018` | Main app canvas                             |
| Sidebar             | `#10141D` | Persistent desktop navigation               |
| Surface             | `#141A25` | Task cards                                  |
| Panel               | `#141D2B` | Dialogs and workflow panels                 |
| Border              | `#293141` | Quiet surface boundaries                    |
| Primary text        | `#F1F3F8` | Headings and essential information          |
| Secondary text      | `#8593AA` | Readable metadata                           |
| Acid lime           | `#C8FF4D` | Primary actions, NIM rewards and completion |
| Electric periwinkle | `#8496FF` | Brand sculpture and navigation accents      |
| Aqua                | `#74D6C8` | Helpful secondary status accents            |
| Soft violet         | `#BDA1EF` | Design category                             |
| Sky                 | `#81B4FA` | Development category                        |
| Apricot             | `#E8B485` | Writing category                            |
| Mint                | `#7CD2AC` | Research category                           |
| Rose                | `#DF9FC5` | Community category                          |

Space Grotesk supplies the display voice; Inter supplies body and form text. Both are bundled locally. Rewards use tabular numeric spacing and a small Nimiq hex mark. Status is communicated with words as well as color.

## Screens and interaction

| Screen      | Layout and purpose                                                                 | Main action                                    |
| ----------- | ---------------------------------------------------------------------------------- | ---------------------------------------------- |
| Explore     | Greeting, 3D hero, honest offered-reward totals, search, category chips, task grid | Find and claim a bounty                        |
| Task detail | Offered reward, effort and deadline, requirements, creator, status timeline        | Claim, submit, review or pay according to role |
| Post bounty | Focused form, acceptance checklist and desktop live preview                        | Publish a task for one worker                  |
| My work     | Separate working/created tabs; cards retain reward and status                      | Resume work or review evidence                 |
| My rewards  | Confirmed earnings, outstanding approvals and receipts                             | Inspect a payment receipt                      |

Desktop uses a fixed sidebar and three card columns at wide sizes, dropping to two on compact displays. Mobile uses one card column, a compact header, horizontal category scrolling and a four-item bottom navigation. The hero places its sculpture below the main copy on narrow phones.

Each task card communicates category, task title, concise instructions, reward, effort, creator and remaining time before opening the detail dialog. Search and sorting update the feed immediately. Empty states offer the next useful action.

Dialogs trap keyboard focus, restore focus when closed, support Escape and outside clicks, and scroll independently. Form inputs have labels and inline errors. Text and evidence links preserve drafts on the device; binary files must be reselected after leaving. Review rejection and revision require a reason. Payment shows recipient and reward before opening Nimiq Pay.

## 3D direction

The hero uses a custom extruded six-sided blue badge with an original extruded B glyph, beveled edges, an orbit ring, lime geometric satellites and soft point lights. It is a brand illustration, not a new tradable token.

- Slow vertical drift, small rotation and restrained metallic highlights.
- React Three Fiber over Three.js, without a large scene-helper library.
- Lazy-loaded separately from the main application bundle.
- Unmounted off-screen; canvas pixel ratio capped at 1.5.
- A flat hex badge remains available if WebGL is unsupported or the canvas fails.
- Reduced motion renders a still frame rather than a continuous loop.

## Interface motion

| Interaction   | Treatment                                           |
| ------------- | --------------------------------------------------- |
| Route changes | 180 ms opacity / small vertical entrance            |
| Task feed     | 280 ms entrances, capped 35 ms staggering           |
| Card hover    | 4 px lift and stronger border                       |
| Card press    | Small compression                                   |
| Dialog        | 200 ms fade, scale and vertical settling            |
| Notifications | Small spring entrance with dismiss control          |
| Task progress | Clearly staged lifecycle and lime completed markers |

No animation delays a wallet approval or changes whether a task is paid. Preview receipts and real verified receipts have distinct copy. Reduced-motion preferences disable nonessential transforms and CSS transitions.

## Trust and clarity

- Show “offered reward”; never “funded,” “guaranteed” or “escrowed.”
- Approval and confirmed payment are separate steps.
- Sample tasks, roles, totals and receipts are labeled as preview.
- Receipt confirmation requires backend verification.
- Workers can record problems with approved or rejected bounties.
- Three active unpaid bounties per creator reduce open payment promises.

## Design acceptance

- No horizontal page overflow at 320, 360, 390, 768, 1024 and 1440 px.
- Discovery, forms, account selection, submission and payment remain operable on a phone.
- All essential text meets WCAG AA contrast; focus and labels are visible.
- No route requires WebGL to perform work.
- Empty, loading, rejected, revision, pending and recovery states have explicit next steps.
- The complete worker/creator flow is understandable without reading implementation documentation.
