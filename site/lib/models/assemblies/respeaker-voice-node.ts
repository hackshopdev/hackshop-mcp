import { COLORS } from "../palette";
import type { BoardModel, ModelPart, ModelStep, Vec3 } from "../types";

export type VoiceNodeFidelity =
  | "official-cad"
  | "published-dimensions"
  | "schematic";

export interface VoiceNodeAssemblyGroup {
  id:
    | "respeaker-cad"
    | "xiao-controller"
    | "speaker"
    | "acrylic-enclosure"
    | "data-cable";
  name: string;
  partIds: string[];
  fidelity: VoiceNodeFidelity;
  note: string;
}

const BOARD_CAD_URL =
  "/cad/seeed-respeaker-lite-xiao-esp32s3/respeaker-lite-v1.1.stl";
const BOARD_STEP_SOURCE =
  "https://files.seeedstudio.com/wiki/respeakerv3/ReSpeakerLitev1.1.step";

// Bounds measured from Seeed's public ReSpeakerLitev1.1.step. The source CAD
// uses a remote assembly origin; this matrix recentres it and places the board
// on the top acrylic deck. The published 86 x 35 mm footprint remains the
// recipe envelope, while the STEP supplies connector and component geometry.
const BOARD_CAD_CENTER: Vec3 = [82.03901305, -90.953487382385, 2.88];
const BOARD_Z = 25;
const boardCadMatrix = [
  1, 0, 0, -BOARD_CAD_CENTER[0],
  0, 1, 0, -BOARD_CAD_CENTER[1],
  0, 0, 1, BOARD_Z - BOARD_CAD_CENTER[2],
  0, 0, 0, 1,
];

const boardExplode: Vec3 = [0, 0, 48];
const antennaExplode: Vec3 = [-38, 0, 27];
const speakerExplode: Vec3 = [52, 8, 18];
const enclosureExplode: Vec3 = [0, 0, -8];
const cableExplode: Vec3 = [72, -18, 28];

const boardCad: ModelPart = {
  id: "respeaker-cad",
  name: "reSpeaker Lite v1.1 board assembly",
  kind: "pcb",
  shape: "roundedBox",
  radius: 1.5,
  size: [83.6, 34.01, 10.93],
  position: [0, 0, BOARD_Z],
  color: "#171b1c",
  finish: "pcb",
  explode: boardExplode,
  stl: BOARD_CAD_URL,
  stlMatrix: boardCadMatrix,
  lesson:
    "Seeed's official v1.1 board CAD supplies the component, connector and mounting geometry. The XIAO ESP32-S3 is purchased pre-soldered in this recipe; do not pry it off the carrier.",
};

const antenna: ModelPart[] = [
  {
    id: "xiao-antenna-lead",
    name: "XIAO antenna lead",
    kind: "cable",
    shape: "tube",
    size: [38, 18, 8],
    position: [0, 0, 0],
    path: [
      [-30, 4, 28],
      [-36, 7, 25],
      [-42, 10, 20],
      [-46, 9, 15],
    ],
    thickness: 0.55,
    color: "#25282c",
    finish: "rubber",
    explode: antennaExplode,
    approx: true,
    external: true,
    lesson:
      "The external 2.4 GHz antenna lead snaps onto the XIAO's tiny U.FL connector. Its route is schematic; press on the connector vertically, never by pulling the cable.",
  },
  {
    id: "xiao-antenna",
    name: "2.4 GHz adhesive antenna",
    kind: "antenna",
    shape: "roundedBox",
    radius: 1.2,
    size: [24, 10, 0.8],
    position: [-54, 9, 14],
    color: "#20252a",
    finish: "pcb",
    explode: antennaExplode,
    approx: true,
    external: true,
    lesson:
      "Muse's board notes require the XIAO external antenna and 2.4 GHz Wi-Fi. The antenna envelope is based on the XIAO accessory, while its placement here is illustrative.",
  },
];

const speaker: ModelPart[] = [
  {
    id: "speaker",
    name: "Mono enclosed speaker, 4 ohm / 5 W",
    kind: "speaker",
    shape: "roundedBox",
    radius: 2.2,
    size: [70, 34, 36],
    position: [0, 0, -10],
    color: "#14171a",
    finish: "plastic",
    explode: speakerExplode,
    approx: true,
    external: true,
    lesson:
      "The optional Seeed 4 ohm, 5 W enclosed speaker connects to the board's amplified output. Muse speaker playback is not yet verified on physical hardware, so this is an integration path rather than a working-audio claim.",
  },
  {
    id: "speaker-cone",
    name: "Speaker cone",
    kind: "speaker",
    shape: "cylinder",
    axis: "y",
    size: [27, 3.2, 27],
    position: [0, -18.25, -10],
    color: "#07090b",
    finish: "rubber",
    explode: speakerExplode,
    approx: true,
    external: true,
    lesson:
      "The driver faces out through the enclosure. Keep the cone and its opening clear when tightening the acrylic frame.",
  },
  {
    id: "speaker-wire",
    name: "Speaker lead",
    kind: "cable",
    shape: "tube",
    size: [34, 24, 28],
    position: [0, 0, 0],
    path: [
      [18, 2, 4],
      [25, 5, 9],
      [34, 5, 15],
      [39, 2, 23],
    ],
    thickness: 0.85,
    color: "#b33b32",
    finish: "rubber",
    explode: speakerExplode,
    approx: true,
    external: true,
    lesson:
      "The two-wire speaker lead rises to the white speaker socket on the reSpeaker board. Route it away from the microphone openings and acrylic edges.",
  },
  {
    id: "speaker-plug",
    name: "Speaker plug",
    kind: "port",
    shape: "roundedBox",
    radius: 0.55,
    size: [5.5, 4, 3.2],
    position: [40.5, 1.5, 24.5],
    color: "#f2eee4",
    finish: "plastic",
    explode: speakerExplode,
    approx: true,
    external: true,
    lesson:
      "The keyed speaker plug seats in the board's speaker connector. Power the build down before changing this connection.",
  },
];

const enclosure: ModelPart[] = [
  {
    id: "acrylic-top",
    name: "Upper acrylic deck",
    kind: "stand",
    shape: "roundedBox",
    radius: 2,
    size: [92, 41, 2],
    position: [0, 0, 18.5],
    color: "#20262b",
    finish: "plastic",
    explode: enclosureExplode,
    approx: true,
    external: true,
    lesson:
      "The upper laser-cut plate carries the pre-soldered reSpeaker/XIAO board above the speaker. Public kit photos establish the stack; exact plate dimensions are schematic until measured from a physical kit.",
  },
  {
    id: "acrylic-base",
    name: "Lower acrylic deck",
    kind: "stand",
    shape: "roundedBox",
    radius: 2,
    size: [76, 41, 2],
    position: [0, 0, 8],
    color: "#20262b",
    finish: "plastic",
    explode: enclosureExplode,
    approx: true,
    external: true,
    lesson:
      "The lower plate fastens to the speaker body and supports the board deck. Its outline is schematic, not a fabrication file.",
  },
  ...([-38, 38] as const).flatMap((x, xIndex) =>
    ([-14.5, 14.5] as const).map((y, yIndex): ModelPart => ({
      id: `standoff-${xIndex + 1}-${yIndex + 1}`,
      name: "Acrylic standoff",
      kind: "stand",
      shape: "cylinder",
      axis: "z",
      size: [4.5, 4.5, 8.5],
      position: [x, y, 13.25],
      color: "#101316",
      finish: "plastic",
      explode: enclosureExplode,
      approx: true,
      external: true,
      lesson:
        "Four standoffs hold the upper deck above the speaker. Start every fastener by hand and stop when the acrylic is secure; overtightening can crack it.",
    })),
  ),
];

const dataCable: ModelPart[] = [
  {
    id: "xiao-usb-plug",
    name: "XIAO-side USB-C plug",
    kind: "port",
    shape: "roundedBox",
    radius: 1.2,
    size: [10.5, 7, 4.2],
    position: [-49, 0, 26.5],
    color: "#20242b",
    finish: "rubber",
    explode: cableExplode,
    approx: true,
    external: true,
    lesson:
      "For Muse flashing, connect USB to the small XIAO board at the left end—not the larger reSpeaker USB port at the opposite end.",
  },
  {
    id: "usb-data-cable",
    name: "USB-C data cable",
    kind: "cable",
    shape: "tube",
    size: [68, 34, 18],
    position: [0, 0, 0],
    path: [
      [-50, 0, 26],
      [-58, -3, 25],
      [-66, -9, 18],
      [-69, -20, 12],
    ],
    thickness: 1.7,
    color: "#191d22",
    finish: "rubber",
    explode: cableExplode,
    approx: true,
    external: true,
    lesson:
      "Use a known data-capable cable. This shortened route shows the correct XIAO connection and clearance rather than a literal cable length.",
  },
];

const model: BoardModel = {
  deviceId: "muse-respeaker-voice-node-assembly",
  name: "Muse reSpeaker Voice Node complete assembly",
  outer: { w: 86, h: 35, t: 10.93, shape: "board" },
  orientation: "flat",
  cornerRadius: 2,
  parts: [boardCad, ...antenna, ...speaker, ...enclosure, ...dataCable],
  sources: [
    BOARD_STEP_SOURCE,
    "https://wiki.seeedstudio.com/reSpeaker_usb_v3/",
    "https://wiki.seeedstudio.com/xiao_respeaker/",
    "https://www.seeedstudio.com/ReSpeaker-Lite-Voice-Assistant-Kit-Full-Kit-of-2-Mic-Array-pre-soldered-XIAO-ESP32S3-Mono-Enclosed-Speaker-and-Enclosure.html",
  ],
};

export const RESPEAKER_VOICE_NODE_ASSEMBLY: {
  model: BoardModel;
  groups: VoiceNodeAssemblyGroup[];
  steps: ModelStep[];
} = {
  model,
  groups: [
    {
      id: "respeaker-cad",
      name: "reSpeaker Lite carrier",
      partIds: [boardCad.id],
      fidelity: "official-cad",
      note: "Seeed's public v1.1 STEP converted to an inspectable browser mesh.",
    },
    {
      id: "xiao-controller",
      name: "Pre-soldered XIAO + external antenna",
      partIds: antenna.map((part) => part.id),
      fidelity: "published-dimensions",
      note: "The XIAO is present in Seeed's board CAD; its required external antenna and lead are shown separately with schematic routing.",
    },
    {
      id: "speaker",
      name: "Mono enclosed speaker",
      partIds: speaker.map((part) => part.id),
      fidelity: "schematic",
      note: "Connector and 4 ohm / 5 W rating are published; enclosure geometry is a photo-based schematic.",
    },
    {
      id: "acrylic-enclosure",
      name: "Laser-cut acrylic frame",
      partIds: enclosure.map((part) => part.id),
      fidelity: "schematic",
      note: "The official kit includes this self-assembly; plate dimensions and fastener positions await physical measurement.",
    },
    {
      id: "data-cable",
      name: "XIAO data connection",
      partIds: dataCable.map((part) => part.id),
      fidelity: "schematic",
      note: "The connection is exact; cable length and cosmetic form are schematic.",
    },
  ],
  steps: [
    {
      id: "seat-board",
      order: 1,
      action: "mount",
      label: "Mount the pre-soldered board",
      instruction:
        "Keep the XIAO attached to the reSpeaker carrier. Set the complete board on the upper acrylic deck with both microphone openings and both USB-C ports unobstructed.",
      optional: false,
      partIds: [boardCad.id, "acrylic-top", ...enclosure.filter((part) => part.id.startsWith("standoff-")).map((part) => part.id)],
    },
    {
      id: "connect-speaker",
      order: 2,
      action: "connect",
      label: "Connect the enclosed speaker",
      instruction:
        "With power disconnected, seat the keyed speaker plug in the board connector and route its lead without crossing a microphone opening.",
      optional: false,
      partIds: speaker.map((part) => part.id),
    },
    {
      id: "close-enclosure",
      order: 3,
      action: "fasten",
      label: "Assemble the acrylic stack",
      instruction:
        "Fasten the upper and lower acrylic plates around the speaker body. Start all fasteners by hand, align the stack, then tighten only until secure.",
      optional: false,
      partIds: enclosure.map((part) => part.id),
    },
    {
      id: "attach-antenna",
      order: 4,
      action: "connect",
      label: "Attach the Wi-Fi antenna",
      instruction:
        "Press the external antenna lead straight down onto the XIAO U.FL connector, then place the antenna where its cable is relaxed and its face is not blocked by metal.",
      optional: false,
      partIds: antenna.map((part) => part.id),
    },
    {
      id: "connect-xiao-usb",
      order: 5,
      action: "connect",
      label: "Connect the data cable",
      instruction:
        "Plug the known-good USB-C data cable into the small XIAO board, not the larger reSpeaker board, before running the Muse flash command.",
      optional: false,
      partIds: dataCable.map((part) => part.id),
    },
  ],
};
