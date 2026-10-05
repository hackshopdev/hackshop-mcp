import type { PublicIdea } from "./types";

// The 12 starter ideas, posted as hackshop with zero votes. Same ids, text and
// timestamps as the seed insert in
// supabase/migrations/20261005000000_ideas.sql, so /ideas can fall back to
// this list when the database is unreachable or the table does not exist yet
// and every seeded URL keeps working. Never add votes here.

type SeedIdea = Omit<PublicIdea, "display_name" | "vote_count" | "budget"> & {
  suggested_device_id: string;
};

const SEEDS: SeedIdea[] = [
  {
    id: "347fda0c-53ac-496c-9262-657596e0632d",
    title: "Round desk companion",
    body: "A round touch screen on your desk with an animated avatar, push-to-talk and replies as captions.",
    size: "desk",
    interaction: "voice",
    sensing: "none",
    suggested_device_id: "waveshare-esp32-s3-touch-amoled-1-75c",
    created_at: "2026-10-05T12:00:00.000Z",
  },
  {
    id: "d3fbbf21-c9a0-463e-9356-f4df2eecfe69",
    title: "Desk camera helper",
    body: "Ask Muse to look at your whiteboard or the parts on your bench and get a photo back.",
    size: "desk",
    interaction: "voice",
    sensing: "camera",
    suggested_device_id: "seeed-sensecap-watcher",
    created_at: "2026-10-05T11:59:00.000Z",
  },
  {
    id: "479c5615-784d-43a4-89d6-e9701e3be181",
    title: "Air-quality monitor",
    body: "Ask whether the room is stuffy and read CO2, tVOC, temperature and humidity on a desk screen.",
    size: "desk",
    interaction: "touch",
    sensing: "air-quality",
    suggested_device_id: "seeed-sensecap-indicator",
    created_at: "2026-10-05T11:58:00.000Z",
  },
  {
    id: "8fafe129-9e94-444e-9617-c8e151b90ca3",
    title: "Glanceable status screen",
    body: "A small color screen that shows what your agent is up to and any picture it sends.",
    size: "desk",
    interaction: "light-button",
    sensing: "none",
    suggested_device_id: "ideaspark-esp32-1-9-lcd",
    created_at: "2026-10-05T11:57:00.000Z",
  },
  {
    id: "a321204f-60c2-4751-ad01-af5574e2e05b",
    title: "Pocket voice note taker",
    body: "Press a button, say the thought, and get it transcribed with a text reply on a pocket screen.",
    size: "pocket",
    interaction: "voice",
    sensing: "none",
    suggested_device_id: "m5stack-sticks3",
    created_at: "2026-10-05T11:56:00.000Z",
  },
  {
    id: "3b6983e1-036c-4b9b-a0c7-82d4a0225ecb",
    title: "Kitchen recipe helper",
    body: "A palm-size buddy on the counter for quick questions like unit conversions, with pictures on its screen.",
    size: "desk",
    interaction: "voice",
    sensing: "none",
    suggested_device_id: "aipi-lite",
    created_at: "2026-10-05T11:55:00.000Z",
  },
  {
    id: "791f89e2-eb4f-4ede-8c3a-079710bcbceb",
    title: "Shelf voice point",
    body: "A speaker-mic puck for the living room with push-to-talk, an LED status ring and a mute switch.",
    size: "hidden",
    interaction: "voice",
    sensing: "none",
    suggested_device_id: "home-assistant-voice-pe",
    created_at: "2026-10-05T11:54:00.000Z",
  },
  {
    id: "aa3cbf76-cbae-43f0-94d2-fedfa91f7e86",
    title: "Family calendar and morning briefing",
    body: "A color e-paper display where your agent posts the day's plan, reminders or a morning briefing.",
    size: "wall",
    interaction: "light-button",
    sensing: "none",
    suggested_device_id: "seeed-reterminal-e1002",
    created_at: "2026-10-05T11:53:00.000Z",
  },
  {
    id: "f5bcf3a5-7e40-4b56-8e02-bfe3c8ac23c9",
    title: "Shopping list by the fridge",
    body: "Black-and-white e-paper on the fridge that updates as people add items from their phones.",
    size: "wall",
    interaction: "light-button",
    sensing: "none",
    suggested_device_id: "seeed-reterminal-e1001",
    created_at: "2026-10-05T11:52:00.000Z",
  },
  {
    id: "1603112f-2217-432f-b512-f7e370d17003",
    title: "Home server helper",
    body: "Ask what's using all the disk space on your Pi, or have your agent check each morning whether backups ran.",
    size: "hidden",
    interaction: "light-button",
    sensing: "none",
    suggested_device_id: "raspberry-pi-5",
    created_at: "2026-10-05T11:51:00.000Z",
  },
  {
    id: "a29db261-ba54-490a-8edb-71aeaf0ac5d4",
    title: "Sensor alert relay",
    body: "Any script on a tiny Linux board can message your agent, like \"The garage door has been open for an hour.\"",
    size: "hidden",
    interaction: "light-button",
    sensing: "none",
    suggested_device_id: "raspberry-pi-zero-2w",
    created_at: "2026-10-05T11:50:00.000Z",
  },
  {
    id: "24454b28-acf5-4757-8a28-eacc6ee01ddb",
    title: "Busy light by your door",
    body: "A status light your agent turns red when you're on a call (needs a small code change).",
    size: "hidden",
    interaction: "light-button",
    sensing: "none",
    suggested_device_id: "espressif-esp32-c5-devkitc-1",
    created_at: "2026-10-05T11:49:00.000Z",
  },
];

export const SEED_IDEAS: ReadonlyArray<PublicIdea> = SEEDS.map((seed) => ({
  ...seed,
  display_name: "hackshop",
  budget: null,
  vote_count: 0,
}));

export function seedIdeaById(id: string): PublicIdea | null {
  return SEED_IDEAS.find((idea) => idea.id === id) ?? null;
}
