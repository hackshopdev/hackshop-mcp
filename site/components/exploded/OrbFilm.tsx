"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import {
  applyExplode,
  attachStlGeometry,
  buildBoard,
  disposeObject,
} from "@/lib/models/build";
import type { BoardModel } from "@/lib/models/types";
import styles from "./orb-film.module.css";

const DURATION_SECONDS = 12.4;
const FLOOR_Y = -62;

declare global {
  interface Window {
    __hackshopFilmReady?: boolean;
    __hackshopFilmSetTime?: (seconds: number) => void;
  }
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function ease(value: number): number {
  const t = clamp01(value);
  return t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
}

function fadeIn(seconds: number, start: number, end: number): number {
  return ease((seconds - start) / (end - start));
}

function fadeOut(seconds: number, start: number, end: number): number {
  return 1 - fadeIn(seconds, start, end);
}

function windowed(seconds: number, enter: [number, number], exit: [number, number]): number {
  return fadeIn(seconds, ...enter) * fadeOut(seconds, ...exit);
}

function studioBackground(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1920;
  canvas.height = 1080;
  const context = canvas.getContext("2d")!;

  const base = context.createLinearGradient(0, 0, 1920, 1080);
  base.addColorStop(0, "#171b22");
  base.addColorStop(0.48, "#0b0e14");
  base.addColorStop(1, "#05070b");
  context.fillStyle = base;
  context.fillRect(0, 0, 1920, 1080);

  const violet = context.createRadialGradient(1320, 360, 20, 1320, 360, 760);
  violet.addColorStop(0, "rgba(104, 84, 255, 0.24)");
  violet.addColorStop(0.38, "rgba(61, 50, 152, 0.11)");
  violet.addColorStop(1, "rgba(0, 0, 0, 0)");
  context.fillStyle = violet;
  context.fillRect(0, 0, 1920, 1080);

  const warm = context.createRadialGradient(360, 800, 10, 360, 800, 640);
  warm.addColorStop(0, "rgba(224, 140, 87, 0.14)");
  warm.addColorStop(1, "rgba(0, 0, 0, 0)");
  context.fillStyle = warm;
  context.fillRect(0, 0, 1920, 1080);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function tuneMaterials(board: ReturnType<typeof buildBoard>) {
  const tune = (id: string, fn: (material: THREE.MeshStandardMaterial) => void) => {
    const part = board.parts.get(id);
    if (!part) return;
    for (const material of part.materials) {
      fn(material);
      material.needsUpdate = true;
    }
  };

  tune("case", (material) => {
    material.color.set("#7f8995");
    material.metalness = 0.9;
    material.roughness = 0.2;
    if (material instanceof THREE.MeshPhysicalMaterial) {
      material.clearcoat = 0.65;
      material.clearcoatRoughness = 0.18;
    }
  });
  tune("printed-stand", (material) => {
    material.color.set("#242a35");
    material.metalness = 0.06;
    material.roughness = 0.36;
    if (material instanceof THREE.MeshPhysicalMaterial) {
      material.clearcoat = 0.48;
      material.clearcoatRoughness = 0.25;
    }
  });
  tune("glass", (material) => {
    material.color.set("#394158");
    material.opacity = 0.015;
    material.roughness = 0.03;
    material.envMapIntensity = 0.1;
    if (material instanceof THREE.MeshPhysicalMaterial) {
      material.clearcoat = 0.28;
      material.clearcoatRoughness = 0.025;
    }
  });
  tune("amoled", (material) => {
    material.roughness = material.emissiveMap ? 1 : 0.22;
    material.metalness = 0.02;
    if (material.emissiveMap) {
      material.color.set("#000000");
      material.envMapIntensity = 0;
      material.emissiveIntensity = 0.68;
    }
  });
  for (const id of ["usb-c-device-plug", "usb-c-data-cable", "usb-c-host-plug"]) {
    tune(id, (material) => {
      material.color.set("#151a23");
      material.roughness = 0.68;
    });
  }
}

export function OrbFilm({ model }: { model: BoardModel }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const filmRef = useRef<HTMLElement | null>(null);
  const timelineStart = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const film = filmRef.current;
    if (!canvas || !film) return;

    const fixedTimeline = new URLSearchParams(window.location.search).has("render");
    window.__hackshopFilmReady = false;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(1);
    renderer.setSize(1920, 1080, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.82;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    const scene = new THREE.Scene();
    const background = studioBackground();
    scene.background = background;

    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const environment = pmrem.fromScene(room, 0.04);
    scene.environment = environment.texture;
    scene.environmentIntensity = 0.5;
    disposeObject(room);

    const board = buildBoard(model, {
      createCanvas: (width, height) => {
        const textureCanvas = document.createElement("canvas");
        textureCanvas.width = width;
        textureCanvas.height = height;
        return textureCanvas;
      },
    });
    tuneMaterials(board);

    const rig = new THREE.Group();
    rig.add(board.group);
    scene.add(rig);

    const ambient = new THREE.HemisphereLight("#bcc9ee", "#17110d", 0.4);
    scene.add(ambient);

    const key = new THREE.SpotLight("#fff1df", 520, 760, Math.PI / 4.2, 0.64, 1.35);
    key.position.set(125, 170, 205);
    key.target.position.set(0, -12, 0);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.radius = 5;
    key.shadow.bias = -0.00035;
    scene.add(key, key.target);

    const rim = new THREE.SpotLight("#8878ff", 380, 650, Math.PI / 3.4, 0.72, 1.45);
    rim.position.set(-155, 75, -120);
    rim.target.position.set(0, 2, 0);
    scene.add(rim, rim.target);

    const fill = new THREE.RectAreaLight("#b7d9ff", 2.1, 110, 180);
    fill.position.set(-105, 30, 125);
    fill.lookAt(0, -8, 0);
    scene.add(fill);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(680, 460),
      new THREE.MeshStandardMaterial({ color: "#11161e", roughness: 0.34, metalness: 0.42 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, FLOOR_Y, 8);
    floor.receiveShadow = true;
    scene.add(floor);

    const plinth = new THREE.Mesh(
      new THREE.CylinderGeometry(68, 73, 3.4, 128),
      new THREE.MeshPhysicalMaterial({
        color: "#171d27",
        roughness: 0.22,
        metalness: 0.7,
        clearcoat: 0.55,
        clearcoatRoughness: 0.2,
      }),
    );
    plinth.position.y = FLOOR_Y + 1.7;
    plinth.receiveShadow = true;
    scene.add(plinth);

    const lightRing = new THREE.Mesh(
      new THREE.TorusGeometry(68.4, 0.28, 10, 160),
      new THREE.MeshBasicMaterial({ color: "#7567e8", transparent: true, opacity: 0.6 }),
    );
    lightRing.rotation.x = Math.PI / 2;
    lightRing.position.y = FLOOR_Y + 3.43;
    scene.add(lightRing);

    const camera = new THREE.PerspectiveCamera(31, 16 / 9, 0.5, 3000);
    const target = new THREE.Vector3();
    const direction = new THREE.Vector3();
    const buttonMaterials = board.parts.get("pwr-button")?.materials ?? [];
    const screenMaterials = board.parts.get("amoled")?.materials ?? [];

    let frame = 0;
    let disposed = false;

    const renderAt = (inputSeconds: number) => {
      if (disposed) return;
      const seconds = ((inputSeconds % DURATION_SECONDS) + DURATION_SECONDS) % DURATION_SECONDS;

      let amount = 0;
      let yaw = 0.34;
      let distance = 158;
      let targetY = -12;

      if (seconds < 3.15) {
        const t = ease(seconds / 3.15);
        yaw = THREE.MathUtils.lerp(0.42, 0.06, t);
        distance = THREE.MathUtils.lerp(174, 146, t);
        targetY = THREE.MathUtils.lerp(-15, -9, t);
      } else if (seconds < 4.45) {
        const t = ease((seconds - 3.15) / 1.3);
        amount = 0.86 * t;
        yaw = THREE.MathUtils.lerp(0.06, -0.28, t);
        distance = THREE.MathUtils.lerp(146, 244, t);
        targetY = THREE.MathUtils.lerp(-9, -5, t);
      } else if (seconds < 8.85) {
        const t = ease((seconds - 4.45) / 4.4);
        amount = 0.86;
        yaw = THREE.MathUtils.lerp(-0.28, -0.76, t);
        distance = THREE.MathUtils.lerp(244, 258, t);
        targetY = -5;
      } else if (seconds < 10.15) {
        const t = ease((seconds - 8.85) / 1.3);
        amount = 0.86 * (1 - t);
        yaw = THREE.MathUtils.lerp(-0.76, 0.22, t);
        distance = THREE.MathUtils.lerp(258, 148, t);
        targetY = THREE.MathUtils.lerp(-5, -8, t);
      } else {
        const t = ease((seconds - 10.15) / 2.25);
        yaw = THREE.MathUtils.lerp(0.22, 0.08, t);
        distance = THREE.MathUtils.lerp(148, 138, t);
        targetY = THREE.MathUtils.lerp(-8, -5, t);
      }

      applyExplode(board, amount);
      rig.rotation.y = Math.sin(seconds * 0.34) * 0.025;
      target.set(0, targetY, 0);
      direction.set(Math.sin(yaw) * 0.95, 0.17, Math.cos(yaw) * 1.42).normalize();
      camera.position.copy(target).addScaledVector(direction, distance);
      camera.lookAt(target);

      const success = fadeIn(seconds, 10.15, 10.85);
      const pulse = success * (0.55 + Math.sin((seconds - 10.15) * Math.PI * 2.1) * 0.22);
      for (const material of buttonMaterials) {
        material.emissive.set("#ff9368");
        material.emissiveIntensity = pulse;
      }
      for (const material of screenMaterials) {
        if (material.emissiveMap) material.emissiveIntensity = 0.66 + success * 0.16;
      }
      (lightRing.material as THREE.MeshBasicMaterial).opacity = 0.34 + amount * 0.34 + success * 0.2;

      const heroOpacity = windowed(seconds, [0.12, 0.62], [2.65, 3.3]);
      const anatomyOpacity = windowed(seconds, [3.35, 4.05], [8.45, 9.25]);
      const successOpacity = fadeIn(seconds, 9.7, 10.35);
      film.style.setProperty("--hero-opacity", heroOpacity.toFixed(4));
      film.style.setProperty("--anatomy-opacity", anatomyOpacity.toFixed(4));
      film.style.setProperty("--success-opacity", successOpacity.toFixed(4));
      film.style.setProperty("--timeline", (seconds / DURATION_SECONDS).toFixed(4));
      film.style.setProperty("--anatomy-shift", `${Math.round((1 - anatomyOpacity) * 18)}px`);
      film.style.setProperty("--success-shift", `${Math.round((1 - successOpacity) * 20)}px`);

      renderer.render(scene, camera);
    };

    timelineStart.current = performance.now();
    const animate = (now: number) => {
      renderAt((now - timelineStart.current) / 1000);
      frame = requestAnimationFrame(animate);
    };

    window.__hackshopFilmSetTime = renderAt;
    renderAt(0);
    if (!fixedTimeline) frame = requestAnimationFrame(animate);

    const stand = model.parts.find((part) => part.stl && part.stlMatrix);
    const standReady = stand?.stl
      ? new STLLoader().loadAsync(stand.stl).then((geometry) => {
          if (disposed) return geometry.dispose();
          attachStlGeometry(board, stand.id, geometry);
          geometry.dispose();
          tuneMaterials(board);
          renderAt(0);
        }).catch(() => undefined)
      : Promise.resolve();
    standReady.finally(() => {
      if (!disposed) window.__hackshopFilmReady = true;
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      delete window.__hackshopFilmSetTime;
      delete window.__hackshopFilmReady;
      disposeObject(scene);
      background.dispose();
      environment.dispose();
      pmrem.dispose();
      renderer.dispose();
    };
  }, [model]);

  return (
    <main ref={filmRef} className={styles.film}>
      <canvas ref={canvasRef} className={styles.canvas} aria-label="Cinematic 3D teardown of the Muse Desk Orb" />

      <div className={styles.identity}>
        <span className={styles.buildNumber}>001</span>
        <span>hackshop / Muse body</span>
      </div>

      <section className={`${styles.sceneCopy} ${styles.heroCopy}`}>
        <p>Give Muse a place on your desk.</p>
        <h1>Muse Desk Orb</h1>
        <span>Hear · touch · show</span>
      </section>

      <section className={`${styles.sceneCopy} ${styles.anatomyCopy}`}>
        <p>Built to be understood.</p>
        <h2>19 inspectable pieces</h2>
        <div className={styles.partRail}>
          <span>Touch + AMOLED</span>
          <span>Dual microphone</span>
          <span>ESP32-S3</span>
          <span>Speaker</span>
          <span>Battery</span>
          <span>USB-C data</span>
        </div>
      </section>

      <section className={`${styles.sceneCopy} ${styles.successCopy}`}>
        <p>The first proof</p>
        <h2>Hold. Ask. See the answer.</h2>
        <span>One working loop before any extras.</span>
      </section>

      <div className={styles.truth}>Concept render · physical build not yet verified</div>
      <div className={styles.progress} aria-hidden="true"><span /></div>
    </main>
  );
}
