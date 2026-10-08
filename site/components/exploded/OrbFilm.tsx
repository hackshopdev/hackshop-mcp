"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { FIDELITY_LABELS, PHYSICAL_LABELS } from "@/lib/models/assembly-experience";
import { sampleChoreography, type AssemblyPackage } from "@/lib/models/assembly-package";
import {
  applyExplode,
  applyPartExplode,
  attachStlGeometry,
  buildBoard,
  disposeObject,
} from "@/lib/models/build";
import type { BoardModel } from "@/lib/models/types";
import styles from "./orb-film.module.css";

const DURATION_SECONDS = 12.4;
export type BuildFilmVariant = "orb" | "voice-node";

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

function tuneMaterials(board: ReturnType<typeof buildBoard>, variant: BuildFilmVariant) {
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
  if (variant === "voice-node") {
    tune("respeaker-cad", (material) => {
      material.color.set("#1c2525");
      material.metalness = 0.14;
      material.roughness = 0.34;
      material.envMapIntensity = 0.78;
    });
    tune("speaker", (material) => {
      material.color.set("#12171d");
      material.metalness = 0.03;
      material.roughness = 0.42;
    });
    tune("speaker-cone", (material) => {
      material.color.set("#050709");
      material.metalness = 0.08;
      material.roughness = 0.3;
    });
    for (const id of ["acrylic-top", "acrylic-base"]) {
      tune(id, (material) => {
        material.color.set("#222c34");
        material.metalness = 0.08;
        material.roughness = 0.25;
        if (material instanceof THREE.MeshPhysicalMaterial) {
          material.clearcoat = 0.74;
          material.clearcoatRoughness = 0.18;
        }
      });
    }
    tune("xiao-antenna", (material) => {
      material.color.set("#183a33");
      material.roughness = 0.48;
    });
    for (const id of ["xiao-usb-plug", "usb-data-cable"]) {
      tune(id, (material) => {
        material.color.set("#141a22");
        material.roughness = 0.62;
      });
    }
  }
}

function railLabel(component: AssemblyPackage["components"][number]): string {
  if (component.handling === "sealed") return `${component.name} · sealed`;
  const fidelity = FIDELITY_LABELS[component.fidelity];
  return `${component.name} · ${fidelity[0]!.toLowerCase()}${fidelity.slice(1)}`;
}

export function OrbFilm({
  model,
  variant = "orb",
  assembly,
}: {
  model: BoardModel;
  variant?: BuildFilmVariant;
  /** When set, explode choreography and copy come from the assembly package. */
  assembly?: AssemblyPackage;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const filmRef = useRef<HTMLElement | null>(null);
  const timelineStart = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const film = filmRef.current;
    if (!canvas || !film) return;

    const search = new URLSearchParams(window.location.search);
    const fixedTimeline = search.has("render");
    const requestedTime = Number(search.get("time") ?? "0");
    const initialSeconds = Number.isFinite(requestedTime) ? requestedTime : 0;
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
    tuneMaterials(board, variant);
    const floorY = variant === "voice-node" ? -29 : -62;

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
    floor.position.set(0, floorY, 8);
    floor.receiveShadow = true;
    scene.add(floor);

    const plinth = new THREE.Mesh(
      variant === "voice-node"
        ? new THREE.BoxGeometry(148, 3.4, 94, 8, 1, 8)
        : new THREE.CylinderGeometry(68, 73, 3.4, 128),
      new THREE.MeshPhysicalMaterial({
        color: "#171d27",
        roughness: 0.22,
        metalness: 0.7,
        clearcoat: 0.55,
        clearcoatRoughness: 0.2,
      }),
    );
    plinth.position.y = floorY + 1.7;
    plinth.receiveShadow = true;
    scene.add(plinth);

    const lightRing = new THREE.Mesh(
      variant === "voice-node"
        ? new THREE.BoxGeometry(146, 0.32, 92)
        : new THREE.TorusGeometry(68.4, 0.28, 10, 160),
      new THREE.MeshBasicMaterial({ color: "#7567e8", transparent: true, opacity: 0.6 }),
    );
    if (variant === "orb") lightRing.rotation.x = Math.PI / 2;
    lightRing.position.y = floorY + 3.43;
    scene.add(lightRing);

    const camera = new THREE.PerspectiveCamera(31, 16 / 9, 0.5, 3000);
    const target = new THREE.Vector3();
    const direction = new THREE.Vector3();
    const partComponent = new Map(
      assembly?.components.flatMap((component) => component.partIds.map((id) => [id, component.id] as const)) ?? [],
    );
    const buttonMaterials = board.parts.get("pwr-button")?.materials ?? [];
    const screenMaterials = board.parts.get("amoled")?.materials ?? [];

    let frame = 0;
    let disposed = false;

    const renderAt = (inputSeconds: number) => {
      if (disposed) return;
      const seconds = ((inputSeconds % DURATION_SECONDS) + DURATION_SECONDS) % DURATION_SECONDS;

      let amount = 0;
      let yaw = variant === "voice-node" ? 0.62 : 0.34;
      let distance = variant === "voice-node" ? 225 : 158;
      let targetY = variant === "voice-node" ? 1 : -12;
      let subjectX = variant === "voice-node" ? 28 : 34;

      if (seconds < 3.15) {
        const t = ease(seconds / 3.15);
        yaw = THREE.MathUtils.lerp(variant === "voice-node" ? 0.7 : 0.42, 0.06, t);
        distance = THREE.MathUtils.lerp(variant === "voice-node" ? 270 : 215, variant === "voice-node" ? 228 : 190, t);
        targetY = THREE.MathUtils.lerp(variant === "voice-node" ? 5 : -15, variant === "voice-node" ? 1 : -9, t);
        subjectX = THREE.MathUtils.lerp(variant === "voice-node" ? -20 : -38, variant === "voice-node" ? -34 : -46, t);
      } else if (seconds < 4.45) {
        const t = ease((seconds - 3.15) / 1.3);
        amount = 0.86 * t;
        yaw = THREE.MathUtils.lerp(0.06, -0.28, t);
        distance = THREE.MathUtils.lerp(variant === "voice-node" ? 228 : 190, variant === "voice-node" ? 292 : 254, t);
        targetY = THREE.MathUtils.lerp(variant === "voice-node" ? 1 : -9, variant === "voice-node" ? 3 : -5, t);
        subjectX = THREE.MathUtils.lerp(variant === "voice-node" ? -34 : -46, variant === "voice-node" ? 28 : 34, t);
      } else if (seconds < 8.85) {
        const t = ease((seconds - 4.45) / 4.4);
        amount = 0.86;
        yaw = THREE.MathUtils.lerp(-0.28, -0.76, t);
        distance = THREE.MathUtils.lerp(variant === "voice-node" ? 292 : 254, variant === "voice-node" ? 302 : 266, t);
        targetY = variant === "voice-node" ? 3 : -5;
      } else if (seconds < 10.15) {
        const t = ease((seconds - 8.85) / 1.3);
        amount = 0.86 * (1 - t);
        yaw = THREE.MathUtils.lerp(-0.76, 0.22, t);
        distance = THREE.MathUtils.lerp(variant === "voice-node" ? 302 : 266, variant === "voice-node" ? 232 : 190, t);
        targetY = THREE.MathUtils.lerp(variant === "voice-node" ? 3 : -5, variant === "voice-node" ? 1 : -8, t);
      } else {
        const t = ease((seconds - 10.15) / 2.25);
        yaw = THREE.MathUtils.lerp(0.22, 0.08, t);
        distance = THREE.MathUtils.lerp(variant === "voice-node" ? 232 : 190, variant === "voice-node" ? 218 : 178, t);
        targetY = THREE.MathUtils.lerp(variant === "voice-node" ? 1 : -8, variant === "voice-node" ? 3 : -5, t);
      }

      if (assembly) {
        const sample = sampleChoreography(assembly, inputSeconds);
        applyPartExplode(board, (id) => sample.amounts[partComponent.get(id) ?? ""] ?? 0);
        amount = Math.max(0, ...Object.values(sample.amounts));
        film.dataset.filmState = sample.stateId;
      } else {
        applyExplode(board, amount);
      }
      rig.position.x = subjectX;
      plinth.position.x = subjectX;
      lightRing.position.x = subjectX;
      rig.rotation.y = Math.sin(seconds * 0.34) * 0.025;
      target.set(0, targetY, 0);
      direction
        .set(
          Math.sin(yaw) * 0.95,
          variant === "voice-node" ? 0.62 : 0.17,
          Math.cos(yaw) * 1.42,
        )
        .normalize();
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
    renderAt(initialSeconds);
    if (!fixedTimeline) frame = requestAnimationFrame(animate);

    const stlParts = model.parts.filter((part) => part.stl && part.stlMatrix);
    const stlReady = Promise.all(
      stlParts.map((part) =>
        new STLLoader()
          .loadAsync(part.stl!)
          .then((geometry) => {
            if (disposed) return geometry.dispose();
            attachStlGeometry(board, part.id, geometry);
            geometry.dispose();
            tuneMaterials(board, variant);
            renderAt(initialSeconds);
          })
          .catch(() => undefined),
      ),
    );
    stlReady.finally(() => {
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
  }, [assembly, model, variant]);

  return (
    <main
      ref={filmRef}
      className={styles.film}
      data-film-state={assembly ? sampleChoreography(assembly, 0).stateId : undefined}
    >
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        aria-label={
          variant === "voice-node"
            ? "Cinematic 3D assembly of the Muse reSpeaker Voice Node"
            : "Cinematic 3D teardown of the Muse Desk Orb"
        }
      />

      <div className={styles.identity}>
        <span className={styles.buildNumber}>{variant === "voice-node" ? "002" : "001"}</span>
        <span>hackshop / Muse body</span>
      </div>

      <section className={`${styles.sceneCopy} ${styles.heroCopy}`}>
        <p>{variant === "voice-node" ? "Build Muse a voice of its own." : "Give Muse a place on your desk."}</p>
        <h1>{variant === "voice-node" ? "Muse Voice Node" : "Muse Desk Orb"}</h1>
        <span>{variant === "voice-node" ? "Hear · press · connect" : "Hear · touch · show"}</span>
      </section>

      <section className={`${styles.sceneCopy} ${styles.anatomyCopy}`}>
        <p>{variant === "voice-node" ? "Five physical assemblies." : "Three physical assemblies."}</p>
        <h2>{variant === "voice-node" ? "Real CAD where it matters." : "Built to fit, not to pretend."}</h2>
        <div className={styles.partRail}>
          {variant === "voice-node" ? (
            <>
              <span>Official board CAD</span>
              <span>Pre-soldered XIAO</span>
              <span>5 W speaker path</span>
              <span>Self-assembled acrylic</span>
              <span>XIAO USB data path</span>
            </>
          ) : assembly ? (
            assembly.components.map((component) => (
              <span key={component.id} data-film-component={component.id}>
                {railLabel(component)}
              </span>
            ))
          ) : (
            <>
              <span>Purchased 55 mm Orb</span>
              <span>Generated stand CAD</span>
              <span>USB-C data path</span>
              <span>Buttons stay clear</span>
            </>
          )}
        </div>
      </section>

      <section className={`${styles.sceneCopy} ${styles.successCopy}`}>
        <p>The first proof</p>
        <h2>{variant === "voice-node" ? "Hold. Ask. Read the reply." : "Hold. Ask. See the answer."}</h2>
        <span>One working loop before any extras.</span>
      </section>

      <div className={styles.truth}>
        {assembly
          ? `Concept render · ${PHYSICAL_LABELS[assembly.evidence.physical]}`
          : "Concept render · physical build not yet verified"}
      </div>
      <div className={styles.progress} aria-hidden="true"><span /></div>
    </main>
  );
}
