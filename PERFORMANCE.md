# Performance budget

Seven overview GLBs total 2,186,476 bytes (2.085 MiB), with 34,765 triangles and unchanged meshopt geometry.
Each has three 512² maps: about 28 MiB of RGBA GPU texture storage including mipmaps for all seven.
One focused 1024² model adds about 16 MiB; its overview remains available. Plaques, framebuffer storage,
decoded images, geometry, and browser memory add overhead. These are estimates, not device measurements.

Initial overview uses two model requests at a time. Named and legacy deep links prioritize the selected
exhibit. Focus upgrades are requested only for that exhibit; outdated upgrades are discarded and disposed.
The previous upgrade is released when focus changes. Hidden documents pause the automatic turntable; returning to the page resumes it.

| Acceptance metric | Target |
|---|---:|
| Initial interactive transfer, before full overview | ≤2 MiB |
| Complete low-tier overview transfer, excluding optional source images | ≤3 MiB |
| Cold usable overview, 10 Mbps / 100 ms RTT | ≤3 seconds |
| Low-tier estimated GPU resource storage | ≤96 MiB |
| Desktop / phone p95 animation frame interval | ≤16.7 / ≤33.3 ms |
| Hidden gallery or reduced motion | No recurring frames |

DPR is capped at 1.5 on narrow screens, 2 elsewhere. Mobile antialiasing is disabled; anisotropy is
2 on narrow screens and 4 on desktop. Reduced motion disables automatic turntable rotation and snaps
camera transitions. The geometry is small enough that further simplification is not the first priority.
KTX2/Basis textures remain an optional optimization if measured GPU memory or upload cost misses budget.

`node scripts/test-room-interactions.cjs` verifies hidden/reduced-motion idle behavior, automatic animation and request concurrency using real r147
geometry with controlled DOM/time and a mocked renderer. It is not a physical GPU benchmark. Validate
cold load, drag, transitions and sustained animation on a real mid-range laptop and phone before claiming
latency/frame-time targets pass. Track renderer.info.render.calls/triangles; info.memory gives counts,
not byte totals. Use the browser performance timeline for decode/upload and long-task measurements.

## Architectural rendering

The refined room adds procedural marble/travertine/floor/sky textures (approximately 8 MiB with
mipmaps) and one shadow-casting skylight. Shadow maps use 512² on phones and 1024² on desktop,
with VSM filtering for soft edges. Repeated piers and arches are instanced; the coffer surfaces share
one mesh. These replace the earlier flat shell. The shadow pass adds ongoing GPU cost while models
rotate, so the physical-device frame-time budgets above still require measurement.
