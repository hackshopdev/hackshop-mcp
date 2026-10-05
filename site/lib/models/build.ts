import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { displayTiltFor } from "./stand";
import type { BoardModel, Cutout, ModelPart, PartFinish, ScreenContent } from "./types";

// Turns a BoardModel into a THREE.Group: one mesh per part (named by part
// id), positioned in millimetres. Explode and highlight helpers work on the
// returned BuiltBoard. Canvas textures (screens, PCB traces) are only made
// when a canvas factory is passed, so the builder also runs under Node.

export const ACCENT = "#ff7a00";

export type PartState = "normal" | "hover" | "selected" | "related" | "dimmed";

export interface BuiltPart {
  part: ModelPart;
  mesh: THREE.Mesh;
  outline: THREE.LineSegments;
  base: THREE.Vector3;
  offset: THREE.Vector3;
  materials: THREE.MeshStandardMaterial[];
  state: PartState;
}

export interface BuiltBoard {
  model: BoardModel;
  group: THREE.Group;
  parts: Map<string, BuiltPart>;
  explode: number;
}

export interface BuildOptions {
  /** Creates a canvas for textures; omit under Node. */
  createCanvas?: (width: number, height: number) => HTMLCanvasElement | OffscreenCanvas | null;
}

interface MaterialMemo {
  emissive: THREE.Color;
  emissiveIntensity: number;
  opacity: number;
  transparent: boolean;
  depthWrite: boolean;
}

const DEFAULT_FINISH: Record<ModelPart["kind"], PartFinish> = {
  "shell-front": "plastic",
  "shell-back": "plastic",
  glass: "glass",
  screen: "screen",
  pcb: "pcb",
  chip: "chip",
  battery: "metal",
  speaker: "plastic",
  mic: "plastic",
  camera: "chip",
  button: "rubber",
  port: "metal",
  led: "led",
  antenna: "pcb",
  stand: "plastic",
  sensor: "chip",
};

export function buildBoard(model: BoardModel, options: BuildOptions = {}): BuiltBoard {
  const group = new THREE.Group();
  group.name = model.deviceId;
  if (model.orientation === "flat") group.rotation.x = -Math.PI / 2;
  else group.rotation.x = (-displayTiltFor(model) * Math.PI) / 180;

  const parts = new Map<string, BuiltPart>();
  const textures = new TextureCache(options);

  for (const part of model.parts) {
    const geometry = geometryForPart(part);
    const finish = part.finish ?? DEFAULT_FINISH[part.kind];
    const material = materialFor(part, finish, textures);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = part.id;
    mesh.userData = { partId: part.id, kind: part.kind, name: part.name };
    mesh.castShadow = finish !== "glass";
    mesh.receiveShadow = true;
    mesh.position.set(...part.position);

    const materials: THREE.MeshStandardMaterial[] = [material];
    for (const extra of detailMeshes(part, textures, model.outer)) {
      extra.userData = { partId: part.id, detail: true };
      mesh.add(extra);
      materials.push(extra.material as THREE.MeshStandardMaterial);
    }

    const outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry, 28),
      new THREE.LineBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.95 }),
    );
    outline.name = `${part.id}-outline`;
    outline.visible = false;
    outline.userData = { partId: part.id, outline: true };
    outline.raycast = () => {};
    mesh.add(outline);

    for (const mat of materials) {
      mat.userData.memo = {
        emissive: mat.emissive.clone(),
        emissiveIntensity: mat.emissiveIntensity,
        opacity: mat.opacity,
        transparent: mat.transparent,
        depthWrite: mat.depthWrite,
      } satisfies MaterialMemo;
    }

    group.add(mesh);
    parts.set(part.id, {
      part,
      mesh,
      outline,
      base: new THREE.Vector3(...part.position),
      offset: new THREE.Vector3(...part.explode),
      materials,
      state: "normal",
    });
  }

  return { model, group, parts, explode: 0 };
}

/** Moves every part to `amount` (0 = assembled, 1 = fully exploded). */
export function applyExplode(board: BuiltBoard, amount: number): void {
  const t = Math.min(1, Math.max(0, amount));
  board.explode = t;
  for (const built of board.parts.values()) {
    built.mesh.position.copy(built.base).addScaledVector(built.offset, t);
  }
  board.group.updateMatrixWorld(true);
}

/** World-space bounds of the board at a given explode amount. */
export function boundsAt(board: BuiltBoard, amount: number): THREE.Box3 {
  const previous = board.explode;
  applyExplode(board, amount);
  const box = new THREE.Box3();
  for (const built of board.parts.values()) box.expandByObject(built.mesh);
  applyExplode(board, previous);
  return box;
}

export function setPartState(built: BuiltPart, state: PartState): void {
  if (built.state === state) return;
  built.state = state;
  const accent = new THREE.Color(ACCENT);
  for (const mat of built.materials) {
    const memo = mat.userData.memo as MaterialMemo;
    mat.emissive.copy(memo.emissive);
    mat.emissiveIntensity = memo.emissiveIntensity;
    mat.opacity = memo.opacity;
    mat.transparent = memo.transparent;
    mat.depthWrite = memo.depthWrite;
    if (state === "selected" || state === "related" || state === "hover") {
      const strength = state === "selected" ? 0.55 : state === "related" ? 0.38 : 0.22;
      if (mat.emissiveMap) {
        mat.emissiveIntensity = memo.emissiveIntensity * 0.75;
      } else {
        mat.emissive.copy(accent);
        mat.emissiveIntensity = strength;
      }
    } else if (state === "dimmed") {
      mat.transparent = true;
      mat.opacity = Math.min(memo.opacity, 0.16);
      mat.depthWrite = false;
    }
    mat.needsUpdate = true;
  }
  built.outline.visible = state === "selected" || state === "related";
  (built.outline.material as THREE.LineBasicMaterial).opacity = state === "selected" ? 0.95 : 0.6;
}

/** Swaps a stand placeholder for the printable STL geometry. */
export function attachStlGeometry(board: BuiltBoard, partId: string, stl: THREE.BufferGeometry): void {
  const built = board.parts.get(partId);
  if (!built?.part.stlMatrix) return;
  const geometry = stl.clone();
  const m = built.part.stlMatrix;
  const matrix = new THREE.Matrix4().set(
    m[0]!, m[1]!, m[2]!, m[3]!,
    m[4]!, m[5]!, m[6]!, m[7]!,
    m[8]!, m[9]!, m[10]!, m[11]!,
    m[12]!, m[13]!, m[14]!, m[15]!,
  );
  geometry.applyMatrix4(matrix);
  geometry.translate(-built.base.x, -built.base.y, -built.base.z);
  if (!geometry.getAttribute("normal")) geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  built.mesh.geometry.dispose();
  built.mesh.geometry = geometry;
  built.outline.geometry.dispose();
  built.outline.geometry = new THREE.EdgesGeometry(geometry, 35);
}

export function disposeObject(root: THREE.Object3D): void {
  const textures = new Set<THREE.Texture>();
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (!material) return;
    for (const mat of Array.isArray(material) ? material : [material]) {
      for (const value of Object.values(mat)) {
        if (value instanceof THREE.Texture) textures.add(value);
      }
      mat.dispose();
    }
  });
  for (const texture of textures) texture.dispose();
}

// ---------------------------------------------------------------------------
// Geometry

export function geometryForPart(part: ModelPart): THREE.BufferGeometry {
  const [sx, sy, sz] = part.size;
  if (part.shape === "cylinder") {
    if (part.hollow || part.cutouts?.length) {
      const r = sx / 2;
      const outline = () => circleShape(r);
      return extrudedPart(outline, r, part, sz);
    }
    const segments = Math.max(24, Math.min(72, Math.round(Math.max(sx, sy, sz) * 2)));
    const axis = part.axis ?? "z";
    if (axis === "z") {
      const g = new THREE.CylinderGeometry(sx / 2, sx / 2, sz, segments);
      g.rotateX(Math.PI / 2);
      if (Math.abs(sy - sx) > 1e-6) g.scale(1, sy / sx, 1);
      return g;
    }
    if (axis === "x") {
      const g = new THREE.CylinderGeometry(sy / 2, sy / 2, sx, segments);
      g.rotateZ(Math.PI / 2);
      if (Math.abs(sz - sy) > 1e-6) g.scale(1, 1, sz / sy);
      return g;
    }
    const g = new THREE.CylinderGeometry(sx / 2, sx / 2, sy, segments);
    if (Math.abs(sz - sx) > 1e-6) g.scale(1, 1, sz / sx);
    return g;
  }

  if (part.shape === "roundedBox" || part.kind === "pcb" || part.cutouts?.length || part.hollow) {
    const radius = Math.min(part.radius ?? 0.6, sx / 2, sy / 2);
    return extrudedPart(() => roundedRectShape(sx, sy, radius), radius, part, sz);
  }

  const bevel = Math.min(0.35, sx / 4, sy / 4, sz / 4);
  if (bevel < 0.05) return new THREE.BoxGeometry(sx, sy, sz);
  return new RoundedBoxGeometry(sx, sy, sz, 2, bevel);
}

function extrudedPart(
  outline: () => THREE.Shape,
  radius: number,
  part: ModelPart,
  depth: number,
): THREE.BufferGeometry {
  const [sx, sy] = part.size;
  const cutouts = part.cutouts ?? [];

  if (!part.hollow) {
    const shape = outline();
    for (const cutout of cutouts) shape.holes.push(cutoutPath(cutout));
    return extrudeCentered(shape, depth, depth >= 1.2 ? Math.min(0.35, depth / 5) : 0);
  }

  const wall = part.hollow.wall;
  const floorSide = part.hollow.floor ?? "none";
  const pieces: THREE.BufferGeometry[] = [];

  const ring = outline();
  const innerW = sx - 2 * wall;
  const innerH = sy - 2 * wall;
  const inner =
    part.shape === "cylinder"
      ? circlePath(innerW / 2)
      : roundedRectPath(innerW, innerH, Math.max(0.3, radius - wall));
  ring.holes.push(inner);

  if (floorSide === "none") {
    pieces.push(extrudeCentered(ring, depth, wall >= 1.2 ? Math.min(0.35, wall / 4) : 0));
  } else {
    const floorT = Math.min(wall, depth / 2);
    const wallDepth = depth - floorT;
    const walls = extrudeCentered(ring, wallDepth, 0);
    const floor = outline();
    for (const cutout of cutouts) floor.holes.push(cutoutPath(cutout));
    const plate = extrudeCentered(floor, floorT, 0);
    const sign = floorSide === "back" ? 1 : -1;
    walls.translate(0, 0, (sign * floorT) / 2);
    plate.translate(0, 0, (-sign * wallDepth) / 2);
    pieces.push(walls, plate);
  }
  const merged = pieces.length === 1 ? pieces[0]! : mergeGeometries(pieces, false);
  if (!merged) throw new Error(`Could not build ${part.id}`);
  merged.computeVertexNormals();
  return merged;
}

function extrudeCentered(shape: THREE.Shape, depth: number, bevel: number): THREE.BufferGeometry {
  const usable = Math.max(0.05, depth - 2 * bevel);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: usable,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: -bevel,
    bevelSegments: 2,
    curveSegments: 20,
  });
  geometry.translate(0, 0, -usable / 2);
  return geometry;
}

function roundedRectShape(w: number, h: number, r: number): THREE.Shape {
  const shape = new THREE.Shape();
  traceRoundedRect(shape, w, h, r, 0, 0);
  return shape;
}

function roundedRectPath(w: number, h: number, r: number, cx = 0, cy = 0): THREE.Path {
  const path = new THREE.Path();
  traceRoundedRect(path, w, h, r, cx, cy);
  return path;
}

function traceRoundedRect(path: THREE.Path, w: number, h: number, radius: number, cx: number, cy: number): void {
  const r = Math.max(0, Math.min(radius, w / 2 - 0.01, h / 2 - 0.01));
  const x = cx - w / 2;
  const y = cy - h / 2;
  if (r < 0.05) {
    path.moveTo(x, y);
    path.lineTo(x + w, y);
    path.lineTo(x + w, y + h);
    path.lineTo(x, y + h);
    path.lineTo(x, y);
    return;
  }
  path.moveTo(x + r, y);
  path.lineTo(x + w - r, y);
  path.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  path.lineTo(x + w, y + h - r);
  path.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  path.lineTo(x + r, y + h);
  path.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  path.lineTo(x, y + r);
  path.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
}

function circleShape(r: number): THREE.Shape {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, r, 0, Math.PI * 2, false);
  return shape;
}

function circlePath(r: number, cx = 0, cy = 0): THREE.Path {
  const path = new THREE.Path();
  path.absarc(cx, cy, r, 0, Math.PI * 2, true);
  return path;
}

function cutoutPath(cutout: Cutout): THREE.Path {
  const [ox, oy] = cutout.offset ?? [0, 0];
  if (cutout.shape === "circle") return circlePath(cutout.size[0] / 2, ox, oy);
  return roundedRectPath(cutout.size[0], cutout.size[1], cutout.radius ?? 0, ox, oy);
}

// ---------------------------------------------------------------------------
// Materials and small details

function materialFor(part: ModelPart, finish: PartFinish, textures: TextureCache): THREE.MeshStandardMaterial {
  const color = new THREE.Color(part.color);
  switch (finish) {
    case "plastic":
      return new THREE.MeshPhysicalMaterial({
        color,
        roughness: part.kind === "speaker" ? 0.8 : 0.5,
        metalness: 0,
        clearcoat: 0.3,
        clearcoatRoughness: 0.45,
      });
    case "metal":
      return new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.85 });
    case "glass":
      return new THREE.MeshPhysicalMaterial({
        color,
        roughness: 0.04,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.04,
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
      });
    case "pcb": {
      const map = textures.pcb(part.color);
      return new THREE.MeshStandardMaterial({ color: map ? "#ffffff" : color, map, roughness: 0.55, metalness: 0.08 });
    }
    case "chip":
      return new THREE.MeshStandardMaterial({ color, roughness: 0.42, metalness: 0.15 });
    case "screen":
      return new THREE.MeshStandardMaterial({ color, roughness: 0.22, metalness: 0.1 });
    case "epaper":
      return new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0 });
    case "rubber":
      return new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0 });
    case "led":
      return new THREE.MeshStandardMaterial({
        color,
        roughness: 0.35,
        metalness: 0,
        emissive: new THREE.Color(part.glow ?? part.color),
        emissiveIntensity: 1.4,
      });
  }
}

const OPENING_PORT = /usb|hdmi|ethernet|jack|sd|grove|power/;

/** Dark socket openings on the outward face of connector parts. */
function portOpenings(part: ModelPart, outer: BoardModel["outer"]): THREE.Mesh[] {
  if (part.kind !== "port" || !OPENING_PORT.test(part.id)) return [];
  const half = [outer.w / 2, outer.h / 2, outer.t / 2];
  let axis = 0;
  let best = Infinity;
  for (let a = 0; a < 3; a += 1) {
    const gap = half[a]! - (Math.abs(part.position[a]!) + part.size[a]! / 2);
    if (gap < best) {
      best = gap;
      axis = a;
    }
  }
  const sign = part.position[axis]! >= 0 ? 1 : -1;
  const [sx, sy, sz] = part.size;
  // Face size in the plane facing out, as (width, height) of the shape.
  const face: [number, number] = axis === 0 ? [sz, sy] : axis === 1 ? [sx, sz] : [sx, sy];
  const usbC = /usb/.test(part.id) && part.shape === "roundedBox";
  const stacked = /\(2\)/.test(part.name);
  const count = stacked ? 2 : 1;
  const w = face[0] * (usbC ? 0.74 : 0.7);
  const h = (face[1] * (usbC ? 0.46 : stacked ? 0.3 : 0.55));
  const color = part.id === "usb3" ? "#1d3f99" : "#0a0b0d";
  const meshes: THREE.Mesh[] = [];
  for (let i = 0; i < count; i += 1) {
    const shape = new THREE.Shape();
    traceRoundedRect(shape, w, h, Math.min(w, h) * (usbC ? 0.48 : 0.15), 0, 0);
    const geometry = new THREE.ShapeGeometry(shape, 12);
    const along = count === 1 ? 0 : (i === 0 ? -1 : 1) * face[1] * 0.24;
    geometry.translate(0, along, 0);
    if (axis === 0) geometry.rotateY((sign * Math.PI) / 2);
    else if (axis === 1) geometry.rotateX((-sign * Math.PI) / 2);
    else if (sign < 0) geometry.rotateY(Math.PI);
    const offset = [0, 0, 0];
    offset[axis] = sign * (part.size[axis]! / 2 + 0.04);
    geometry.translate(offset[0]!, offset[1]!, offset[2]!);
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, side: THREE.DoubleSide }),
    );
    mesh.name = `${part.id}-opening-${i}`;
    meshes.push(mesh);
  }
  return meshes;
}

function detailMeshes(part: ModelPart, textures: TextureCache, outer: BoardModel["outer"]): THREE.Mesh[] {
  const [sx, sy, sz] = part.size;
  const meshes: THREE.Mesh[] = [...portOpenings(part, outer)];

  if (part.kind === "screen" && part.display) {
    const texture = textures.screen(part.display, sx, sy, part.shape === "cylinder");
    if (texture) {
      const isPaper = part.display.startsWith("epaper");
      const face =
        part.shape === "cylinder"
          ? new THREE.CircleGeometry(sx / 2 - 0.15, 72)
          : new THREE.PlaneGeometry(sx - 0.3, sy - 0.3);
      const material = new THREE.MeshStandardMaterial({
        map: texture,
        roughness: isPaper ? 0.92 : 0.28,
        metalness: 0,
        emissive: new THREE.Color(isPaper ? "#000000" : "#ffffff"),
        emissiveMap: isPaper ? null : texture,
        emissiveIntensity: isPaper ? 0 : 0.85,
      });
      const mesh = new THREE.Mesh(face, material);
      mesh.position.z = sz / 2 + 0.02;
      mesh.name = `${part.id}-face`;
      meshes.push(mesh);
    }
  }

  if (part.kind === "camera") {
    const lensR = Math.min(sx, sy) * 0.32;
    const lens = new THREE.Mesh(
      new THREE.CylinderGeometry(lensR, lensR, 0.6, 40).rotateX(Math.PI / 2),
      new THREE.MeshPhysicalMaterial({ color: "#0b1830", roughness: 0.05, metalness: 0.2, clearcoat: 1 }),
    );
    lens.position.z = sz / 2 + 0.3;
    lens.name = `${part.id}-lens`;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(lensR + 0.45, 0.35, 12, 40),
      new THREE.MeshStandardMaterial({ color: "#9aa0a8", roughness: 0.3, metalness: 0.9 }),
    );
    ring.position.z = sz / 2 + 0.2;
    ring.name = `${part.id}-ring`;
    meshes.push(lens, ring);
  }

  if (part.kind === "speaker" && part.shape === "cylinder" && (part.axis ?? "z") === "z" && sx >= 8) {
    const cone = new THREE.Mesh(
      new THREE.CylinderGeometry(sx * 0.18, sx * 0.4, 0.6, 40).rotateX(Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: "#3b3e44", roughness: 0.6, metalness: 0.1 }),
    );
    cone.position.z = sz / 2 + 0.3;
    cone.name = `${part.id}-cone`;
    meshes.push(cone);
  }

  return meshes;
}

// ---------------------------------------------------------------------------
// Canvas textures

class TextureCache {
  private readonly cache = new Map<string, THREE.Texture | null>();

  constructor(private readonly options: BuildOptions) {}

  pcb(color: string): THREE.Texture | null {
    const key = `pcb:${color}`;
    if (this.cache.has(key)) return this.cache.get(key)!;
    const canvas = this.options.createCanvas?.(256, 256) ?? null;
    const texture = canvas ? drawPcb(canvas, color) : null;
    this.cache.set(key, texture);
    return texture;
  }

  screen(content: ScreenContent, w: number, h: number, round: boolean): THREE.Texture | null {
    const scale = 512 / Math.max(w, h);
    const cw = Math.max(64, Math.round(w * scale));
    const ch = Math.max(64, Math.round(h * scale));
    const canvas = this.options.createCanvas?.(cw, ch) ?? null;
    if (!canvas) return null;
    return drawScreen(canvas, content, round);
  }
}

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

function context(canvas: HTMLCanvasElement | OffscreenCanvas): Ctx | null {
  return canvas.getContext("2d") as Ctx | null;
}

function finishTexture(canvas: HTMLCanvasElement | OffscreenCanvas, repeatMm?: number): THREE.Texture {
  const texture = new THREE.CanvasTexture(canvas as HTMLCanvasElement);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  if (repeatMm) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1 / repeatMm, 1 / repeatMm);
  }
  return texture;
}

function drawPcb(canvas: HTMLCanvasElement | OffscreenCanvas, color: string): THREE.Texture | null {
  const ctx = context(canvas);
  if (!ctx) return null;
  const { width, height } = canvas;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
  const base = new THREE.Color(color);
  const trace = base.clone().lerp(new THREE.Color("#ffffff"), 0.14).getStyle();
  let seed = 7;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  ctx.strokeStyle = trace;
  ctx.lineCap = "round";
  for (let i = 0; i < 46; i += 1) {
    ctx.lineWidth = rand() < 0.2 ? 3 : 1.5;
    let x = rand() * width;
    let y = rand() * height;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < 3; s += 1) {
      const len = 20 + rand() * 60;
      const dir = Math.floor(rand() * 4);
      if (dir === 0) x += len;
      else if (dir === 1) x -= len;
      else if (dir === 2) y += len;
      else y -= len;
      if (rand() < 0.4) {
        x += len * 0.4;
        y += len * 0.4;
      }
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.fillStyle = "#c9a54a";
  for (let i = 0; i < 26; i += 1) {
    ctx.beginPath();
    ctx.arc(rand() * width, rand() * height, 1.6 + rand() * 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
  return finishTexture(canvas, 30);
}

function drawScreen(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  content: ScreenContent,
  round: boolean,
): THREE.Texture | null {
  const ctx = context(canvas);
  if (!ctx) return null;
  const { width: w, height: h } = canvas;
  const s = Math.min(w, h);
  const paper = content === "epaper-bw" || content === "epaper-color";

  if (paper) {
    ctx.fillStyle = "#e9e7df";
    ctx.fillRect(0, 0, w, h);
  } else {
    const bg = ctx.createRadialGradient(w / 2, h * 0.42, s * 0.05, w / 2, h / 2, Math.max(w, h) * 0.7);
    bg.addColorStop(0, content === "avatar" ? "#24345a" : "#1a2433");
    bg.addColorStop(1, "#05070b");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
  }

  const ink = paper ? "#141414" : "#f3f5f8";
  const faceY = paper ? h * 0.5 : content === "avatar" ? h * 0.46 : h * 0.4;
  const faceR = s * (paper ? 0.3 : content === "avatar" ? 0.27 : 0.18);
  const faceX = paper ? w * 0.27 : w / 2;

  if (content === "avatar" || paper || content === "status") {
    // A simple friendly character: round head, two eyes and a smile.
    ctx.fillStyle = paper ? (content === "epaper-color" ? "#3d6fd6" : "#ffffff") : "#6c8cff";
    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(2, s * 0.012);
    ctx.beginPath();
    ctx.arc(faceX, faceY, faceR, 0, Math.PI * 2);
    ctx.fill();
    if (paper) ctx.stroke();
    ctx.fillStyle = paper ? ink : "#ffffff";
    const eyeW = faceR * 0.2;
    const eyeH = faceR * 0.42;
    for (const dx of [-0.36, 0.36]) {
      roundRect(ctx, faceX + dx * faceR - eyeW / 2, faceY - faceR * 0.32, eyeW, eyeH, eyeW / 2);
      ctx.fill();
    }
    ctx.strokeStyle = paper ? ink : "#ffffff";
    ctx.lineWidth = Math.max(2, faceR * 0.08);
    ctx.beginPath();
    ctx.arc(faceX, faceY + faceR * 0.12, faceR * 0.38, Math.PI * 0.2, Math.PI * 0.8);
    ctx.stroke();
  }

  const fontPx = Math.round(s * (round ? 0.075 : 0.085));
  ctx.font = `600 ${fontPx}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (content === "avatar") {
    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.fillText("Hold to talk", w / 2, h * (round ? 0.8 : 0.84));
  } else if (content === "status") {
    ctx.fillStyle = "#7ad88a";
    ctx.beginPath();
    ctx.arc(w / 2 - fontPx * 2.7, h * 0.72, fontPx * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ink;
    ctx.fillText("Connected", w / 2 + fontPx * 0.3, h * 0.72);
    ctx.fillStyle = "rgba(243,245,248,0.6)";
    ctx.font = `500 ${Math.round(fontPx * 0.7)}px system-ui, sans-serif`;
    ctx.fillText("Muse gadget", w / 2, h * 0.84);
  } else if (paper) {
    ctx.fillStyle = ink;
    ctx.textAlign = "left";
    const left = w * 0.08;
    ctx.fillText("Ready", left + w * 0.62, h * 0.32);
    ctx.font = `500 ${Math.round(fontPx * 0.62)}px system-ui, sans-serif`;
    ctx.fillText("Status: connected", left + w * 0.56, h * 0.47);
    ctx.fillText("Last update 09:41", left + w * 0.56, h * 0.57);
    if (content === "epaper-color") {
      const inks = ["#d6b11b", "#c8372d", "#2d5fc8", "#2f8f4e"];
      inks.forEach((inkColor, i) => {
        ctx.fillStyle = inkColor;
        ctx.fillRect(left + w * 0.56 + i * w * 0.075, h * 0.68, w * 0.06, h * 0.12);
      });
    } else {
      ctx.fillStyle = ink;
      for (let i = 0; i < 4; i += 1) {
        ctx.fillRect(left + w * 0.56 + i * w * 0.075, h * 0.68, w * 0.06, h * 0.12 * (0.4 + i * 0.2));
      }
    }
  }

  if (round) {
    // Keep the corners outside the round panel black.
    ctx.globalCompositeOperation = "destination-in";
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, s / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }
  return finishTexture(canvas);
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
