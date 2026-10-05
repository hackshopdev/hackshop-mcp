// The free tools under /tools, for the index page, related links and the
// sitemap.

export interface ToolInfo {
  slug: string;
  path: string;
  name: string;
  /** One line for cards and related links. */
  blurb: string;
  /** Meta description. */
  description: string;
}

export const TOOLS: readonly ToolInfo[] = [
  {
    slug: "muse-board-picker",
    path: "/tools/muse-board-picker",
    name: "Muse board picker",
    blurb: "Four quick questions, three boards that fit, with the all-in cost.",
    description:
      "Which Muse board should you buy? Answer four quick questions and get the three Muse Gadgets boards that fit, with photos, prices and the steps to build one.",
  },
  {
    slug: "does-my-board-run-muse",
    path: "/tools/does-my-board-run-muse",
    name: "Does my board run Muse?",
    blurb: "Check any board against the Muse Gadgets SDK list and see what works on it.",
    description:
      "Check whether your ESP32 board or Raspberry Pi runs Meta's Muse. See what works (screen, voice, camera), the build command and flashing tips for all 24 SDK boards.",
  },
  {
    slug: "esp32-port-finder",
    path: "/tools/esp32-port-finder",
    name: "ESP32 port finder",
    blurb: "ESP32 not showing up? Get the command and port name for your computer and board.",
    description:
      "ESP32 not showing up? Find your serial port on macOS, Linux or Windows: the command to list ports, what the port name looks like, and a checklist when nothing appears.",
  },
  {
    slug: "3d-print-cost-calculator",
    path: "/tools/3d-print-cost-calculator",
    name: "3D printer cost calculator",
    blurb: "Buy a printer, use a print service, the library or a makerspace? See the yearly cost.",
    description:
      "Should you buy a 3D printer? Compare a year of printing on a Bambu Lab A1 mini, P1S or Prusa MINI+ with a print service, a public library and a makerspace, using checked prices.",
  },
];

export function toolBySlug(slug: string): ToolInfo {
  const tool = TOOLS.find((candidate) => candidate.slug === slug);
  if (!tool) throw new Error(`Unknown tool ${slug}`);
  return tool;
}

export function otherTools(slug: string): ToolInfo[] {
  return TOOLS.filter((tool) => tool.slug !== slug);
}
