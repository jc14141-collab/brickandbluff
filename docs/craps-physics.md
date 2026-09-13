# Craps rigid-body playback

The renderer uses cannon-es 0.20.0 (MIT, `dist/vendor/CANNON-LICENSE.txt`).
`scripts/build.mjs` copies the exact locked dependency into the browser assets.

References reviewed:
- https://github.com/3d-dice/dice-box-threejs/blob/main/src/DiceBox.js
- https://github.com/byWulf/threejs-dice/blob/master/lib/dice.js

Those projects demonstrate separate Three/Cannon worlds, contact materials,
pre-simulation, rest detection and preassigned face labels. We integrate Cannon
directly with the existing tavern instead of importing their entire renderers.

Each throw uses fixed 1/360-second steps with gravity, box inertia, friction,
restitution, die-to-die contacts and sleep detection. Sleep ends the simulation;
there is no end-of-throw position correction, target-quaternion interpolation,
procedural bounce, or forced upright pose. Numerical contact tolerance is 0.012
world units against a 0.5-unit die; final face normals must be within 0.0001 of up
in regression cases. A cocked or short trajectory is retried during preparation.

The seeded path is computed once and cached, then interpolated at render time.
The animation has 17% hand preparation, 75% physical playback and 8% stationary
hold. Physical time is uniformly rescaled to fit the existing multiplayer throw
duration, so it is a physics-derived replay rather than live server physics.

Server-side fair dice generation and settlement remain unchanged. Before release,
a constant cube-symmetry rotation assigns the face labels to the authoritative
result. This preserves opposite-face relationships and collision geometry. It
does not rotate the body at the end of the animation. Room roll IDs seed the
trajectory for all clients, including reconnections; balances are never settled
from a client-supplied physics result.

The felt and bumper colliders are flat planes; detailed rubber pyramids and
decorative chips are not individual colliders. This is a game-scale simulation,
not a calibrated model of a particular real casino table.
