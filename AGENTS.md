# QR Quest Party

## Purpose

This repository contains a commercial-ready mobile-first QR route game for
events. The experience is inspired by the visual language and battle flow of
classic Pokemon RPGs. It is played by scanning physical route QR codes and
virtual player QR cards.

Keep the playful tone, simple navigation, bright visual identity, and generic
event setup. Do not reintroduce fixed private attendee names or birthday-only
copy.

## Working Rules

- Before changing code, inspect `git status`, `git diff`, relevant files, and
  the current database integration.
- Preserve existing user changes and do not revert unrelated work.
- Make small, verifiable phases. Run `npm run build` after material changes.
- Test important flows in a mobile viewport when browser tooling is available.
- Explain results in clear Spanish. The project owner is not a professional
  developer.
- Do not expose secrets. Browser code may use only
  `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- Keep `.env.local`, `.next`, and `node_modules` out of Git.
- Supabase is the source of truth for shared game state. Use local storage only
  to remember the selected profile and harmless device preferences.
- Token grants, token spending, capture redemption, final rewards, and master
  operations must be idempotent and preferably executed atomically in the
  database.

## Stack And Deployment

- Next.js App Router, React, TypeScript, and CSS.
- Supabase for Postgres data and Realtime synchronization.
- Vercel for deployment.
- Stripe Checkout for the 1,99 EUR purchase page.
- Production and preview environment variables are managed in Vercel.
- Local development uses `.env.local`.

## Product Rules

- Every participant creates a profile by entering their own display name.
- There must be no pre-written player names.
- Duplicate display names are rejected within the current game.
- Each player gets a virtual QR card linked to a stable opaque player code.
- The master panel opens without a local password for easy event operation.
- Public commercial deployments still need real organizer authentication before
  broad sharing.

## Core Game Rules

- Main navigation: Map, Pokedex, Scan, Backpack or event utilities, and Profile.
- Players first choose one of all eight Eevee evolutions: Vaporeon, Jolteon,
  Flareon, Espeon, Umbreon, Leafeon, Glaceon, or Sylveon.
- Evolution unlocks after four captures and should use a special animation.
- Level/progress is displayed as a percentage, not hearts.
- There are exactly 12 mandatory route QR codes: 8 Trainer encounters and
  4 Team Rocket encounters.
- Every one of the 12 must be completed before the Elite Four unlocks.
- Scanning the same physical QR gives each player a suitable randomized
  challenge.
- Players should not receive the same question again until the applicable bank
  is exhausted.
- Trainer victory grants 2 tokens. Team Rocket victory grants 3 tokens.
- Reloading, rescanning, or double tapping must never duplicate rewards.
- After the first route QR, if a player waits too long before finding the next
  QR, a random wild Pokemon encounter may appear. Defeating it grants experience
  and a capture without counting as route progress.

## Personal Player QR Cards

Each generated card has a stable QR linked to exactly one profile. The same card
is used for Team Rocket invitations, Arena opponents, master lookup, bar
redemption, and administrative player lookup.

Do not encode balances, privileges, or mutable game data inside the QR. Encode
only an opaque stable identifier or secure URL and obtain current state from
Supabase.

## Administrator Requirements

The master interface should allow organizers to inspect player progress, scan a
player QR, award or remove tokens with a reason, process bar redemptions, heal a
player, recover stuck invitations or encounters, and see enough state to operate
the event.

Do not treat an open client-side panel as sufficient production authentication.
Document and isolate the authentication hardening needed before public sharing.

## Visual Direction

- Bright, colorful, polished, and mobile-first; never use a predominantly black
  interface.
- Evoke classic Game Boy Advance Pokemon RPGs: route map, towns, gyms, tall
  grass, water, paths, pixel details, battle transitions, trainers, dialogue
  boxes, HP/level bars, and victory animation.
- The map should feel like a connected Pokemon region, not a generic list of
  cards.
- Battle scenes need an animated entrance, rival presentation, player Pokemon,
  percentage bar, question/options, feedback, and reward reveal.
- Keep navigation and text very simple despite the rich presentation.
- Support reduced motion and readable contrast.
- Reuse PokeAPI sprites or other legal asset sources rather than committing
  unlicensed image dumps.

## Commercial Checkout

The `/comprar` page sells the product through Stripe Checkout for 1,99 EUR.
Do not put `STRIPE_SECRET_KEY` in client code. For real fulfillment, add a Stripe
webhook that verifies completed payment and delivers a signed download link or
license.
