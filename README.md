# The Hall of Attempts

Seven public image-to-3D experiments on Roman columns, generated locally with Pixal3D.
Each exhibit pairs its reconstruction with a source image and an honest verdict.

Run `python3 -m http.server 8080` in this directory, then open http://localhost:8080.
The gallery uses vendored three.js r147 and meshoptimizer; no build step or external runtime requests.

Drag in overview to rotate the hall. Select a model, column, plaque, or named navigation button to
inspect it. Drag in focus to turn that object. Arrow keys and previous/next browse; Esc, Home, or O
return to overview. Models turn automatically whenever the page is visible, except when reduced motion is requested.
Use the contextual “Back to hall” link or tap empty scene space to leave focus on mobile. The exhibit
guide provides descriptions, source images, model downloads, and credits without WebGL.

Canonical links use stable names, such as `#/gladiator`. Legacy links `#/3`–`#/9` retain their original
exhibit identity; `#/4` still opens Roman secutor. Removed exhibits `#/1` and `#/2` return to overview.
Navigation retains the original Roman numerals III–IX to avoid relabelling existing references.

## Assets and rights

DOOM mask and Onewheel are excluded from this gallery and its publication bundle because the lab
records no redistribution permission. Original research inputs/results are retained outside the gallery.
See [credits](credits.html), [asset attribution](LICENCES.md), and [machine-readable provenance](models/index.json).
CC-derived models and textures carry the source's exact BY-SA version, including France 2.0 for Leica.
Generated reference images and their reconstructions are explicitly offered under Apache-2.0 to the
extent the project holds rights; the generation model's weights licence is recorded separately.
These asset licences do not grant unrelated third-party rights or a blanket licence to gallery code.
Vendor permission notices are bundled in `licences/`.

## Loading and validation

Overview GLBs retain approximately 5,000 triangles each, with 512² JPEG textures; only the focused
exhibit loads 1024² textures. Two model jobs run at a time. Previous high-detail resources are disposed
when leaving focus. Rendering is coalesced on demand, except during automatic turntable animation or camera transitions.
See [performance targets](PERFORMANCE.md); device latency and frame-time targets require physical-device measurement.

From the project root:

```sh
lab/.venv/bin/python scripts/prepare-gallery-assets.py
node scripts/test-room-interactions.cjs
python3 scripts/publish.py --out publish/hall-of-attempts
```

Publishing assembles local files and preserves the destination's `.git`; it does not commit, push,
or deploy. It excludes restricted assets even if they remain in older repository history or deployments.
