"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { buildHardwareScene, disposeHardwareScene, type HardwareSceneKind } from "@/lib/hardware-preview";
import styles from "./hardware-media.module.css";

type SceneApi = { rotate: (angle: number) => void; zoom: (factor: number) => void; reset: () => void; toggle: (active: boolean) => void };

function addSampleCalendar(model: THREE.Group) {
  const surface = model.getObjectByName("dashboard-surface") as THREE.Mesh | undefined;
  if (!surface) return;
  const canvas = document.createElement("canvas");
  canvas.width = 960;
  canvas.height = 560;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = "#e6eee5"; ctx.fillRect(0, 0, 960, 560);
  ctx.fillStyle = "#163b3c"; ctx.font = "bold 86px system-ui"; ctx.fillText("Your day", 48, 115);
  ctx.font = "28px system-ui"; ctx.fillText("Thursday · sample calendar", 48, 170);
  ["09:00  Coffee + planning", "14:30  Project time", "18:00  Dinner with friends"].forEach((text, i) => {
    ctx.fillStyle = i === 1 ? "#d4a86b" : "#c9d7cb"; ctx.fillRect(48, 213 + i * 86, 864, 70);
    ctx.fillStyle = "#163b3c"; ctx.font = "30px system-ui"; ctx.fillText(text, 72, 258 + i * 86);
  });
  ctx.font = "22px system-ui"; ctx.fillText("Illustrative data · not connected", 48, 533);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  (surface.material as THREE.MeshStandardMaterial).map = texture;
}

export default function HardwareScene({ kind }: { kind: HardwareSceneKind }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const api = useRef<SceneApi | null>(null);
  const [available, setAvailable] = useState(true);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true }); }
    catch { setAvailable(false); return; }
    let disposed = false;
    let frame = 0;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#20292f");
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    const initial = kind === "home" ? new THREE.Vector3(9, 8, 11) : new THREE.Vector3(7, 5.5, 12);
    camera.position.copy(initial);
    const controls = new OrbitControls(camera, canvas);
    controls.target.set(0, kind === "home" ? 0.8 : 2.3, 0);
    controls.enablePan = false;
    controls.minDistance = 5; controls.maxDistance = 25;
    controls.maxPolarAngle = Math.PI * 0.52;
    controls.update();
    scene.add(new THREE.HemisphereLight("#e9f5ff", "#59616b", 3));
    const light = new THREE.DirectionalLight("#fff0d7", 4);
    light.position.set(4, 9, 6); light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024);
    light.shadow.camera.left = -7; light.shadow.camera.right = 7;
    light.shadow.camera.top = 7; light.shadow.camera.bottom = -7;
    scene.add(light);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshStandardMaterial({ color: "#20292f", roughness: 0.9 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    let model = buildHardwareScene(kind, true);
    if (kind === "frame") addSampleCalendar(model);
    scene.add(model);
    const render = () => {
      if (disposed) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => { if (!disposed) renderer.render(scene, camera); });
    };
    const resize = () => {
      const width = stage.clientWidth;
      const height = stage.clientHeight;
      if (!width || !height) return;
      camera.aspect = width / height; camera.updateProjectionMatrix();
      renderer.setSize(width, height, false); render();
    };
    const observer = new ResizeObserver(resize); observer.observe(stage);
    controls.addEventListener("change", render);
    const rotate = (angle: number) => {
      camera.position.sub(controls.target).applyAxisAngle(new THREE.Vector3(0, 1, 0), angle).add(controls.target);
      controls.update(); render();
    };
    const zoom = (factor: number) => {
      const delta = camera.position.clone().sub(controls.target);
      delta.setLength(THREE.MathUtils.clamp(delta.length() * factor, controls.minDistance, controls.maxDistance));
      camera.position.copy(controls.target).add(delta); controls.update(); render();
    };
    api.current = {
      rotate, zoom,
      reset: () => { camera.position.copy(initial); controls.update(); render(); },
      toggle: (value) => {
        scene.remove(model); disposeHardwareScene(model);
        model = buildHardwareScene(kind, value);
        if (kind === "frame") addSampleCalendar(model);
        scene.add(model); render();
      },
    };
    const lost = (event: Event) => { event.preventDefault(); setAvailable(false); };
    canvas.addEventListener("webglcontextlost", lost);
    resize(); setReady(true);
    return () => {
      disposed = true; cancelAnimationFrame(frame); observer.disconnect();
      canvas.removeEventListener("webglcontextlost", lost);
      controls.dispose(); disposeHardwareScene(scene); renderer.dispose(); api.current = null;
    };
  }, [kind]);

  if (!available) return <p role="status">WebGL is unavailable on this browser. The reference photos and planning diagram below remain available; no hardware is connected.</p>;
  const action = kind === "home" ? "Simulate lamp" : kind === "frame" ? "Sample calendar" : "Simulate button event";
  return (
    <div>
      <div ref={stageRef} className={styles.stage}>
        <canvas ref={canvasRef} aria-label={`${kind} illustrative 3D render. Drag to rotate. Use the buttons below, or arrow keys to rotate and plus/minus to zoom.`} tabIndex={0} onKeyDown={(event) => {
          if (["ArrowLeft", "ArrowRight", "+", "=", "-", "Home"].includes(event.key)) event.preventDefault();
          if (event.key === "ArrowLeft") api.current?.rotate(-0.2);
          if (event.key === "ArrowRight") api.current?.rotate(0.2);
          if (event.key === "+" || event.key === "=") api.current?.zoom(0.85);
          if (event.key === "-") api.current?.zoom(1.15);
          if (event.key === "Home") api.current?.reset();
        }} />
        <span className={styles.stageLabel}>Render · simulated</span>
      </div>
      {!ready && <p role="status">Preparing the render…</p>}
      <div className={styles.controls} aria-label="Render controls">
        <button type="button" onClick={() => api.current?.rotate(-0.3)}>Rotate left</button>
        <button type="button" onClick={() => api.current?.rotate(0.3)}>Rotate right</button>
        <button type="button" onClick={() => api.current?.zoom(0.85)}>Zoom in</button>
        <button type="button" onClick={() => api.current?.zoom(1.15)}>Zoom out</button>
        <button type="button" onClick={() => api.current?.reset()}>Reset view</button>
        <button type="button" aria-pressed={active} onClick={() => { api.current?.toggle(!active); setActive(!active); }}>{action}: {active ? "on" : "off"}</button>
      </div>
      <p className={styles.hint}>Drag or use the rotate buttons. Pinch to zoom. Keyboard: left/right, +/−, Home to reset. No automatic motion.</p>
    </div>
  );
}
