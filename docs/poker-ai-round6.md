# Poker AI Round 6: Multiway All-in Response Model

## Question

Can the experimental response model estimate fold/call behavior in multiplayer all-in pots, and does its largest-stack all-in valuation improve actual chip returns when used by the current policy?

## Held-out response test

The response model was trained on 3,000 synthetic 4- and 6-player legacy-bot hands (31,469 decisions, including 12,000 decisions after a forced all-in). It was evaluated on separate seeds across 1,000 held-out forced-all-in hands at each table size. The held-out labels came from the pinned v127 bot policy; no hidden cards or future outcomes were used as model features.

| Table | Decisions | Fold rate | Context model Brier | Pooled-rate Brier | Context model log loss | Pooled-rate log loss |
|---|---:|---:|---:|---:|---:|---:|
| 4 players | 3,000 | 82.9% | 0.0695 | 0.1436 | 0.2213 | 0.4634 |
| 6 players | 5,000 | 87.5% | 0.0596 | 0.1174 | 0.1918 | 0.4036 |

The per-hand paired 95% intervals for model-minus-pooled Brier were [-0.0807, -0.0676] in 4-player games and [-0.0619, -0.0536] in 6-player games. Log-loss intervals were also below zero: [-0.2576, -0.2265] and [-0.2222, -0.2014]. This is a strong held-out prediction improvement over one pooled fold rate for the same synthetic policy family.

## Paired chip-return test

The old policy and the experimental policy were compared on paired fixed deals, rotating the challenger through all four seats: 300 deal groups per seat, equal 100-BB stacks, 100 equity samples per decision, and legacy synthetic opponents. The only enabled change was the largest-stack multiway all-in valuation.

Across the 1,200 challenger hands, the paired chip-return difference was -0.60 BB/100, 95% interval [-1.78, +0.58]. The interval includes zero and the point estimate is slightly negative, so this does not establish an earnings improvement or a meaningful regression.

The valuation was eligible under a broad structural check in 1,657 decision windows, but actually evaluated only 5 times (0.30%). The policy's candidate-generation and raise selection rarely reach this branch. Its observed latency was about 3–6 ms per evaluation. Because the intervention changed only five decisions, the earnings test has very little power to establish a useful strategy effect.

## Decision

Keep this branch experimental and disabled in production. Response prediction passed a synthetic held-out hurdle, but the all-in action valuation has not demonstrated better chip returns and rarely activates. The tests do not measure human-opponent behavior, and the response training/evaluation both use legacy bot policies.

## Next step

For multiplayer play, prioritize decision coverage: estimate fold/call responses for ordinary bet sizes (not just maximum-stack all-ins), then evaluate the complete current-street payoff across main and side pots. Before changing production, run paired complete-hand tests with a meaningful number of changed decisions and report both chip-return differences and uncertainty. Keep turn/river future-street search out of scope until the current-street model is independently calibrated.
