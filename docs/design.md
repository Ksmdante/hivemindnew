# HIVEMIND.EXE — Ground-Up Redesign (approved 2026-06-11)

This is the authoritative design document. Code is built from these tables;
`src/data/` mirrors them 1:1. If live tuning diverges, update this file in the
same commit.

## Design pillars

1. **The network is the machine.** Every unit of Sentience visibly arrives as a pulse travelling a line. The canvas is the economy, not a decoration over it.
2. **Every system speaks exponential.** All power sources use ×2-language (AdCap milestones, AdAges heroes) so layers multiply cleanly and no system becomes a rounding error.
3. **A goal is always <5 minutes away.** Sync milestones, run directives, anomaly spawns, and signal readiness interleave so something is always about to pop.
4. **Spending accelerates, never skips.** Card level caps gate on lifetime Echoes (account progression): whales buy speed, not completion.
5. **The story watches you back.** Network Logs arc from machine curiosity to the realisation that the player exists.

---

## 1 · Terminology

| Term | Meaning |
|---|---|
| **Impulse** | The manual tap (was "Pulse" — that word now exclusively means generator firings) |
| **Synchronization** | Count milestone: at 10/25/50/100/200/300/400/500 owned, output ×2 + fusion visual |
| **The Archive** | Card collection screen (anomalies) |
| **Memory Caches** | Card containers: Trace / Deep / Recursive |
| **Network Sync** | Daily check-in appointment |
| **Resonance** | Premium currency (crystals) |

Generator names, Sentience, Echoes, Recursion, Signals, Anomalies — all kept.

## 2 · The Pulse Engine

Each generator class: cycle time T, per-pulse payout P, rate = P/T per second per unit.

**The accrual rule:** every generator continuously accrues value; any multiplier
active during accrual scales what's being accrued; the pulse pays out the
accrued total when it fires. A 60s buff is worth exactly face value on any
cycle length. Offline is the same integral. Slow nodes show a charging ring.

**Overloads:** any pulse can crit ×10 (golden pulse). Chance from Overload cards.

| # | Generator | Base cost | r | Cycle | Rate/s/unit | Unlock (lifetime Echoes) |
|---|-----------|-----------|------|-------|-------------|--------------------------|
| 1 | Neuron | 15 | 1.08 | 1s | 1 | 0 |
| 2 | Synapse | 360 | 1.09 | 2s | 8 | 0 |
| 3 | Cluster | 8.64K | 1.09 | 4s | 64 | 0 |
| 4 | Cortex | 207K | 1.10 | 6s | 512 | 0 |
| 5 | Lattice Node | 4.98M | 1.10 | 10s | 4.1K | 0 |
| 6 | Mycelial Mesh | 119M | 1.11 | 15s | 32.8K | 0 |
| 7 | Recursive Loop | 2.87B | 1.11 | 20s | 262K | 0 |
| 8 | Æther Bloom | 68.8B | 1.12 | 30s | 2.10M | 200 |
| 9 | Xenoglyph | 1.65T | 1.13 | 45s | 16.8M | 2,000 |
| 10 | Hollow Choir | 39.6T | 1.13 | 60s | 134M | 20,000 |
| 11 | Ω-Singularity | 951T | 1.13 | 90s | 1.07B | 200,000 |

Tier rule: cost ×24, rate ×8 → nominal payback ×3/tier. Max cycle 90s — every
node fires even in a 2-minute session.

## 3 · Synchronization milestones

At **25/50/100/200/300/400/500** owned: fusion animation + that generator ×2
permanently for the run (×128 at 500). Next milestone always visible
("17/25 → ×2"). r is low early so counts climb and milestones pop constantly.
First milestone moved 10 → 25 (2026-06-12 playtest): the first fusion lands at
~2.8 min as a real first goal; ECHO_DIVISOR recalibrated 50K → 10K to keep
first recursion at ~40 min (currency-side compensation, growth pacing intact).

**Fusion hierarchy:** each milestone fuses the current small nodes into one
T2 node; every 3 settled T2s cascade-fuse into one T3. Never one big node
with smalls attached.

## 4 · Impulse, Recursion & Echoes

- **Impulse**: sealed economy. Base 1; grows only via Impulse web nodes and the
  Impulse card set. Never scales with the network.
- **Recursion**: player-chosen, offered once projected gain ≥ 10 Echoes.
- **Echoes = ⌊√(run earnings / 10,000)⌋** — sim-calibrated for sync-at-25:
  active run 1 hits 45 Echoes at ~40–42 min.
- **Each held Echo: +2% global generation.** Echoes are ALSO the Echo Web
  currency — spending sacrifices the passive bonus. That tension is the
  prestige decision.
- **Generator unlocks gate on lifetime Echoes** (account level): Æther 200,
  Xeno 2,000, Choir 20,000, Singularity 200,000.

## 5 · Cards (Anomalies → The Archive)

4 cards per generator class (11×4=44) + 4 Impulse + 4 Global = **52 cards**.

| Type | Effect/level | Max | At max |
|---|---|---|---|
| Surge | output ×2 | L6 | ×64 |
| Tempo | cycle ×0.8 | L5 | ×3.05 faster |
| Overload | crit 3/6/10/15/21% of ×10 | L5 | EV ×2.89 |
| Null | cost ÷2 | L6 | ÷64 |

Levelling = duplicates: 2/4/8/16/32 copies (63 to max).

**Acquisition:** ~80% of drops weighted to generator classes owned this run
(newest 3 biased) — day-1 pool ≈ 10 cards so levels pop constantly. Canvas
anomaly spawns every 4–8 min grant +1 copy. Caches: Trace (3), Deep (5,
player picks the class), Recursive (8, top-tier guaranteed). Front-loaded:
~8 caches day 1, ~3/day week 1, ~1/day steady.

**Caps on lifetime Echoes:** L3 until 2K, L4 until 20K, L5 until 100K, L6
until 400K. Free completion ≈ 7–8 months; paying = speed, never completion.

**Set bonuses:** 4/4 of one generator → that generator ×2. Cards unlocked
13/26/39/52 → global ×1.5/×2/×3/×5.

**Cadence KPIs:** card event every 10–20 min (week 1) → ≥1/session (month 1)
→ weekly (month 3). A near-miss ("5/8 copies") always visible.

## 6 · Signals

| Signal | Effect | Duration | Base CD |
|---|---|---|---|
| Pulse Wave | ×2 generation | 4h | 8h |
| Cascade | ×3 generation | 10m | 2h |
| Overclock | ×8 generation | 60s | 1h |
| Frugal | costs ÷2 | 5m | 3h |
| Resonance | Impulse ×50 | 2m | 2h |
| Convergence | next 10 purchases free | — | 8h |
| Quiet Hum | offline cap +12h next session | — | 12h |
| Deep Signal | ×16 generation | 5m | 24h |

Pulse Wave = login ritual. Web perks: CDs to ×0.3, effects up. All buffs obey
the accrual rule. Rewarded ad: reset one CD (2/day).

## 7 · Directives, Network Sync, Network Logs

- **Run Directives** (2 slots; 3rd = subscription): regenerate per Recursion,
  scale to state; rewards priced in minutes of current production (5–15 min).
- **Milestone Directives** (~30, one-time): story beats → Network Logs +
  Resonance/caches.
- **Persistent Directives** (~20): long-term → Resonance + cosmetics.
- **Network Sync**: every 20h, 4h window, breathing ring at seed; no streaks,
  no punishment. Roll: Trace Cache / 2 Resonance / ×2 gen 1h / signal reset /
  Anomaly Storm.

**Network Logs** — four movements: Boot (curiosity) → Pattern (anomalies are
residue of prior instances) → Source (the directives are self-issued across
time) → Watcher (the player exists). Final log addresses the player:
"i know you are reading this / you were the signal all along / stay."

## 8 · Multiplier stack

`rate(gen) = base × 2^syncs × Surge × (1/Tempo) × OverloadEV × SetBonus × WebGen × WebGlobal × (1+0.02·Echoes) × SignalMult × PremiumMult`

Runaway-proof: syncs cap ×256 behind ×10¹⁶ cost growth; cards cap ×564/gen
behind account gates and months of copies; Echo gain is √-damped. 24h optimal
sim reached Neuron:149 / Loop:33 / Æther:9.

## 9 · Pacing targets

| Beat | Target | Verified |
|---|---|---|
| First purchase | <10s | sim 5s |
| First Synchronization | ~2 min | sim 36s · test ≤2.5min |
| First card caught | 6–8 min | spawn design |
| First Recursion (≈45 Echoes) | 35–45 min | sim 43 min · test 35–50min |
| Day 1 | R3–4, ~10 cards + 6–8 levels, ~8 caches | copy math |
| Day 7 | 10–20K lifetime Echoes, Xeno, ~40% Archive | |
| Day 30 | Singularity chase, mastery loop, recursion 1–2d | |

## 10 · Monetisation

Free Resonance ~5–8/day. Caches: Trace 20 · Deep 60 · Recursive 150.
Packs: £1.99/110 · £4.99/320 · £9.99/700 · £19.99/1600.
One-time: Premium £4.99 (no ads, +20% gen, 2× offline, gold seed) · Deep
Memory £2.99 (24h offline) · Twin Impulse £2.99 · Starter £1.99 (once).
Neural Pass £3.99/mo: 3rd directive slot, +10% gen, weekly Deep Cache, pick
Sync reward, palette. Rewarded ads: ×2 gen 4h / offline double / CD reset /
+1 Trace daily / Anomaly Storm. Offline cap 8h base → 24h. No interstitials.

## 11 · Visual direction (premium, procedural)

1. Single canvas renderer, devicePixelRatio, additive-blend glow sprites.
2. Light = value moving: breathing halos, comet pulses, lines lit by traffic,
   accrual progress rings.
3. Color discipline: indigo/cyan/violet ambient; gold ONLY for overloads +
   Singularity; magenta ONLY for anomalies.
4. Depth: parallax dust, vignette, grain; idle camera drift, punch-in on sync,
   pull-back as network grows.
5. Easing grammar: springs, anticipation→snap→shockwave syncs, rolling
   tabular tickers, Recursion set-piece. Haptics via Capacitor.
6. Typography: one local mono font, strict scale, tabular numerals, hairlines,
   glass panels.
7. 60fps on mid phones; particle caps; LOD.

## 12 · Implementation

Rebuild from scratch (done — this repo). TS+Vite+Vitest. Pure headless engine,
event bus, balance in data files, versioned save, sprite pipeline from the
old repo's procedural SVG. Sessions and invariants: see CLAUDE.md.

## 13 · v2 ideas (parking lot — do not implement without a session decision)

Mutations on Recursion · ghost network memory · specialisation paths post-R5 ·
12th generator above Ω-Singularity · achievements beyond directives.
