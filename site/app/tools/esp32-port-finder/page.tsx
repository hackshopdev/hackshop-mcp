import { pageMetadata } from "@/lib/page-metadata";
import { toolBySlug } from "@/lib/tools/catalog";
import {
  ARDUINO_NOT_DETECTED_URL,
  ESPRESSIF_SERIAL_GUIDE_URL,
  ESPTOOL_TROUBLESHOOTING_URL,
  SDK_DEVICES_README_URL,
  SDK_ESP32_AGENTS_URL,
  SDK_ESP32_README_URL,
  type SourceLink,
} from "@/lib/tools/sources";
import { ToolPage, type FaqItem } from "../_components/ToolPage";
import { PortFinder } from "./PortFinder";
import styles from "./ports.module.css";
import shared from "../tools.module.css";

export const dynamic = "force-static";

const TOOL = toolBySlug("esp32-port-finder");
const TITLE = "ESP32 not showing up? Find your serial port";

export const metadata = pageMetadata(`${TITLE} · Hackshop`, TOOL.description, TOOL.path);

const PORT_TABLE: Array<{ chip: string; mac: string; linux: string; windows: string }> = [
  {
    chip: "Native USB (ESP32-S3, C5 and C6 boards, StickS3, Waveshare, AIPI Lite, Voice PE)",
    mac: "/dev/cu.usbmodem*",
    linux: "/dev/ttyACM*",
    windows: "COM port",
  },
  {
    chip: "CH340 bridge (ideaspark, SenseCAP Indicator, reTerminal E1001 and E1002)",
    mac: "/dev/cu.usbserial-* or /dev/cu.wchusbserial*",
    linux: "/dev/ttyUSB*",
    windows: "COM port",
  },
  {
    chip: "CH342 bridge (SenseCAP Watcher)",
    mac: "Two /dev/cu.usbmodem* ports. Use the one ending in 3",
    linux: "Two ports. Use the second one",
    windows: "Two COM ports",
  },
  {
    chip: "CH9102 bridge (M5Stack StickC Plus2)",
    mac: "/dev/cu.usbserial-*",
    linux: "/dev/ttyACM*",
    windows: "COM port",
  },
];

const FAQ: FaqItem[] = [
  {
    question: "Why is my ESP32 not showing up?",
    answer:
      "Start with the cable. A charge-only USB cable powers the board but carries no data, so no port appears. Try a cable you know moves files, or test yours on another device. Muse's ESP32 SDK lists a data cable as a requirement.",
  },
  {
    question: "What is the ESP32 port name on a Mac?",
    answer:
      "Run ls /dev/cu.* to list ports. Native USB boards (ESP32-S3, C5, C6) show up as /dev/cu.usbmodem followed by a number. Boards with a CH340 chip show up as /dev/cu.usbserial-* or /dev/cu.wchusbserial*.",
  },
  {
    question: "How do I fix Permission denied on /dev/ttyUSB0 or /dev/ttyACM0?",
    answer:
      "Add yourself to the dialout group with sudo usermod -a -G dialout $USER (uucp on Arch), then log out and back in so the change takes effect.",
  },
  {
    question: "What does holding BOOT and pressing RESET do?",
    answer:
      "It puts the chip in download mode so the flasher can connect. Hold BOOT, tap RESET, let go of BOOT, then flash again. Reflashing Muse keeps pairing and Wi-Fi settings; only erase-flash wipes them.",
  },
  {
    question: "Which port do I use on the SenseCAP Watcher?",
    answer:
      "Its bottom USB-C port has a CH342 bridge that shows up as two ports. The ESP32-S3 console is the second one, ending in 3; the first is the Himax camera chip. Flash it with tools/muse/board.sh flash watcher and wait about three minutes.",
  },
  {
    question: "Do I need a driver?",
    answer:
      "Espressif says the CP210x and FTDI drivers should come with your operating system, and the Watcher's CH342 works with macOS's built-in driver. On Windows, if the board shows up under Other devices with a warning sign, install the driver from the bridge chip's maker.",
  },
];

const SOURCES: SourceLink[] = [
  { label: "Muse ESP32 SDK README", url: SDK_ESP32_README_URL },
  { label: "Muse ESP32 AGENTS.md (port names, Watcher, Voice PE)", url: SDK_ESP32_AGENTS_URL },
  { label: "Muse ESP32 devices README (StickS3, CoreS3, StickC Plus2)", url: SDK_DEVICES_README_URL },
  { label: "Espressif: establish a serial connection", url: ESPRESSIF_SERIAL_GUIDE_URL },
  { label: "esptool troubleshooting", url: ESPTOOL_TROUBLESHOOTING_URL },
  { label: "Arduino: board not detected", url: ARDUINO_NOT_DETECTED_URL },
];

export default function Esp32PortFinderPage() {
  return (
    <ToolPage
      path={TOOL.path}
      crumb="ESP32 port finder"
      eyebrow="Free tool · ESP32"
      title={TITLE}
      app={{ name: "ESP32 port finder", description: TOOL.description }}
      intro={
        <>
          <p>
            Start with the cable: a charge-only USB cable powers the board but carries no data, so no port
            appears. With a data cable, native USB boards (ESP32-S3, C5, C6) show up as{" "}
            <code>/dev/cu.usbmodem*</code> on a Mac and <code>/dev/ttyACM*</code> on Linux. Boards with a CH340 chip
            show up as <code>/dev/cu.usbserial-*</code> or <code>/dev/ttyUSB*</code>. On Windows it&apos;s a COM port.
          </p>
          <p>Pick your computer and board for the exact command and a checklist when nothing appears.</p>
        </>
      }
      toolLabel="ESP32 serial port finder"
      howItWorks={
        <>
          <p>
            An ESP32 talks to your computer one of two ways. Most newer boards use the chip&apos;s{" "}
            <strong>own USB port</strong> (native USB), which shows up as a modem-style port. Others put a{" "}
            <strong>USB bridge chip</strong> such as a CH340 between the USB socket and the ESP32, which shows up as
            a serial adapter. The port name tells you which one you have.
          </p>
          <p>
            The finder looks up your board&apos;s connection type from the Muse Gadgets SDK docs, then gives you the
            command for your computer, the name to look for, and the board&apos;s own flash command. The checklist
            runs from the most common fix to the rarest.
          </p>
          <h3>Port names by chip</h3>
          <table className={shared.dataTable}>
            <caption className="sr-only">ESP32 serial port names by USB chip and computer</caption>
            <thead>
              <tr>
                <th scope="col">Connection</th>
                <th scope="col">macOS</th>
                <th scope="col">Linux</th>
                <th scope="col">Windows</th>
              </tr>
            </thead>
            <tbody>
              {PORT_TABLE.map((row) => (
                <tr key={row.chip}>
                  <td>{row.chip}</td>
                  <td>
                    <code>{row.mac}</code>
                  </td>
                  <td>
                    <code>{row.linux}</code>
                  </td>
                  <td>{row.windows}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className={styles.source}>
            On Linux, <code>lsusb</code> shows native USB as 303a:1001 and a CH340 as 1a86:7523.
          </p>
        </>
      }
      faq={FAQ}
      related={[
        { href: "/tools/does-my-board-run-muse", label: "Does my board run Muse?", blurb: "Check your board and get its build command." },
        { href: "/resources/safe-firmware-flashing-a-preflight-and-recovery-checklist", label: "Safe flashing checklist", blurb: "Back up first and know how to recover." },
        { href: "/resources/brick-risk-field-guide-flash-recover-or-walk-away", label: "Brick-risk field guide", blurb: "When a failed flash is fixable and when it isn't." },
      ]}
      cta={{
        title: "Board connected? Build the gadget.",
        body: "Start a build to get the steps for your board, or hand it to your agent with the build plan.",
        primary: { href: "/#start", label: "Start a build" },
        secondary: { href: "/muse", label: "See Muse boards" },
      }}
      sources={SOURCES}
    >
      <PortFinder />
    </ToolPage>
  );
}
