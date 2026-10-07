# Featured build proof standard

A project may be called a **featured build** only when it has an interactive whole-build model, a quick video, and an explicit physical-evidence state. A concept may be featured before it is built only when the page says **Concept render — not yet built**. It cannot claim prototype or validated status without real-device evidence.

## Required proof bundle

1. **Interactive 3D assembly**
   - Show the actual selected parts, their placement, connections, and important movement or access constraints.
   - Author in Blender, source CAD, or inspectable procedural Three.js. Present it in the browser with Three.js.
   - Preserve an inspectable source scene, CAD file, or source implementation. A flattened render is not enough.
   - Label approximated geometry and dimensions.

2. **Quick demonstration video**
   - Maximum length: 45 seconds. Target 15–30 seconds.
   - For concepts, show the intended behavior and label the video as an animation or simulation.
   - For physical prototypes and validated builds, show the assembled hardware performing the build's main behavior.
   - Include a poster frame and captions or enough visual context to understand the result without audio.
   - A Blender animation or simulation replay can supplement the demo, but cannot replace the real-hardware demonstration.

3. **Physical-evidence state**
   - Show the real assembled hardware in its intended setting.
   - Include useful alt text and a provenance link to the build log or maker source.
   - Product photography, a CAD render, or an AI-generated image does not count as physical-build proof.
   - If the project has not been built, record the photo as unavailable with reason `not-built`; do not silently omit it.

The machine-readable contract is `site/lib/build-proof.ts`. `buildProofIssues()` is the publication gate.

## Honest maturity labels

- `concept`: proposed parts and behavior; not built.
- `digital-prototype`: interactive model, simulation, or generated firmware exists; physical behavior is unverified.
- `physical-prototype`: the hardware has been assembled and demonstrated.
- `validated-build`: the build was repeated or checked against stated acceptance tests.

Never use a render, successful compilation, simulation, HTTP response, or vendor product photo as evidence that a physical build works.

## ATech builds

ATech compositions follow the same standard. The interactive model should show the motherboard, exact modules, occupied ports, double-width clearance, enclosure, and power path. A concept video may animate the expected events/actions, but must say it is not yet built. Physical or validated status requires video and photography of the flashed composition, not the store kit or an enclosure render.

If the public ATech hardware catalog and SDK support catalog disagree, preserve both statuses in the build record and do not visually imply that an unsupported module has been demonstrated.
