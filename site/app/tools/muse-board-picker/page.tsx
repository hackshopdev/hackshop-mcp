import Link from "next/link";
import platformsJson from "@/platforms.json";
import { boardPath } from "@/lib/board-slugs";
import { pageMetadata } from "@/lib/page-metadata";
import { BOARD_PRICES } from "@/lib/tools/board-prices";
import { toolBySlug } from "@/lib/tools/catalog";
import { PRICES_CHECKED_LABEL } from "@/lib/tools/sources";
import { ToolPage, type FaqItem } from "../_components/ToolPage";
import { BoardPicker, type PartsInfo } from "./BoardPicker";
import shared from "../tools.module.css";
import styles from "./picker.module.css";

export const dynamic = "force-static";

const TOOL = toolBySlug("muse-board-picker");
const TITLE = "Which Muse board should I buy?";

export const metadata = pageMetadata(`${TITLE} Board picker quiz · Hackshop`, TOOL.description, TOOL.path);

interface PlatformFile {
  boards: Array<{
    device_id: string;
    parts?: Array<{ name: string; qty: number; required: boolean; est_price_usd?: number }>;
  }>;
}

function partsByDevice(): Record<string, PartsInfo> {
  const out: Record<string, PartsInfo> = {};
  for (const platform of platformsJson as unknown as PlatformFile[]) {
    for (const board of platform.boards) {
      const required = (board.parts ?? []).filter((part) => part.required);
      out[board.device_id] = {
        usd: required.reduce((sum, part) => sum + (part.est_price_usd ?? 0) * part.qty, 0),
        names: required.map((part) => part.name),
      };
    }
  }
  return out;
}

function boardPagesByDevice(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const platform of platformsJson as unknown as PlatformFile[]) {
    for (const board of platform.boards) {
      const page = boardPath(board.device_id);
      if (page) out[board.device_id] = page;
    }
  }
  return out;
}

const QUICK_PICKS: Array<{ want: string; deviceId: string; name: string; why: string }> = [
  {
    want: "A pocket remote you talk to",
    deviceId: "m5stack-sticks3",
    name: "M5Stack StickS3",
    why: "Full UI, push-to-talk, speaker, mic and a battery in a 48 mm stick.",
  },
  {
    want: "A palm-size voice buddy",
    deviceId: "aipi-lite",
    name: "AIPI Lite",
    why: "Full UI with push-to-talk, a two-button menu and a battery module.",
  },
  {
    want: "A desk gadget with a touch screen",
    deviceId: "waveshare-esp32-s3-touch-amoled-1-75c",
    name: "Waveshare ESP32-S3-Touch-AMOLED-1.75C",
    why: "Round 1.75\" AMOLED touch screen with the animated avatar.",
  },
  {
    want: "A desk gadget with a camera",
    deviceId: "seeed-sensecap-watcher",
    name: "Seeed SenseCAP Watcher",
    why: "Round touch screen and the only listed board whose camera Muse can use.",
  },
  {
    want: "A wall or fridge display",
    deviceId: "seeed-reterminal-e1002",
    name: "Seeed reTerminal E1002",
    why: "7.3\" six-colour e-paper. The black-and-white E1001 is $69.",
  },
  {
    want: "Talk to it, no screen",
    deviceId: "home-assistant-voice-pe",
    name: "Home Assistant Voice PE",
    why: "LED ring and push-to-talk. Replies show up in the Muse app.",
  },
  {
    want: "Let Muse run a Linux box",
    deviceId: "raspberry-pi-zero-2w",
    name: "Raspberry Pi Zero 2 W",
    why: "On the Linux SDK's list. Muse can run shell commands on it.",
  },
];

const FAQ: FaqItem[] = [
  {
    question: "Which Muse board is best for beginners?",
    answer:
      "Muse's own docs suggest the ESP32-C5 DevKitC-1 as the quickest start: it works as-is with its status light and BOOT button. If you want a screen and voice, the M5Stack StickS3 costs $21.50, but its first flash needs a workaround. The AIPI Lite ($35.99) and the Waveshare 1.75C ($39.99-41.99) have no special first-flash steps in the SDK docs.",
  },
  {
    question: "Can a Muse gadget talk back?",
    answer:
      "Replies from Muse are text. You push to talk, Muse answers in writing, and boards with a screen show the answer as captions. For spoken answers you add a text-to-speech service of your choice; the SDK marks where to hook it in.",
  },
  {
    question: "What does the all-in price include?",
    answer:
      "The board's price from the seller's page, checked October 5, 2026, plus hackshop's estimate for the parts each build needs, usually a USB-C data cable. A Raspberry Pi also needs a power supply and a microSD card.",
  },
  {
    question: "Do I need a 3D printer?",
    answer:
      "No. None of the SDK boards needs a printed part to run Muse. Some hackshop builds have an optional printed stand, and the 3D printer cost calculator shows whether buying a printer is worth it.",
  },
  {
    question: "Can I sell gadgets I build?",
    answer:
      "Not with a Muse token inside. Meta's SDK token terms allow personal, non-commercial use and sharing up to 50 devices, and forbid selling or listing devices with a token. The code itself is Apache-2.0.",
  },
];

export default function MuseBoardPickerPage() {
  return (
    <ToolPage
      path={TOOL.path}
      crumb={TOOL.name}
      eyebrow="Free tool · Muse Gadgets"
      title={TITLE}
      showPricesChecked
      app={{ name: "Muse board picker", description: TOOL.description }}
      intro={
        <>
          <p>
            For most people: the <strong>M5Stack StickS3</strong> ($21.50) for a pocket remote you talk
            to, the <strong>Waveshare ESP32-S3-Touch-AMOLED-1.75C</strong> ($39.99-41.99) for a desk
            gadget with a round touch screen, and the <strong>Seeed reTerminal E1002</strong> ($99) for a
            color e-paper display on the wall.
          </p>
          <p>Answer four questions below to get the three boards that fit what you want to build.</p>
        </>
      }
      toolLabel="Muse board picker quiz"
      howItWorks={
        <>
          <p>
            Your four answers become the same inputs the hackshop planner uses: where it lives sets the
            size, how you use it and what it senses set the features it needs, and the budget caps the
            all-in cost. The planner checks every board Muse supports and ranks the ones that cover your
            needs, cheapest first when you set a budget. Your answers stay in the page address, so you
            can share the results.
          </p>
          <h3>Quick picks</h3>
          <table className={shared.dataTable}>
            <caption className="sr-only">Quick Muse board picks by use, with checked prices</caption>
            <thead>
              <tr>
                <th scope="col">If you want</th>
                <th scope="col">Buy</th>
                <th scope="col">Price</th>
              </tr>
            </thead>
            <tbody>
              {QUICK_PICKS.map((row) => {
                const price = BOARD_PRICES[row.deviceId];
                const page = boardPath(row.deviceId);
                return (
                  <tr key={row.deviceId}>
                    <td>{row.want}</td>
                    <td>
                      {page ? <Link href={page}>{row.name}</Link> : row.name}
                      <br />
                      <span className="sr-only">. </span>
                      <small>{row.why}</small>
                    </td>
                    <td>
                      {price ? (
                        <a href={price.source} target="_blank" rel="noopener noreferrer">
                          {price.label}
                        </a>
                      ) : (
                        "Not checked"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className={styles.fine}>{PRICES_CHECKED_LABEL}. Prices link to the seller&apos;s page.</p>
        </>
      }
      faq={FAQ}
      related={[
        { href: "/tools/does-my-board-run-muse", label: "Does my board run Muse?", blurb: "Already own a board? Check it against the SDK list." },
        { href: "/muse", label: "Compare every Muse board", blurb: "Voice, screen, camera and price side by side." },
        { href: "/store", label: "Get the parts", blurb: "Seller links for each board and the cable it needs." },
      ]}
      cta={{
        title: "Have something specific in mind?",
        body: "Describe the gadget in your own words and the planner picks boards, lists the parts and saves the build steps.",
        primary: { href: "/#start", label: "Start a build" },
        secondary: { href: "/muse", label: "Compare the boards" },
      }}
      sources={[
        { label: "M5Stack StickS3 ($21.50)", url: BOARD_PRICES["m5stack-sticks3"]!.source },
        { label: "AIPI Lite ($35.99)", url: BOARD_PRICES["aipi-lite"]!.source },
        { label: "Waveshare 1.75C ($39.99-41.99)", url: BOARD_PRICES["waveshare-esp32-s3-touch-amoled-1-75c"]!.source },
        { label: "Seeed SenseCAP Watcher ($60.99)", url: BOARD_PRICES["seeed-sensecap-watcher"]!.source },
        { label: "Seeed reTerminal E1001 ($69)", url: BOARD_PRICES["seeed-reterminal-e1001"]!.source },
        { label: "Seeed reTerminal E1002 ($99)", url: BOARD_PRICES["seeed-reterminal-e1002"]!.source },
        { label: "Home Assistant Voice PE ($69)", url: BOARD_PRICES["home-assistant-voice-pe"]!.source },
        { label: "Raspberry Pi 5 list prices", url: BOARD_PRICES["raspberry-pi-5"]!.source },
        { label: "Raspberry Pi Zero 2 W ($15)", url: BOARD_PRICES["raspberry-pi-zero-2w"]!.source },
        { label: "Muse ESP32 SDK README", url: "https://github.com/facebookincubator/muse-gadget-sdk/blob/main/esp32/README.md" },
        { label: "Muse Gadget SDK terms", url: "https://gadgets.muse.ai/sdk-terms" },
      ]}
    >
      <BoardPicker parts={partsByDevice()} boardPages={boardPagesByDevice()} />
    </ToolPage>
  );
}
