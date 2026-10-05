// Lesson text shared by several boards. Facts come from the hackshop catalog,
// the QA fact sheet and the Muse Gadgets SDK docs (esp32/README.md,
// esp32/AGENTS.md, esp32/devices/README.md, linux/README.md).

export const LESSONS = {
  esp32s3:
    "This is the ESP32-S3, the small computer that runs Muse. It has two cores at up to 240 MHz, 2.4 GHz Wi-Fi and Bluetooth LE.",
  usbData:
    "USB-C for power and data. Use a cable that carries data, not just power, when you flash Muse.",
  pairButtonHold:
    "A short press confirms pairing when Muse asks for it. Holding it for 5 seconds resets setup.",
  bleWifi:
    "Muse pairs with your phone over Bluetooth LE, then the board joins your Wi-Fi.",
  piPair:
    "Muse pairs with the Pi over Bluetooth LE. Pairing stays open for 10 minutes after install; sudo musegadget pair reopens it.",
  piSoc:
    "It runs Raspberry Pi OS and the musegadget service. Anything Muse runs here runs with your account's permissions.",
} as const;
