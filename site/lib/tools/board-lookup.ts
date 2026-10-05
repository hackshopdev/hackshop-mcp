// "Does my board run Muse?" data. The 24 ESP32 boards and their features
// come from the Muse Gadgets SDK board tables (esp32/README.md,
// esp32/devices/README.md, esp32/AGENTS.md); the Linux entries come from
// linux/README.md. All read 2026-10-05 from facebookincubator/muse-gadget-sdk.

import {
  SDK_DEVICES_README_URL,
  SDK_ESP32_AGENTS_URL,
  SDK_ESP32_README_URL,
  SDK_LINUX_README_URL,
  SDK_REPO_URL,
} from "./sources";

export type SupportStatus = "supported" | "experimental" | "not-listed";
export type PortKind = "native" | "ch340" | "ch342" | "ch9102" | "cp2104-or-ch9102";
export type ShowsOn = "full-ui" | "light" | "screen" | "e-paper" | "led-ring" | "rgb-led" | "linux" | "unknown";
export type VoiceSupport =
  | "push-to-talk"
  | "buzzer"
  | "text-replies"
  | "app-replies"
  | "needs-mic"
  | "none"
  | "unknown";
export type CameraSupport = "off-by-default" | "unused" | "none" | "unknown";

export interface BoardEntry {
  /** URL key for ?board= */
  id: string;
  name: string;
  aliases: string[];
  family: "esp32" | "linux" | "other";
  status: SupportStatus;
  /** One plain sentence that answers "does it run Muse?" */
  verdict: string;
  chip?: string;
  display?: string;
  memory?: string;
  shows: ShowsOn;
  voice: VoiceSupport;
  /** "Color", "Black and white", "Six colours", or null for no images. */
  images: string | null;
  touch: boolean | null;
  camera: CameraSupport;
  /** Home-network tunnel (needs PSRAM). */
  tunnel: boolean | null;
  build: string | null;
  buildNote?: string;
  /** The SDK's command to back up the stock flash before the first Muse flash. */
  backup?: string;
  port: PortKind | null;
  flashNotes: string[];
  /** hackshop device ids that may have a /muse or /build page for this board. */
  deviceIds: string[];
  sdkUrl: string;
}

export const SDK_ESP32_BOARD_COUNT = 24;

const BACKUP_FIRST = "Back up the stock firmware before the first flash so you can go back.";

export const BOARDS: readonly BoardEntry[] = [
  // ---- Status light boards ----
  {
    id: "esp32-c5-devkitc-1",
    name: "Espressif ESP32-C5 DevKitC-1",
    aliases: ["esp32-c5", "c5 devkitc", "c5 devkit", "esp32c5"],
    family: "esp32",
    status: "supported",
    verdict: "Yes. It's the SDK's default board and Muse's suggested quickest start.",
    chip: "ESP32-C5",
    display: "None (RGB status light)",
    memory: "8 MB flash, 8 MB PSRAM",
    shows: "light",
    voice: "none",
    images: null,
    touch: false,
    camera: "none",
    tunnel: true,
    build: "idf.py build",
    port: "native",
    flashNotes: [
      "If the light shows green as red, its LED takes green first. Turn off the RGB order option in idf.py menuconfig and rebuild.",
    ],
    deviceIds: ["espressif-esp32-c5-devkitc-1"],
    sdkUrl: SDK_DEVICES_README_URL,
  },
  {
    id: "esp32-c6-devkit",
    name: "ESP32-C6 devkit (no PSRAM)",
    aliases: ["esp32-c6", "c6 devkitc", "c6 devkit", "esp32c6", "esp32-c6-devkitc-1"],
    family: "esp32",
    status: "supported",
    verdict: "Yes, with a status light. It has no PSRAM, so there's no home-network tunnel.",
    chip: "ESP32-C6",
    display: "None (RGB status light)",
    memory: "8 MB flash or more, no PSRAM",
    shows: "light",
    voice: "none",
    images: null,
    touch: false,
    camera: "none",
    tunnel: false,
    build: "tools/board.sh c6-nopsram build",
    port: "native",
    flashNotes: [],
    deviceIds: ["espressif-esp32-c6-devkitc-1"],
    sdkUrl: SDK_DEVICES_README_URL,
  },
  {
    id: "esp32-s3-devkitc-1",
    name: "Espressif ESP32-S3-DevKitC-1 (N8R8)",
    aliases: ["esp32-s3", "s3 devkitc", "s3 devkit", "esp32s3", "n8r8"],
    family: "esp32",
    status: "supported",
    verdict: "Yes, with a status light and a button.",
    chip: "ESP32-S3",
    display: "None (RGB status light)",
    memory: "8 MB flash, 8 MB PSRAM",
    shows: "light",
    voice: "none",
    images: null,
    touch: false,
    camera: "none",
    tunnel: true,
    build: "tools/board.sh espressif-s3-devkitc-1 build",
    port: "native",
    flashNotes: [],
    deviceIds: ["espressif-esp32-s3-devkitc-1"],
    sdkUrl: SDK_DEVICES_README_URL,
  },
  // ---- Status screen and e-paper boards ----
  {
    id: "ideaspark-1-9",
    name: "ideaspark ESP32 with 1.9\" display",
    aliases: ["ideaspark", "st7789", "1.9 inch", "esp32 1.9"],
    family: "esp32",
    status: "supported",
    verdict: "Yes. It shows status and images on its screen. No PSRAM, so no home-network tunnel.",
    chip: "ESP32 (classic)",
    display: "1.9\" 170x320 LCD",
    memory: "16 MB flash, no PSRAM",
    shows: "screen",
    voice: "none",
    images: "Color",
    touch: false,
    camera: "none",
    tunnel: false,
    build: "tools/board.sh ideaspark build",
    port: "ch340",
    flashNotes: ["It uses a CH340 USB bridge, so the port name says usbserial, not usbmodem."],
    deviceIds: ["ideaspark-esp32-1-9-lcd"],
    sdkUrl: SDK_DEVICES_README_URL,
  },
  {
    id: "waveshare-c6-lcd-1-47",
    name: "Waveshare ESP32-C6-LCD-1.47",
    aliases: ["waveshare c6 lcd", "c6 lcd 1.47", "1.47"],
    family: "esp32",
    status: "supported",
    verdict: "Yes. It shows status and images on its screen. No PSRAM, so no home-network tunnel.",
    chip: "ESP32-C6",
    display: "1.47\" 172x320 LCD",
    memory: "4 MB flash, no PSRAM",
    shows: "screen",
    voice: "none",
    images: "Color",
    touch: false,
    camera: "none",
    tunnel: false,
    build: "tools/board.sh waveshare-c6-lcd-147 build",
    port: "native",
    flashNotes: [],
    deviceIds: ["waveshare-esp32-c6-lcd-1-47"],
    sdkUrl: SDK_DEVICES_README_URL,
  },
  {
    id: "sensecap-indicator",
    name: "Seeed SenseCAP Indicator",
    aliases: ["indicator", "sensecap d1", "d1s", "d1pro", "d1 pro"],
    family: "esp32",
    status: "supported",
    verdict: "Yes. Status and images on a 4\" screen. The D1S and D1Pro also read air sensors.",
    chip: "ESP32-S3",
    display: "4\" 480x480 LCD",
    memory: "8 MB flash, 8 MB PSRAM",
    shows: "screen",
    voice: "none",
    images: "Color",
    touch: false,
    camera: "none",
    tunnel: true,
    build: "tools/board.sh sensecap-indicator build",
    port: "ch340",
    flashNotes: [
      "It uses a CH340 USB bridge, so the port name says usbserial, not usbmodem.",
      "The air sensors need Seeed's stock RP2040 firmware. Temperature and humidity come from the Grove AHT20 in the box; plug it in.",
    ],
    deviceIds: ["seeed-sensecap-indicator"],
    sdkUrl: SDK_DEVICES_README_URL,
  },
  {
    id: "reterminal-e1001",
    name: "Seeed reTerminal E1001",
    aliases: ["e1001", "reterminal", "7.5 e-paper", "epaper", "e-ink"],
    family: "esp32",
    status: "supported",
    verdict: "Yes. Status and black-and-white images on a 7.5\" e-paper screen.",
    chip: "ESP32-S3",
    display: "7.5\" 800x480 black and white e-paper",
    memory: "32 MB flash, 8 MB PSRAM",
    shows: "e-paper",
    voice: "none",
    images: "Black and white",
    touch: false,
    camera: "none",
    tunnel: true,
    build: "tools/board.sh reterminal-e1001 build",
    port: "ch340",
    flashNotes: [
      "It uses a CH340 USB bridge, so the port name says usbserial, not usbmodem.",
      "Each screen refresh takes a second or two.",
    ],
    deviceIds: ["seeed-reterminal-e1001"],
    sdkUrl: SDK_DEVICES_README_URL,
  },
  {
    id: "reterminal-e1002",
    name: "Seeed reTerminal E1002",
    aliases: ["e1002", "reterminal color", "spectra 6", "7.3 e-paper", "color e-paper"],
    family: "esp32",
    status: "supported",
    verdict: "Yes. Status and six-colour images on a 7.3\" e-paper screen.",
    chip: "ESP32-S3",
    display: "7.3\" 800x480 six-colour e-paper (E Ink Spectra 6)",
    memory: "32 MB flash, 8 MB PSRAM",
    shows: "e-paper",
    voice: "none",
    images: "Six colours",
    touch: false,
    camera: "none",
    tunnel: true,
    build: "tools/board.sh reterminal-e1002 build",
    port: "ch340",
    flashNotes: [
      "It uses a CH340 USB bridge, so the port name says usbserial, not usbmodem.",
      "Each screen refresh takes about 30 seconds and flashes. That's normal.",
    ],
    deviceIds: ["seeed-reterminal-e1002"],
    sdkUrl: SDK_DEVICES_README_URL,
  },
  // ---- Voice boards without a screen ----
  {
    id: "home-assistant-voice-pe",
    name: "Home Assistant Voice Preview Edition",
    aliases: ["voice pe", "ha voice", "home assistant voice", "voice preview"],
    family: "esp32",
    status: "supported",
    verdict: "Yes. Status on the LED ring, push-to-talk on the centre button, and the dial sets the volume.",
    chip: "ESP32-S3 (plus an XMOS audio chip)",
    display: "None (12-LED ring)",
    memory: "16 MB flash, 8 MB PSRAM",
    shows: "led-ring",
    voice: "app-replies",
    images: null,
    touch: false,
    camera: "none",
    tunnel: true,
    build: "tools/board.sh home-assistant-voice build",
    port: "native",
    flashNotes: [
      "Flash the ESP32-S3 only, through its own USB port (/dev/cu.usbmodem* on a Mac). Never reflash the XMOS audio chip.",
      "The centre button is push-to-talk. Turn the mute switch on to get its setup role back (pairing and the 5-second reset).",
    ],
    deviceIds: ["home-assistant-voice-pe"],
    sdkUrl: SDK_ESP32_AGENTS_URL,
  },
  {
    id: "respeaker-lite",
    name: "Seeed reSpeaker Lite with XIAO ESP32-S3",
    aliases: ["respeaker", "xiao esp32-s3", "xiao s3", "respeaker lite"],
    family: "esp32",
    status: "experimental",
    verdict: "Experimental. A single RGB LED and push-to-talk on the XIAO's BOOT button.",
    chip: "ESP32-S3 (XIAO)",
    display: "None (single RGB LED)",
    memory: "8 MB flash, 8 MB PSRAM",
    shows: "rgb-led",
    voice: "app-replies",
    images: null,
    touch: false,
    camera: "none",
    tunnel: true,
    build: "tools/board.sh seeed-respeaker-lite build",
    buildNote: "Follow the SDK's reSpeaker Lite setup page first.",
    port: "native",
    flashNotes: ["The XMOS chip needs 16 kHz I2S firmware. The SDK's setup page covers it."],
    deviceIds: ["seeed-respeaker-lite-xiao-esp32s3", "seeed-respeaker-lite"],
    sdkUrl: SDK_DEVICES_README_URL,
  },
  // ---- Full on-screen UI ----
  {
    id: "waveshare-amoled-1-75c",
    name: "Waveshare ESP32-S3-Touch-AMOLED-1.75C",
    aliases: ["waveshare 1.75c", "amoled 1.75c", "round amoled", "1.75c"],
    family: "esp32",
    status: "supported",
    verdict: "Yes. It runs the full UI: avatar, push-to-talk and settings on a round touch screen.",
    chip: "ESP32-S3",
    display: "1.75\" 466x466 round AMOLED, touch",
    memory: "32 MB flash, 8 MB PSRAM",
    shows: "full-ui",
    voice: "push-to-talk",
    images: "Color",
    touch: true,
    camera: "none",
    tunnel: true,
    build: "tools/muse/board.sh build s3",
    port: "native",
    flashNotes: [],
    deviceIds: ["waveshare-esp32-s3-touch-amoled-1-75c"],
    sdkUrl: SDK_ESP32_AGENTS_URL,
  },
  {
    id: "waveshare-amoled-1-75",
    name: "Waveshare ESP32-S3-Touch-AMOLED-1.75",
    aliases: ["waveshare 1.75", "amoled 1.75"],
    family: "esp32",
    status: "supported",
    verdict: "Yes. It runs the full UI on a round touch screen.",
    chip: "ESP32-S3",
    display: "1.75\" 466x466 round AMOLED, touch",
    memory: "16 MB flash, 8 MB PSRAM",
    shows: "full-ui",
    voice: "push-to-talk",
    images: "Color",
    touch: true,
    camera: "none",
    tunnel: true,
    build: null,
    buildNote: "Built by hand. The SDK's AGENTS.md has the command for the full-UI boards.",
    port: "native",
    flashNotes: ["Not the same as the 1.75C. Check the model name on the box before you build."],
    deviceIds: ["waveshare-esp32-s3-touch-amoled-1-75"],
    sdkUrl: SDK_ESP32_AGENTS_URL,
  },
  {
    id: "esp32-s3-box-3",
    name: "Espressif ESP32-S3-BOX-3",
    aliases: ["box-3", "box3", "s3 box", "esp box"],
    family: "esp32",
    status: "supported",
    verdict: "Yes. Full UI with touch, push-to-talk on BOOT/CONFIG and settings.",
    chip: "ESP32-S3",
    display: "2.4\" 320x240 LCD, touch",
    memory: "16 MB flash, 16 MB PSRAM",
    shows: "full-ui",
    voice: "push-to-talk",
    images: "Color",
    touch: true,
    camera: "none",
    tunnel: true,
    build: "tools/muse/board.sh build box3",
    buildNote: "The SDK's BOX-3 setup page also has PowerShell build and flash commands.",
    port: "native",
    flashNotes: [],
    deviceIds: ["espressif-esp32-s3-box-3"],
    sdkUrl: SDK_DEVICES_README_URL,
  },
  {
    id: "aipi-lite",
    name: "AIPI Lite",
    aliases: ["aipi", "ai pi", "aipi lite"],
    family: "esp32",
    status: "supported",
    verdict: "Yes. Full UI with push-to-talk and a two-button menu.",
    chip: "ESP32-S3",
    display: "128x128 LCD",
    memory: "16 MB flash, 8 MB PSRAM",
    shows: "full-ui",
    voice: "push-to-talk",
    images: "Color",
    touch: false,
    camera: "none",
    tunnel: true,
    build: "tools/muse/board.sh build aipi",
    port: "native",
    flashNotes: [],
    deviceIds: ["aipi-lite"],
    sdkUrl: SDK_ESP32_AGENTS_URL,
  },
  {
    id: "waveshare-c6-amoled-1-8",
    name: "Waveshare ESP32-C6-Touch-AMOLED-1.8",
    aliases: ["waveshare c6 1.8", "c6 amoled", "amoled 1.8", "1.8"],
    family: "esp32",
    status: "supported",
    verdict: "Yes. Full UI, but with no PSRAM its voice notes go over the control session and replies scroll past as text.",
    chip: "ESP32-C6",
    display: "1.8\" 368x448 AMOLED, touch",
    memory: "16 MB flash, no PSRAM",
    shows: "full-ui",
    voice: "text-replies",
    images: null,
    touch: true,
    camera: "none",
    tunnel: false,
    build: "tools/muse/board.sh build c6",
    port: "native",
    flashNotes: [],
    deviceIds: ["waveshare-esp32-c6-touch-amoled-1-8"],
    sdkUrl: SDK_ESP32_AGENTS_URL,
  },
  {
    id: "sensecap-watcher",
    name: "Seeed SenseCAP Watcher",
    aliases: ["watcher", "sensecap watcher", "w1-a", "himax"],
    family: "esp32",
    status: "supported",
    verdict: "Yes. Full UI on a round touch screen, and the only listed board whose camera Muse can use.",
    chip: "ESP32-S3",
    display: "1.45\" 412x412 round LCD, touch",
    memory: "32 MB flash, 8 MB PSRAM",
    shows: "full-ui",
    voice: "push-to-talk",
    images: "Color",
    touch: true,
    camera: "off-by-default",
    tunnel: true,
    build: "tools/muse/board.sh build watcher",
    backup: "tools/muse/paced_esptool.py --chip esp32s3 -p PORT read-flash 0x9000 0x32000 nvsfactory.bin",
    buildNote: "Flash it only with tools/muse/board.sh flash watcher. Plain esptool fails on its USB bridge.",
    port: "ch342",
    flashNotes: [
      "Back up its factory data first. Muse overwrites the nvsfactory partition at 0x9000, and it's unique to each Watcher.",
      "Its USB-C port shows up as two ports. Use the second one, whose name ends in 3. The first is the Himax camera chip.",
      "A flash shows nothing for about three minutes. Don't interrupt it, or the board won't boot until a flash succeeds.",
      "If plain esptool already failed with 0107 or 0105, it erased the bootloader. The board is not bricked: flash again with the SDK's paced tool.",
    ],
    deviceIds: ["seeed-sensecap-watcher"],
    sdkUrl: SDK_ESP32_AGENTS_URL,
  },
  {
    id: "cardputer-adv",
    name: "M5Stack Cardputer ADV",
    aliases: ["cardputer", "cardputer adv", "m5 cardputer"],
    family: "esp32",
    status: "experimental",
    verdict: "Experimental. Full UI with keyboard controls; voice notes get text replies. No images or home-network tunnel.",
    chip: "ESP32-S3",
    display: "1.14\" 240x135 LCD",
    memory: "8 MB flash, no PSRAM",
    shows: "full-ui",
    voice: "text-replies",
    images: null,
    touch: false,
    camera: "none",
    tunnel: false,
    build: "tools/muse/board.sh build cardputer-adv",
    backup: "python -m esptool --chip esp32s3 -p PORT read-flash 0 0x800000 cardputer-adv-backup.bin",
    port: "native",
    flashNotes: [
      "To enter download mode: switch it off, hold GO while you plug in USB, then let go.",
      `${BACKUP_FIRST} It has 8 MB of flash.`,
    ],
    deviceIds: ["m5stack-cardputer-adv"],
    sdkUrl: SDK_DEVICES_README_URL,
  },
  {
    id: "sticks3",
    name: "M5Stack StickS3",
    aliases: ["sticks3", "stick s3", "m5stick s3", "m5sticks3"],
    family: "esp32",
    status: "supported",
    verdict: "Yes. Full UI with push-to-talk on the front button and a menu on the side button.",
    chip: "ESP32-S3",
    display: "1.14\" 135x240 LCD",
    memory: "8 MB flash, 8 MB PSRAM",
    shows: "full-ui",
    voice: "push-to-talk",
    images: "Color",
    touch: false,
    camera: "none",
    tunnel: true,
    build: "tools/muse/board.sh build sticks3",
    backup: "python -m esptool --chip esp32s3 -p PORT --after no-reset read-flash 0 0x800000 sticks3.bin",
    port: "native",
    flashNotes: [
      "First flash only: it ships with UiFlow2, which turns off the chip's USB serial port, and it has no BOOT button. Paste the SDK's REPL snippet to turn USB serial back on.",
      "Pass --after no-reset to esptool until Muse is on, and back up the full 8 MB first (read-flash 0 0x800000 sticks3.bin).",
      "Later flashes need none of this.",
    ],
    deviceIds: ["m5stack-sticks3"],
    sdkUrl: SDK_DEVICES_README_URL,
  },
  {
    id: "stopwatch",
    name: "M5Stack StopWatch",
    aliases: ["stopwatch", "m5 stopwatch"],
    family: "esp32",
    status: "supported",
    verdict: "Yes. Full UI on a round touch AMOLED, with push-to-talk on the yellow button.",
    chip: "ESP32-S3",
    display: "1.75\" 466x466 round AMOLED, touch",
    memory: "16 MB flash, 8 MB PSRAM",
    shows: "full-ui",
    voice: "push-to-talk",
    images: "Color",
    touch: true,
    camera: "none",
    tunnel: true,
    build: "tools/muse/board.sh build stopwatch",
    port: "native",
    flashNotes: ["It uses the chip's own USB port, so flashing needs nothing special."],
    deviceIds: ["m5stack-stopwatch"],
    sdkUrl: SDK_DEVICES_README_URL,
  },
  {
    id: "cores3",
    name: "M5Stack CoreS3",
    aliases: ["cores3", "core s3", "m5 cores3"],
    family: "esp32",
    status: "supported",
    verdict: "Yes. Full UI with touch, and push-to-talk on the PWR button.",
    chip: "ESP32-S3",
    display: "2\" 320x240 LCD, touch",
    memory: "16 MB flash, 8 MB PSRAM",
    shows: "full-ui",
    voice: "push-to-talk",
    images: "Color",
    touch: true,
    camera: "unused",
    tunnel: true,
    build: "tools/muse/board.sh build cores3",
    port: "native",
    flashNotes: ["If esptool can't connect, hold RST for 3 seconds until the green LED lights. That enters the bootloader."],
    deviceIds: ["m5stack-cores3"],
    sdkUrl: SDK_DEVICES_README_URL,
  },
  {
    id: "jc3248w535",
    name: "Guition JC3248W535",
    aliases: ["guition", "jc3248", "jc3248w535c", "3.5 inch"],
    family: "esp32",
    status: "supported",
    verdict: "Yes. Full UI with touch and a speaker. Push-to-talk needs a microphone you add.",
    chip: "ESP32-S3",
    display: "3.5\" 320x480 IPS LCD, touch",
    memory: "16 MB flash, 8 MB PSRAM",
    shows: "full-ui",
    voice: "needs-mic",
    images: "Color",
    touch: true,
    camera: "none",
    tunnel: true,
    build: "tools/muse/board.sh build jc3248w535",
    backup: "python -m esptool --chip esp32s3 -p PORT read-flash 0 0x1000000 jc3248w535.bin",
    port: "native",
    flashNotes: [
      "It has no microphone. Push-to-talk records silence until you wire in an I2S MEMS mic such as an INMP441.",
      BACKUP_FIRST,
    ],
    deviceIds: ["guition-jc3248w535"],
    sdkUrl: SDK_DEVICES_README_URL,
  },
  {
    id: "stickc-plus2",
    name: "M5Stack StickC Plus2",
    aliases: ["stickc plus2", "plus2", "m5stickc", "stickc"],
    family: "esp32",
    status: "supported",
    verdict: "Yes, with the full UI. M5Stack lists it as end of life, and it speaks through a small buzzer.",
    chip: "ESP32 (classic)",
    display: "1.14\" 135x240 LCD",
    memory: "8 MB flash, 2 MB PSRAM",
    shows: "full-ui",
    voice: "buzzer",
    images: "Color",
    touch: false,
    camera: "none",
    tunnel: true,
    build: "tools/muse/board.sh build plus2",
    backup: "python -m esptool --chip esp32 -p PORT -b 230400 read-flash 0 0x800000 plus2.bin",
    port: "ch9102",
    flashNotes: [
      "Its CH9102 USB bridge drops out above 230400 baud. The SDK's flash script uses 230400.",
      `${BACKUP_FIRST} It ships with M5Stack's factory firmware.`,
    ],
    deviceIds: ["m5stack-stickc-plus2"],
    sdkUrl: SDK_DEVICES_README_URL,
  },
  {
    id: "core2",
    name: "M5Stack Core2 (v1.0)",
    aliases: ["core2", "core 2", "m5 core2"],
    family: "esp32",
    status: "supported",
    verdict: "Yes, v1.0 only. Full UI with push-to-talk on the touch strip. The v1.1 (AXP2101) isn't supported.",
    chip: "ESP32 (classic)",
    display: "2.0\" 320x240 touch LCD",
    memory: "16 MB flash, 8 MB PSRAM",
    shows: "full-ui",
    voice: "push-to-talk",
    images: "Color",
    touch: true,
    camera: "none",
    tunnel: true,
    build: "tools/muse/board.sh build core2",
    backup: "python -m esptool --chip esp32 -p PORT -b 230400 read-flash 0 0x1000000 core2.bin",
    port: "cp2104-or-ch9102",
    flashNotes: [
      "Check the revision on the back sticker or the board. Only v1.0 (AXP192) works.",
      "Its USB bridge is a CP2104 or CH9102F, so the SDK flashes it at 230400 baud.",
      BACKUP_FIRST,
    ],
    deviceIds: ["m5stack-core2-v1-0", "m5stack-core2"],
    sdkUrl: SDK_DEVICES_README_URL,
  },
  {
    id: "freenove-fnk0104b",
    name: "Freenove FNK0104B",
    aliases: ["freenove", "fnk0104b", "fnk0104"],
    family: "esp32",
    status: "supported",
    verdict: "Yes. Full UI with touch and push-to-talk on BOOT.",
    chip: "ESP32-S3",
    display: "2.8\" 240x320 LCD, touch",
    memory: "16 MB flash, 8 MB PSRAM",
    shows: "full-ui",
    voice: "push-to-talk",
    images: "Color",
    touch: true,
    camera: "none",
    tunnel: true,
    build: "tools/muse/board.sh build fnk0104b",
    port: null,
    flashNotes: [],
    deviceIds: ["freenove-fnk0104b"],
    sdkUrl: SDK_DEVICES_README_URL,
  },
  // ---- Linux SDK ----
  {
    id: "raspberry-pi-5",
    name: "Raspberry Pi 5",
    aliases: ["pi 5", "pi5", "rpi 5", "rpi5"],
    family: "linux",
    status: "supported",
    verdict: "Yes, through the Linux SDK. Muse can run commands and move files on it.",
    chip: "Broadcom BCM2712, Bluetooth 5.0",
    shows: "linux",
    voice: "none",
    images: null,
    touch: null,
    camera: "none",
    tunnel: null,
    build: "bash install.sh --sdk-token mgst_...",
    buildNote: "Download install.sh from the Linux SDK and read it first.",
    port: null,
    flashNotes: [],
    deviceIds: ["raspberry-pi-5"],
    sdkUrl: SDK_LINUX_README_URL,
  },
  {
    id: "raspberry-pi-4",
    name: "Raspberry Pi 4 Model B",
    aliases: ["pi 4", "pi4", "rpi 4", "rpi4", "raspberry pi 4b"],
    family: "linux",
    status: "supported",
    verdict: "Yes, through the Linux SDK.",
    shows: "linux",
    voice: "none",
    images: null,
    touch: null,
    camera: "none",
    tunnel: null,
    build: "bash install.sh --sdk-token mgst_...",
    buildNote: "Download install.sh from the Linux SDK and read it first.",
    port: null,
    flashNotes: [],
    deviceIds: ["raspberry-pi-4b"],
    sdkUrl: SDK_LINUX_README_URL,
  },
  {
    id: "raspberry-pi-3b-plus",
    name: "Raspberry Pi 3 Model B+",
    aliases: ["pi 3", "pi3", "3b+", "3b plus", "rpi 3"],
    family: "linux",
    status: "supported",
    verdict: "Yes, the 3B+ is on the Linux SDK's list.",
    shows: "linux",
    voice: "none",
    images: null,
    touch: null,
    camera: "none",
    tunnel: null,
    build: "bash install.sh --sdk-token mgst_...",
    buildNote: "Download install.sh from the Linux SDK and read it first.",
    port: null,
    flashNotes: [],
    deviceIds: ["raspberry-pi-3b-plus"],
    sdkUrl: SDK_LINUX_README_URL,
  },
  {
    id: "raspberry-pi-zero-2w",
    name: "Raspberry Pi Zero 2 W",
    aliases: ["zero 2 w", "zero 2w", "pi zero", "zero2w"],
    family: "linux",
    status: "supported",
    verdict: "Yes, through the Linux SDK. It's the cheapest way to try it.",
    chip: "RP3A0, Bluetooth 4.2/BLE",
    shows: "linux",
    voice: "none",
    images: null,
    touch: null,
    camera: "none",
    tunnel: null,
    build: "bash install.sh --sdk-token mgst_...",
    buildNote: "Download install.sh from the Linux SDK and read it first.",
    port: null,
    flashNotes: [],
    deviceIds: ["raspberry-pi-zero-2w"],
    sdkUrl: SDK_LINUX_README_URL,
  },
  {
    id: "linux-computer",
    name: "Other Linux computer (mini PC, thin client, NUC)",
    aliases: [
      "linux",
      "mini pc",
      "thin client",
      "nuc",
      "intel nuc",
      "dell wyse",
      "wyse 5070",
      "hp t620",
      "thinkcentre",
      "ubuntu",
      "debian",
      "server",
      "homelab",
    ],
    family: "linux",
    status: "supported",
    verdict:
      "Yes, if it has Bluetooth LE and runs Debian 11+, Ubuntu 22.04+ or Raspberry Pi OS. Meta doesn't list models by name.",
    shows: "linux",
    voice: "none",
    images: null,
    touch: null,
    camera: "none",
    tunnel: null,
    build: "bash install.sh --sdk-token mgst_...",
    buildNote: "Download install.sh from the Linux SDK and read it first.",
    port: null,
    flashNotes: [
      "No Bluetooth LE? A USB Bluetooth LE adapter adds it. Pairing happens over Bluetooth.",
    ],
    deviceIds: ["dell-wyse-5070", "hp-t620-plus", "intel-nuc", "lenovo-thinkcentre-tiny"],
    sdkUrl: SDK_LINUX_README_URL,
  },
  // ---- Popular boards that are not on the list ----
  {
    id: "esp32-devkitc-wroom",
    name: "ESP32 DevKitC (ESP32-WROOM-32E) and other classic ESP32 boards",
    aliases: ["esp32 devkit", "wroom", "wroom-32", "esp32-wroom-32e", "nodemcu-32s", "esp32 dev module", "devkit v1"],
    family: "other",
    status: "not-listed",
    verdict:
      "Not on the list. The SDK does run on other classic ESP32 boards (the ideaspark, StickC Plus2 and Core2), and its devices README shows how to add a board.",
    chip: "ESP32 (classic)",
    shows: "unknown",
    voice: "unknown",
    images: null,
    touch: null,
    camera: "unknown",
    tunnel: null,
    build: null,
    port: null,
    flashNotes: [],
    deviceIds: ["esp32-devkit-c"],
    sdkUrl: SDK_DEVICES_README_URL,
  },
  {
    id: "other-esp32-chips",
    name: "ESP32-C3, S2, H2 or P4 boards",
    aliases: ["esp32-c3", "c3", "supermini", "esp32-s2", "s2", "esp32-h2", "esp32-p4", "p4", "xiao esp32c3"],
    family: "other",
    status: "not-listed",
    verdict:
      "Not on the list. Every listed ESP32 board uses an ESP32, ESP32-S3, ESP32-C5 or ESP32-C6 chip.",
    shows: "unknown",
    voice: "unknown",
    images: null,
    touch: null,
    camera: "unknown",
    tunnel: null,
    build: null,
    port: null,
    flashNotes: [],
    deviceIds: [],
    sdkUrl: SDK_ESP32_README_URL,
  },
];

export const UNKNOWN_BOARD_CHECKS: ReadonlyArray<{ title: string; body: string }> = [
  {
    title: "The chip",
    body: "Every listed ESP32 board uses an ESP32, ESP32-S3, ESP32-C5 or ESP32-C6. The chip name is printed on the metal shield or in the seller's specs.",
  },
  {
    title: "PSRAM",
    body: "Boards without PSRAM can't run the home-network tunnel, and the full UI holds images in PSRAM. Look for \"R8\" or \"8 MB PSRAM\" in the specs.",
  },
  {
    title: "Flash size",
    body: "Boards with the full UI need 16 MB of flash or more. The StickS3, StickC Plus2 and Cardputer ADV use a special 8 MB layout.",
  },
  {
    title: "Screen and audio",
    body: "A new kind of display, or running the full avatar UI, needs code as well as settings. Push-to-talk needs a microphone. Replies from Muse are text.",
  },
  {
    title: "A Linux computer instead?",
    body: "Any Linux computer with Bluetooth LE can run the Linux SDK: Raspberry Pi OS Bullseye+, Debian 11+ or Ubuntu 22.04+.",
  },
];

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/["'″”]/g, "")
    .replace(/[^a-z0-9.+]+/g, " ")
    .trim();
}

function compact(text: string): string {
  return normalize(text).replace(/[\s.]+/g, "");
}

function haystacks(entry: BoardEntry): string[] {
  return [entry.name, entry.id, ...entry.aliases].map(normalize);
}

/** Score how well a query matches a board. 0 means no match. */
export function matchScore(entry: BoardEntry, query: string): number {
  const q = normalize(query);
  if (!q) return 0;
  const qc = compact(query);
  const hay = haystacks(entry);
  let score = 0;
  for (const text of hay) {
    if (text === q) return 100;
    if (compact(text) === qc) score = Math.max(score, 95);
  }
  // A known name or alias inside a longer query ("seeed sensecap watcher w1-a").
  // Longer aliases are more specific, so they score higher.
  const padded = ` ${q} `;
  for (const text of [entry.name, ...entry.aliases].map(normalize)) {
    if (text && padded.includes(` ${text} `)) score = Math.max(score, 60 + Math.min(text.length, 34));
  }
  if (hay.some((text) => text.startsWith(q))) score = Math.max(score, 70);
  if (hay.some((text) => text.includes(q))) score = Math.max(score, 60);
  if (qc.length >= 3 && hay.some((text) => compact(text).includes(qc))) score = Math.max(score, 55);
  if (score > 0) return score;
  const tokens = q.split(" ").filter((token) => token.length > 1);
  if (tokens.length === 0) return 0;
  const joined = hay.join(" ");
  const hits = tokens.filter((token) => joined.includes(token)).length;
  return hits === tokens.length ? 40 + Math.min(tokens.length, 5) : 0;
}

/** Boards that match the query, best first. Empty query returns every board. */
export function searchBoards(query: string, boards: readonly BoardEntry[] = BOARDS): BoardEntry[] {
  if (!normalize(query)) return [...boards];
  return boards
    .map((entry, index) => ({ entry, index, score: matchScore(entry, query) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((row) => row.entry);
}

export function boardById(id: string | null | undefined): BoardEntry | null {
  if (!id) return null;
  return BOARDS.find((entry) => entry.id === id) ?? null;
}

/** The answer for a free-text board name: the best match, or null for "not listed". */
export function lookupBoard(query: string): BoardEntry | null {
  const byId = boardById(query.trim());
  if (byId) return byId;
  return searchBoards(query)[0] ?? null;
}

export const STATUS_LABEL: Record<SupportStatus, string> = {
  supported: "Supported",
  experimental: "Experimental",
  "not-listed": "Not listed",
};

export interface WorksRow {
  label: string;
  value: string;
  ok: boolean | null;
}

const SHOWS_TEXT: Record<ShowsOn, string> = {
  "full-ui": "Full on-screen UI: animated avatar, push-to-talk and settings",
  light: "Status light only",
  screen: "Status on the screen",
  "e-paper": "Status on e-paper",
  "led-ring": "Status on the LED ring",
  "rgb-led": "Status on a single RGB LED",
  linux: "No screen needed. Muse runs commands on the machine",
  unknown: "Unknown until someone ports it",
};

const VOICE_TEXT: Record<VoiceSupport, string> = {
  "push-to-talk": "Push-to-talk. Replies show as text on the screen",
  buzzer: "Push-to-talk. Replies show as text; the speaker is a small buzzer",
  "text-replies": "Push-to-talk over the control session. Replies scroll past as text",
  "app-replies": "Push-to-talk. Replies show up in the Muse app",
  "needs-mic": "Push-to-talk once you add an I2S microphone",
  none: "No",
  unknown: "Unknown",
};

const CAMERA_TEXT: Record<CameraSupport, string> = {
  "off-by-default": "Yes. Turn on camera capture in the build settings (off by default)",
  unused: "It has a camera, but the SDK doesn't use it yet",
  none: "No",
  unknown: "Unknown",
};

/** Plain "what works" rows for the result card. */
export function whatWorks(entry: BoardEntry): WorksRow[] {
  if (entry.family === "linux") {
    return [
      { label: "What Muse can do", value: "Run shell commands, read and write files, report device health", ok: true },
      { label: "Needs", value: "Bluetooth LE, a sudo account, Raspberry Pi OS Bullseye+, Debian 11+ or Ubuntu 22.04+", ok: null },
      { label: "Screen, voice, camera", value: "Not part of the Linux SDK. Add your own commands for hardware", ok: null },
    ];
  }
  if (entry.status === "not-listed") {
    return [{ label: "What works", value: "Unknown. Nobody has added this board to the SDK yet", ok: null }];
  }
  return [
    { label: "Shows", value: SHOWS_TEXT[entry.shows], ok: entry.shows === "full-ui" ? true : null },
    { label: "Voice", value: VOICE_TEXT[entry.voice], ok: entry.voice === "none" ? false : true },
    {
      label: "Images from Muse",
      value: entry.images ?? "No",
      ok: entry.images !== null,
    },
    { label: "Touch", value: entry.touch ? "Yes" : "No", ok: entry.touch === true },
    { label: "Camera", value: CAMERA_TEXT[entry.camera], ok: entry.camera === "off-by-default" },
    {
      label: "Home-network tunnel",
      value: entry.tunnel ? "Yes" : "No (needs PSRAM). Muse can still reach and control it",
      ok: entry.tunnel === true,
    },
  ];
}

export interface HackshopLinks {
  boardPage: string | null;
  buildPage: string | null;
  deviceId: string | null;
}

/**
 * hackshop pages for a board, if any: /muse/<slug> when the board has a
 * board page, /build/<id> when it has a build plan.
 */
export function resolveLinks(
  entry: BoardEntry,
  ctx: { boardPath: (deviceId: string) => string | null; buildDeviceIds: ReadonlySet<string> },
): HackshopLinks {
  for (const deviceId of entry.deviceIds) {
    const boardPage = ctx.boardPath(deviceId);
    const buildPage = ctx.buildDeviceIds.has(deviceId) ? `/build/${deviceId}` : null;
    if (boardPage || buildPage) return { boardPage, buildPage, deviceId };
  }
  return { boardPage: null, buildPage: null, deviceId: null };
}

/** Every hackshop page for a board (the generic Linux entry has several). */
export function resolveAllLinks(
  entry: BoardEntry,
  ctx: { boardPath: (deviceId: string) => string | null; buildDeviceIds: ReadonlySet<string> },
): HackshopLinks[] {
  return entry.deviceIds
    .map((deviceId) => ({
      boardPage: ctx.boardPath(deviceId),
      buildPage: ctx.buildDeviceIds.has(deviceId) ? `/build/${deviceId}` : null,
      deviceId,
    }))
    .filter((links) => links.boardPage !== null || links.buildPage !== null);
}

export function supportedCount(): { esp32: number; experimental: number } {
  const esp32 = BOARDS.filter((entry) => entry.family === "esp32");
  return {
    esp32: esp32.length,
    experimental: esp32.filter((entry) => entry.status === "experimental").length,
  };
}

export { SDK_REPO_URL };
