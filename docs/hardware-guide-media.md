# Hardware-guide media and renders

The PF1007L, House Control, and Siri Remote field guides have a structured media
section separate from their trusted editorial HTML and catalog proof claims.

## Design and evidence boundaries

Keep the site's existing system sans, dark canvas (#0a0a0a), panel (#171717),
light text (#f4f4f2), and orange (#ff7a00) links. Give the original 3D scene one
wide, quiet workbench (#20292f), with a persistent render label. Photos retain
their original aspect ratios and source captions. Use teal (#83dfcf) for focus,
not decorative motion. Below the scene: reference images, native creator
players, explicit missing evidence, and the original safety/planning guide.

These are approximate exterior scenes, not measured CAD, assembly instructions,
device emulators, or evidence of a physical build. The sample room is not the
creator's apartment. They do not connect to calendars, home systems, Bluetooth,
or input devices. No featured-build state, queue approval, or catalog physical
claim changes with this release.

## Public asset ledger

`site/public/media/hardware-guides.json` is the public source of truth for
per-image author, source, license, modifications, byte hash and evidence scope.
It is linked from each guide for MCP clients and other agents to inspect.
`site/public/media/hardware/NOTICE.txt` preserves notices and exceptions to the
repository's MIT license. CC BY-SA photos remain CC BY-SA, including adaptations.

Checked on October 20, 2026:

- Wes Bos's own documentation photograph: source contribution
  `wesbos/photo-frame-dashboard@7e39fa425a25d96931d41358953e497d6a0026b3`.
  Author and asset history match the repository's MIT copyright holder. The
  license was added in `34d04b8d1ccc1b987cceed45f743983dff2eb141` on October 19;
  its link is pinned separately from the earlier photo contribution. This is
  the Android **Rockchip BIUFRAME**, not the Linux Allwinner PF1007L.
- 0xProbability's original app screenshot: source contribution
  `0xProbabillity/house-control@0ddadcb7cc34c0f43f7cfd83d05680fef355e40a`.
  Author matches the MIT copyright holder; commit explicitly states the images
  show the bundled demo plan with simulated devices. Not a physical photograph.
- Wikimedia Commons own-work Hue bulb and gen-1 remote photos: file-specific
  **CC BY-SA 4.0**, creator attribution and license links. Wikimedia's 1280px
  reductions, no crop. The remote's exact rear model is not established.
- Wikimedia Commons own-work Hue Bridge reference: file-specific **CC0 1.0**.
- Do not treat third-party community photos in Wes Bos's repository, seller
  photos, social screenshots, or firmware as cleared by either MIT license.
  None of those are copied here.

## Creator clips are embeds, not reusable downloads

Canonical primary posts, authors and media presence were checked against the
public X oEmbed/syndication responses (no downloaded video files):

- `@redp314`, post `2109699021799293244`: 14.333s Linux-frame demo.
- `@0xProbabillity`, post `2109978137794883621`: 17.6s app screen demo; the maker
  reports real device control, but no physical Hue lamp response is independently
  shown by that screen recording.
- `@alexzfunk`, post `2108585025205592408`: 9.514s gen-1 remote demo, not a full
  pairing/permissions/sleep-reconnect walkthrough.
- Syntax video `ZLycoUMltNI`, confirmed via YouTube oEmbed and Wes Bos's README:
  longer related **Android BIUFRAME** walkthrough, not the PF1007L Linux recipe.

X's first-party widget creates the entire original post after a button click;
it retains attribution and can reflect removals. No raw oEmbed HTML injection,
copied MP4, extracted still, or locally cached social thumbnail. YouTube reuses
the existing consent-gated `youtube-nocookie.com` player. Native embedding does
not grant a license to download, edit, or redistribute either platform's clips.

References: https://help.x.com/en/x-for-websites-ads-info-and-privacy and
https://docs.x.com/developer-terms/policy (public display of posts).

No extra paid ScrapeCreators requests or Grok sends were made. The prior Grok
request `discovery_20261020` was checked through the CLI webhook and was still
pending; it is not evidence of completed research.

## Verification

Media contract tests check license/scope, hashes, three scenes and native-only
video reuse. Model tests build/dispose all three scenes and exercise both states.
The preview loads Three.js only after interaction, renders on demand, has no
automatic motion, and provides buttons/keyboard controls and a WebGL fallback.
Browser QA must additionally check actual scene visibility, toggles, reset,
mobile layout, consent before player/thumbnail traffic, and native playback.

Full exact-project instructional videos are still missing for all three. The
pages must keep that limitation visible instead of calling short clips how-tos.
