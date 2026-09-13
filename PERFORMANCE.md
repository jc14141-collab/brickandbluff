# Performance changes — 2026-09-12

Validated against the current Sites Worker contract. No D1 schema migration in this release.

## Implemented

- Club.change skips UPDATE when the encoded state is identical. Presence writes are limited to ten-second intervals. Actual commands retain optimistic concurrency and idempotency.
- A room read advances only its own game. Directory/admin reads perform expiry cleanup, not AI work for every active game. Expiry still uses last human action, not presence.
- Room polling sends an opaque revision and accepts a minimal unchanged response, after authorization and expiry processing. GET still advances due game events: these are deliberate state transitions, not strictly pure reads.
- Hidden pages skip room/directory requests; identical directory markup and action controls retain their DOM nodes. Failed commands unlock before resync.
- Game renderers load dynamically. The production lobby static dependency graph excludes Three.js and Cannon. Game CSS remains a combined sheet to preserve the existing cascade; 21 stylesheet links become one.
- Six large images use WebP, retaining PNG source originals. Stable asset names revalidate through ETag; hashed JS/CSS get immutable cache headers. Embedded textual assets use gzip, with the Workers manual encoding option and a plain fallback.
- Decoded asset cache is bounded to 2 MiB and excludes individual payloads over 256 KiB.
- Versioned room codec reads legacy saves, preserves Set/Map/Date/undefined, rejects unsupported executable values and circular state, and explicitly restores game runtime dependencies. Set representation stays readable by the former codec.

## Measurements

- Six images: 10,590,373 -> 1,294,776 bytes.
- Worker: approximately 19,295,467 -> 5,775,439 bytes.
- Production lobby initial static JS graph: 61,401 bytes before transfer compression (excludes CSS, images and fonts).
- Ten consecutive idle 900 ms room polls plus room-list reads: zero UPDATE calls; the ten-second heartbeat adds one.
- 56 targeted regression tests passed: funds/concurrency/idempotency, room expiry, codec compatibility, static serving and dependency graph, avatar/layout, client action lifecycle.
- These are local measurements, not live concurrency or physical iPad FPS results. A broader legacy test run contains outdated access-password expectations and is not being reported as an all-suite pass.

## Deliberately not claimed as solved

- The authoritative data remains in club_state. JSON parsing/serialization of the global record and cross-room CAS contention remain. A proper split needs per-player and per-room versions plus transactional debit/credit/refund operations, idempotency receipts, online migration, reconciliation and rollback. Do not replace this with two independent writes.
- No WebSocket or Durable Object binding was introduced. Poll intervals remain 900 ms while visible; only unchanged payloads/background work were reduced.
- Assets are still embedded under the established deployment contract. R2/static offload requires provisioning and a versioned upload/deploy workflow. Compression is not equivalent to offloading.
- The full Chinese font is retained to support arbitrary nicknames. Safe subsetting needs a fallback strategy.

Workers precompressed response reference: https://developers.cloudflare.com/workers/runtime-apis/response/
