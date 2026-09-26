# Simulation, prototyping, and LLM cost: recommendations

Status: RECOMMENDATIONS (2026-09-25). Grounded in the code as of `1c17e2e`. Token and dollar figures are estimates: file sizes measured with `wc -c` at about 4 chars per token, priced at Anthropic list prices (Haiku 4.5 $1/$5 per MTok, Sonnet 4.6 $3/$15, Sonnet 5 $2/$10). There is no usage logging yet, so no figure here is a measured bill.

## TL;DR

| # | Change | Effort | Payoff |
|---|---|---|---|
| 1 | Reorder `/api/propose` prompts so the catalog is a stable prefix, then turn on prompt caching | ½ day | About −50% per propose call on cache hits (input drops from about $0.009 to about $0.001) |
| 2 | Type-safe structured outputs (zod schema, device ids as `z.enum`) instead of four hand-written JSON parsers | ½–1 day | No parse failures, no invented ids, fewer retries, less code |
| 3 | Split "pick devices" (small structured output) from "write the markdown guide" (lazy, on click, like `/api/howto`) | 1 day | Most output tokens disappear from the hot path, so it is faster and cheaper |
| 4 | Cache results for the 24 fixed templates and dedupe simulations by assembly hash | ½ day | Repeat traffic costs $0 and returns instantly |
| 5 | Rate-limit `/api/diagram` and `/api/howto`; fix the retired sim-agent model | 1 hr | Closes a cost hole during traffic spikes; restores agent mode |
| 6 | three.js: render sim replays client-side and make the mp4 opt-in; later add MuJoCo-WASM (or Rapier) for an instant in-browser sandbox | 2–5 days | Removes the dominant sim-worker cost (serialized OSMesa rendering) and makes previews instant |
| 7 | Blender: glTF export button now, an offline Blender asset pipeline later, bpy/Blender-MCP interop for enclosure prototyping | 1 day → ongoing | Real shapes instead of proxy boxes, and a path from "proposal" to "printable enclosure" |

## 1. Where the money goes today

| Call | File | Model | Input tokens | Notes |
|---|---|---|---|---|
| Propose (site) | `site/lib/propose.ts:178` | Haiku 4.5 | about 8.5–9.7k | Sends the **whole** 68-device catalog (about 7.6k tokens) every time. Picks devices **and** writes 3 markdown sections. No caching, no `maxOutputTokens`, hand-parsed JSON, no deterministic fallback |
| Premium (site) | `site/lib/premium.ts:141` | Haiku 4.5 | about 10.3k | Whole 53-device premium catalog every time |
| Assembly | `site/lib/assembly-gen.ts:582` | Haiku 4.5 | under 1k | zod-validated, deterministic fallback (the good pattern) |
| How-to | `site/app/api/howto/route.ts:294` | Haiku 4.5 | under 600 | 24h LRU cache, **no rate limit** |
| Diagram | `site/app/api/diagram/route.ts:140` | `gpt-image-2` | about 2.5k chars | Most expensive route, 24h LRU, **no rate limit** |
| MCP propose fallback | `src/sampling.ts:79` | **Sonnet 4.6** | about 7.9k | Only when the host lacks sampling and `ANTHROPIC_API_KEY` is set |
| Sim builder agent | `sim-worker/hackshop_sim/agent/tools.py:90` | `claude-3-5-sonnet-latest` | 1.3–2.5k × ≤3 rounds | **Retired 2025-10-28.** Agent mode silently falls back to the scripted controller |

Estimated `/api/propose` cost: about **$0.012–0.017** per call, and about $0.025–0.03 with `include_premium`. The site README and `llms.txt` say about $0.002.

Docs also disagree with code on the propose rate limit. `AGENTS.md`, `llms.txt`, `agents.md` and `ai-agent.json` say 5/hr/IP; the code default is 200/hr (`site/app/api/propose/route.ts`). Pick one.

## 2. "Type-safe" classification: cheaper and faster matching

The "classification" step is: idea → pick 3–5 catalog ids. Four levers, cheapest first.

### 2a. Prompt caching (free win, do first)

The user message today is `idea + budget + constraints + inventory` **followed by** the catalog (`propose.ts:160-172`, `premium.ts:129-134`, `src/tools/propose_hardware.ts:291-300`). Because the idea comes first, the 7.6k-token catalog is never a stable prefix, so nothing can be cached.

- Move the catalog into the `system` block, after the instructions. Put per-request fields last.
- Mark it cacheable: with `@ai-sdk/anthropic`, `providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } }` on the system message. With the Anthropic SDK, `cache_control` on the system block.
- Haiku 4.5's minimum cacheable prefix is **4,096 tokens**. System plus catalog is about 8.5k, so it qualifies. The system prompt alone (about 850) never would.
- Economics: cache reads are 0.1× input and 5-minute writes 1.25×. With a burst of traffic (now), nearly every call is a hit, and input cost drops about 8×. Verify with `usage.cache_read_input_tokens`.
- Apply the same to `premium.ts` (10.1k-token block) and the MCP fallback.

### 2b. Structured outputs with zod (the type-safe part)

All four JSON-returning calls strip fences and `JSON.parse` by hand (`src/sampling.ts:115`, `propose.ts:72`, `premium.ts:58`, `assembly-gen.ts:370`). Only `assembly-gen` validates with zod.

- Site: use ai-sdk `generateObject` / `Output.object` with a zod schema. Haiku 4.5 supports structured outputs natively.
- Constrain ids: `device_ids: z.array(z.enum(catalogIds)).min(3).max(5)`. The model then **cannot** return an id that doesn't exist. Today unknown ids are silently dropped, sometimes leaving fewer than 3 proposals.
- MCP server: sampling can't enforce a schema, so keep the loose parser there but validate with the same zod schema. The Anthropic fallback can use `output_config.format`.
- Share one schema module between `src/` and `site/lib/`. The 4 parsers collapse into 1.

### 2c. Split selection from generation

`propose.ts` asks one call to both pick devices and write `rationale_md`, `next_steps_md` and a 12–20 line `software_guide_md`. Output tokens cost 5× input on Haiku.

- The hot path becomes: structured `{ id, why_one_line }[]`, roughly 150 output tokens.
- Generate the long markdown lazily when a card is expanded, reusing the `/api/howto` pattern (already cached per `device_id::idea`). It can also stream.
- Expect time-to-results to fall from "3–8 s" to about 1–2 s, since output generation dominates latency.
- Set `maxOutputTokens`. It is currently unset, so the provider allows up to 64k.

### 2d. Deterministic or embedding pre-filter (only when the catalog grows)

At today's catalog size **caching beats pre-filtering**. A cached 7.6k-token catalog bills like about 760 tokens, while a per-request shortlist of about 25 devices is about 2.8k **uncached** tokens, because it changes the prefix every call.

Revisit at about 300+ devices, or if you drop the LLM for simple ideas:

- The deterministic scorer is half-built already: `TAG_ALIASES` and `shortlistCandidates` (`src/tools/propose_hardware.ts:215-272`, currently unranked, first 5 in catalog order) plus the closed 24-tag vocabulary. Add BM25 over name/tags/notes and rank.
- Embeddings: precompute device vectors at build time, either local with Transformers.js (MiniLM, runs in a Vercel function) or with a hosted embedding API. Cosine top-k in-process; 121 devices need no vector DB.
- Use the scorer as the **site's degraded fallback**. Today the site returns an empty result when the LLM fails, while the MCP path already degrades gracefully.

### 2e. Result caching

- The 24 fixed template prompts (`site/lib/templates.ts`) re-run the full LLM call on every click. Precompute at build time, or cache in Vercel Runtime Cache / KV keyed by `sha256(normalized idea + budget + constraints + flags)`, TTL 24h.
- Same for `/api/assembly` on the deterministic path.

### 2f. Model defaults

- MCP fallback: `claude-sonnet-4-6` ($3/$15) becomes `claude-sonnet-5` ($2/$10). It is cheaper and newer. Or use Haiku 4.5 to match the site.
- Sim builder agent: replace the retired `claude-3-5-sonnet-latest` with `claude-sonnet-5` (`HACKSHOP_SIM_MODEL`). Log when agent mode falls back to scripted instead of doing it silently.
- Consider separate env vars per route. `HACKSHOP_MODEL` currently sets all four site calls and the MCP fallback, while their defaults differ.

## 3. three.js and physics

### Today

- three.js is **replay only**. `InteractiveSimViewer.tsx` fetches `trajectory.json` from the worker and interpolates planar `(x, y, yaw)` (`site/lib/trajectory.ts:294-325`).
- Per-joint `qpos` is parsed but unused, so wheels and arms don't move.
- Rapier is in `node_modules` only as a transitive type dependency; nothing imports it.
- All physics runs in MuJoCo on one always-on Fly machine (`shared-cpu-2x`, 1 GB). Rendering is CPU OSMesa behind a process-wide `_RENDER_LOCK`: up to 900 frames to mp4, plus 5 studio PNGs at 1200×900 with 8× multisampling, per run.
- There is no dedupe (every kick is a new job) and no artifact cleanup (the 3 GB volume grows without bound).
- Only the `navigate` goal kind simulates; the other 4 return "unsupported".

### Recommendations, in order

**1. Render in the browser and make the mp4 opt-in (biggest win, 1–2 days).** The worker already emits `trajectory.json`, `scene.xml` and `frame_qpos`, and the browser already has three.js.

- Default runs: `render: false`. Physics only; that drops the serialized OSMesa step, which dominates wall time.
- Animate joints from `frame_qpos`: wheels spinning, arms moving.
- Render the mp4 and studio shots only when the user clicks **Share video**, as a second job.
- This also shortens the 1.5 s × 120 poll loop and cuts Vercel poll invocations.

**2. Dedupe and retention (½ day).** Hash `(assembly, world, options)` and return the cached `result.json` when it exists; `docs/v2-simulation-plan.md` already planned this. Add a TTL sweep for `runs/`.

**3. In-browser physics sandbox (3–5 days).** Two options:

| | MuJoCo WASM | Rapier (`@dimforge/rapier3d-compat`) | cannon-es |
|---|---|---|---|
| Same engine as the worker | **Yes.** It loads the worker's `scene.xml` as-is | No (a second physics model, so results diverge) | No |
| Robotics fidelity (contacts, actuators, joints) | High | Medium | Low |
| Bundle | Several MB WASM | About 1–2 MB WASM | About 150 KB JS |
| Determinism | Yes | Yes (cross-platform) | No |

- **Recommendation:** MuJoCo WASM for "drive it yourself / drag the obstacle" previews. It keeps one source of truth, and the worker stays authoritative for scored runs and shareable videos.
- The scripted controller (`sim-worker/hackshop_sim/control/scripted.py`: go-to-goal plus an 11-ray avoidance ring) is small enough to port to TypeScript for the in-browser loop. Pyodide for `control.py` is possible but heavy.
- Use Rapier only for lightweight toy physics outside robot scoring, such as the "does this enclosure tip over" checks below.

**4. Cheap static checks in JS (1 day).** `site/lib/feasibility.ts` already does interface, power, mass and structural rules. Add a three.js bounding-box and center-of-mass visualization, plus a tip-over check with Rapier (static stability under tilt). That covers the 4 goal kinds MuJoCo doesn't simulate yet (`display-loop`, `sense-act`, …) without the worker.

## 4. Blender

Blender is the wrong tool in the request path: headless it is several hundred MB, and Cycles renders take seconds to minutes. Its Bullet physics is also weaker than MuJoCo for robotics. It **is** the right tool at the edges:

1. **"Download 3D model (.glb)" (1 day, zero infra).** Use three.js `GLTFExporter` on the scene `InteractiveSimViewer` already builds. Users open it in Blender, Fusion or Onshape to design an enclosure or mount around the real part layout. This is the fastest route from proposal to prototype.
2. **Offline asset pipeline (ongoing).**
   - `blender -b -P tools/convert.py` turns manufacturer STEP/STL or community GLB models into (a) a decimated, Draco-compressed visual GLB for three.js and (b) simplified convex collision meshes for MJCF.
   - This replaces the 5 `dimensioned-proxy` boxes in `sim-worker/assets/registry.json` with real shapes.
   - Output goes to Vercel Blob; `registry.json` gains `visual_glb` and `collision_mesh` fields.
3. **Prototype export / Blender MCP.** A `export_prototype` MCP tool returns a bpy script (and the GLB) that rebuilds the assembly as positioned parts in Blender. Paired with a community Blender MCP server, Claude can go from "hackshop proposed these parts" to "Blender modeled a printable enclosure" in one conversation.
4. **Hero renders (optional).** Batch Eevee/Cycles renders of the top template builds for share cards and resource pages. Run them on a GPU job (Modal or similar), not the CPU Fly worker.

## 5. Suggested sequencing

1. **This week (cost, during the traffic spike):**
   - 2a caching;
   - rate-limit `/api/diagram` and `/api/howto`;
   - fix the retired sim model;
   - reconcile the 5/hr vs 200/hr docs.
2. **Next:**
   - 2b structured outputs;
   - 2c split selection from generation;
   - 2e template cache;
   - 3.1 client-side replay with opt-in mp4;
   - 3.2 sim dedupe;
   - 4.1 glTF export.
3. **Later:**
   - 3.3 MuJoCo-WASM sandbox;
   - 4.2 Blender asset pipeline;
   - 4.3 Blender MCP interop;
   - 2d embeddings once the catalog is past about 300 devices.

Measure before and after with the new analytics:
- `api_propose_served.duration_ms` in PostHog;
- `usage.cache_read_input_tokens` in logs (add usage logging to `propose.ts`);
- `simulation_completed` counts.
