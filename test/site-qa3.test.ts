import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ASK_AGENT_BLURB,
  ASK_AGENT_TITLE,
  buildWithAgentPrompt,
  buyEverythingPrompt,
  chatUrl,
  STORE_AGENT_PROMPT,
} from "../site/lib/agent-prompts";
import {
  DIFFICULTY_LEVELS,
  difficultyFor,
  difficultyMap,
  parseDifficulty,
} from "../site/lib/ui/difficulty";
import {
  cleanAnswers,
  ideaFromAnswers,
  INTAKE_QUESTIONS,
  intakeFromSearchParams,
  planInputFromAnswers,
  plannerHref,
} from "../site/lib/ui/intake";
import {
  hasDeveloperDetail,
  humanNote,
  partStatusLabel,
  plainTierLabel,
  projectStatusLabel,
} from "../site/lib/ui/labels";
import { NAV_LINKS } from "../site/lib/ui/nav";
import { boardAndTotalLabel, boardPriceRange } from "../site/lib/ui/price";
import { summarizeProject } from "../site/lib/ui/project-summary";

const site = (path: string) => readFileSync(join(process.cwd(), "site", path), "utf8");

describe("planner intake chips (UX-003)", () => {
  it("asks the four questions with the planner's option values", () => {
    expect(INTAKE_QUESTIONS.map((question) => [question.id, question.question])).toEqual([
      ["size", "Where will it live?"],
      ["interaction", "How will you use it?"],
      ["sensing", "Should it sense the room?"],
      ["budget", "Budget"],
    ]);
    expect(INTAKE_QUESTIONS.map((question) => question.options.map((option) => option.label))).toEqual([
      ["Pocket", "Desk", "Wall or fridge", "Hidden"],
      ["Talk to it", "Touch screen", "Light and button"],
      ["Camera", "Air quality", "None"],
      ["Under $25", "Under $50", "Under $100", "No limit"],
    ]);
  });

  it("maps every chip exactly like the planner core's intake options", async () => {
    const { POST } = await import("../site/app/api/plan/route");
    const response = await POST(
      new Request("https://www.hackshop.dev/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Forwarded-For": "198.51.100.30" },
        body: JSON.stringify({ idea: "abc" }),
      }),
    );
    const data = (await response.json()) as {
      questions: Array<{
        id: string;
        options: Array<{ value: string; needs?: string[]; size?: string; budget_usd?: number }>;
      }>;
    };
    for (const question of INTAKE_QUESTIONS) {
      const core = data.questions.find((candidate) => candidate.id === question.id);
      expect(core, question.id).toBeDefined();
      expect(question.options.map((option) => option.value)).toEqual(core!.options.map((option) => option.value));
      for (const option of question.options) {
        const coreOption = core!.options.find((candidate) => candidate.value === option.value)!;
        expect(option.needs ?? [], `${question.id}.${option.value} needs`).toEqual(coreOption.needs ?? []);
        expect(option.size, `${question.id}.${option.value} size`).toBe(coreOption.size);
        expect(option.budget_usd, `${question.id}.${option.value} budget`).toBe(coreOption.budget_usd);
      }
    }
  });

  it("turns chip answers into needs, size, budget and raw answers", () => {
    expect(planInputFromAnswers({ size: "pocket" })).toEqual({
      needs: ["battery"],
      size: "pocket",
      answers: { size: "pocket" },
    });
    expect(planInputFromAnswers({ size: "wall", interaction: "touch", sensing: "air-quality", budget: "under-50" })).toEqual({
      needs: ["big-screen", "screen", "touch", "air-sensors"],
      size: "wall",
      budget_usd: 50,
      answers: { size: "wall", interaction: "touch", sensing: "air-quality", budget: "under-50" },
    });
    expect(planInputFromAnswers({ size: "hidden", interaction: "light-button" })).toEqual({
      needs: ["home-tunnel"],
      size: "hidden",
      answers: { size: "hidden", interaction: "light-button" },
    });
    expect(planInputFromAnswers({ size: "desk", interaction: "voice", sensing: "camera", budget: "under-100" })).toEqual({
      needs: ["voice", "camera"],
      size: "desk",
      budget_usd: 100,
      answers: { size: "desk", interaction: "voice", sensing: "camera", budget: "under-100" },
    });
    expect(planInputFromAnswers({ sensing: "none", budget: "no-limit" })).toEqual({
      answers: { sensing: "none", budget: "no-limit" },
    });
    expect(planInputFromAnswers({ budget: "under-25" }).budget_usd).toBe(25);
    expect(planInputFromAnswers({})).toEqual({});
  });

  it("drops unknown answers and builds an idea when the box is empty", () => {
    expect(cleanAnswers({ size: "moon", budget: "under-50" })).toEqual({ budget: "under-50" });
    const idea = ideaFromAnswers({ size: "desk", interaction: "voice", sensing: "camera", budget: "under-100" });
    expect(idea.length).toBeGreaterThanOrEqual(3);
    expect(idea).toBe("A Muse gadget for my desk, that I can talk to, with a camera, under $100");
    expect(ideaFromAnswers({}).length).toBeGreaterThanOrEqual(3);
  });
});

describe("planner prefill from the URL (item 16)", () => {
  it("reads idea and chips from the query string", () => {
    const prefill = intakeFromSearchParams(
      new URLSearchParams("idea=A%20fridge%20calendar&size=wall&interaction=touch&sensing=none&budget=under-50"),
    );
    expect(prefill).toEqual({
      idea: "A fridge calendar",
      answers: { size: "wall", interaction: "touch", sensing: "none", budget: "under-50" },
    });
  });

  it("accepts plain budget numbers and ignores junk", () => {
    expect(intakeFromSearchParams(new URLSearchParams("budget=25&size=garage")).answers).toEqual({ budget: "under-25" });
    expect(intakeFromSearchParams(new URLSearchParams("")).answers).toEqual({});
  });

  it("builds links that round-trip", () => {
    const href = plannerHref({ idea: "A pocket remote", answers: { size: "pocket", budget: "under-25" } });
    expect(href).toBe("/?idea=A+pocket+remote&size=pocket&budget=under-25#start");
    const query = href.slice(href.indexOf("?") + 1, href.indexOf("#"));
    expect(intakeFromSearchParams(new URLSearchParams(query))).toEqual({
      idea: "A pocket remote",
      answers: { size: "pocket", budget: "under-25" },
    });
  });
});

describe("plain labels (UX-006)", () => {
  it("maps tiers by id or data label", () => {
    expect(plainTierLabel("full-ui")).toBe("Screen and voice");
    expect(plainTierLabel("Full UI")).toBe("Screen and voice");
    expect(plainTierLabel("status")).toBe("Status screen");
    expect(plainTierLabel("Status")).toBe("Status screen");
    expect(plainTierLabel("linux")).toBe("Linux box");
    expect(plainTierLabel(null)).toBeNull();
    expect(projectStatusLabel("ordering")).toBe("Getting parts");
    expect(partStatusLabel("have")).toBe("Have it");
  });

  it("strips config flags, SDK calls and backticked code from human notes", () => {
    const watcher = "Push-to-talk, full UI display and camera capture. camera.capture returns a JPEG (CONFIG_MUSE_WATCHER_CAMERA=y).";
    expect(humanNote(watcher)).toBe("Push-to-talk, full UI display and camera capture.");
    expect(humanNote("camera.capture returns a JPEG (CONFIG_MUSE_WATCHER_CAMERA=y).")).toBe("");
    expect(
      humanNote("Status light and button. Muse's recommended starting point. The direct `idf.py build` command is correct; `tools/board.sh devkit build` also works."),
    ).toBe("Status light and button. Muse's recommended starting point.");
    expect(humanNote("D1S/D1Pro add CO2 and tVOC that Muse can read with sensors.read; D1 has no sensors.")).toBe(
      "D1S/D1Pro add CO2 and tVOC that Muse can read; D1 has no sensors.",
    );
    expect(humanNote("Full Muse UI plus camera.capture, so Muse can look at a room.")).toBe(
      "Full Muse UI plus camera capture, so Muse can look at a room.",
    );
    expect(humanNote('Round 1.75" 466x466 touch AMOLED. Visit gadgets.muse.ai.')).toBe(
      'Round 1.75" 466x466 touch AMOLED. Visit gadgets.muse.ai.',
    );
    for (const text of [humanNote(watcher), humanNote("`x` y")]) {
      expect(text).not.toMatch(/CONFIG_|`|camera\.capture/);
    }
    expect(hasDeveloperDetail("camera.capture returns a JPEG")).toBe(true);
    expect(hasDeveloperDetail("Pocket stick with speaker")).toBe(false);
  });
});

describe("price labels (UX-005)", () => {
  it("shows the board price next to the all-in total", () => {
    expect(boardAndTotalLabel("$55-61", 63)).toBe("Board $55-61 · about $63 with cable/parts");
    expect(boardAndTotalLabel("~$36", 41.4)).toBe("Board $36 · about $41 with cable/parts");
    expect(boardAndTotalLabel("$69", 69)).toBe("Board $69");
    expect(boardAndTotalLabel("$55-61", null)).toBe("Board $55-61");
    expect(boardAndTotalLabel(null, 30)).toBe("About $30 with cable/parts");
    expect(boardAndTotalLabel("Price unknown", null)).toBeNull();
    expect(boardPriceRange(55, 61)).toBe("$55-61");
    expect(boardPriceRange(60.99, 60.99)).toBe("$60.99");
  });
});

describe("difficulty badges (item 15)", () => {
  it("reads optional difficulty blocks and returns undefined when missing", () => {
    const fixture = [
      {
        boards: [
          { device_id: "a", difficulty: { level: "green", why: "One cable." } },
          { device_id: "b", difficulty: { level: "purple", why: "?" } },
          { device_id: "c" },
        ],
      },
    ];
    expect(difficultyFor("a", fixture)).toEqual({ level: "green", why: "One cable." });
    expect(difficultyFor("b", fixture)).toBeUndefined();
    expect(difficultyFor("c", fixture)).toBeUndefined();
    expect(difficultyFor("missing", fixture)).toBeUndefined();
    expect(difficultyMap(fixture)).toEqual({ a: { level: "green", why: "One cable." } });
    expect(parseDifficulty({ level: "black" })).toEqual({ level: "black", why: "" });
    expect(parseDifficulty(null)).toBeUndefined();
  });

  it("works against the real platforms.json, with or without data", () => {
    const map = difficultyMap();
    for (const value of Object.values(map)) {
      expect(["green", "blue", "black"]).toContain(value.level);
    }
    expect(() => difficultyFor("seeed-sensecap-watcher")).not.toThrow();
  });

  it("uses the ski-slope labels", () => {
    expect(DIFFICULTY_LEVELS.green.text).toBe("Beginner · no tools");
    expect(DIFFICULTY_LEVELS.blue.text).toBe("Intermediate · extra steps");
    expect(DIFFICULTY_LEVELS.black.text).toBe("Expert · needs a pro or better to buy");
  });
});

describe("My builds cards (item 12)", () => {
  const steps = [
    { id: "parts", title: "Get the parts" },
    { id: "token", title: "Get your Muse SDK token" },
    { id: "flash", title: "Flash the firmware" },
  ];
  const base = {
    id: "11111111-1111-4111-8111-111111111111",
    device_ids: ["m5stack-sticks3"],
    updated_at: "2026-10-05T12:00:00.000Z",
  };

  it("summarizes progress, parts and where you left off", () => {
    const summary = summarizeProject(
      {
        ...base,
        status: "ordering",
        checklist: { parts: true, token: false, flash: false },
        parts: { board: "have", cable: "have", stand: "need" },
      },
      steps,
    );
    expect(summary.statusLabel).toBe("Getting parts");
    expect(summary.stepsDone).toBe(1);
    expect(summary.stepsTotal).toBe(3);
    expect(summary.progress).toBeCloseTo(1 / 3);
    expect(summary.partsLine).toBe("2 of 3 parts in hand");
    expect(summary.nextStep).toEqual({ number: 2, title: "Get your Muse SDK token" });
    expect(summary.continueHref).toBe(`/projects/${base.id}#step-2`);
    expect(summary.finishedLabel).toBeNull();
  });

  it("says when a build is finished", () => {
    const summary = summarizeProject(
      { ...base, status: "done", checklist: { parts: true, token: true, flash: true }, parts: {} },
      steps,
      () => "Oct 5, 2026",
    );
    expect(summary.statusLabel).toBe("Done");
    expect(summary.finishedLabel).toBe("Finished Oct 5, 2026");
    expect(summary.nextStep).toBeNull();
    expect(summary.partsLine).toBeNull();
    expect(summary.continueHref).toBe(`/projects/${base.id}`);
  });

  it("links steps by number on the project page", () => {
    const source = site("components/ProjectDetailClient.tsx");
    expect(source).toContain("id={`step-${index + 1}`}");
  });
});

describe("Ask my agent prompts (items 4 and 11)", () => {
  it("reads the board's build plan and asks before any order", () => {
    const prompt = buildWithAgentPrompt({
      name: "M5Stack StickS3",
      deviceId: "m5stack-sticks3",
      items: [{ qty: 1, name: "USB-C data cable" }],
      idea: "A pocket remote",
    });
    expect(prompt).toContain("https://www.hackshop.dev/build/m5stack-sticks3/build.md");
    expect(prompt).toContain("1 × USB-C data cable");
    expect(prompt).toContain("It's for: A pocket remote.");
    expect(prompt).toMatch(/where it will live, how I'll use it \(talk, touch, or light and button\)/);
    expect(prompt).toMatch(/sense the room/);
    expect(prompt).toMatch(/budget/);
    expect(prompt).toMatch(/including how hard it is to build/);
    expect(prompt).toMatch(/seller link, its price and the total/);
    expect(prompt).toContain('"Place this order for $<total> at <seller>?"');
    expect(prompt).toMatch(/wait for a clear yes/);
    expect(prompt).toMatch(/Amazon and eBay don't/);
    expect(prompt).toMatch(/flashing and pairing step by step/);
    expect(prompt).toMatch(/where to pick up next time/);
  });

  it("falls back to agents.md and mentions eBay at most once", () => {
    for (const prompt of [STORE_AGENT_PROMPT, buildWithAgentPrompt(), buildWithAgentPrompt({ name: "X", deviceId: "x" })]) {
      expect(prompt.match(/eBay/g)?.length ?? 0).toBeLessThanOrEqual(1);
      expect(prompt).not.toMatch(/newest eBay listings/i);
      expect(prompt).not.toMatch(/buy everything/i);
    }
    expect(STORE_AGENT_PROMPT).toContain("https://www.hackshop.dev/agents.md");
    expect(STORE_AGENT_PROMPT).toMatch(/Recommend a board and say why/);
    expect(buyEverythingPrompt).toBe(buildWithAgentPrompt);
  });

  it("keeps the buying rules inside the chat URL limit", () => {
    const prompt = buildWithAgentPrompt({
      name: "Seeed SenseCAP Watcher",
      deviceId: "seeed-sensecap-watcher",
      items: Array.from({ length: 12 }, (_, index) => ({ qty: 1, name: `Part number ${index}` })),
      idea: "x".repeat(3000),
    });
    expect(chatUrl("claude", prompt).length).toBeLessThan(2100);
    expect(prompt).toContain("Place this order for $<total> at <seller>?");
    expect(prompt).toContain("where to pick up next time");
  });

  it("uses the agreed button copy", () => {
    expect(ASK_AGENT_TITLE).toBe("Ask my agent to help me build one");
    expect(ASK_AGENT_BLURB).toBe(
      "Paste this into Claude, ChatGPT or your agent. It asks what you want the gadget to do, helps you pick the board, lists the parts with prices, and walks you through setup. It never buys anything without your OK.",
    );
  });
});

describe("site copy guards", () => {
  const files = [
    "app/page.tsx",
    "app/muse/page.tsx",
    "app/muse/[slug]/page.tsx",
    "app/store/page.tsx",
    "app/templates/page.tsx",
    "components/BuildExperience.tsx",
    "components/GadgetPlanner.tsx",
    "components/GetPartsPanel.tsx",
    "components/ProjectDetailClient.tsx",
    "components/ProjectsIndexClient.tsx",
    "components/SiteHeaderBar.tsx",
    "components/StartBuildButton.tsx",
    "lib/templates.ts",
    "lib/muse-page.ts",
  ];

  it("never pushes buying", () => {
    for (const file of files) {
      const source = site(file);
      expect(source, file).not.toMatch(/Buy everything|buy it all|Tell my agent to buy/i);
      expect(source, file).not.toMatch(/with spoken replies|spoken replies and|hear Muse answer|"Spoken"/i);
    }
    expect(site("app/page.tsx")).toContain("Never buys anything without your OK");
  });

  it("uses one meaning for Start a build (UX-007)", () => {
    expect(site("components/StartBuildButton.tsx")).toContain('label = "Start this build"');
    expect(site("components/GadgetPlanner.tsx")).toContain('heading = "Find your board"');
    expect(site("app/page.tsx")).toContain('href="#start"');
    expect(site("app/page.tsx")).toContain("Use the planner on this page");
  });

  it("puts the effort line on build pages (UX-008)", () => {
    const source = site("components/BuildExperience.tsx");
    expect(source).toContain("About 30-45 minutes");
    expect(source).toContain("needs a Mac or PC and a USB-C data cable");
    expect(source).toContain("some Terminal, or let your agent do it");
    expect(source).toContain('href="#agent-handoff"');
  });

  it("lists the E1002 as an SDK board on templates", () => {
    expect(site("lib/templates.ts")).not.toMatch(/only the E1001 is in the SDK/);
  });

  it("keeps the legal pages dated and free of personal names", () => {
    for (const file of ["app/terms/page.tsx", "app/privacy/page.tsx", "app/about/page.tsx"]) {
      const source = site(file);
      expect(source, file).toContain('updated="October 5, 2026"');
      expect(source, file).not.toMatch(/—/);
      expect(source, file).not.toMatch(/msanchez|gmail\.com/i);
    }
    expect(site("components/SiteFooter.tsx")).toContain("https://github.com/hackshopdev/hackshop-mcp");
  });
});

describe("header nav (item 14)", () => {
  it("links every section, including pages from other branches", () => {
    expect(NAV_LINKS.map((link) => [link.label, link.href])).toEqual([
      ["Muse gadgets", "/muse"],
      ["Store", "/store"],
      ["Templates", "/templates"],
      ["Ideas", "/ideas"],
      ["Tools", "/tools"],
      ["Field guides", "/resources"],
    ]);
    const header = site("components/SiteHeaderBar.tsx");
    expect(header).toContain("aria-expanded={open}");
    expect(header).toContain('event.key === "Escape"');
    expect(site("components/ProjectNav.tsx")).toContain("MY_BUILDS_LABEL");
  });
});
