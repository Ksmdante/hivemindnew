# HIVEMIND.EXE v2 — agent contracts

Idle/incremental game. Vanilla TS + Vite + Vitest, no framework. Mobile-first
(portrait, ~400×700), later wrapped with Capacitor. The full design is in
`docs/design.md` — read the relevant section before changing any system.

## Commands

- `npm test` — invariant suite. **Must be green before every commit. No exceptions.**
- `npm run dev` — dev server
- `npm run build` — typecheck + production build (deployed to Pages by CI on push to main)

## Architecture rules (non-negotiable)

1. **`src/engine/` is pure and headless.** No DOM, no `Date.now()`, no
   `Math.random()`. Time advances only via `advance()`/`applyOffline()`;
   randomness only via `nextRandom(state)` (seeded, stored in the save).
2. **Engine → presentation via the event bus only** (`src/engine/events.ts`).
   Renderer/audio/haptics subscribe; they never reach into engine internals to
   mutate, and the engine never imports from `render/`, `ui/`, or `audio/`.
3. **All balance numbers live in `src/data/`** as data files mirroring the
   tables in `docs/design.md`. Tuning never edits logic files.
4. **The accrual rule is sacred** (design §2): generators accrue continuously;
   multipliers scale accrual; pulses pay out accrued value. Any change to
   `advance()` must keep `test/economy.test.ts` "accrual rule" tests green.
5. **Multiplier seams:** new power systems (cards, Echo Web, set bonuses) plug
   into the seam functions in `economy.ts` (`genRate`, `genCost`,
   `overloadChance`, `impulseValue`) — never into `advance()`/`buy()` directly.
6. **Save is versioned** (`save.ts`, schema int). Any state shape change bumps
   the schema and extends `deserialize` defensively.

## Balance invariants (enforced by `npm test`)

| Invariant | Test |
|---|---|
| First Synchronization ≤ 3 min (greedy bot; first threshold is 25) | pacing.test.ts |
| 45 Echoes (first good Recursion) in 35–50 min (greedy bot) | pacing.test.ts |
| Timed buff worth exactly face value on 1s and 90s cycles | economy.test.ts |
| Offline(Δt) == live ticking of Δt | economy.test.ts |
| Impulse never scales with network size (sealed economy) | economy.test.ts |
| No NaN at extreme magnitudes | economy.test.ts |

If a deliberate rebalance moves a target, change the test AND the table in
`docs/design.md` §9 in the same commit, and say so in the commit message.

## Session log

- **S0+S1 (done):** scaffold, pure engine (pulse accrual, syncs, Impulse,
  Echo formula, offline, save), invariant suite green, placeholder shell UI.
- **S2 (done):** canvas renderer — sprite atlas rasterized from procedural SVG
  (`render/shapes.ts` ported from the prototype), additive glow, comet pulses
  to the seed, fusion-on-sync, accrual rings (cycle ≥10s), parallax dust,
  camera fit/drift/punch, ripples, floats, recursion flash, ResizeObserver
  sizing, FPS in dev panel, `window.__hm` dev handle (DEV builds only).
  **Still owed from S2 scope:** local mono font, grain pass, on-device 60fps
  check (do during S7 polish / S9 QA).
- **S2.1 feel fixes (done, from first playtest feedback):** per-node ambient
  ping scheduler (each visual node fires comets on its own cycle, phased from
  bornAt; engine class-pulses remain the income truth — seed flash/floats/
  overloads only; balance-neutral by construction). Real collision avoidance
  with per-stage radii + golden-angle fallback (no more stacked nodes). UI:
  per-row sync progress bars, generator color dots, press states, transitions,
  recurse-button pulse. Visual cap purchases now acknowledge via node ripple.
- **S2.2 (done, second playtest round):** 64-unit seed clearance (nothing
  spawns near the centre; class hubs spawn ~92 out in golden-angle sectors).
  Hub-and-spoke topology: first node of each class = hub with brighter trunk
  to seed; siblings edge to their hub (resolved per frame). Pings now run at
  the generator's TRUE cycle per node, phased by placement time (no rate
  stretching) — bootstrap scatters phases for loaded saves; comet cap 120.
- **S2.3 (done, third playtest round):** REBALANCE: first sync 25 (was 10),
  ECHO_DIVISOR 10K (was 50K) — sim-recalibrated, pacing gate now ≤3 min; test
  + design.md updated in same commit. Comets travel real edges only, inward
  (sibling→hub, hub→seed), colored by generator. Tiered fusion: smalls→T2,
  3×T2 cascade→T3 (bootstrap honours hierarchy). Seed-centred camera, zoom
  driven by radial extent (close-up start → pull-back as network grows).
  Distinct evolving seed: orbiting arc rings, one per Recursion (cap 5),
  eye-like core. PARKED for later: background palette evolving per Recursion.
- **S2.4 (done):** hub = biggest node of class (stage, then age) so the trunk
  node is always the largest; web topology — each node stores a parentId
  (~30% link to hub, rest to a random sibling; stale links reattach to the
  nearest sibling); comets/edges follow the node's actual link. Visual cap
  44/class (bootstrap smalls 20, comet cap 140). Dev console: FORCE RECURSE,
  +1 RANK, UNLOCK ALL GENS, RESET SAVE alongside grants/time-warps.
- **S3 (done):** Echo Web — data in `data/web.ts` (Awakening + Architecture +
  Cognition live; Signals/Anomalies roots dormant until S5/S4), engine in
  `engine/web.ts` plugged into the seams (global mult, cost div, impulse,
  echo gain, start sentience, offline cap). Spending Echoes sacrifices the
  held +2%/Echo passive. Web screen (`ui/web.ts`, SVG graph + trade panel),
  WEB button in HUD (pulses when something is buyable), recursion collapse
  overlay. Save schema 2 (+web). Tests: web.test.ts + run-2-faster pacing
  gate (28 total).
- S4: cards (Archive) — plug into `overloadChance`/`genRate`/`genCost` seams.
- S5: signals — ride the existing `ActiveBuff` system; add cooldown store.
- S6: directives + logs + Network Sync. S7: audio/haptics. S8: monetisation
  stubs. S9: packaging.

## Reference material

The original prototype lives at `../hivemind/` (read-only reference): shape
functions in `generators.js`, anomaly corruption art in `anomalies.js`,
generative audio in `audio.js`, organic layout in `render.js`.
