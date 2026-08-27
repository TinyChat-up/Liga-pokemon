# Nivel 27 - Liga de la Terraza

## Purpose

This repository contains a private mobile-first birthday game for Alejandro's
27th birthday. The experience is inspired by the visual language and battle
flow of classic Pokemon RPGs. It is played by scanning physical QR codes around
one terrace. Preserve the playful tone, simple navigation, and bright visual
identity.

The user is not a professional developer. Work directly in the repository,
explain results in clear Spanish, and give exact actions only when a manual step
is unavoidable.

## Working rules

- Before changing code, inspect `git status`, `git diff`, the relevant files,
  and the current database integration. Never assume the repository still
  matches an earlier version.
- Preserve existing user changes and do not revert unrelated work.
- Make small, verifiable phases. Run `npm run build` after material changes.
- Test important flows in a mobile viewport when browser tooling is available.
- Do not merely propose code when asked to implement: edit, test, and summarize.
- Do not expose secrets. Browser code may use only
  `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
  Never add a Supabase `service_role` key to client code or commits.
- Keep `.env.local`, `.next`, and `node_modules` out of Git.
- Supabase is the source of truth for shared game state. Use local storage only
  to remember the selected profile and harmless device preferences.
- Token grants, token spending, capture redemption, final rewards, and admin
  operations must be idempotent and preferably executed atomically in the
  database.
- Do not create or rename players without explicit approval.

## Stack and deployment

- Next.js 16 App Router, React, TypeScript, and CSS.
- Supabase for Postgres data and Realtime synchronization.
- Vercel for deployment.
- Production and preview environment variables are managed in Vercel.
- Local development uses `.env.local`.
- The current test build must remain accessible. Do not re-enable the launch
  timer unless Alejandro explicitly requests the final release mode.
- Intended opening time: Saturday, 29 August 2026 at 17:00,
  `Europe/Madrid`.

## Exact profiles

There are 15 profiles in total. Alejandro is the only administrator.

1. Eduardo
2. Karim
3. Carlos de la Fuente
4. Cristian
5. Nicole
6. Ros
7. Maria Santana
8. Maria Alfonso
9. Lola
10. Ismael
11. Marco
12. Alex
13. Maria Loufoukou
14. Juan Carlos
15. Alejandro - administrator

Display the accented forms `María Santana`, `María Alfonso`, and
`María Loufoukou` when the stored data uses those names. Never invent a
sixteenth attendee.

## Core game rules

- Every visit begins with the simple profile selector unless the same device
  has intentionally remembered a profile.
- Main navigation: Map, Pokedex, Scan, Backpack, and Profile.
- Players first choose one of all eight Eevee evolutions: Vaporeon, Jolteon,
  Flareon, Espeon, Umbreon, Leafeon, Glaceon, or Sylveon.
- The selected evolution is visible to Alejandro in administration and is
  persisted in Supabase.
- Evolution is unlocked after four captures and should use a special animation.
- A level/progress bar is displayed as a percentage, not hearts.

### Route and QR codes

- There are exactly 12 mandatory route QR codes: 8 Trainer encounters and
  4 Team Rocket encounters.
- Every one of the 12 must be completed before the Elite Four unlocks.
- Scanning the same physical QR gives each player a suitable randomized
  challenge. A player should not receive the same question again until the
  applicable bank is exhausted.
- The scanner opens the phone camera and also offers manual code entry for
  browsers without reliable camera or `BarcodeDetector` support, especially
  Safari on iPhone.
- Trainer victory grants 2 tokens. Team Rocket victory grants 3 tokens.
- Reloading, rescanning, or double tapping must never duplicate rewards.

### Challenge content

Use large banks with progressive difficulty. Favor short but genuinely clever
problems in these categories:

- logic and deduction;
- number, symbol, and visual patterns;
- codes and cryptograms;
- spatial reasoning and observation;
- short chess positions and strategy.

Questions should suit an intelligent mixed group of engineers, doctors,
teachers, and other professionals. Keep individual problems concise and avoid
generic trivia or childish filler.

### Team Rocket

- Two players are recommended, but solo play must always remain possible.
- For cooperative play, player A scans player B's personal card QR.
- Player B receives a Realtime invitation showing who invited them.
- On acceptance, both devices open the same synchronized challenge and share
  its result.
- Rejecting, expiring, retrying, or reconnecting must leave both accounts in a
  consistent state and cannot duplicate tokens.

### Arena de Paya

- Arena de Paya is not a thirteenth QR and is not a permanent map destination.
- It appears as a surprise before one or two of the 12 route encounters for
  each player's run.
- The player chooses an opponent and scans that person's card QR.
- Both screens must clearly show the opponent and challenge.
- Challenges include karaoke battle, aura-farming contest, finger wrestling,
  shot contest, beer or wine tasting, bad-joke contest, impossible sales pitch,
  and imitation.
- Alejandro scans the winner's personal QR and awards 2 tokens from the admin
  flow. The award must be recorded and cannot be claimed twice.

### Captures and Pokedex

- Victories can award a random real Pokemon obtained from PokeAPI, including
  ordinary, special, and rare legendary captures.
- Store enough Pokemon data in Supabase to render a stable capture later even
  if the external API is temporarily unavailable.
- Captures appear in the Pokedex with number, name, official image, rarity,
  acquisition time, and token value.
- A captured Pokemon can be kept or redeemed for tokens. Redemption is
  irreversible, atomic, recorded, and cannot be repeated.

### Tokens and bar redemption

- Tokens accumulate and can be spent in any combination.
- Default menu: beer 2, shot 3, extra barbecue portion 4, mixed drink 6.
- A player shows or provides their personal QR at the bar.
- Alejandro scans it in the admin account, sees the balance, selects the item,
  and confirms the redemption.
- Record who requested what, cost, time, and the administrator who processed it.
- Reject redemptions with insufficient balance and prevent duplicate submits.

### Pokemon Center

When weakened, a player may recover by choosing one configured cost: a drink,
a short challenge, or losing tokens. The system should clearly record the
choice without requiring another ordinary player to validate it.

### Elite Four and ending

- The Elite Four unlocks only after all 12 mandatory QR encounters are
  completed.
- It presents three randomized questions of increasing difficulty.
- Once started, the final attempt cannot simply be exited to avoid its state.
- Completing all three grants a randomized barbecue privilege such as extra
  chicken, longaniza, ribs, or another configured reward.
- Final rewards are persisted and cannot be claimed repeatedly.

## Personal player QR cards

Each physical personalized card has a stable QR linked to exactly one profile.
The same card is used for:

- selecting a partner for Team Rocket;
- choosing an opponent in Arena de Paya;
- identifying the winner to Alejandro;
- bar redemption and administrative player lookup.

Do not encode balances, privileges, or mutable game data inside the QR. Encode
only an opaque stable identifier or secure URL and obtain current state from
Supabase.

## Administrator requirements

Alejandro needs a clearly separated administrator interface that can:

- inspect every player's evolution choice, progress percentage, completed QR
  codes, captures, token balance, status, Arena history, Team Rocket sessions,
  redemptions, and final reward;
- search or scan a personal player QR;
- award or remove tokens with a recorded reason;
- process bar and Pokemon redemptions;
- register Arena winners;
- recover a stuck invitation or encounter;
- reset one player or one encounter without damaging other players;
- see an audit trail for material balance changes.

Do not treat selecting the display name `Alejandro` as sufficient production
authentication. Keep test access convenient for now, but document and isolate
the authentication hardening needed before public sharing.

## Visual direction

- Bright, colorful, polished, and mobile-first; never use a predominantly black
  interface.
- Evoke classic Game Boy Advance Pokemon RPGs: route map, towns, gyms, tall
  grass, water, paths, pixel details, battle transitions, trainers, dialogue
  boxes, HP/level bars, and victory animation.
- The map should feel like a real connected Pokemon region, not a generic list
  of cards. Clearly distinguish locked, available, completed, and final nodes.
- Battle scenes need an animated entrance, rival presentation, player Pokemon,
  percentage bar, question/options, feedback, and reward reveal.
- Keep navigation and text extremely simple despite the rich presentation.
- Support reduced motion and readable contrast. Sound is optional and must have
  an obvious mute control.
- Reuse PokeAPI sprites or other already configured legal asset sources rather
  than committing unlicensed image dumps to the repository.

## Architecture direction

The initial prototype placed substantial logic in `app/page.tsx`. Improve it
incrementally rather than rewriting blindly:

- components for profile selection, map, scan, battle, Team Rocket, Arena,
  Pokedex, backpack, profile, Elite Four, and admin;
- typed game-domain models;
- centralized constants and challenge banks;
- Supabase query/mutation services;
- hooks for player session and Realtime synchronization;
- server-side routes or database RPC functions for privileged atomic actions;
- explicit loading, empty, offline, reconnecting, and error states.

When beginning a new task, first report what the code currently does, what has
changed according to Git, and the smallest safe next phase. After completing a
task, report changed files, verification performed, remaining risks, and the
next recommended phase.
