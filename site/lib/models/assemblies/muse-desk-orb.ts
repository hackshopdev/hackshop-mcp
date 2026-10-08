import fab from "../../../public/cad/waveshare-esp32-s3-touch-amoled-1-75c/desk-stand.fab.json";
import {
  assertAssemblyPackage,
  type AssemblyComponent,
  type AssemblyFidelity,
  type AssemblyPackage,
  type ComponentPresentation,
} from "../assembly-package";
import { COLORS } from "../palette";
import { DIMENSION_SOURCES, FACT_SOURCES, outerFor, sourceUrlsFor } from "../sources";
import { printedStandPart } from "../stand";
import type { BoardModel, ModelPart, ModelStep, Vec3 } from "../types";

const DEVICE_ID = "waveshare-esp32-s3-touch-amoled-1-75c";
const outer = outerFor(DEVICE_ID);

export type { AssemblyFidelity };

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

const FAB_FILE = "desk-stand.fab.json";
const FAB_HREF = `/cad/${DEVICE_ID}/${FAB_FILE}`;
const STAND_BASIS = `Generator parameter in ${FAB_FILE}`;
const fabChecks = Object.values(fab.checks);
const orbRim: Vec3 = [0, -outer.h / 2, 0];
const devicePlug = cable[0]!;

const components: AssemblyComponent[] = [
  {
    id: "purchased-orb",
    name: "Purchased Orb",
    handling: "sealed",
    origin: "purchased",
    fidelity: "published-dimensions",
    partIds: purchasedDevice.map((part) => part.id),
    summary:
      "A finished Waveshare device, shown as one closed unit. Only its published exterior is modeled: envelope, glass, display, side buttons and USB-C opening. You never open it.",
    sources: [
      { label: "Waveshare size drawing", url: DIMENSION_SOURCES[DEVICE_ID]!.w.url },
      { label: "Waveshare product page", url: FACT_SOURCES.waveshare175c },
    ],
    facts: [
      { label: "Envelope", value: `${outer.w} mm round, ${outer.t} mm deep`, basis: "Waveshare size drawing" },
      { label: "Cover glass", value: "48.96 mm", basis: "Waveshare size drawing" },
      { label: "Display area", value: "43.76 mm", basis: "Waveshare size drawing" },
    ],
  },
  {
    id: "printed-stand",
    name: "Printed stand",
    handling: "user-assembled",
    origin: "printed",
    fidelity: "generated-cad",
    partIds: [stand.id],
    summary: "The exact generated STL from the recipe download. You print it and seat the Orb in its cradle.",
    sources: [
      { label: "Stand STL", url: stand.stl! },
      { label: "Fabrication record", url: FAB_HREF },
    ],
    facts: [
      { label: "Viewing tilt", value: `${fab.params.tilt_deg}°`, basis: STAND_BASIS },
      { label: "Cradle clearance", value: `${fab.params.clearance} mm`, basis: STAND_BASIS },
      {
        label: "Plug overmold limit",
        value: `${fab.params.plug_overmold[0]} × ${fab.params.plug_overmold[1]} mm`,
        basis: STAND_BASIS,
      },
      {
        label: "Print",
        value: `${fab.print.material}, ${fab.print.orientation.toLowerCase()}`,
        basis: `Print settings in ${FAB_FILE}`,
      },
      {
        label: "Generator checks",
        value: `${fabChecks.filter(Boolean).length} of ${fabChecks.length} passed`,
        basis: `Geometry checks in ${FAB_FILE}; not a physical test print`,
      },
    ],
  },
  {
    id: "data-cable",
    name: "USB-C data cable",
    handling: "user-assembled",
    origin: "purchased",
    fidelity: "schematic",
    partIds: cable.map((part) => part.id),
    summary:
      "A data-capable USB-C cable you route through the stand. The plug fits the stand's clearance envelope; cable length and route are schematic.",
    sources: [{ label: "Adafruit USB-C data cable", url: "https://www.adafruit.com/product/4199" }],
  },
];

const seated: ComponentPresentation = { explode: 0, emphasis: "context" };

const pkg: AssemblyPackage = {
  id: "muse-desk-orb",
  title: "Muse Desk Orb",
  model,
  components,
  groups: [
    { id: "buy", label: "Buy, keep closed", componentIds: ["purchased-orb"], note: "Sealed purchased device." },
    { id: "make", label: "Print", componentIds: ["printed-stand"], note: "Generated stand CAD." },
    { id: "connect", label: "Route and plug in", componentIds: ["data-cable"], note: "Schematic cable route." },
  ],
  actors: [
    { id: "you", label: "You", kind: "person", note: "Press, speak and read." },
    { id: "usb-host", label: "Computer or USB power", kind: "host", note: "Flashes the firmware, then powers the Orb." },
    { id: "wifi", label: "Wi-Fi", kind: "network", note: "The Orb pairs over BLE, then joins Wi-Fi." },
    { id: "muse-vm", label: "Your Muse VM", kind: "service", note: "Holds an encrypted session with the Orb." },
  ],
  endpoints: [
    { id: "orb-rim", componentId: "purchased-orb", partId: "case", label: "Orb lower rim", anchor: orbRim },
    { id: "orb-usb-c", componentId: "purchased-orb", partId: "usb-c", label: "Orb USB-C port" },
    { id: "orb-pwr", componentId: "purchased-orb", partId: "pwr-button", label: "PWR button (push to talk)" },
    {
      id: "orb-audio",
      componentId: "purchased-orb",
      partId: "case",
      label: "Built-in microphones and speaker (inside the sealed Orb, not shown)",
    },
    { id: "orb-screen", componentId: "purchased-orb", partId: "amoled", label: "Round AMOLED" },
    { id: "stand-cradle", componentId: "printed-stand", partId: stand.id, label: "Stand cradle", anchor: orbRim },
    {
      id: "stand-cable-slot",
      componentId: "printed-stand",
      partId: stand.id,
      label: "Stand cable opening",
      anchor: devicePlug.position,
    },
    { id: "cable-device-plug", componentId: "data-cable", partId: "usb-c-device-plug", label: "Device-side plug" },
    { id: "cable-host-plug", componentId: "data-cable", partId: "usb-c-host-plug", label: "Computer-side plug" },
  ],
  edges: [
    {
      id: "cradle-fit",
      kind: "mechanical-fit",
      from: "stand-cradle",
      to: "orb-rim",
      label: "Orb seats in the cradle",
      detail: `Generated with ${fab.params.clearance} mm clearance at a ${fab.params.tilt_deg}° tilt. Physical fit has not been tested.`,
      fidelity: "generated-cad",
    },
    {
      id: "usb-c-mate",
      kind: "usb-c",
      from: "cable-device-plug",
      to: "orb-usb-c",
      label: "Plug into the Orb",
      detail: `A straight plug with an overmold no larger than ${fab.params.plug_overmold[0]} × ${fab.params.plug_overmold[1]} mm. Plug shape is schematic.`,
      fidelity: "schematic",
    },
    {
      id: "cable-slot",
      kind: "cable-route",
      from: "stand-cable-slot",
      to: "cable-device-plug",
      label: "Through the stand opening",
      detail: "The plug passes through the generated opening under the cradle.",
      fidelity: "generated-cad",
    },
    {
      id: "cable-run",
      kind: "cable-route",
      from: "cable-device-plug",
      to: "cable-host-plug",
      label: "Cable to the computer",
      detail: "Route and length are schematic.",
      fidelity: "schematic",
    },
  ],
  systems: [
    {
      id: "usb-power",
      kind: "power",
      label: "USB power",
      support: "supported",
      path: ["usb-host", "cable-host-plug", "cable-device-plug", "orb-usb-c"],
      edgeIds: ["cable-run", "usb-c-mate"],
      note: "A computer or USB power source powers the Orb through the cable.",
    },
    {
      id: "usb-data",
      kind: "data",
      label: "Flash and serial",
      support: "supported",
      path: ["usb-host", "cable-host-plug", "cable-device-plug", "orb-usb-c"],
      edgeIds: ["cable-run", "usb-c-mate"],
      note: "Flashing and the serial monitor need a data-capable cable.",
    },
    {
      id: "voice-in",
      kind: "agent-input",
      label: "Ask Muse",
      support: "supported",
      path: ["you", "orb-pwr", "orb-audio", "wifi", "muse-vm"],
      edgeIds: [],
      note: "Hold the upper PWR button to record a push-to-talk voice note through the dual microphones.",
    },
    {
      id: "reply-out",
      kind: "agent-output",
      label: "Read the reply",
      support: "supported",
      path: ["muse-vm", "wifi", "orb-screen", "you"],
      edgeIds: [],
      note: "Muse status, text replies and received color images appear on the 466 × 466 AMOLED.",
    },
    {
      id: "spoken-out",
      kind: "agent-output",
      label: "Spoken reply",
      support: "requires-integration",
      path: ["muse-vm", "wifi", "orb-audio", "you"],
      edgeIds: [],
      note: "Stock Muse replies are text. Spoken replies need a separate TTS integration.",
    },
  ],
  steps: [
    {
      id: "print-stand",
      order: 1,
      action: "print",
      label: "Make the stand",
      instruction: "Print the reviewed stand on its side, then remove any stringing from the cradle and USB-C opening.",
      componentIds: ["printed-stand"],
      partIds: [stand.id],
      edgeIds: [],
      stateId: "step-print-stand",
      checks: ["Cradle and cable opening are free of stringing."],
    },
    {
      id: "seat-orb",
      order: 2,
      action: "insert",
      label: "Seat the purchased Orb",
      instruction: "Lower the complete purchased Orb into the cradle without opening its case. Confirm both side buttons remain clear.",
      componentIds: ["purchased-orb", "printed-stand"],
      partIds: [...purchasedDevice.map((part) => part.id), stand.id],
      edgeIds: ["cradle-fit"],
      stateId: "step-seat-orb",
      checks: ["The Orb sits without force or wobble.", "PWR and BOOT buttons stay clear."],
    },
    {
      id: "connect-cable",
      order: 3,
      action: "connect",
      label: "Route the data cable",
      instruction: "Pass a known data-capable USB-C cable through the stand opening and connect it without forcing the plug.",
      componentIds: ["data-cable", "purchased-orb"],
      partIds: ["usb-c", ...cable.map((part) => part.id)],
      edgeIds: ["cable-slot", "usb-c-mate", "cable-run"],
      stateId: "step-connect-cable",
      checks: ["The plug seats fully without bending the cable at the opening."],
    },
  ],
  states: [
    { id: "assembled", label: "Assembled", mode: "assembled", components: {}, edgeIds: [] },
    {
      id: "exploded",
      label: "All three assemblies",
      mode: "build",
      components: {
        "purchased-orb": { explode: 1, emphasis: "context" },
        "printed-stand": { explode: 1, emphasis: "context" },
        "data-cable": { explode: 1, emphasis: "context" },
      },
      edgeIds: ["cradle-fit", "usb-c-mate"],
    },
    {
      id: "step-print-stand",
      label: "Make the stand",
      mode: "build",
      components: {
        "purchased-orb": { explode: 1, emphasis: "ghost" },
        "printed-stand": { explode: 0, emphasis: "focus" },
        "data-cable": { explode: 1, emphasis: "hidden" },
      },
      edgeIds: [],
    },
    {
      id: "step-seat-orb",
      label: "Seat the purchased Orb",
      mode: "build",
      components: {
        "purchased-orb": { explode: 0, emphasis: "focus" },
        "printed-stand": seated,
        "data-cable": { explode: 1, emphasis: "ghost" },
      },
      edgeIds: ["cradle-fit"],
    },
    {
      id: "step-connect-cable",
      label: "Route the data cable",
      mode: "build",
      components: {
        "purchased-orb": seated,
        "printed-stand": seated,
        "data-cable": { explode: 0, emphasis: "focus" },
      },
      edgeIds: ["cable-slot", "usb-c-mate", "cable-run"],
    },
    {
      id: "connections",
      label: "Connections and agent flow",
      mode: "connections",
      components: {
        "purchased-orb": { explode: 0.4, emphasis: "context" },
        "printed-stand": seated,
        "data-cable": { explode: 0.4, emphasis: "focus" },
      },
      edgeIds: ["cradle-fit", "usb-c-mate", "cable-slot", "cable-run"],
    },
  ],
  modes: [
    { id: "assembled", label: "Assembled", stateIds: ["assembled"] },
    {
      id: "build",
      label: "Guided build",
      stateIds: ["exploded", "step-print-stand", "step-seat-orb", "step-connect-cable"],
    },
    { id: "connections", label: "Connections & agent flow", stateIds: ["connections"] },
  ],
  film: {
    durationSeconds: 12.4,
    keyframes: [
      { at: 0, stateId: "assembled" },
      { at: 3.15, stateId: "assembled" },
      { at: 4.45, stateId: "exploded", intensity: 0.86 },
      { at: 8.85, stateId: "exploded", intensity: 0.86 },
      { at: 9.5, stateId: "step-seat-orb", intensity: 0.86 },
      { at: 10.15, stateId: "step-connect-cable" },
      { at: 12.4, stateId: "assembled" },
    ],
  },
  evidence: {
    render: "concept-render",
    physical: "not-built",
    statement:
      "This build has not been physically built: stand fit, cable clearance and the Muse loop are unverified on real hardware.",
  },
};

/** The Muse Desk Orb as a reusable, validated assembly package. */
export const MUSE_DESK_ORB_PACKAGE: AssemblyPackage = assertAssemblyPackage(pkg);

export interface OrbAssemblyGroup {
  id: "purchased-orb" | "printed-stand" | "data-cable";
  name: string;
  partIds: string[];
  fidelity: AssemblyFidelity;
  note: string;
}

const GROUP_NOTES: Record<OrbAssemblyGroup["id"], string> = {
  "purchased-orb": "Published exterior envelope, glass and display diameters. The purchased device is not opened.",
  "printed-stand": "The exact generated STL shown in the recipe download.",
  "data-cable": "Connection and clearance are represented; cable length and cosmetic details are schematic.",
};

/** Earlier group/step view of the same package, kept for existing callers. */
export const MUSE_DESK_ORB_ASSEMBLY: {
  model: BoardModel;
  groups: OrbAssemblyGroup[];
  steps: ModelStep[];
} = {
  model,
  groups: components.map((component) => {
    const id = component.id as OrbAssemblyGroup["id"];
    return {
      id,
      name: component.name === "Printed stand" ? "Printable stand" : component.name,
      partIds: component.partIds,
      fidelity: component.fidelity,
      note: GROUP_NOTES[id],
    };
  }),
  steps: pkg.steps.map(({ id, order, action, label, instruction, partIds }) => ({
    id,
    order,
    action,
    label,
    instruction,
    optional: false,
    partIds,
  })),
};
