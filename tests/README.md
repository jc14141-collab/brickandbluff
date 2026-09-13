# Validation

Run with Node.js:

- `node tests/game.test.mjs` — 980 seeded 4–10-seat games with variable stacks, side pots, chip conservation, short all-in reopening, information isolation, royal-flush ties, legal AI actions.
- `node tests/scene.test.mjs` — Three.js geometry checks across 21 table-size / viewport combinations; checks card separation, showdown placement, winner markers, idle transforms, and skill-effect cleanup. Uses real geometry and mocked rendering, not browser visual verification.
- `node tests/ui.test.mjs` — View logic with a minimal document stub: lobby seat count, generated opponent labels, all skill hooks, and guardian refund.

Local strategy comparison: 2,400 four-seat hands against the previous strategy from commit d010f52, rotating the new agent through every seat for each of 600 seeded decks, 560 samples per decision. New agent net +4,319 chips (+1.80 per hand); approximate grouped 95% interval −5.77 to +9.37 chips/hand. This does **not** establish a significant strength gain, an external rating, or GTO convergence. Production uses 1,200 / 1,800 samples; the benchmark is only a local regression comparison. No external pretrained model is included.
