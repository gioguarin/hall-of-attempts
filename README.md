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
The public collection is numbered I–VII; number keys 1–7 match that visible order.
Older numeric deep links retain their original exhibit identity; new links use the stable names.

## How these models were made

The gallery’s “About & how it was made” panel describes the workflow: single photographs or locally
FLUX-generated references, background removal, local Pixal3D reconstruction through AssetFurnace on
Apple Silicon, then retopology, texture baking and compression. Models retain roughly 5,000 triangles;
the gallery supplies 512² overview and 1024² focus textures in meshopt-compressed GLBs. Inspection,
orientation and contact-height adjustments prepare the exhibits without removing reconstruction artifacts.
The account is based on the project log and saved generation/Finish provenance records.

## Assets and rights

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
or deploy.

The archway recesses open into blackness. A single low-count particle field drifts slowly through the
skylight and pauses with reduced motion or a hidden page. Pedestal labels hang below the top rim,
with their upper edges aligned to the abacus surface in both overview and focus.

Cards are fixed to their pedestal assembly. Entering close-up turns the assemblies inward, and
browsing other items keeps that orientation. Returning to overview turns all assemblies outward
together in the same direction. Cards keep the same local mount and aligned top edge throughout;
reduced motion snaps the assemblies into place.

The Leica, bumper car and road barrier have fixed presentation alignments that level their reconstructed
base/contact planes. Precise vertex bounds determine the contact height after rotation, and supporting
feet fit inside the top slab throughout the turntable. Both texture tiers share these corrections.
