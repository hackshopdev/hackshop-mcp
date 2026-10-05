import { boardPath } from "@/lib/board-slugs";
import { deviceNameFor, platformBuildDeviceIds } from "@/lib/build-plan-data";
import { pageMetadata } from "@/lib/page-metadata";
import { BOARDS, STATUS_LABEL, SDK_ESP32_BOARD_COUNT, resolveAllLinks } from "@/lib/tools/board-lookup";
import { BOARD_PRICES } from "@/lib/tools/board-prices";
import { toolBySlug } from "@/lib/tools/catalog";
import {
  SDK_DEVICES_README_URL,
  SDK_ESP32_AGENTS_URL,
  SDK_ESP32_README_URL,
  SDK_LINUX_README_URL,
  type SourceLink,
} from "@/lib/tools/sources";
import { ToolPage, type FaqItem } from "../_components/ToolPage";
import { BoardChecker, type ResolvedLink } from "./BoardChecker";
import shared from "../tools.module.css";

export const dynamic = "force-static";

const TOOL = toolBySlug("does-my-board-run-muse");
const TITLE = "Does my board run Meta's Muse?";

export const metadata = pageMetadata(`${TITLE} Muse Gadgets board checker · Hackshop`, TOOL.description, TOOL.path);

function resolvedLinks(): Record<string, ResolvedLink[]> {
  const buildDeviceIds = new Set(platformBuildDeviceIds());
  const out: Record<string, ResolvedLink[]> = {};
  for (const entry of BOARDS) {
    out[entry.id] = resolveAllLinks(entry, { boardPath, buildDeviceIds }).map((link) => ({
      deviceId: link.deviceId ?? "",
      name: (link.deviceId && deviceNameFor(link.deviceId)) || entry.name,
      boardPage: link.boardPage,
      buildPage: link.buildPage,
    }));
  }
  return out;
}

const SHOWS_SHORT: Record<string, string> = {
  "full-ui": "Full UI (avatar, push-to-talk, settings)",
  light: "Status light",
  screen: "Status screen and images",
  "e-paper": "E-paper status and images",
  "led-ring": "LED ring, push-to-talk",
  "rgb-led": "RGB LED, push-to-talk",
  linux: "Commands and files",
};

const FAQ: FaqItem[] = [
  {
    question: "Which boards does Meta's Muse support?",
    answer: `The ESP32 Device SDK lists ${SDK_ESP32_BOARD_COUNT} boards, two of them experimental (the Seeed reSpeaker Lite with XIAO ESP32-S3 and the M5Stack Cardputer ADV). They range from the ESP32-C5 DevKitC-1 with a status light to full-UI boards like the SenseCAP Watcher and M5Stack StickS3. The Linux SDK runs on a Raspberry Pi 3B+, 4, 5 or Zero 2 W and on other Linux computers with Bluetooth LE.`,
  },
  {
    question: "Does Muse work on an ESP32-C3 or an ESP8266?",
    answer:
      "Not out of the box. Every listed ESP32 board uses an ESP32, ESP32-S3, ESP32-C5 or ESP32-C6 chip. To add a board, the SDK says to copy the closest board's settings file and change the chip, button pin, status light and flash size.",
  },
  {
    question: "What does full UI mean?",
    answer:
      "Boards with the full UI run an animated avatar, push-to-talk and settings on their screen. The others show status on a light, an LED ring or a simple status screen.",
  },
  {
    question: "Why don't some boards get the home-network tunnel?",
    answer:
      "The tunnel needs more memory than boards without PSRAM have, such as the classic ESP32 and the ESP32-C6. Muse can still reach and control those boards.",
  },
  {
    question: "What computer do I need to flash a board?",
    answer:
      "The ESP32 SDK lists a computer running macOS or Linux, a USB cable that carries data, an SDK token and the Muse app. The BOX-3 setup page also has PowerShell commands for Windows.",
  },
  {
    question: "Which ESP-IDF version do I need?",
    answer:
      "Exactly ESP-IDF 6.0.1. The SDK says other versions aren't supported, even though Espressif's stable docs now show 6.1. Don't install the latest by default.",
  },
];

const SOURCES: SourceLink[] = [
  { label: "Muse ESP32 SDK README (board table)", url: SDK_ESP32_README_URL },
  { label: "Muse ESP32 devices README (features, flashing)", url: SDK_DEVICES_README_URL },
  { label: "Muse ESP32 AGENTS.md (ports, Watcher, Voice PE)", url: SDK_ESP32_AGENTS_URL },
  { label: "Muse Linux SDK README", url: SDK_LINUX_README_URL },
  ...Object.values(BOARD_PRICES).map((price) => ({ label: `${price.seller}: ${price.label}`, url: price.source })),
];

export default function DoesMyBoardRunMusePage() {
  const listed = BOARDS.filter((entry) => entry.family === "esp32");
  return (
    <ToolPage
      path={TOOL.path}
      crumb="Does my board run Muse?"
      eyebrow="Free tool · Muse Gadgets"
      title={TITLE}
      showPricesChecked
      app={{ name: "Muse board checker", description: TOOL.description }}
      intro={
        <>
          <p>
            If it&apos;s one of the <strong>{SDK_ESP32_BOARD_COUNT} boards</strong> in Meta&apos;s Muse Gadgets ESP32
            SDK, yes: from the ESP32-C5 DevKitC-1 to the SenseCAP Watcher and M5Stack StickS3. A{" "}
            <strong>Raspberry Pi 3B+, 4, 5 or Zero 2 W</strong>, or any Linux computer with Bluetooth LE, runs the
            Linux SDK.
          </p>
          <p>Search your board to see what works on it, how to build it and what to watch for when you flash.</p>
        </>
      }
      toolLabel="Muse board checker"
      howItWorks={
        <>
          <p>
            The checker matches what you type against the board names, model numbers and chips in Meta&apos;s SDK
            docs, then shows what that board gets: the full on-screen UI or a status light, push-to-talk, images,
            touch, camera and the home-network tunnel. Flashing notes come from the SDK&apos;s own instructions,
            such as backing up the SenseCAP Watcher&apos;s factory data first.
          </p>
          <p>
            Two of the {SDK_ESP32_BOARD_COUNT} boards are marked experimental by the SDK. Boards that aren&apos;t on the
            list may still be added with a new settings file, so the checker tells you what to look for.
          </p>
          <h3>Every board on the ESP32 SDK list</h3>
          <table className={shared.dataTable}>
            <caption className="sr-only">Boards supported by the Muse Gadgets ESP32 SDK</caption>
            <thead>
              <tr>
                <th scope="col">Board</th>
                <th scope="col">Status</th>
                <th scope="col">What you get</th>
              </tr>
            </thead>
            <tbody>
              {listed.map((entry) => (
                <tr key={entry.id}>
                  <td>
                    <a href={`?board=${entry.id}#check`}>{entry.name}</a>
                  </td>
                  <td>{STATUS_LABEL[entry.status]}</td>
                  <td>{SHOWS_SHORT[entry.shows] ?? entry.shows}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      }
      faq={FAQ}
      related={[
        { href: "/tools/esp32-port-finder", label: "ESP32 port finder", blurb: "Board not showing up? Find its serial port." },
        { href: "/tools/muse-board-picker", label: "Muse board picker", blurb: "Don't have a board yet? Get three picks." },
        { href: "/muse", label: "Compare Muse boards", blurb: "Features and prices side by side." },
        { href: "/resources/safe-firmware-flashing-a-preflight-and-recovery-checklist", label: "Safe flashing checklist", blurb: "Back up first and know how to recover." },
      ]}
      cta={{
        title: "Your board runs Muse. Now build it.",
        body: "Start a build to get the parts list, the steps and a prompt your agent can follow.",
        primary: { href: "/#start", label: "Start a build" },
        secondary: { href: "/muse", label: "Compare the boards" },
      }}
      sources={SOURCES}
    >
      <BoardChecker links={resolvedLinks()} />
    </ToolPage>
  );
}
