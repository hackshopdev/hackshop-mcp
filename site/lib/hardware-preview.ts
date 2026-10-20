import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

export type HardwareSceneKind = "frame" | "home" | "remote";

/** Original, approximate exterior geometry. Never measured CAD or device proof. */
export function buildHardwareScene(kind: HardwareSceneKind, active: boolean): THREE.Group {
  const group = new THREE.Group();
  group.userData = { evidence: "schematic-render", kind };
  const box = (name: string, size: [number, number, number], at: [number, number, number], color: string, radius = 0.08) => {
    const mesh = new THREE.Mesh(
      new RoundedBoxGeometry(...size, 3, Math.min(radius, ...size.map((value) => value / 2))),
      new THREE.MeshStandardMaterial({ color, roughness: 0.65, metalness: 0.15 }),
    );
    mesh.name = name;
    mesh.position.set(...at);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };
  const cylinder = (name: string, radius: number, height: number, at: [number, number, number], color: string) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 40), new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.25 }));
    mesh.name = name;
    mesh.position.set(...at);
    mesh.castShadow = true;
    group.add(mesh);
    return mesh;
  };
  const signalColor = active ? "#ffd38a" : "#38464d";
  if (kind === "frame") {
    box("frame-shell", [5, 3.3, 0.3], [0, 2.1, 0], "#d5cebc");
    box("screen-bezel", [4.56, 2.86, 0.07], [0, 2.1, 0.185], "#1f2529");
    const signal = box("signal", [4.32, 2.62, 0.03], [0, 2.1, 0.23], active ? "#e6eee5" : "#162329");
    signal.userData.active = active;
    box("stand", [0.75, 1.45, 0.12], [0, 1.12, -0.7], "#8b8a83").rotation.x = -0.45;
    box("stand-foot", [1.7, 0.12, 1.2], [0, 0.4, -0.55], "#8b8a83");
    box("separate-microsd", [0.48, 0.64, 0.07], [3.2, 0.47, 0.5], "#252c32").rotation.x = -Math.PI / 2;
    for (let i = 0; i < 5; i++) box(`card-contact-${i}`, [0.045, 0.16, 0.01], [3.05 + i * 0.075, 0.515, 0.35], "#dbb867").rotation.x = -Math.PI / 2;
    const surface = box("dashboard-surface", [3.92, 2.28, 0.005], [0, 2.1, 0.25], "#e6eee5");
    surface.visible = active;
  } else if (kind === "home") {
    box("floor", [6.4, 0.16, 4.5], [0, 0.1, 0], "#aa9985");
    box("back-wall", [6.4, 1.9, 0.12], [0, 1.05, -2.2], "#d8d3c9");
    box("side-wall", [0.12, 1.9, 4.5], [-3.15, 1.05, 0], "#b9bdba");
    box("sofa", [2.4, 0.55, 1.05], [-0.9, 0.5, -0.65], "#5a6b81");
    box("sofa-back", [2.4, 0.6, 0.24], [-0.9, 0.9, -1.1], "#5a6b81");
    box("coffee-table", [1.45, 0.45, 0.8], [-0.9, 0.4, 0.8], "#79533a");
    box("bridge-reference", [0.6, 0.16, 0.6], [2.1, 0.32, 1.4], "#f4f3ee");
    cylinder("lamp-base", 0.32, 0.07, [1.8, 0.24, -0.8], "#333b41");
    cylinder("lamp-stem", 0.045, 1.5, [1.8, 0.95, -0.8], "#333b41");
    const signal = cylinder("signal", 0.39, 0.5, [1.8, 1.85, -0.8], signalColor);
    signal.userData.active = active;
    (signal.material as THREE.MeshStandardMaterial).emissive.set(active ? "#ffb45d" : "#000000");
    (signal.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.5;
    const bulb = new THREE.PointLight("#ffcf8b", active ? 12 : 0, 6, 2);
    bulb.position.set(1.8, 1.6, -0.8);
    group.add(bulb);
  } else {
    const remote = box("remote-body", [1.34, 4.75, 0.26], [-1.2, 2.7, 0], "#969a9f", 0.18);
    remote.rotation.y = -0.1;
    box("glass-front", [1.23, 4.61, 0.09], [-1.2, 2.7, 0.17], "#171b20", 0.15);
    box("touch-surface", [1.18, 1.85, 0.015], [-1.2, 4.03, 0.225], "#42474e", 0.14);
    for (let i = 0; i < 6; i++) {
      const x = -1.48 + (i % 2) * 0.56;
      const y = 2.7 - Math.floor(i / 2) * 0.57;
      if (i === 0) {
        const ring = cylinder("menu-ring", 0.215, 0.035, [x, y, 0.23], "#e7e7df");
        ring.rotation.x = Math.PI / 2;
      }
      const button = cylinder(i === 0 ? "signal" : `button-${i}`, i === 0 ? 0.17 : 0.2, 0.04, [x, y, 0.26], i === 0 ? signalColor : "#343b43");
      button.rotation.x = Math.PI / 2;
      if (i === 0) button.userData.active = active;
    }
    box("linux-host-reference", [1.7, 1.2, 0.9], [1.65, 0.8, 0], "#9aabb6");
    box("host-panel", [1.5, 0.95, 0.03], [1.65, 0.8, 0.47], "#18313b");
    for (let i = 0; i < 3; i++) box(`event-${i}`, [0.9, 0.07, 0.01], [1.65, 1.03 - i * 0.23, 0.5], active ? "#83dfcf" : "#3b626b");
  }
  return group;
}

export function disposeHardwareScene(group: THREE.Object3D): void {
  group.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (material instanceof THREE.MeshStandardMaterial) material.map?.dispose();
        material.dispose();
      }
    }
  });
}
