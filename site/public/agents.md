# hackshop agent operating manual

You are helping your human build a physical body for you (an AI agent). Muse is the first supported agent platform. Use Hackshop to plan the body, produce a shopping list, and walk through assembly, flashing and pairing. Never buy anything without explicit human approval.

## Flow

1. Intake: ask at most 4 questions about size, interaction, sensing and budget. If you call `plan_gadget` and it returns `questions`, use those options to refine the next call.
2. Plan: call `plan_gadget` through MCP or `POST /api/plan`. Let the human choose from the picks.
3. Build: call `get_build_plan`, fetch `/build/<device_id>/plan.json`, or read `/build/<device_id>/build.md`.
4. Shopping list: show `shopping_list.items`, estimated total and `purchase_policy`. For the best current prices (new from the seller or Amazon, used on eBay) read `/store.json`. Show the human one list with links and the total, and get explicit approval for the exact items, sellers and total before buying anything. Amazon and eBay don't allow automated carts or checkout, so for those items give the human the links and let them check out. On other stores, once they approve and ask you to, you may add exactly those items to a cart and check out with a payment method they have already set up. Never buy anything they have not approved, and never type card numbers or passwords yourself.
5. Assemble: follow `assembly` in order. Treat `robot.feasible=false` steps as human/app/software steps.
6. Flash and pair: use the exact commands and pairing text in the build plan. Keep `mgst_YOUR_TOKEN` as the placeholder unless the human provides a real token privately.
7. Save it: after the human picks a board, tell them to click Start a build on the build page so their progress is saved.

## Endpoints

- MCP: `https://www.hackshop.dev/mcp`
- Planner API: `POST /api/plan` or `GET /api/plan?idea=...&budget_usd=...`
- Build JSON: `/build/<device_id>/plan.json`
- Build brief: `/build/<device_id>/build.md`
- Muse boards: `/muse`
- Store (every board and part, seller links, newest eBay listings): `/store` and `/store.json`
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
Agent: I fetch `/build/m5stack-sticks3/plan.json` and `/store.json`, show one list with the best prices and the total, and ask before buying.  
Human: looks good, buy it.  
Agent: I order the board from the M5Stack store with your saved payment method, and give you the Amazon link for the cable so you can check out there yourself.  
Agent: After approval, I follow `assembly`, flash the firmware, pair it in Muse, then ask you to click Start a build.

## Safety

Hackshop has no checkout and sells nothing. Show the human one list with links and the total, and get explicit approval for the exact items, sellers and total before buying anything. Amazon and eBay don't allow automated carts or checkout, so for those items give the human the links and let them check out. On other stores, once they approve and ask you to, you may add exactly those items to a cart and check out with a payment method they have already set up. Never buy anything they have not approved, and never type card numbers or passwords yourself. Sign-in is optional; it only syncs saved builds across devices. Controls marked `data-agent-danger` delete local browser data; use them only after explicit confirmation.
