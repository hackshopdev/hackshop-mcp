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
const FILM_EXPLODE = 0.7;

function ease(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return clamped < 0.5 ? 4 * clamped ** 3 : 1 - (-2 * clamped + 2) ** 3 / 2;
}

function explodeAt(seconds: number): number {
  if (seconds < 2.8) return 0;
  if (seconds < 6.4) return FILM_EXPLODE * ease((seconds - 2.8) / 3.6);
  if (seconds < 8.8) return FILM_EXPLODE;
  if (seconds < 12.1) return FILM_EXPLODE * (1 - ease((seconds - 8.8) / 3.3));
  return 0;
}

function angleAt(seconds: number): number {
  if (seconds < 2.8) return THREE.MathUtils.lerp(0.36, 0.12, ease(seconds / 2.8));
  if (seconds < 8.8) return THREE.MathUtils.lerp(0.12, -0.62, ease((seconds - 2.8) / 6));
  return THREE.MathUtils.lerp(-0.62, 0.16, ease((seconds - 8.8) / 3.6));
}

function fitDistance(camera: THREE.PerspectiveCamera, box: THREE.Box3, boxCenter: THREE.Vector3, dir: THREE.Vector3): number {
  const vTan = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  const hTan = vTan * camera.aspect;
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
          depth + Math.abs(rel.dot(right)) / (hTan * 0.78),
          depth + Math.abs(rel.dot(up)) / (vTan * 0.78),
        );
      }
    }
  }
  return distance;
}

export function OrbFilm({ model }: { model: BoardModel }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const timelineStart = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(1920, 1080, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.98;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#07090d");
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const env = pmrem.fromScene(room, 0.04);
    scene.environment = env.texture;
    scene.environmentIntensity = 0.62;
    disposeObject(room);

    const board = buildBoard(model, {
      createCanvas: (width, height) => {
        const textureCanvas = document.createElement("canvas");
        textureCanvas.width = width;
        textureCanvas.height = height;
        return textureCanvas;
      },
    });
    scene.add(board.group);

    const hemi = new THREE.HemisphereLight("#dfe7ff", "#17120f", 0.72);
    scene.add(hemi);
    const key = new THREE.DirectionalLight("#fff4e6", 2.35);
    key.position.set(105, 160, 180);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.radius = 5;
    key.shadow.bias = -0.0005;
    scene.add(key);
    const rim = new THREE.DirectionalLight("#879cff", 1.15);
    rim.position.set(-150, 65, -80);
    scene.add(rim);
    const fill = new THREE.RectAreaLight("#baffea", 1.7, 150, 150);
    fill.position.set(-105, 40, 155);
    fill.lookAt(0, 0, 0);
    scene.add(fill);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(560, 560),
      new THREE.ShadowMaterial({ color: "#000000", opacity: 0.42, depthWrite: false }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -92;
    floor.receiveShadow = true;
    scene.add(floor);

    const camera = new THREE.PerspectiveCamera(27, 16 / 9, 0.5, 3000);
    const target = new THREE.Vector3();
    const box = new THREE.Box3();
    const center = new THREE.Vector3();
    const direction = new THREE.Vector3();
    timelineStart.current = performance.now();
    let frame = 0;
    let disposed = false;

    const render = (now: number) => {
      if (disposed) return;
      const rawSeconds = (now - timelineStart.current) / 1000;
      const seconds = rawSeconds % DURATION_SECONDS;
      const amount = explodeAt(seconds);
      applyExplode(board, amount);

      box.setFromObject(board.group);
      box.getCenter(center);
      target.copy(center);
      target.y += amount * 4;
      const angle = angleAt(seconds);
      direction.set(Math.sin(angle) * 0.9, 0.48, Math.cos(angle) * 1.48).normalize();
      const fit = fitDistance(camera, box, target, direction);
      const distance = Math.max(90, fit * 0.76);
      camera.position.copy(target).addScaledVector(direction, distance);
      camera.lookAt(target);
      renderer.render(scene, camera);

      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);

    const stand = model.parts.find((part) => part.stl && part.stlMatrix);
    if (stand?.stl) {
      new STLLoader().loadAsync(stand.stl).then((geometry) => {
        if (disposed) return geometry.dispose();
        attachStlGeometry(board, stand.id, geometry);
        geometry.dispose();
      }).catch(() => undefined);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      disposeObject(scene);
      env.dispose();
      pmrem.dispose();
      renderer.dispose();
    };
  }, [model]);

  return (
    <main className={styles.film}>
      <canvas ref={canvasRef} className={styles.canvas} aria-label="Cinematic 3D teardown of the Muse Desk Orb" />
      <div className={styles.title}>
        <span>Hackshop build 001</span>
        <strong>Muse Desk Orb</strong>
      </div>
      <div className={styles.truth}>Concept render · physical build not yet verified</div>
    </main>
  );
}
