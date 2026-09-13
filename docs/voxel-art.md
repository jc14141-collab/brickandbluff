# Voxel tavern art

Shared spruce grain, fine woven felt and paper edges are procedurally authored in `dist/voxel-art.mjs`. All five games retain their camera and gameplay geometry. Poker and blackjack retain their separate playing areas. Guandan now shares the tavern environment.

Existing room lights and the shadowed key illuminate the tavern. Candle halos share one instanced draw instead of adding 24 point lights. Opaque emissive bottle materials avoid the extra transmission render pass. Gold outlines are instanced per area. Dust preserves atmosphere without light cones. These WebGL effects are not UE4, ray tracing or true subsurface scattering.

Rendering starts with a 1.8-million-pixel budget and maximum 1.5 device-pixel ratio; the shadow map is 1024 square. This reduces high-DPI GPU load without changing camera composition or CSS HUD resolution. Dice retain their clearcoat but no longer trigger a transmission pass. Real device frame rates still require measurement; automated tests verify rendering configuration, game correctness and geometric visibility, not FPS.

UI borders: Kenney UI Pack — Pixel Adventure, CC0, https://kenney.nl/assets/ui-pack-pixel-adventure . License in `dist/art/KENNEY-LICENSE.txt`.

Chinese/Latin font: Fusion Pixel 12px proportional, release v2026.09.01, https://github.com/TakWolf/fusion-pixel-font . OFL and component notices in `dist/art/FONT-LICENSE.txt` and `dist/art/font-licenses/`.

Dungeons Content UI and STONEBORN were visual references only; their restricted assets were not copied. The new HUD uses opaque wood frames, bevel buttons and an iron chain slider, leaving betting cells and hand selection geometry under each game's existing styles.
