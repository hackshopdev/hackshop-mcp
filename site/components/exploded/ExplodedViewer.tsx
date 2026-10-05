"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import {
  applyExplode,
  attachStlGeometry,
  boundsAt,
  buildBoard,
  disposeObject,
  setPartState,
  type BuiltBoard,
  type PartState,
} from "@/lib/models/build";
import type { BoardModel, ModelPart, ModelStep } from "@/lib/models/types";
import styles from "./exploded.module.css";
import { KIND_LABELS, MODEL_NOTE, formatOuter } from "./labels";

export interface ExplodedViewerProps {
  /** The board to show (from site/lib/models). */
  model: BoardModel;
  /** Assembly steps mapped to parts (site/lib/models/plan-steps on the server). */
  steps?: ModelStep[];
  /** Called when WebGL can't start, so the wrapper can show the static fallback. */
  onUnavailable?: (reason: string) => void;
}

interface SceneContext {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  board: BuiltBoard;
  home: { position: THREE.Vector3; target: THREE.Vector3 };
  centers: Map<string, THREE.Vector3>;
  requestRender: () => void;
  /** Moves the camera to frame the board at an explode amount (0-1). */
  frameFor: (amount: number, direction?: THREE.Vector3) => void;
}

const OUTSIDE_KINDS = new Set<ModelPart["kind"]>([
  "shell-front",
  "shell-back",
  "glass",
  "button",
  "port",
  "stand",
]);

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

export function ExplodedViewer({ model, steps = [], onUnavailable }: ExplodedViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const ctxRef = useRef<SceneContext | null>(null);
  const explodeRef = useRef(0);
  const animRef = useRef(0);
  const labelEls = useRef(new Map<string, HTMLDivElement>());
  const pointerDown = useRef<{ x: number; y: number } | null>(null);
  const autoFrame = useRef(true);
  const touches = useRef(new Set<number>());
  const hoverFrame = useRef(0);

  const [ready, setReady] = useState(false);
  const [explode, setExplode] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hover, setHover] = useState<{ id: string; x: number; y: number; fromList?: boolean } | null>(null);
  const [activeStepId, setActiveStepId] = useState<string | null>(null);
  const [labelsOn, setLabelsOn] = useState(false);
  const [tab, setTab] = useState<"parts" | "steps">("parts");
  const [exporting, setExporting] = useState(false);

  const partsById = useMemo(() => new Map(model.parts.map((part) => [part.id, part])), [model]);
  const selected = selectedId ? partsById.get(selectedId) ?? null : null;
  const activeStep = steps.find((step) => step.id === activeStepId) ?? null;
  const dims = formatOuter(model);

  const labelIds = useMemo(() => {
    const ids = new Set<string>();
    if (labelsOn) for (const part of model.parts) ids.add(part.id);
    if (activeStep) for (const id of activeStep.partIds) ids.add(id);
    if (selectedId) ids.add(selectedId);
    return [...ids];
  }, [activeStep, labelsOn, model.parts, selectedId]);
  const labelIdsRef = useRef<string[]>([]);
  labelIdsRef.current = labelIds;

  // --- three.js scene -------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    } catch (error) {
      onUnavailable?.(error instanceof Error ? error.message : "WebGL is not available");
      return;
    }
    let disposed = false;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const envTarget = pmrem.fromScene(room, 0.04);
    scene.environment = envTarget.texture;
    scene.environmentIntensity = 0.55;
    disposeObject(room);

    const board = buildBoard(model, {
      createCanvas: (width, height) => {
        const c = document.createElement("canvas");
        c.width = width;
        c.height = height;
        return c;
      },
    });
    for (const built of board.parts.values()) {
      if (built.part.stl) built.mesh.visible = false;
    }
    scene.add(board.group);
    applyExplode(board, explodeRef.current / 100);

    // Frame the fully exploded model so nothing leaves the view when exploding.
    const collapsed = boundsAt(board, 0);
    const exploded = boundsAt(board, 1);
    const all = collapsed.clone().union(exploded);
    const size = all.getSize(new THREE.Vector3());
    const center = all.getCenter(new THREE.Vector3());
    const radius = Math.max(size.length() / 2, 10);

    const hemi = new THREE.HemisphereLight("#e8eeff", "#2a2118", 0.9);
    scene.add(hemi);
    const key = new THREE.DirectionalLight("#ffffff", 2.4);
    key.position.set(center.x + radius * 0.9, center.y + radius * 1.6, center.z + radius * 1.2);
    key.target.position.copy(center);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.radius = 4;
    key.shadow.bias = -0.0005;
    const shadowCam = key.shadow.camera;
    shadowCam.left = -radius * 1.4;
    shadowCam.right = radius * 1.4;
    shadowCam.top = radius * 1.4;
    shadowCam.bottom = -radius * 1.4;
    shadowCam.near = radius * 0.2;
    shadowCam.far = radius * 5;
    scene.add(key, key.target);
    const rim = new THREE.DirectionalLight("#a9c1ff", 0.9);
    rim.position.set(center.x - radius * 1.2, center.y + radius * 0.6, center.z - radius * 1.4);
    scene.add(rim);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(radius * 8, radius * 8),
      new THREE.ShadowMaterial({ color: "#000000", opacity: 0.3, depthWrite: false }),
    );
    floor.rotation.x = -Math.PI / 2;
    // The floor sits under the assembled board; exploded parts may pass below it.
    floor.position.set(center.x, collapsed.min.y - 0.2, center.z);
    floor.receiveShadow = true;
    floor.raycast = () => {};
    scene.add(floor);

    const camera = new THREE.PerspectiveCamera(30, 1, Math.max(0.5, radius / 50), radius * 40);
    const direction =
      model.orientation === "flat"
        ? new THREE.Vector3(0.42, 0.95, 0.9).normalize()
        : new THREE.Vector3(1, 0.42, 0.85).normalize();
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.09;
    controls.minDistance = radius * 0.6;
    controls.maxDistance = radius * 6;
    controls.target.copy(center);

    const centers = new Map<string, THREE.Vector3>();
    const computeCenters = () => {
      for (const [id, built] of board.parts) {
        built.mesh.geometry.computeBoundingBox();
        const box = built.mesh.geometry.boundingBox;
        centers.set(id, box ? box.getCenter(new THREE.Vector3()) : new THREE.Vector3());
      }
    };
    computeCenters();

    // Smallest camera distance along `dir` that keeps every corner of `box`
    // inside the frame, with a margin.
    const fitDistance = (box: THREE.Box3, boxCenter: THREE.Vector3, dir: THREE.Vector3) => {
      const vTan = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
      const hTan = vTan * camera.aspect;
      const margin = 0.8;
      const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), dir).normalize();
      const up = new THREE.Vector3().crossVectors(dir, right).normalize();
      let distance = 0;
      for (const x of [box.min.x, box.max.x]) {
        for (const y of [box.min.y, box.max.y]) {
          for (const z of [box.min.z, box.max.z]) {
            const rel = new THREE.Vector3(x, y, z).sub(boxCenter);
            const depth = rel.dot(dir);
            distance = Math.max(
              distance,
              depth + Math.abs(rel.dot(right)) / (hTan * margin),
              depth + Math.abs(rel.dot(up)) / (vTan * margin),
            );
          }
        }
      }
      return distance;
    };

    const collapsedCenter = collapsed.getCenter(new THREE.Vector3());
    // Frame the assembled board tightly and ease out to the exploded bounds
    // as it comes apart, keeping whatever angle the viewer has orbited to.
    const frameFor = (amount: number, dirOverride?: THREE.Vector3) => {
      const dir = (dirOverride ?? camera.position.clone().sub(controls.target)).normalize();
      const t = Math.min(1, Math.max(0, amount));
      const near = fitDistance(collapsed, collapsedCenter, dir);
      const far = fitDistance(all, center, dir);
      const target = collapsedCenter.clone().lerp(center, t);
      const distance = THREE.MathUtils.lerp(near, Math.max(near, far), t);
      controls.target.copy(target);
      camera.position.copy(target).addScaledVector(dir, Math.max(distance, radius * 0.3));
      controls.update();
    };

    const tmp = new THREE.Vector3();
    const updateLabels = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      for (const id of labelIdsRef.current) {
        const el = labelEls.current.get(id);
        const built = board.parts.get(id);
        const local = centers.get(id);
        if (!el || !built || !local) continue;
        tmp.copy(local);
        built.mesh.localToWorld(tmp);
        tmp.project(camera);
        const visible = built.mesh.visible && tmp.z < 1 && Math.abs(tmp.x) < 1.1 && Math.abs(tmp.y) < 1.1;
        const x = ((tmp.x + 1) / 2) * width;
        el.style.opacity = visible ? "1" : "0";
        el.style.transform = `translate(${x}px, ${((1 - tmp.y) / 2) * height}px)`;
        el.dataset.side = x > width * 0.62 ? "left" : "right";
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

    let sized = false;
    const resize = () => {
      const width = Math.max(1, stage.clientWidth);
      const height = Math.max(1, stage.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      if (sized && autoFrame.current) frameFor(explodeRef.current / 100);
      sized = true;
      requestRender();
    };
    resize();
    controls.target.copy(collapsedCenter);
    camera.position.copy(collapsedCenter).add(direction);
    frameFor(explodeRef.current / 100, direction);
    const home = { position: direction.clone(), target: collapsedCenter.clone() };

    const stopAutoFrame = () => {
      autoFrame.current = false;
    };
    canvas.addEventListener("wheel", stopAutoFrame, { passive: true });

    const observer = new ResizeObserver(resize);
    observer.observe(stage);

    ctxRef.current = { renderer, scene, camera, controls, board, home, centers, requestRender, frameFor };
    setReady(true);
    requestRender();

    const stand = model.parts.find((part) => part.stl && part.stlMatrix);
    if (stand?.stl) {
      void import("three/examples/jsm/loaders/STLLoader.js")
        .then(({ STLLoader }) => new STLLoader().loadAsync(stand.stl!))
        .then((geometry) => {
          if (disposed) {
            geometry.dispose();
            return;
          }
          attachStlGeometry(board, stand.id, geometry);
          geometry.dispose();
          computeCenters();
          board.parts.get(stand.id)!.mesh.visible = true;
          requestRender();
        })
        .catch(() => {
          if (disposed) return;
          const built = board.parts.get(stand.id);
          if (built) built.mesh.visible = true;
          requestRender();
        });
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener("wheel", stopAutoFrame);
      controls.removeEventListener("change", requestRender);
      controls.dispose();
      disposeObject(scene);
      envTarget.dispose();
      pmrem.dispose();
      renderer.dispose();
      ctxRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model]);

  // --- explode --------------------------------------------------------------
  useEffect(() => {
    explodeRef.current = explode;
    const ctx = ctxRef.current;
    if (!ctx) return;
    applyExplode(ctx.board, explode / 100);
    if (autoFrame.current) ctx.frameFor(explode / 100);
    ctx.requestRender();
  }, [explode, ready]);

  useEffect(() => () => cancelAnimationFrame(animRef.current), []);

  const animateTo = useCallback((target: number) => {
    cancelAnimationFrame(animRef.current);
    if (prefersReducedMotion()) {
      setExplode(target);
      return;
    }
    const from = explodeRef.current;
    const start = performance.now();
    const duration = 750;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setExplode(from + (target - from) * easeInOutCubic(t));
      if (t < 1) animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
  }, []);

  // --- highlight ------------------------------------------------------------
  const applyHighlights = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const related = activeStep ? new Set(activeStep.partIds) : null;
    for (const [id, built] of ctx.board.parts) {
      let state: PartState = "normal";
      if (related) state = related.has(id) ? "related" : "dimmed";
      if (hover?.id === id && state !== "dimmed") state = "hover";
      if (selectedId === id) state = "selected";
      setPartState(built, state);
    }
    ctx.requestRender();
  }, [activeStep, hover?.id, selectedId]);

  useEffect(() => {
    applyHighlights();
  }, [applyHighlights, ready]);

  useEffect(() => {
    ctxRef.current?.requestRender();
  }, [labelIds]);

  // --- picking --------------------------------------------------------------
  const pick = useCallback((clientX: number, clientY: number): string | null => {
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, ctx.camera);
    const hits = raycaster.intersectObject(ctx.board.group, true);
    for (const hit of hits) {
      let object: THREE.Object3D | null = hit.object;
      while (object && !object.userData.partId) object = object.parent;
      const id = object?.userData.partId as string | undefined;
      if (!id || !object?.visible) continue;
      const built = ctx.board.parts.get(id);
      if (built?.state === "dimmed") continue;
      return id;
    }
    return null;
  }, []);

  const selectPart = useCallback(
    (id: string | null, fromList = false) => {
      setSelectedId((current) => (current === id ? null : id));
      if (!id || !fromList) return;
      const part = partsById.get(id);
      if (part && !OUTSIDE_KINDS.has(part.kind) && explodeRef.current < 30) animateTo(65);
    },
    [animateTo, partsById],
  );

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    pointerDown.current = { x: event.clientX, y: event.clientY };
    if (event.pointerType === "touch") touches.current.add(event.pointerId);
    // Pinch-zoom and panning take over the framing from the auto camera.
    if (touches.current.size > 1 || event.button === 2 || event.ctrlKey || event.metaKey || event.shiftKey) {
      autoFrame.current = false;
    }
  };

  const onPointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    touches.current.delete(event.pointerId);
    const start = pointerDown.current;
    pointerDown.current = null;
    if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6) return;
    const id = pick(event.clientX, event.clientY);
    if (id) {
      setTab("parts");
      selectPart(id);
    } else {
      setSelectedId(null);
    }
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.pointerType !== "mouse" || event.buttons !== 0) return;
    const { clientX, clientY } = event;
    const canvas = canvasRef.current;
    cancelAnimationFrame(hoverFrame.current);
    hoverFrame.current = requestAnimationFrame(() => {
      const id = pick(clientX, clientY);
      if (!id || !canvas) {
        setHover(null);
        return;
      }
      const rect = canvas.getBoundingClientRect();
      setHover({ id, x: clientX - rect.left, y: clientY - rect.top });
    });
  };

  useEffect(() => () => cancelAnimationFrame(hoverFrame.current), []);

  // --- toolbar actions ------------------------------------------------------
  const resetView = () => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    autoFrame.current = true;
    ctx.frameFor(explodeRef.current / 100, ctx.home.position.clone());
    ctx.requestRender();
  };

  const downloadGlb = async () => {
    const ctx = ctxRef.current;
    if (!ctx || exporting) return;
    setExporting(true);
    try {
      for (const built of ctx.board.parts.values()) setPartState(built, "normal");
      const { GLTFExporter } = await import("three/examples/jsm/exporters/GLTFExporter.js");
      const result = await new GLTFExporter().parseAsync(ctx.board.group, { binary: true, onlyVisible: true });
      const blob = new Blob([result as ArrayBuffer], { type: "model/gltf-binary" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${model.deviceId}.glb`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 4000);
    } finally {
      applyHighlights();
      setExporting(false);
    }
  };

  const chooseStep = (step: ModelStep) => {
    const next = activeStepId === step.id ? null : step.id;
    setActiveStepId(next);
    setSelectedId(null);
    if (next && explodeRef.current < 40) animateTo(70);
  };

  const exploded = explode >= 50;
  const hoverPart = hover ? partsById.get(hover.id) : null;

  return (
    <div
      className={styles.viewer}
      data-testid="exploded-viewer"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setSelectedId(null);
          setActiveStepId(null);
        }
      }}
    >
      <div className={styles.main}>
        <div className={styles.stage} ref={stageRef}>
          <canvas
            ref={canvasRef}
            className={styles.canvas}
            data-testid="model-canvas"
            aria-label={`Interactive 3D model of the ${model.name}. Drag to orbit, scroll or pinch to zoom, and pick a part from the list to learn what it does.`}
            role="img"
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerMove={onPointerMove}
            onPointerLeave={() => setHover(null)}
            onPointerCancel={(event) => touches.current.delete(event.pointerId)}
          />
          <div className={styles.hint} aria-hidden="true">
            Drag to orbit · Pinch or scroll to zoom · Tap a part
          </div>
          <div className={styles.dims} aria-hidden="true">
            {dims}
          </div>
          <div className={styles.labels} aria-hidden="true">
            {labelIds.map((id, index) => {
              const part = partsById.get(id);
              if (!part) return null;
              return (
                <div
                  key={id}
                  data-tier={labelIds.length > 3 ? index % 3 : 0}
                  className={`${styles.label} ${id === selectedId ? styles.labelActive : ""}`}
                  ref={(el) => {
                    if (el) labelEls.current.set(id, el);
                    else labelEls.current.delete(id);
                  }}
                >
                  <span className={styles.labelDot} />
                  <span className={styles.labelText}>{part.name}</span>
                </div>
              );
            })}
          </div>
          {hoverPart && hover && !hover.fromList && hover.id !== selectedId ? (
            <div className={styles.tooltip} style={{ transform: `translate(${hover.x + 14}px, ${hover.y + 12}px)` }}>
              <strong>{hoverPart.name}</strong>
              <span>{KIND_LABELS[hoverPart.kind]}</span>
            </div>
          ) : null}
          {!ready ? <div className={styles.loading}>Loading 3D model</div> : null}
        </div>

        <div className={styles.toolbar}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnAccent}`}
            aria-pressed={exploded}
            onClick={() => animateTo(exploded ? 0 : 100)}
            data-testid="explode-toggle"
          >
            {exploded ? "Collapse" : "Explode"}
          </button>
          <label className={styles.slider}>
            <span>Explode</span>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={Math.round(explode)}
              aria-valuetext={`${Math.round(explode)}% exploded`}
              data-testid="explode-slider"
              onChange={(event) => {
                cancelAnimationFrame(animRef.current);
                setExplode(Number(event.target.value));
              }}
            />
            <output aria-live="off">{Math.round(explode)}%</output>
          </label>
          <div className={styles.toolGroup}>
            <button type="button" className={styles.btn} onClick={resetView}>
              Reset view
            </button>
            <button
              type="button"
              className={styles.btn}
              aria-pressed={labelsOn}
              onClick={() => setLabelsOn((value) => !value)}
            >
              {labelsOn ? "Hide labels" : "Show labels"}
            </button>
            <button type="button" className={styles.btn} onClick={downloadGlb} disabled={!ready || exporting}>
              {exporting ? "Preparing .glb" : "Download 3D model (.glb)"}
            </button>
          </div>
        </div>
        <p className={styles.note}>{MODEL_NOTE}</p>
      </div>

      <aside className={styles.side} aria-label={`${model.name} parts`}>
        <div className={styles.lessonCard} aria-live="polite" data-testid="part-lesson">
          {selected ? (
            <>
              <p className={styles.kicker}>{KIND_LABELS[selected.kind]}</p>
              <h3 className={styles.lessonTitle}>{selected.name}</h3>
              <p className={styles.lessonText}>{selected.lesson}</p>
              <div className={styles.tags}>
                {selected.optional ? <span className={styles.tag}>Optional</span> : null}
                {selected.approx ? <span className={styles.tag}>Position is approximate</span> : null}
              </div>
            </>
          ) : activeStep ? (
            <>
              <p className={styles.kicker}>
                Step {activeStep.order}: {activeStep.label}
              </p>
              <p className={styles.lessonText}>{activeStep.instruction}</p>
              <p className={styles.muted}>Highlighted: {activeStep.partIds.map((id) => partsById.get(id)?.name).filter(Boolean).join(", ")}</p>
            </>
          ) : (
            <>
              <p className={styles.kicker}>What&apos;s inside</p>
              <p className={styles.lessonText}>
                Tap a part on the model or in the list to see what it does. Press Explode to pull the layers apart.
              </p>
            </>
          )}
        </div>

        <div className={styles.tabs} role="tablist" aria-label="Viewer panels">
          <button
            type="button"
            role="tab"
            id="tab-parts"
            aria-selected={tab === "parts"}
            aria-controls="panel-parts"
            className={styles.tab}
            onClick={() => setTab("parts")}
          >
            Parts ({model.parts.length})
          </button>
          <button
            type="button"
            role="tab"
            id="tab-steps"
            aria-selected={tab === "steps"}
            aria-controls="panel-steps"
            className={styles.tab}
            onClick={() => setTab("steps")}
          >
            Build steps ({steps.length})
          </button>
        </div>

        {tab === "parts" ? (
          <ul className={styles.partList} id="panel-parts" role="tabpanel" aria-labelledby="tab-parts">
            {model.parts.map((part) => (
              <li key={part.id}>
                <button
                  type="button"
                  className={styles.partButton}
                  aria-pressed={selectedId === part.id}
                  data-part-id={part.id}
                  onClick={() => selectPart(part.id, true)}
                  onMouseEnter={() => setHover({ id: part.id, x: 0, y: 0, fromList: true })}
                  onMouseLeave={() => setHover(null)}
                >
                  <span className={styles.swatch} style={{ background: part.color }} aria-hidden="true" />
                  <span className={styles.partName}>{part.name}</span>
                  <span className={styles.partKind}>{KIND_LABELS[part.kind]}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div id="panel-steps" role="tabpanel" aria-labelledby="tab-steps" className={styles.stepsPanel}>
            <p className={styles.stepsNote}>
              <span className={styles.soon}>Lessons coming soon</span> Pick a step to see the parts it touches.
              Animated step-by-step lessons are next.
            </p>
            {steps.length === 0 ? (
              <p className={styles.muted}>No assembly steps for this board yet.</p>
            ) : (
              <ol className={styles.stepList}>
                {steps.map((step) => (
                  <li key={step.id}>
                    <button
                      type="button"
                      className={styles.stepButton}
                      aria-pressed={activeStepId === step.id}
                      onClick={() => chooseStep(step)}
                    >
                      <span className={styles.stepNum}>{step.order}</span>
                      <span>
                        <strong>
                          {step.label}
                          {step.optional ? <em> (optional)</em> : null}
                        </strong>
                        <span className={styles.stepText}>{step.instruction}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
