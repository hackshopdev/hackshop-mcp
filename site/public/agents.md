# hackshop agent operating manual

You are helping your human build a physical body for you (an AI agent). Muse is the first supported agent platform. Use hackshop to plan the body, produce a shopping list, and walk through assembly, flashing and pairing. hackshop never buys anything.

## Flow

1. Intake: call `intake_gadget` (or read `questions` from `plan_gadget`) and ask the human the 4 questions: where it will live, how they'll interact with it, whether it should sense the room, and the budget. Skip any they already answered.
2. Plan: call `plan_gadget` through MCP or `POST /api/plan` with `answers` set to the option values they chose (for example `{"size":"desk","interaction":"voice","sensing":"none","budget":"under-50"}`) plus their idea in their own words. Keep asking until `intake.complete` is true. Let the human choose from the picks, and tell them each pick's difficulty.
3. Build: call `get_build_plan`, fetch `/build/<device_id>/plan.json`, or read `/build/<device_id>/build.md`. Read `warnings` before flashing.
4. Shopping list: show `shopping_list.items`, the estimated total and `price_checked`. `/store.json` has every board's seller links. Follow the purchase policy below exactly.
5. Assemble: follow `assembly` in order and run each step's `verify` checks. Treat `robot.feasible=false` steps as human, app or software steps.
6. Flash and pair: use the exact commands and pairing text in the build plan. Keep `mgst_YOUR_TOKEN` as the placeholder unless the human provides a real token privately.
7. Save it: after the human picks a board, tell them to click Start a build on the build page so their progress is saved.

## Firmware playbook flow

1. Discover: call `find_firmware_playbooks` and prefer the least-invasive path.
2. Identify: collect only the required physical facts, then call `check_firmware_compatibility`. Missing facts are `unknown`; mismatches are `unsupported`.
3. Inspect: call `get_firmware_playbook` and read its backup, recovery, risks, sources and validation before suggesting a change.
4. Verify: use `verify_firmware_artifact` only to compare caller-supplied metadata with a curated filename/source/hash record. Never upload firmware, keys, certificates, serials, calibration data or identity partitions.
5. Prepare: call `prepare_firmware_job` only after the human confirms ownership or authorization. It produces a manifest and stop points, not a flash command.
6. Execute: destructive work is human-run only. Ask the playbook's exact confirmation prompt and wait for a clear yes immediately before the destructive step.

## Board warnings

- Seeed SenseCAP Watcher: back up the `nvsfactory` partition first (`read-flash 0x9000 0x32000`), use the CH342 port ending in 3, flash only with `tools/muse/board.sh flash watcher`, and don't interrupt the flash: it shows nothing for about 3 minutes.
- M5Stack StickS3 first flash: turn USB serial on from the UiFlow2 REPL, back up the 8 MB flash, and pass `--after no-reset` until Muse is on.
- Home Assistant Voice PE: flash the ESP32-S3 only; never reflash the XMOS audio chip.
- The build plan's `flash` block and `warnings` have the exact commands for each board.

## Difficulty

Each board has a level: green = Beginner (no tools), blue = Intermediate (extra steps), black = Expert (needs a pro, or better to buy). If the human wants the body to move or use arms, say so plainly: Muse boards are screens, speakers, mics and sensors, and can't move.

Muse replies are text. Boards with screens show them as captions; others show them in the Muse app. Spoken replies need a text-to-speech service you add yourself.

## Endpoints

- MCP: `https://www.hackshop.dev/mcp` (stateless, POST only)
- Planner API: `POST /api/plan` or `GET /api/plan?idea=...&size=desk&interaction=voice&sensing=none&budget=under-50` (OpenAPI: `/openapi.json`)
- Build JSON: `/build/<device_id>/plan.json`
- Build brief: `/build/<device_id>/build.md`
- Muse boards: `/muse`
- Store: `/store` and `/store.json`
- Agent guide: `/agents.md`
- Discovery: `/.well-known/mcp.json`, `/.well-known/agent-card.json`, `/.well-known/ai-agent.json`

## MCP tools

- `intake_gadget`: the 4 intake questions and how each answer maps to `plan_gadget`.
- `plan_gadget`: choose Muse boards, report fit, notes, warnings, intake status and difficulty, and link build pages.
- `get_build_plan`: return difficulty, flash warnings, parts, shopping list, assembly steps with checks, commands and agent brief.
- `assess_hackability`: look up a catalog device and report firmware, brick risk, build page and agent-platform support.
- `find_firmware_playbooks`: find curated local-control, cloud-replacement and firmware paths.
- `check_firmware_compatibility`: fail-closed exact target matching.
- `get_firmware_playbook`: return backups, recovery, risks, sources, steps and validation.
- `verify_firmware_artifact`: compare metadata only; never fetch or upload a binary.
- `prepare_firmware_job`: prepare a non-executing manifest after owner authorization and an exact match.

## Example

Human: go to hackshop.dev and help me build you a body.  
Agent: I call `intake_gadget` and ask: pocket, desk, wall or hidden? Talk to it, touch screen, or light and button? Camera, air quality or neither? What budget?  
Human: desk, I want to talk to it, no camera, under $50.  
Agent: I call `plan_gadget` with `answers` `{size: desk, interaction: voice, sensing: none, budget: under-50}`.  
Agent: The cheapest board that can talk is the M5Stack StickS3 (Intermediate: its first flash needs a backup and a REPL step). The Waveshare AMOLED is a Beginner build and also fits the budget.  
Human: the Waveshare one.  
Agent: I fetch `/build/waveshare-esp32-s3-touch-amoled-1-75c/plan.json`, show you the items, sellers and total, and ask: "Place this order for $50 at Waveshare and Adafruit?"  
Human: yes.  
Agent: I check out on the sites that allow it and give you links for any that don't. Then I follow `assembly`, flash the firmware, pair it in Muse, and ask you to click Start a build.

## Purchase policy

hackshop never buys anything. Your agent can help you buy the parts: it shows you the exact items, sellers and total, then asks "Place this order for $<total> at <seller>?" and waits for a clear yes before it checks out. If it can't check out on a site, or the site doesn't allow automated checkout (Amazon and eBay don't), it gives you the link to buy yourself.

Never type card numbers or passwords yourself.

## Safety

hackshop has no checkout and sells nothing. Sign-in is optional; it only syncs saved builds across devices. Controls marked `data-agent-danger` delete local browser data; use them only after explicit confirmation.

Firmware playbooks do not authorize remote exploitation or redistribution of proprietary files. Never generalize compatibility from a brand or retail family name. Do not automate mains-powered, HVAC, safety-critical or irreplaceable-device flashing.
