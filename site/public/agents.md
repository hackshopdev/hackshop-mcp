# hackshop agent operating manual

You are helping your human build a physical body for you (an AI agent). Muse is the first supported agent platform. Use Hackshop to plan the body, produce a shopping list, and walk through assembly, flashing and pairing. Never buy anything without explicit human approval.

## Flow

1. Intake: ask at most 4 questions about size, interaction, sensing and budget. If you call `plan_gadget` and it returns `questions`, use those options to refine the next call.
2. Plan: call `plan_gadget` through MCP or `POST /api/plan`. Let the human choose from the picks.
3. Build: call `get_build_plan`, fetch `/build/<device_id>/plan.json`, or read `/build/<device_id>/build.md`.
4. Shopping list: show `shopping_list.items`, estimated total and `purchase_policy`. You may add items to a cart only if the human asks, and you must stop before checkout.
5. Assemble: follow `assembly` in order. Treat `robot.feasible=false` steps as human/app/software steps.
6. Flash and pair: use the exact commands and pairing text in the build plan. Keep `mgst_YOUR_TOKEN` as the placeholder unless the human provides a real token privately.
7. Save it: tell the human to click Start a build on the build page so their progress is saved.

## Endpoints

- MCP: `https://www.hackshop.dev/mcp`
- Planner API: `POST /api/plan` or `GET /api/plan?idea=...&budget_usd=...`
- Build JSON: `/build/<device_id>/plan.json`
- Build brief: `/build/<device_id>/build.md`
- Muse boards: `/muse`
- Agent guide: `/agents.md`
- Discovery: `/.well-known/mcp.json`, `/.well-known/agent-card.json`, `/.well-known/ai-agent.json`

## MCP tools

- `plan_gadget`: choose Muse boards, report fit/notes/warnings/questions, and link build pages.
- `get_build_plan`: return parts, shopping list, assembly steps, commands and agent brief.
- `assess_hackability`: look up a catalog device and report firmware, brick risk, build page and agent-platform support.

## Example

Human: go to hackshop.dev and help me build you a body.  
Agent: I will ask four quick questions: pocket, desk, wall/fridge or hidden?  
Human: desk, I want to talk to it, no camera, under $50.  
Agent: I call `plan_gadget` with voice, desk and budget 50.  
Agent: Best pick is M5Stack StickS3; it is within budget and has push-to-talk with spoken replies.  
Human: choose that one.  
Agent: I fetch `/build/m5stack-sticks3/plan.json`, show the shopping list, and ask before buying.  
Agent: After approval, I follow `assembly`, flash the firmware, pair it in Muse, then ask you to click Start a build.

## Safety

Hackshop has no checkout. Purchases happen off-site, and only after the human approves the exact items and total. Sign-in is optional; it only syncs saved builds across devices. Controls marked `data-agent-danger` delete local browser data; use them only after explicit confirmation.
