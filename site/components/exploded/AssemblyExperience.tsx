"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import {
  componentAmounts,
  componentForPart,
  endpointPoint,
  type AssemblyPackage,
  type ConnectionEdge,
} from "@/lib/models/assembly-package";
import {
  FIDELITY_LABELS,
  HANDLING_LABELS,
  PHYSICAL_LABELS,
  describeExperience,
  experienceReducer,
  initialExperience,
  type ExperienceState,
} from "@/lib/models/assembly-experience";
import {
  applyPartExplode,
  attachStlGeometry,
  buildBoard,
  disposeObject,
  setPartState,
  type BuiltBoard,
  type PartState,
} from "@/lib/models/build";
import styles from "./assembly.module.css";

export interface AssemblyExperienceProps {
  /** Validated assembly package (site/lib/models/assemblies). */
  pkg: AssemblyPackage;
  /** Starting interaction state; tests and deep links use it. */
  initial?: Partial<ExperienceState>;
}

const EDGE_COLORS: Record<ConnectionEdge["kind"], string> = {
  "mechanical-fit": "#7dd3fc",
  "usb-c": "#ff9d4d",
  "cable-route": "#b4a5ff",
};

const SYSTEM_KIND_LABELS = {
  power: "Power",
  data: "Data",
  "agent-input": "Muse input",
  "agent-output": "Muse output",
} as const;

const VIEW_DIRECTION = new THREE.Vector3(0.62, 0.3, 1.48).normalize();

interface SceneContext {
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  board: BuiltBoard;
  edgeLines: Map<string, THREE.Line>;
  markers: Map<string, THREE.Mesh>;
  requestRender: () => void;
  /** Camera target and distance that fit the visible parts at these amounts. */
  framing: (amounts: Record<string, number>) => { target: THREE.Vector3; distance: number };
}

interface StageLabel {
  id: string;
  text: string;
  tone: ConnectionEdge["kind"] | "endpoint";
  /** Endpoint ids; the label sits at their midpoint. */
  at: string[];
}

function ease(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

export function AssemblyExperience({ pkg, initial }: AssemblyExperienceProps) {
  const [state, dispatch] = useReducer(
    (current: ExperienceState, action: Parameters<typeof experienceReducer>[2]) =>
      experienceReducer(pkg, current, action),
    undefined,
    () => ({ ...initialExperience(pkg), ...initial }),
  );
  const view = describeExperience(pkg, state);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const ctxRef = useRef<SceneContext | null>(null);
  const amountsRef = useRef<Record<string, number>>(componentAmounts(pkg, view.presentation.state.id));
  const animRef = useRef(0);
  const autoFrame = useRef(true);
  const pointerDown = useRef<{ x: number; y: number } | null>(null);
  const labelEls = useRef(new Map<string, HTMLDivElement>());
  const labelsRef = useRef<StageLabel[]>([]);
  const pendingStl = useRef(new Set<string>());
  const [ready, setReady] = useState(false);
  const [stlVersion, setStlVersion] = useState(0);
  const [webgl, setWebgl] = useState(true);
  const [hoverComponentId, setHoverComponentId] = useState<string | null>(null);

  const partComponent = useMemo(
    () => new Map(pkg.components.flatMap((component) => component.partIds.map((id) => [id, component.id] as const))),
    [pkg],
  );
  const edgesById = useMemo(() => new Map(pkg.edges.map((edge) => [edge.id, edge])), [pkg]);
  const endpointsById = useMemo(() => new Map(pkg.endpoints.map((endpoint) => [endpoint.id, endpoint])), [pkg]);

  const flowEndpointIds = view.flow.filter((node) => node.kind === "endpoint").map((node) => node.id);
  const stageLabels: StageLabel[] = view.system
    ? flowEndpointIds.map((id) => ({ id: `node-${id}`, text: endpointsById.get(id)!.label, tone: "endpoint", at: [id] }))
    : view.activeEdgeIds.map((id) => {
        const edge = edgesById.get(id)!;
        return { id: `edge-${id}`, text: edge.label, tone: edge.kind, at: [edge.from, edge.to] };
      });
  labelsRef.current = stageLabels;
  const activeEdgeKey = view.activeEdgeIds.join(",");
  const markerKey = [...view.activeEdgeIds.flatMap((id) => [edgesById.get(id)!.from, edgesById.get(id)!.to]), ...flowEndpointIds].join(",");

  // --- three.js scene -------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    } catch {
      setWebgl(false);
      return;
    }
    let disposed = false;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const envTarget = pmrem.fromScene(room, 0.04);
    scene.environment = envTarget.texture;
    scene.environmentIntensity = 0.82;
    disposeObject(room);

    const board = buildBoard(pkg.model, {
      createCanvas: (width, height) => {
        const c = document.createElement("canvas");
        c.width = width;
        c.height = height;
        return c;
      },
    });
    pendingStl.current = new Set(pkg.model.parts.filter((part) => part.stl).map((part) => part.id));
    for (const id of pendingStl.current) board.parts.get(id)!.mesh.visible = false;
    scene.add(board.group);

    // Connection lines and endpoint markers live in the model frame so they
    // follow the stand tilt and each component's explode offset.
    const edgeLines = new Map<string, THREE.Line>();
    for (const edge of pkg.edges) {
      const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
      const line = new THREE.Line(
        geometry,
        new THREE.LineBasicMaterial({ color: EDGE_COLORS[edge.kind], transparent: true, opacity: 0.95, depthTest: false }),
      );
      line.renderOrder = 10;
      line.visible = false;
      line.raycast = () => {};
      board.group.add(line);
      edgeLines.set(edge.id, line);
    }
    const markers = new Map<string, THREE.Mesh>();
    const markerGeometry = new THREE.SphereGeometry(1.15, 16, 12);
    for (const endpoint of pkg.endpoints) {
      const marker = new THREE.Mesh(
        markerGeometry,
        new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.95, depthTest: false }),
      );
      marker.renderOrder = 11;
      marker.visible = false;
      marker.raycast = () => {};
      board.group.add(marker);
      markers.set(endpoint.id, marker);
    }

    const all = new THREE.Box3();
    for (const stateDef of pkg.states) {
      applyPartExplode(board, (id) => componentAmounts(pkg, stateDef.id)[partComponent.get(id)!] ?? 0);
      for (const built of board.parts.values()) all.expandByObject(built.mesh);
    }
    const allSize = all.getSize(new THREE.Vector3());
    const allCenter = all.getCenter(new THREE.Vector3());
    const radius = Math.max(allSize.length() / 2, 10);

    scene.add(new THREE.HemisphereLight("#e8eeff", "#2a2118", 0.9));
    const key = new THREE.DirectionalLight("#fff8ed", 3.1);
    key.position.set(allCenter.x + radius * 0.9, allCenter.y + radius * 1.6, allCenter.z + radius * 1.2);
    key.target.position.copy(allCenter);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.radius = 4;
    key.shadow.bias = -0.0005;
    Object.assign(key.shadow.camera, {
      left: -radius * 1.4,
      right: radius * 1.4,
      top: radius * 1.4,
      bottom: -radius * 1.4,
      near: radius * 0.2,
      far: radius * 5,
    });
    scene.add(key, key.target);
    const rim = new THREE.DirectionalLight("#9fb8ff", 1.45);
    rim.position.set(allCenter.x - radius * 1.2, allCenter.y + radius * 0.6, allCenter.z - radius * 1.4);
    scene.add(rim);

    applyPartExplode(board, () => 0);
    const seatedBox = new THREE.Box3();
    for (const built of board.parts.values()) seatedBox.expandByObject(built.mesh);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(radius * 8, radius * 8),
      new THREE.ShadowMaterial({ color: "#000000", opacity: 0.3, depthWrite: false }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(allCenter.x, seatedBox.min.y - 0.2, allCenter.z);
    floor.receiveShadow = true;
    floor.raycast = () => {};
    scene.add(floor);

    const camera = new THREE.PerspectiveCamera(30, 1, Math.max(0.5, radius / 50), radius * 40);
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.09;
    controls.minDistance = radius * 0.5;
    controls.maxDistance = radius * 5;

    const fitDistance = (box: THREE.Box3, center: THREE.Vector3, dir: THREE.Vector3) => {
      const vTan = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
      const hTan = vTan * camera.aspect;
      const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), dir).normalize();
      const up = new THREE.Vector3().crossVectors(dir, right).normalize();
      let distance = 0;
      for (const x of [box.min.x, box.max.x]) {
        for (const y of [box.min.y, box.max.y]) {
          for (const z of [box.min.z, box.max.z]) {
            const rel = new THREE.Vector3(x, y, z).sub(center);
            const depth = rel.dot(dir);
            // Extra vertical margin keeps the model clear of the stage controls.
            distance = Math.max(
              distance,
              depth + Math.abs(rel.dot(right)) / (hTan * 0.8),
              depth + Math.abs(rel.dot(up)) / (vTan * 0.72),
            );
          }
        }
      }
      return distance;
    };

    const framing = (amounts: Record<string, number>) => {
      const previous = amountsRef.current;
      applyPartExplode(board, (id) => amounts[partComponent.get(id)!] ?? 0);
      const box = new THREE.Box3();
      for (const built of board.parts.values()) {
        if (built.mesh.visible || pendingStl.current.has(built.part.id)) box.expandByObject(built.mesh);
      }
      applyPartExplode(board, (id) => previous[partComponent.get(id)!] ?? 0);
      if (box.isEmpty()) box.copy(all);
      const center = box.getCenter(new THREE.Vector3());
      const dir = camera.position.clone().sub(controls.target).normalize();
      return { target: center, distance: Math.max(fitDistance(box, center, dir), radius * 0.3) };
    };

    const tmp = new THREE.Vector3();
    const other = new THREE.Vector3();
    const updateLabels = () => {
      const width = stage.clientWidth;
      const height = stage.clientHeight;
      const placed: { x: number; y: number; w: number; h: number }[] = [];
      for (const label of labelsRef.current) {
        const el = labelEls.current.get(label.id);
        if (!el) continue;
        tmp.set(0, 0, 0);
        for (const id of label.at) {
          other.fromArray(endpointPoint(pkg, id, amountsRef.current));
          tmp.add(other);
        }
        tmp.divideScalar(label.at.length);
        board.group.localToWorld(tmp);
        tmp.project(camera);
        const margin = 10;
        const w = el.offsetWidth;
        const h = el.offsetHeight;
        const x = Math.min(Math.max(((tmp.x + 1) / 2) * width + 8, margin), width - w - margin);
        let y = Math.min(Math.max(((1 - tmp.y) / 2) * height - h / 2, margin), height - h - margin);
        // Stack labels that would overlap an earlier one.
        for (let guard = 0; guard < placed.length + 1; guard += 1) {
          const hit = placed.find((p) => x < p.x + p.w && x + w > p.x && y < p.y + p.h + 4 && y + h + 4 > p.y);
          if (!hit) break;
          y = hit.y + hit.h + 4;
        }
        if (y > height - h - margin) y = Math.max(margin, height - h - margin);
        placed.push({ x, y, w, h });
        el.style.opacity = tmp.z < 1 ? "1" : "0";
        el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
      }
    };

    let frame = 0;
    const renderNow = () => {
      frame = 0;
      if (disposed) return;
      const moving = controls.update();
      renderer.render(scene, camera);
      updateLabels();
      if (moving) requestRender();
    };
    const requestRender = () => {
      if (!frame && !disposed) frame = requestAnimationFrame(renderNow);
    };
    controls.addEventListener("change", requestRender);

    const resize = () => {
      const width = Math.max(1, stage.clientWidth);
      const height = Math.max(1, stage.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      if (autoFrame.current) {
        const dir = camera.position.clone().sub(controls.target).normalize();
        const fit = framing(amountsRef.current);
        controls.target.copy(fit.target);
        camera.position.copy(fit.target).addScaledVector(dir, fit.distance);
        controls.update();
      }
      requestRender();
    };
    controls.target.copy(allCenter);
    camera.position.copy(allCenter).add(VIEW_DIRECTION);
    const observer = new ResizeObserver(resize);
    observer.observe(stage);
    resize();
    const fit = framing(amountsRef.current);
    controls.target.copy(fit.target);
    camera.position.copy(fit.target).addScaledVector(VIEW_DIRECTION, fit.distance);
    controls.update();

    const stopAutoFrame = () => {
      autoFrame.current = false;
    };
    canvas.addEventListener("wheel", stopAutoFrame, { passive: true });

    ctxRef.current = { camera, controls, board, edgeLines, markers, requestRender, framing };
    applyPartExplode(board, (id) => amountsRef.current[partComponent.get(id)!] ?? 0);
    setReady(true);
    requestRender();

    const stlParts = pkg.model.parts.filter((part) => part.stl && part.stlMatrix);
    if (stlParts.length > 0) {
      void import("three/examples/jsm/loaders/STLLoader.js").then(({ STLLoader }) => {
        const loader = new STLLoader();
        for (const part of stlParts) {
          const show = () => {
            pendingStl.current.delete(part.id);
            setStlVersion((version) => version + 1);
          };
          void loader
            .loadAsync(part.stl!)
            .then((geometry) => {
              if (disposed) return geometry.dispose();
              attachStlGeometry(board, part.id, geometry);
              geometry.dispose();
              show();
            })
            .catch(() => {
              if (!disposed) show();
            });
        }
      });
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener("wheel", stopAutoFrame);
      controls.removeEventListener("change", requestRender);
      controls.dispose();
      markerGeometry.dispose();
      disposeObject(scene);
      envTarget.dispose();
      pmrem.dispose();
      renderer.dispose();
      ctxRef.current = null;
    };
  }, [pkg, partComponent]);

  // --- parts, lines and markers for the current view --------------------------
  const applyAmounts = useCallback(
    (amounts: Record<string, number>) => {
      const ctx = ctxRef.current;
      if (!ctx) return;
      amountsRef.current = amounts;
      applyPartExplode(ctx.board, (id) => amounts[partComponent.get(id)!] ?? 0);
      for (const edge of pkg.edges) {
        const line = ctx.edgeLines.get(edge.id)!;
        const position = line.geometry.getAttribute("position") as THREE.BufferAttribute;
        position.setXYZ(0, ...endpointPoint(pkg, edge.from, amounts));
        position.setXYZ(1, ...endpointPoint(pkg, edge.to, amounts));
        position.needsUpdate = true;
        line.geometry.computeBoundingSphere();
      }
      for (const [id, marker] of ctx.markers) marker.position.fromArray(endpointPoint(pkg, id, amounts));
      ctx.requestRender();
    },
    [partComponent, pkg],
  );

  const targetStateId = view.presentation.state.id;
  useEffect(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    cancelAnimationFrame(animRef.current);
    const from = { ...amountsRef.current };
    const to = componentAmounts(pkg, targetStateId);
    const startTarget = ctx.controls.target.clone();
    const startDistance = ctx.camera.position.distanceTo(ctx.controls.target);
    const end = autoFrame.current ? ctx.framing(to) : null;
    const step = (t: number) => {
      const k = ease(t);
      applyAmounts(Object.fromEntries(Object.keys(to).map((id) => [id, (from[id] ?? 0) + ((to[id] ?? 0) - (from[id] ?? 0)) * k])));
      if (end) {
        const dir = ctx.camera.position.clone().sub(ctx.controls.target).normalize();
        ctx.controls.target.lerpVectors(startTarget, end.target, k);
        ctx.camera.position.copy(ctx.controls.target).addScaledVector(dir, THREE.MathUtils.lerp(startDistance, end.distance, k));
        ctx.controls.update();
      }
    };
    if (prefersReducedMotion()) {
      step(1);
      return;
    }
    const started = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / 750);
      step(t);
      if (t < 1) animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [applyAmounts, pkg, ready, targetStateId]);

  const highlightKey = view.highlightedPartIds.join(",");
  const selectedId = state.selectedComponentId;
  useEffect(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const highlighted = new Set(highlightKey ? highlightKey.split(",") : []);
    for (const [id, built] of ctx.board.parts) {
      const presentation = view.presentation.parts[id]!;
      const componentId = partComponent.get(id);
      const hidden = presentation.emphasis === "hidden" && componentId !== selectedId;
      built.mesh.visible = !hidden && !pendingStl.current.has(id);
      let next: PartState = presentation.emphasis === "focus" ? "related" : presentation.emphasis === "ghost" ? "dimmed" : "normal";
      if (highlighted.has(id)) next = componentId === selectedId ? "selected" : "related";
      else if (componentId === hoverComponentId && next === "normal") next = "hover";
      setPartState(built, next);
    }
    const active = new Set(activeEdgeKey ? activeEdgeKey.split(",") : []);
    for (const [id, line] of ctx.edgeLines) line.visible = active.has(id);
    const marked = new Set(markerKey ? markerKey.split(",") : []);
    for (const [id, marker] of ctx.markers) marker.visible = marked.has(id);
    ctx.requestRender();
  }, [activeEdgeKey, highlightKey, hoverComponentId, markerKey, partComponent, ready, selectedId, stlVersion, view.presentation]);

  // --- picking and view controls ----------------------------------------------
  const pick = (clientX: number, clientY: number): string | null => {
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(
      new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1),
      ctx.camera,
    );
    for (const hit of raycaster.intersectObject(ctx.board.group, true)) {
      let object: THREE.Object3D | null = hit.object;
      while (object && !object.userData.partId) object = object.parent;
      const id = object?.userData.partId as string | undefined;
      const built = id ? ctx.board.parts.get(id) : undefined;
      if (!id || !built?.mesh.visible || built.state === "dimmed") continue;
      return id;
    }
    return null;
  };

  const zoom = (factor: number) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    autoFrame.current = false;
    const offset = ctx.camera.position.clone().sub(ctx.controls.target);
    const distance = THREE.MathUtils.clamp(offset.length() * factor, ctx.controls.minDistance, ctx.controls.maxDistance);
    ctx.camera.position.copy(ctx.controls.target).addScaledVector(offset.normalize(), distance);
    ctx.controls.update();
    ctx.requestRender();
  };

  const resetView = () => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    autoFrame.current = true;
    ctx.camera.position.copy(ctx.controls.target).add(VIEW_DIRECTION);
    const fit = ctx.framing(amountsRef.current);
    ctx.controls.target.copy(fit.target);
    ctx.camera.position.copy(fit.target).addScaledVector(VIEW_DIRECTION, fit.distance);
    ctx.controls.update();
    ctx.requestRender();
  };

  const selected = view.selected;
  const sources = [
    ...new Map(pkg.components.flatMap((component) => component.sources).map((source) => [source.url, source])).values(),
  ];
  const modeHint =
    view.mode.id === "build"
      ? view.step
        ? `${view.position} · ${view.step.label}`
        : "Overview · all three assemblies"
      : view.mode.id === "connections"
        ? view.system
          ? `${SYSTEM_KIND_LABELS[view.system.kind]} · ${view.system.label}`
          : "Every physical connection"
        : "Finished build";

  return (
    <section
      className={styles.experience}
      data-testid="assembly-experience"
      aria-label={`${pkg.title} interactive build`}
      onKeyDown={(event) => {
        if (event.key === "Escape") dispatch({ type: "select-component", componentId: null });
        if (event.target instanceof HTMLButtonElement || event.target === canvasRef.current) {
          if (event.key === "ArrowRight" && view.canNext) dispatch({ type: "next" });
          if (event.key === "ArrowLeft" && view.canPrev) dispatch({ type: "prev" });
        }
      }}
    >
      <div className={styles.bar}>
        <div className={styles.modes} role="group" aria-label="View">
          {pkg.modes.map((mode) => (
            <button
              key={mode.id}
              type="button"
              className={styles.mode}
              data-mode={mode.id}
              aria-pressed={view.mode.id === mode.id}
              onClick={() => dispatch({ type: "mode", modeId: mode.id })}
            >
              {mode.label}
            </button>
          ))}
        </div>
        <span className={styles.evidencePill}>
          Concept render · {PHYSICAL_LABELS[pkg.evidence.physical]}
        </span>
      </div>

      <div className={styles.body}>
        <div className={styles.stage} ref={stageRef} data-testid="assembly-stage">
          <canvas
            ref={canvasRef}
            className={styles.canvas}
            data-testid="assembly-canvas"
            role="img"
            tabIndex={0}
            aria-label={`Interactive 3D model of the ${pkg.title} build. Drag to orbit, scroll or pinch to zoom, and tap a component to select it.`}
            onPointerDown={(event) => {
              pointerDown.current = { x: event.clientX, y: event.clientY };
              if (event.button === 2 || event.ctrlKey || event.metaKey || event.shiftKey) autoFrame.current = false;
            }}
            onPointerUp={(event) => {
              const start = pointerDown.current;
              pointerDown.current = null;
              if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6) return;
              const id = pick(event.clientX, event.clientY);
              if (id) dispatch({ type: "select-part", partId: id });
              else if (state.selectedComponentId) dispatch({ type: "select-component", componentId: null });
            }}
            onPointerMove={(event) => {
              if (event.pointerType !== "mouse" || event.buttons !== 0) return;
              const id = pick(event.clientX, event.clientY);
              const next = id ? componentForPart(pkg, id)?.id ?? null : null;
              if (next !== hoverComponentId) setHoverComponentId(next);
            }}
            onPointerLeave={() => setHoverComponentId(null)}
          />
          <div className={styles.labels} aria-hidden="true">
            {stageLabels.map((label) => (
              <div
                key={label.id}
                className={styles.label}
                data-tone={label.tone}
                ref={(el) => {
                  if (el) labelEls.current.set(label.id, el);
                  else labelEls.current.delete(label.id);
                }}
              >
                {label.text}
              </div>
            ))}
          </div>
          <p className={styles.stageHint} aria-live="polite">
            <strong>{modeHint}</strong>
            <span>Drag to orbit · scroll or pinch to zoom · tap a part</span>
          </p>
          {!webgl ? (
            <p className={styles.stageMessage}>3D needs WebGL in this browser. The steps and connections still work.</p>
          ) : !ready ? (
            <p className={styles.stageMessage}>Loading 3D model</p>
          ) : null}
          <div className={styles.stageControls}>
            {view.mode.id === "build" ? (
              <div className={styles.pager}>
                <button
                  type="button"
                  className={styles.iconButton}
                  aria-label="Previous step"
                  disabled={!view.canPrev}
                  onClick={() => dispatch({ type: "prev" })}
                >
                  ←
                </button>
                <span className={styles.pagerPosition}>{view.position}</span>
                <button
                  type="button"
                  className={`${styles.iconButton} ${styles.iconAccent}`}
                  aria-label="Next step"
                  disabled={!view.canNext}
                  onClick={() => dispatch({ type: "next" })}
                >
                  →
                </button>
              </div>
            ) : (
              <span />
            )}
            <div className={styles.viewButtons}>
              <button type="button" className={styles.iconButton} aria-label="Zoom in" onClick={() => zoom(0.8)}>
                +
              </button>
              <button type="button" className={styles.iconButton} aria-label="Zoom out" onClick={() => zoom(1.25)}>
                −
              </button>
              <button type="button" className={styles.iconButton} aria-label="Reset view" onClick={resetView}>
                ⟲
              </button>
            </div>
          </div>
        </div>

        <aside className={styles.panel} data-testid="assembly-panel" aria-label={`${pkg.title} build details`}>
          <div className={styles.card} aria-live="polite">
            {selected ? (
              <>
                <p className={styles.kicker}>{selected.handling}</p>
                <h3>{selected.component.name}</h3>
                <span className={styles.badge} data-fidelity={selected.component.fidelity}>
                  {selected.fidelity}
                </span>
                <p>{selected.component.summary}</p>
                {selected.component.facts?.length ? (
                  <dl className={styles.facts}>
                    {selected.component.facts.map((fact) => (
                      <div key={fact.label} title={fact.basis}>
                        <dt>{fact.label}</dt>
                        <dd>{fact.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
                {selected.exteriorFeatures.length > 0 ? (
                  <>
                    <p className={styles.subhead}>Exterior features</p>
                    <ul className={styles.chips}>
                      {selected.exteriorFeatures.map((feature) => (
                        <li key={feature}>{feature}</li>
                      ))}
                    </ul>
                  </>
                ) : null}
                <p className={styles.sourceLine}>
                  {selected.component.sources.map((source) => (
                    <a key={source.url} href={source.url} target="_blank" rel="noreferrer">
                      {source.label} ↗
                    </a>
                  ))}
                </p>
                <button
                  type="button"
                  className={styles.textButton}
                  onClick={() => dispatch({ type: "select-component", componentId: null })}
                >
                  Clear selection
                </button>
              </>
            ) : view.step ? (
              <>
                <p className={styles.kicker}>{view.position}</p>
                <h3>{view.step.label}</h3>
                <p>{view.step.instruction}</p>
                {view.step.checks.length > 0 ? (
                  <>
                    <p className={styles.subhead}>Check before moving on</p>
                    <ul className={styles.checks}>
                      {view.step.checks.map((check) => (
                        <li key={check}>{check}</li>
                      ))}
                    </ul>
                  </>
                ) : null}
                {view.step.edgeIds.length > 0 ? <EdgeList edges={view.step.edgeIds.map((id) => edgesById.get(id)!)} /> : null}
              </>
            ) : view.system ? (
              <>
                <p className={styles.kicker}>{SYSTEM_KIND_LABELS[view.system.kind]}</p>
                <h3>{view.system.label}</h3>
                <span className={styles.badge} data-support={view.system.support}>
                  {view.system.support === "supported" ? "Works in this build" : "Needs integration"}
                </span>
                <p>{view.system.note}</p>
                <ol className={styles.flow} data-testid="flow-path">
                  {view.flow.map((node) => (
                    <li key={node.id} data-flow-node={node.id} data-kind={node.kind}>
                      {node.label}
                    </li>
                  ))}
                </ol>
              </>
            ) : view.mode.id === "build" ? (
              <>
                <p className={styles.kicker}>Guided build</p>
                <h3>{view.presentation.state.label}</h3>
                <p>Three steps take you from a printed stand to a powered Orb. The purchased Orb is seated whole; it is never opened.</p>
              </>
            ) : view.mode.id === "connections" ? (
              <>
                <p className={styles.kicker}>Connections & agent flow</p>
                <h3>How power, data and Muse move</h3>
                <p>Pick a flow to trace it. Lines show the physical fits and the cable path you assemble.</p>
                <EdgeList edges={view.activeEdgeIds.map((id) => edgesById.get(id)!)} />
              </>
            ) : (
              <>
                <p className={styles.kicker}>Finished build</p>
                <h3>{pkg.title}</h3>
                <p>
                  {pkg.components.length} components: one sealed device you buy and keep closed, and the parts you make
                  and connect. Tap one to see where its geometry comes from.
                </p>
              </>
            )}
          </div>

          {view.mode.id === "build" ? (
            <ol className={styles.list}>
              {pkg.steps.map((step) => (
                <li key={step.id}>
                  <button
                    type="button"
                    className={styles.row}
                    aria-pressed={view.step?.id === step.id}
                    onClick={() => dispatch({ type: "step", stepId: step.id })}
                  >
                    <span className={styles.num}>{step.order}</span>
                    <span className={styles.rowText}>
                      <strong>{step.label}</strong>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          ) : view.mode.id === "connections" ? (
            <ul className={styles.list}>
              {pkg.systems.map((system) => (
                <li key={system.id}>
                  <button
                    type="button"
                    className={styles.row}
                    aria-pressed={view.system?.id === system.id}
                    data-system={system.id}
                    onClick={() => dispatch({ type: "system", systemId: view.system?.id === system.id ? null : system.id })}
                  >
                    <span className={styles.flowKind} data-kind={system.kind}>
                      {SYSTEM_KIND_LABELS[system.kind]}
                    </span>
                    <span className={styles.rowText}>
                      <strong>{system.label}</strong>
                      {system.support === "requires-integration" ? <small>Needs integration</small> : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {view.mode.id === "assembled" ? (
          <div className={styles.components}>
            {pkg.groups.map((group) => (
              <div key={group.id} className={styles.group}>
                <p className={styles.subhead}>{group.label}</p>
                <ul className={styles.list}>
                  {group.componentIds.map((id) => {
                    const component = pkg.components.find((candidate) => candidate.id === id)!;
                    return (
                      <li key={id}>
                        <button
                          type="button"
                          className={styles.row}
                          aria-pressed={state.selectedComponentId === id}
                          data-component={id}
                          data-handling={component.handling}
                          onClick={() => dispatch({ type: "select-component", componentId: id })}
                          onMouseEnter={() => setHoverComponentId(id)}
                          onMouseLeave={() => setHoverComponentId(null)}
                        >
                          <span className={styles.rowText}>
                            <strong>{component.name}</strong>
                            <small>{HANDLING_LABELS[component.handling]}</small>
                          </span>
                          <span className={styles.badge} data-fidelity={component.fidelity}>
                            {FIDELITY_LABELS[component.fidelity]}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
          ) : null}
        </aside>
      </div>

      <div className={styles.proof}>
        <p>
          <strong>Concept render.</strong> {pkg.evidence.statement}
        </p>
        <p>
          <span>Physical build: {PHYSICAL_LABELS[pkg.evidence.physical]}</span>
          {sources.map((source) => (
            <a key={source.url} href={source.url} target="_blank" rel="noreferrer">
              {source.label} ↗
            </a>
          ))}
        </p>
      </div>
    </section>
  );
}

function EdgeList({ edges }: { edges: ConnectionEdge[] }) {
  return (
    <ul className={styles.edges}>
      {edges.map((edge) => (
        <li key={edge.id} data-kind={edge.kind}>
          <strong>{edge.label}</strong>
          <span>{edge.detail}</span>
          <small>{FIDELITY_LABELS[edge.fidelity]}</small>
        </li>
      ))}
    </ul>
  );
}
