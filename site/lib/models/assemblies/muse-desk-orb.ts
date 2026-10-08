import { COLORS } from "../palette";
import { FACT_SOURCES, outerFor, sourceUrlsFor } from "../sources";
import { printedStandPart } from "../stand";
import type { BoardModel, ModelPart, ModelStep, Vec3 } from "../types";

const DEVICE_ID = "waveshare-esp32-s3-touch-amoled-1-75c";
const outer = outerFor(DEVICE_ID);

export type AssemblyFidelity = "published-dimensions" | "generated-cad" | "schematic";

export interface OrbAssemblyGroup {
  id: "purchased-orb" | "printed-stand" | "data-cable";
  name: string;
  partIds: string[];
  fidelity: AssemblyFidelity;
  note: string;
}

const deviceExplode: Vec3 = [0, 18, 25];
const cableExplode: Vec3 = [-28, -9, -10];

const purchasedDevice: ModelPart[] = [
  {
    id: "case",
    name: "Purchased aluminum Orb",
    kind: "shell-back",
    shape: "cylinder",
    size: [55, 55, 15.05],
    position: [0, 0, 0],
    color: "#aab0b9",
    finish: "metal",
    explode: deviceExplode,
    lesson:
      "The purchased Waveshare unit stays intact in this build view. Its 55 mm body and 15.05 mm depth come from the published size drawing.",
  },
  {
    id: "glass",
    name: "48.96 mm cover glass",
    kind: "glass",
    shape: "cylinder",
    size: [48.96, 48.96, 0.72],
    position: [0, 0, 7.22],
    color: "#202735",
    finish: "glass",
    explode: deviceExplode,
    lesson:
      "The cover-glass diameter comes from Waveshare's drawing. It remains attached to the purchased device during assembly.",
  },
  {
    id: "amoled",
    name: '1.75" round AMOLED',
    kind: "screen",
    shape: "cylinder",
    size: [43.76, 43.76, 0.38],
    position: [0, 0, 7.61],
    color: COLORS.screenOff,
    finish: "screen",
    display: "avatar",
    explode: deviceExplode,
    lesson:
      "The 43.76 mm active display area is shown at the published diameter. It stays grouped with the purchased Orb.",
  },
  {
    id: "pwr-button",
    name: "PWR button",
    kind: "button",
    shape: "roundedBox",
    radius: 0.7,
    size: [2.4, 5, 3],
    position: [22.2, 13.75, 0],
    color: "#d7d9dd",
    finish: "metal",
    explode: deviceExplode,
    lesson: "The upper side control is seated into the housing rim. Muse uses it for push-to-talk and pairing.",
  },
  {
    id: "boot-button",
    name: "BOOT button",
    kind: "button",
    shape: "roundedBox",
    radius: 0.7,
    size: [2.4, 5, 3],
    position: [22.2, -13.75, 0],
    color: "#bfc4cb",
    finish: "metal",
    explode: deviceExplode,
    lesson: "The lower side control is seated into the housing rim. It is used when the board enters download mode.",
  },
  {
    id: "usb-c",
    name: "USB-C port",
    kind: "port",
    shape: "roundedBox",
    radius: 1.25,
    size: [8.9, 7.3, 3.2],
    position: [0, -23.85, 0],
    color: COLORS.connector,
    finish: "metal",
    explode: deviceExplode,
    lesson: "The bottom USB-C opening is retained because it controls the stand slot and cable path.",
  },
];

const stand = {
  ...printedStandPart({
    deviceId: DEVICE_ID,
    outer,
    usbFace: "bottom",
    explode: [0, -12, -27],
  }),
  name: "Generated printable stand",
  lesson:
    "This is the generated CAD, not a decorative proxy. Its cradle, cable opening and 15 degree viewing angle come from the fabrication package.",
} satisfies ModelPart;

const cable: ModelPart[] = [
  {
    id: "usb-c-device-plug",
    name: "Device-side USB-C plug",
    kind: "port",
    shape: "roundedBox",
    radius: 1.2,
    size: [10.5, 7, 4.2],
    position: [0, -29.2, -0.3],
    color: "#20242b",
    finish: "rubber",
    explode: cableExplode,
    approx: true,
    external: true,
    lesson: "The plug is sized to the stand's reviewed cable-clearance envelope. Its cosmetic shape is schematic.",
  },
  {
    id: "usb-c-data-cable",
    name: "USB-C data cable",
    kind: "cable",
    shape: "tube",
    size: [42, 38, 14],
    position: [0, -40, -0.3],
    path: [
      [0, 8, 0],
      [0, 1, 0],
      [-2, -8, -2],
      [-9, -18, -7],
      [-23, -26, -10],
      [-38, -26, -10],
    ],
    thickness: 1.75,
    color: "#1e2229",
    finish: "rubber",
    explode: cableExplode,
    approx: true,
    external: true,
    lesson: "A data-capable USB-C cable powers and flashes the Orb. Its route is shortened and schematic so the connection stays visible.",
  },
  {
    id: "usb-c-host-plug",
    name: "Computer-side USB-C plug",
    kind: "port",
    shape: "roundedBox",
    radius: 1.2,
    size: [10.5, 7, 4.2],
    position: [-41, -66, -10.3],
    color: "#20242b",
    finish: "rubber",
    explode: cableExplode,
    approx: true,
    external: true,
    lesson: "The host end connects to a computer for flashing or to a USB power source after setup.",
  },
];

const model: BoardModel = {
  deviceId: "muse-desk-orb-assembly",
  name: "Muse Desk Orb complete exterior assembly",
  outer: { ...outer, shape: "round" },
  orientation: "upright",
  parts: [...purchasedDevice, stand, ...cable],
  sources: sourceUrlsFor(DEVICE_ID, [FACT_SOURCES.waveshare175c, FACT_SOURCES.museDevices]),
};

export const MUSE_DESK_ORB_ASSEMBLY: {
  model: BoardModel;
  groups: OrbAssemblyGroup[];
  steps: ModelStep[];
} = {
  model,
  groups: [
    {
      id: "purchased-orb",
      name: "Purchased Orb",
      partIds: purchasedDevice.map((part) => part.id),
      fidelity: "published-dimensions",
      note: "Published exterior envelope, glass and display diameters. The purchased device is not opened.",
    },
    {
      id: "printed-stand",
      name: "Printable stand",
      partIds: [stand.id],
      fidelity: "generated-cad",
      note: "The exact generated STL shown in the recipe download.",
    },
    {
      id: "data-cable",
      name: "USB-C data cable",
      partIds: cable.map((part) => part.id),
      fidelity: "schematic",
      note: "Connection and clearance are represented; cable length and cosmetic details are schematic.",
    },
  ],
  steps: [
    {
      id: "print-stand",
      order: 1,
      action: "print",
      label: "Make the stand",
      instruction: "Print the reviewed stand on its side, then remove any stringing from the cradle and USB-C opening.",
      optional: false,
      partIds: [stand.id],
    },
    {
      id: "seat-orb",
      order: 2,
      action: "insert",
      label: "Seat the purchased Orb",
      instruction: "Lower the complete purchased Orb into the cradle without opening its case. Confirm both side buttons remain clear.",
      optional: false,
      partIds: [...purchasedDevice.map((part) => part.id), stand.id],
    },
    {
      id: "connect-cable",
      order: 3,
      action: "connect",
      label: "Route the data cable",
      instruction: "Pass a known data-capable USB-C cable through the stand opening and connect it without forcing the plug.",
      optional: false,
      partIds: ["usb-c", ...cable.map((part) => part.id)],
    },
  ],
};
