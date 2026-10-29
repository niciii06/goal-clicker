import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import type { WalkoutHair, WalkoutPresentation } from "./walkout-data";

/*
 * The 3D walkout: a rigged CC0 character (Quaternius Universal Base Characters) walks out of the tunnel with
 * real skeletal animations (Universal Animation Library). The kit is painted in the shader from the rest pose
 * position of each vertex, so one model wears every club's colours; skin and hair are tinted the same way.
 * Assets live in /public/walkout (see scripts/walkout-assets.mjs).
 */

const ASSETS = "/walkout";

type Body = "men" | "women";
/** Bone landmarks of the two bodies in their T pose, in metres. */
const LANDMARKS: Record<Body, { torsoX: number; armY: number; sleeveX: number; wristX: number; neckY: number; hipY: number; kneeY: number; ankleY: number; sideZ: number; headTop: number }> = {
  men: { torsoX: 0.185, armY: 1.455, sleeveX: 0.35, wristX: 0.69, neckY: 1.505, hipY: 0.985, kneeY: 0.542, ankleY: 0.086, sideZ: -0.03, headTop: 1.81 },
  women: { torsoX: 0.14, armY: 1.418, sleeveX: 0.27, wristX: 0.625, neckY: 1.47, hipY: 0.96, kneeY: 0.535, ankleY: 0.071, sideZ: -0.03, headTop: 1.767 },
};

type HairPiece = "simpleparted" | "buzzed" | "buzzedfemale" | "long" | "buns";
/** The pack has five hair pieces; every hair style of the game uses the closest one, afros and curls get a volume. */
export function hairPiece(hair: WalkoutHair, body: Body): { piece?: HairPiece; volume?: "afro" | "curls" } {
  switch (hair) {
    case "bald": return {};
    case "afro": return { piece: body === "women" ? "buzzedfemale" : "buzzed", volume: "afro" };
    case "curls": case "twists": return { piece: body === "women" ? "buzzedfemale" : "buzzed", volume: "curls" };
    case "buzz": case "fade": case "waves": case "receding": return { piece: body === "women" ? "buzzedfemale" : "buzzed" };
    case "long": case "mane": case "locs": case "braids": case "bob": return { piece: "long" };
    case "bun": case "pony": return { piece: "buns" };
    default: return { piece: body === "women" ? "long" : "simpleparted" };
  }
}

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const cache = new Map<string, Promise<GLTF>>();
function load(name: string) {
  let entry = cache.get(name);
  if (!entry) {
    entry = loader.loadAsync(`${ASSETS}/${name}.glb`);
    entry.catch(() => cache.delete(name));
    cache.set(name, entry);
  }
  return entry;
}
const color = (value: string | undefined, fallback: string) => new THREE.Color(value || fallback);

/** The chest print: crest, a small maker's mark and the rating as the shirt number. */
function chestPrint(p: WalkoutPresentation, rating: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 512; canvas.height = 384;
  const g = canvas.getContext("2d")!;
  g.fillStyle = p.kitSecondary;
  g.textAlign = "center";
  g.font = "900 190px system-ui, Arial, sans-serif";
  g.lineWidth = 6;
  g.strokeStyle = "rgba(0,0,0,.25)";
  g.strokeText(String(rating), 256, 340);
  g.fillText(String(rating), 256, 340);
  // Crest on the player's left chest (the viewer's right).
  g.beginPath(); g.moveTo(352, 40); g.lineTo(412, 40); g.lineTo(412, 84); g.quadraticCurveTo(410, 112, 382, 126); g.quadraticCurveTo(354, 112, 352, 84); g.closePath(); g.fill();
  g.fillStyle = p.kitPrimary; g.globalAlpha = 0.85;
  g.beginPath(); g.moveTo(364, 52); g.lineTo(400, 52); g.lineTo(400, 82); g.quadraticCurveTo(398, 100, 382, 110); g.quadraticCurveTo(366, 100, 364, 82); g.closePath(); g.fill();
  g.globalAlpha = 1; g.fillStyle = p.kitSecondary;
  g.beginPath(); g.moveTo(100, 92); g.quadraticCurveTo(128, 112, 168, 52); g.quadraticCurveTo(136, 96, 100, 92); g.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function kitMaterial(material: THREE.MeshStandardMaterial, p: WalkoutPresentation, body: Body, print: THREE.Texture, shell = false) {
  const l = LANDMARKS[body];
  const uniforms = {
    uSkin: { value: color(p.skin, "#c4885d") },
    uSkinRef: { value: new THREE.Vector3(0.405, 0.17, 0.08) },
    uPrimary: { value: color(p.kitPrimary, "#d71920") },
    uSecondary: { value: color(p.kitSecondary, "#ffffff") },
    uBoots: { value: color(p.boots, "#111111") },
    uBootAccent: { value: color(p.boots, "#111111").getHSL({ h: 0, s: 0, l: 0 }).l > 0.55 ? new THREE.Color("#16181d") : new THREE.Color("#f2f4f7") },
    uGloves: { value: color(p.gloves, "#f1f3f6") },
    uKeeper: { value: p.keeper ? 1 : 0 },
    uTattoo: { value: new THREE.Vector2(p.tattoo === "left" || p.tattoo === "both" ? 1 : 0, p.tattoo === "right" || p.tattoo === "both" ? 1 : 0) },
    uStubble: { value: !p.body && (p.beard === "stubble" || p.beard === "short" || p.beard === "full" || p.beard === "goatee" || p.beard === "chinstrap") ? (p.beard === "stubble" ? 0.45 : 0.75) : 0 },
    uHair: { value: color(p.hairColor, "#2c1d15") },
    uPrint: { value: print },
    uL1: { value: new THREE.Vector4(l.torsoX, l.armY, l.sleeveX, l.wristX) },
    uL2: { value: new THREE.Vector4(l.neckY, l.hipY, l.kneeY, l.ankleY) },
    uSideZ: { value: l.sideZ },
  };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vRest;${shell ? "\nattribute vec3 aRest;" : ""}`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>\nvRest = ${shell ? "aRest" : "position"};`);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>
varying vec3 vRest;
uniform vec3 uSkin, uPrimary, uSecondary, uBoots, uBootAccent, uGloves, uHair, uSkinRef;
uniform float uKeeper, uStubble, uSideZ;
uniform vec4 uL1, uL2;
uniform vec2 uTattoo;
uniform sampler2D uPrint;`)
      .replace("#include <map_fragment>", `#include <map_fragment>
float cloth = 0.0;
float shine = 0.0;
{
  vec3 p = vRest;
  float ax = abs(p.x);
  vec3 skin = uSkin * clamp(diffuseColor.rgb / uSkinRef, 0.0, 1.7);
  vec3 outColor = skin;
  bool arm = ax > uL1.x && p.y > uL1.y - 0.16;
  float sleeve = uKeeper > 0.5 ? uL1.w - 0.015 : uL1.z;
  if (arm) {
    if (ax < sleeve) { outColor = ax > sleeve - 0.018 ? uSecondary : uPrimary; cloth = 1.0; }
    else if (uKeeper > 0.5) { outColor = ax < sleeve + 0.035 ? uSecondary : uGloves; cloth = 1.0; }
    else if ((p.x > 0.0 ? uTattoo.x : uTattoo.y) > 0.5 && ax < uL1.w - 0.03) {
      // A tattoo sleeve: swirls and bands of ink from the sleeve to the wrist.
      float ink = smoothstep(0.55, 0.75, sin(ax * 140.0 + sin(p.z * 90.0) * 2.0) * sin(p.y * 120.0 + ax * 40.0) + 0.35);
      ink = max(ink, step(abs(ax - (uL1.w - 0.06)), 0.004));
      outColor = mix(outColor, vec3(0.05, 0.07, 0.11), ink * 0.6);
    }
  } else if (p.y > uL2.y - 0.035) {
    float neck = length(vec2(p.x, p.z + 0.03)) < 0.085 ? (p.z > -0.01 ? uL2.x - 0.022 - max(0.0, 0.05 - ax) * 0.8 : uL2.x - 0.012) : uL2.x + 0.035;
    if (p.y < neck) {
      cloth = 1.0;
      outColor = p.y > neck - 0.014 ? uSecondary : uPrimary;
      if (abs(p.z - uSideZ) < 0.02 && ax > 0.08 && p.y < uL1.y - 0.07) outColor = uSecondary;
      if (p.z > 0.03) {
        vec2 uv = vec2((p.x + 0.16) / 0.32, (p.y - (uL1.y - 0.32)) / 0.24);
        if (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) { vec4 t = texture2D(uPrint, uv); outColor = mix(outColor, t.rgb, t.a); }
      }
    } else if (uStubble > 0.0 && p.z > 0.035 && p.y < uL2.x + 0.165 && p.y > uL2.x + 0.04) {
      // Stubble and beards shade the jaw and upper lip in the hair colour.
      float lips = smoothstep(0.012, 0.024, abs(p.y - (uL2.x + 0.122))) + step(0.03, ax);
      float jaw = smoothstep(uL2.x + 0.165, uL2.x + 0.14, p.y) * clamp(lips, 0.0, 1.0);
      outColor = mix(outColor, uHair * 0.6, jaw * uStubble);
    }
  } else if (p.y > uL2.z + 0.17) {
    cloth = 1.0;
    outColor = uSecondary;
    if (abs(p.z - uSideZ) < 0.014 && ax > 0.13) outColor = uPrimary;
  } else if (p.y > uL2.z - 0.05) {
    outColor = skin;
  } else if (p.y > uL2.w + 0.045) {
    cloth = 1.0;
    outColor = p.y > uL2.z - 0.09 ? uSecondary : uPrimary;
  } else {
    cloth = 1.0; shine = 1.0;
    outColor = uBoots;
    // A dark sole and a stripe across the outside of the boot.
    if (abs(p.y - 0.032 - (p.z - 0.02) * 0.32) < 0.007 && p.y > 0.016 && ax > 0.1) outColor = uBootAccent;
    if (p.y < 0.016) outColor = mix(uBoots, vec3(0.02), 0.8);
  }
  diffuseColor.rgb = outColor;
}
${shell ? "if (cloth < 0.5) discard;" : ""}`)
      .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, mix(0.82, 0.38, shine), cloth);")
      .replace("#include <normal_fragment_maps>", "#include <normal_fragment_maps>\nnormal = normalize(mix(normal, nonPerturbedNormal, cloth * 0.7));");
  };
  if (shell) material.normalMap = null;
  material.customProgramCacheKey = () => `walkout-kit-${body}-${shell}`;
  material.needsUpdate = true;
}

/**
 * The clothes as a shell over the body: the kit parts of the mesh, pushed out along their normals and skinned to
 * the same bones. The shirt hangs looser towards the hem, the shorts flare, socks cover shin pads, boots smooth
 * the toes. Triangles that cross from one garment into the next are left out, so the hems stay clean edges.
 */
function clothShell(geometry: THREE.BufferGeometry, body: Body, keeper: boolean) {
  const l = LANDMARKS[body];
  const position = geometry.attributes.position as THREE.BufferAttribute;
  const normal = geometry.attributes.normal as THREE.BufferAttribute;
  const garment = (x: number, y: number, z: number): [number, number] | null => {
    const ax = Math.abs(x);
    if (ax > l.torsoX && y > l.armY - 0.16) {
      const end = keeper ? l.wristX - 0.015 : l.sleeveX;
      return ax < end ? [1, 0.008 + 0.01 * Math.min(1, (ax - l.torsoX) / (end - l.torsoX))] : null;
    }
    if (y > l.hipY - 0.035) {
      const neck = Math.hypot(x, z + 0.03) < 0.085 ? (z > -0.01 ? l.neckY - 0.022 - Math.max(0, 0.05 - ax) * 0.8 : l.neckY - 0.012) : l.neckY + 0.035;
      return y < neck - 0.003 ? [1, 0.007 + 0.022 * Math.min(1, Math.max(0, (l.armY - 0.22 - y) / 0.4))] : null;
    }
    if (y > l.kneeY + 0.17) return [2, 0.012 + 0.03 * Math.min(1, (l.hipY - 0.035 - y) / (l.hipY - l.kneeY - 0.2))];
    if (y > l.kneeY - 0.05) return null;
    if (y > l.ankleY + 0.045) return [3, 0.004 + (z > 0 && y < l.kneeY - 0.1 && y > l.ankleY + 0.12 ? 0.005 : 0)];
    return [4, 0.006];
  };
  const parts = Array.from({ length: position.count }, (_, i) => garment(position.getX(i), position.getY(i), position.getZ(i)));
  const index = geometry.index;
  const triangles: number[] = [];
  const count = index ? index.count : position.count;
  for (let i = 0; i < count; i += 3) {
    const a = index ? index.getX(i) : i, b = index ? index.getX(i + 1) : i + 1, c = index ? index.getX(i + 2) : i + 2;
    const pa = parts[a], pb = parts[b], pc = parts[c];
    // Hems are cut per pixel in the shader, so a triangle joins as soon as one corner is clothed.
    if (pa || pb || pc) triangles.push(a, b, c);
  }
  // Plain copies of the attributes: the loader may hand out interleaved buffers.
  const shell = new THREE.BufferGeometry();
  for (const [name, attribute] of Object.entries(geometry.attributes)) {
    const source = attribute as THREE.BufferAttribute;
    const copy = new THREE.BufferAttribute(new (source.array.constructor as Float32ArrayConstructor)(source.count * source.itemSize), source.itemSize, source.normalized);
    for (let i = 0; i < source.count; i += 1) for (let c = 0; c < source.itemSize; c += 1) copy.setComponent(i, c, source.getComponent(i, c));
    shell.setAttribute(name, copy);
  }
  shell.setIndex(triangles);
  const moved = shell.attributes.position as THREE.BufferAttribute;
  shell.setAttribute("aRest", moved.clone());
  for (let i = 0; i < moved.count; i += 1) {
    const offset = parts[i]?.[1] ?? 0.004;
    moved.setXYZ(i, position.getX(i) + normal.getX(i) * offset, position.getY(i) + normal.getY(i) * offset, position.getZ(i) + normal.getZ(i) * offset);
  }
  return shell;
}

/** Hair, beards and brows: the pack's grey strands, tinted to the player's hair colour. */
function hairMaterial(material: THREE.MeshStandardMaterial, hair: THREE.Color) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uHairColor = { value: hair };
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform vec3 uHairColor;")
      .replace("#include <map_fragment>", "#include <map_fragment>\ndiffuseColor.rgb = uHairColor * clamp(dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)) / 0.3, 0.35, 1.6);");
  };
  material.customProgramCacheKey = () => "walkout-hair";
  material.roughness = 0.7;
  material.needsUpdate = true;
}

/** A curly volume (afro or curls) on the head bone, drawn as a bumpy sphere. */
function hairVolume(kind: "afro" | "curls", hair: THREE.Color, body: Body) {
  const geometry = new THREE.IcosahedronGeometry(kind === "afro" ? 0.15 : 0.112, 5);
  const position = geometry.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < position.count; i += 1) {
    v.fromBufferAttribute(position, i);
    const n = v.clone().normalize();
    const bump = 1 + 0.06 * Math.sin(n.x * 41) * Math.sin(n.y * 37) * Math.sin(n.z * 43);
    // Flatten the back and cut the face side so the volume sits on the skull.
    v.multiplyScalar(bump);
    if (n.z > 0.35 && n.y < 0.15) v.z -= (n.z - 0.35) * (kind === "afro" ? 0.12 : 0.08);
    position.setXYZ(i, v.x, v.y, v.z);
  }
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({ color: hair, roughness: 0.95 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(0, LANDMARKS[body].headTop - (kind === "afro" ? 0.07 : 0.075), kind === "afro" ? -0.03 : -0.012);
  mesh.scale.set(kind === "afro" ? 1.05 : 0.95, kind === "afro" ? 0.92 : 0.72, kind === "afro" ? 1.02 : 1.05);
  return mesh;
}

/** Signature pieces: Ronaldinho's headband, Čech's skull cap, Davids' glasses and a backwards cap. */
function accessories(p: WalkoutPresentation, body: Body) {
  const top = LANDMARKS[body].headTop;
  const items: THREE.Mesh[] = [];
  if (p.headband) {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.098, 0.1, 0.026, 40, 1, true), new THREE.MeshStandardMaterial({ color: p.headband, roughness: 0.8, side: THREE.DoubleSide }));
    band.position.set(0, top - 0.072, -0.012);
    band.rotation.x = -0.12;
    band.scale.set(1, 1, 1.12);
    items.push(band);
  }
  if (p.helmet) {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.12, 40, 20, 0, Math.PI * 2, 0, Math.PI * 0.6), new THREE.MeshStandardMaterial({ color: "#1e2026", roughness: 0.55 }));
    cap.position.set(0, top - 0.098, -0.02);
    cap.rotation.x = -0.22;
    cap.scale.set(0.98, 1.04, 1.1);
    items.push(cap);
  }
  if (p.glasses) {
    const frame = new THREE.MeshStandardMaterial({ color: "#111111", roughness: 0.35 });
    for (const side of [-1, 1]) {
      const lens = new THREE.Mesh(new THREE.TorusGeometry(0.019, 0.0028, 8, 24), frame);
      lens.position.set(side * 0.034, top - 0.108, 0.098);
      lens.scale.set(1.15, 0.85, 1);
      items.push(lens);
    }
  }
  if (p.cap) {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.106, 36, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), new THREE.MeshStandardMaterial({ color: p.kitSecondary, roughness: 0.7 }));
    cap.position.set(0, top - 0.075, -0.012);
    cap.scale.set(1, 0.8, 1.12);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.006, 24, 1, false, Math.PI * 0.6, Math.PI * 0.8), cap.material);
    brim.position.set(0, top - 0.08, -0.07);
    items.push(cap, brim);
  }
  return items;
}

export type Walkout3DTimeline = { appearAt: number; arriveAt: number; celebrateAt: number };

export type Walkout3D = { dispose: () => void };

/**
 * Builds the scene into the canvas and plays the walkout. Times are seconds after `start`; the CSS stage around
 * the canvas keeps its own timeline (flag, position, rating, name), so both use the same delays.
 */
export async function createWalkout3D(canvas: HTMLCanvasElement, p: WalkoutPresentation, rating: number, timeline: Walkout3DTimeline, reducedMotion: boolean): Promise<Walkout3D> {
  const body: Body = p.body === "women" ? "women" : "men";
  const hairInfo = hairPiece(p.hair, body);
  const beard = body === "men" && (p.beard === "full" || p.beard === "short");
  const [bodyGltf, clips, hairGltf, beardGltf] = await Promise.all([
    load(`body-${body}`), load("clips"),
    hairInfo.piece ? load(`hair-${hairInfo.piece}`) : null,
    beard ? load("hair-beard") : null,
  ]);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 60);
  scene.add(new THREE.HemisphereLight(0xcfdcff, 0x1a1f28, 0.9));
  const key = new THREE.SpotLight(0xfff4e6, 60, 30, Math.PI / 6, 0.6, 1.6);
  key.position.set(1.8, 5.5, 4.5);
  key.target.position.set(0, 0.8, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.0004;
  scene.add(key, key.target);
  const rimLeft = new THREE.DirectionalLight(0x7fb8ff, 2.2);
  rimLeft.position.set(-3, 2.5, -3);
  const rimRight = new THREE.DirectionalLight(0xffd9a0, 1.6);
  rimRight.position.set(3, 2, -2.5);
  const fill = new THREE.DirectionalLight(0xffffff, 0.6);
  fill.position.set(-2, 1.5, 4);
  scene.add(rimLeft, rimRight, fill);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.45 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const player = bodyGltf.scene.clone(true);
  // SkinnedMesh clones need their skeleton rebound to the cloned bones.
  const bones = new Map<string, THREE.Bone>();
  player.traverse((o) => { if ((o as THREE.Bone).isBone) bones.set(o.name, o as THREE.Bone); });
  const rebind = (mesh: THREE.SkinnedMesh) => {
    const skeleton = new THREE.Skeleton(mesh.skeleton.bones.map((bone) => bones.get(bone.name) ?? bone), mesh.skeleton.boneInverses);
    mesh.bind(skeleton, mesh.bindMatrix);
  };
  const print = chestPrint(p, rating);
  const hairColor = color(p.hairColor, "#2c1d15");
  const disposables: { dispose: () => void }[] = [print];
  const shells: [THREE.Object3D, THREE.SkinnedMesh][] = [];
  const bodyMaterialSource = (mesh: THREE.SkinnedMesh) => mesh.userData.sourceMaterial as THREE.MeshStandardMaterial;
  player.traverse((o) => {
    const mesh = o as THREE.SkinnedMesh;
    if (!mesh.isSkinnedMesh) return;
    rebind(mesh);
    mesh.userData.sourceMaterial = mesh.material;
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    const material = (mesh.material as THREE.MeshStandardMaterial).clone();
    mesh.material = material;
    disposables.push(material);
    if (/Hair/i.test(material.name)) hairMaterial(material, hairColor);
    else if (!/Eye/i.test(material.name)) {
      kitMaterial(material, p, body, print);
      const shellMaterial = (bodyMaterialSource(mesh)).clone();
      kitMaterial(shellMaterial, p, body, print, true);
      const shell = new THREE.SkinnedMesh(clothShell(mesh.geometry, body, Boolean(p.keeper)), shellMaterial);
      shell.position.copy(mesh.position); shell.quaternion.copy(mesh.quaternion); shell.scale.copy(mesh.scale);
      shell.bind(mesh.skeleton, mesh.bindMatrix);
      shell.castShadow = true;
      shell.frustumCulled = false;
      shells.push([mesh.parent!, shell]);
      disposables.push(shellMaterial, shell.geometry);
    }
  });
  for (const [parent, shell] of shells) parent.add(shell);
  for (const extra of [hairGltf, beardGltf]) {
    if (!extra) continue;
    extra.scene.clone(true).traverse((o) => {
      const mesh = o as THREE.SkinnedMesh;
      if (!mesh.isSkinnedMesh) return;
      const piece = mesh.clone() as THREE.SkinnedMesh;
      rebind(piece);
      piece.castShadow = true;
      piece.frustumCulled = false;
      const material = (piece.material as THREE.MeshStandardMaterial).clone();
      piece.material = material;
      disposables.push(material);
      hairMaterial(material, hairColor);
      player.add(piece);
    });
  }
  // Hair volumes and accessories are placed in the T pose and then follow the head bone.
  const head = bones.get("Head");
  player.updateMatrixWorld(true);
  const onHead = (mesh: THREE.Mesh) => {
    mesh.castShadow = true;
    player.add(mesh);
    mesh.updateMatrixWorld(true);
    head?.attach(mesh);
    disposables.push(mesh.geometry, mesh.material as THREE.Material);
  };
  if (hairInfo.volume) onHead(hairVolume(hairInfo.volume, hairColor, body));
  for (const accessory of accessories(p, body)) onHead(accessory);
  // Height and build of the player, around the feet.
  player.scale.set(p.build, p.height, p.build);
  scene.add(player);

  const mixer = new THREE.AnimationMixer(player);
  const clip = (name: string) => clips.animations.find((a) => a.name === name);
  const walk = mixer.clipAction(clip("Walk_Formal_Loop") ?? clip("Walk_Loop")!);
  const idle = mixer.clipAction(clip("Idle_Loop")!);
  const air = clip("Jump_Loop") ? mixer.clipAction(clip("Jump_Loop")!) : null;
  const celebrate = celebrationPose(p.celebration, bones, player);

  const resize = () => {
    const width = canvas.clientWidth || 1, height = canvas.clientHeight || 1;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    // Narrow phone stages step the camera back so the figure leaves room for the rating and the name.
    const distance = 5.7 * Math.max(1, Math.sqrt(1.3 / camera.aspect));
    camera.position.set(0, 1.1, distance);
    camera.lookAt(0, 1.04, 0);
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();

  const startZ = -6;
  const start = performance.now();
  let last = start;
  let frame = 0;
  let disposed = false;
  let phase: "hidden" | "walk" | "idle" = "hidden";
  let current: THREE.AnimationAction | null = null;
  const switchTo = (action: THREE.AnimationAction, fade: number) => {
    if (current === action) return;
    action.reset().play();
    if (current) current.crossFadeTo(action, fade, false);
    current = action;
  };
  const tick = (now: number) => {
    if (disposed) return;
    const t = (now - start) / 1000;
    const dt = Math.min(Math.max(now - last, 0) / 1000, 0.05);
    last = now;
    player.position.y = 0;
    player.rotation.y = 0;
    if (reducedMotion || t >= timeline.arriveAt) {
      player.visible = true;
      player.position.z = 0;
      if (phase !== "idle") { phase = "idle"; switchTo(idle, reducedMotion ? 0 : 0.45); }
    } else if (t < timeline.appearAt) {
      player.visible = false;
    } else {
      player.visible = true;
      if (phase !== "walk") { phase = "walk"; switchTo(walk, 0); }
      const k = (t - timeline.appearAt) / (timeline.arriveAt - timeline.appearAt);
      // Slows down towards the end of the tunnel like a player taking his place.
      player.position.z = startZ * (1 - k) ** 2;
      walk.timeScale = 0.9 + (1 - k) * 0.4;
    }
    const ct = reducedMotion ? -1 : t - timeline.celebrateAt;
    // Jumps borrow the legs of the airborne clip while the player is off the ground.
    if (air && (p.celebration === "jump" || p.celebration === "siu") && ct > 0) switchTo(ct < celebrationAirTime(p.celebration) ? air : idle, 0.15);
    mixer.update(dt);
    if (ct > 0) celebrate(ct);
    renderer.render(scene, camera);
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);

  return {
    dispose: () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      mixer.stopAllAction();
      for (const item of disposables) item.dispose();
      floor.geometry.dispose();
      (floor.material as THREE.Material).dispose();
      renderer.dispose();
    },
  };
}

const celebrationAirTime = (celebration: WalkoutPresentation["celebration"]) => (celebration === "siu" ? 0.75 : 1.5);

/**
 * Football celebrations on top of the idle animation: the arm bones are aimed in the player's own space and
 * blended in, the body jumps and turns for the jump and the "Siu".
 */
function celebrationPose(celebration: WalkoutPresentation["celebration"], bones: Map<string, THREE.Bone>, player: THREE.Object3D) {
  const a = new THREE.Vector3(), b = new THREE.Vector3(), dir = new THREE.Vector3();
  const q = new THREE.Quaternion(), world = new THREE.Quaternion(), parent = new THREE.Quaternion(), identity = new THREE.Quaternion();
  const aim = (boneName: string, childName: string, target: [number, number, number], weight: number) => {
    const bone = bones.get(boneName), child = bones.get(childName);
    if (!bone || !child || !bone.parent || weight <= 0) return;
    bone.getWorldPosition(a);
    child.getWorldPosition(b);
    dir.set(...target).normalize().applyQuaternion(player.quaternion);
    q.setFromUnitVectors(b.sub(a).normalize(), dir);
    q.copy(identity.clone().slerp(q, weight));
    bone.getWorldQuaternion(world);
    bone.parent.getWorldQuaternion(parent);
    bone.quaternion.copy(parent.invert().multiply(q.multiply(world)));
    bone.updateMatrixWorld(true);
  };
  // x is the player's left, y up, z towards the camera.
  const arm = (side: "l" | "r", upper: [number, number, number], lower: [number, number, number], weight: number) => {
    const s = side === "l" ? 1 : -1;
    aim(`upperarm_${side}`, `lowerarm_${side}`, [upper[0] * s, upper[1], upper[2]], weight);
    aim(`lowerarm_${side}`, `hand_${side}`, [lower[0] * s, lower[1], lower[2]], weight);
  };
  const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
  return (ct: number) => {
    const w = ease(ct / 0.45);
    switch (celebration) {
      case "arms":
        arm("l", [0.55, 0.8, 0.18], [0.35, 0.92, 0.12], w);
        arm("r", [0.55, 0.8, 0.18], [0.35, 0.92, 0.12], w);
        break;
      case "fist": {
        // Two pumps of the right fist, then held.
        const pump = ct < 1.4 ? Math.abs(Math.sin(ct * Math.PI * 1.45)) : 1;
        arm("r", [0.75, 0.45 + 0.25 * pump, 0.3], [0.1, 1, 0.15], w);
        break;
      }
      case "point":
        arm("r", [0.18, 0.96, 0.18], [0.12, 0.98, 0.14], w);
        arm("l", [0.25, -0.2, 0.95], [0.05, 0.1, 1], w * 0.85);
        break;
      case "jump": {
        const hop = ct < 1.5 ? Math.max(0, Math.sin((ct / 0.75) * Math.PI)) : 0;
        player.position.y = hop * 0.38;
        arm("l", [0.45, 0.85, 0.2], [0.3, 0.94, 0.12], w);
        arm("r", [0.45, 0.85, 0.2], [0.3, 0.94, 0.12], w);
        break;
      }
      case "siu": {
        // Jump, a full turn in the air, land with the arms thrown wide and down.
        const k = Math.min(1, ct / 0.75);
        player.position.y = ct < 0.75 ? Math.sin(k * Math.PI) * 0.5 : 0;
        player.rotation.y = ease(k) * Math.PI * 2;
        const land = ease((ct - 0.7) / 0.25);
        arm("l", [0.5 + 0.4 * land, 0.6 - 1.05 * land, 0.3], [0.6, 0.6 - 1.2 * land, 0.3], w);
        arm("r", [0.5 + 0.4 * land, 0.6 - 1.05 * land, 0.3], [0.6, 0.6 - 1.2 * land, 0.3], w);
        break;
      }
      default:
        // Calm: a short clap of the hands in front of the chest.
        if (ct < 2) {
          const clap = Math.abs(Math.sin(ct * Math.PI * 2.4));
          arm("l", [0.25, -0.35, 0.9], [-0.35 - 0.3 * clap, 0.45, 0.8], w * (1 - ease((ct - 1.6) / 0.4)));
          arm("r", [0.25, -0.35, 0.9], [-0.35 - 0.3 * clap, 0.45, 0.8], w * (1 - ease((ct - 1.6) / 0.4)));
        }
    }
  };
}
