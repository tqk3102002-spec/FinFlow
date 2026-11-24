import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

let cachedSoftwareGl: boolean | null = null;
let cachedWebGlAvailable: boolean | null = null;

export interface StudioPalette {
  bg: number;
  keyColor: number;
  keyIntensity: number;
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  rimColor: number;
  rimIntensity: number;
  exposure: number;
  gold: number;
  emerald: number;
  slate: number;
  crimson: number;
  crystalTint: number;
  crystalAttenuation: number;
  edgeLine: number;
}

export const STUDIO_PALETTES: Record<'light' | 'dark', StudioPalette> = {
  light: {
    bg: 0xf4f2ec,
    keyColor: 0xfff5e4,
    keyIntensity: 2.35,
    hemiSky: 0xdce8e6,
    hemiGround: 0xd2cbc0,
    hemiIntensity: 1.1,
    rimColor: 0x38b29a,
    rimIntensity: 1.05,
    exposure: 1.08,
    gold: 0xc28a36,
    emerald: 0x0e5a4f,
    slate: 0x2d5b78,
    crimson: 0xbe123c,
    crystalTint: 0xf7fbfa,
    crystalAttenuation: 0xc5e8df,
    edgeLine: 0xb47b2b,
  },
  dark: {
    bg: 0x111722,
    keyColor: 0xfff0d4,
    keyIntensity: 2.45,
    hemiSky: 0x2a4554,
    hemiGround: 0x0b0f16,
    hemiIntensity: 1.0,
    rimColor: 0x38b29a,
    rimIntensity: 1.35,
    exposure: 1.14,
    gold: 0xe2b05e,
    emerald: 0x38b29a,
    slate: 0x5b92b3,
    crimson: 0xfb7185,
    crystalTint: 0xeaf7f4,
    crystalAttenuation: 0x6fd0bc,
    edgeLine: 0xe2b05e,
  },
};

export function isWebGLAvailable(): boolean {
  if (cachedWebGlAvailable !== null) return cachedWebGlAvailable;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    cachedWebGlAvailable = Boolean(gl);
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    cachedWebGlAvailable = false;
  }
  return cachedWebGlAvailable;
}

export function detectSoftwareWebGL(): boolean {
  if (cachedSoftwareGl !== null) return cachedSoftwareGl;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) {
      cachedSoftwareGl = true;
      return true;
    }
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) ?? '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    cachedSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    cachedSoftwareGl = true;
  }
  return cachedSoftwareGl;
}

export interface BrushedTextures {
  roughnessMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  dispose: () => void;
}

export function createBrushedMetalTextures(maxAnisotropy: number): BrushedTextures {
  const size = 256;
  let seed = 4219;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d');

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d');

  if (rCtx && bCtx) {
    rCtx.fillStyle = '#484848';
    rCtx.fillRect(0, 0, size, size);
    bCtx.fillStyle = '#808080';
    bCtx.fillRect(0, 0, size, size);

    for (let y = 0; y < size; y++) {
      const base = 58 + Math.floor(rand() * 34);
      rCtx.fillStyle = `rgb(${base},${base},${base})`;
      rCtx.fillRect(0, y, size, 1);

      const bumpBase = 116 + Math.floor(rand() * 24);
      bCtx.fillStyle = `rgb(${bumpBase},${bumpBase},${bumpBase})`;
      bCtx.fillRect(0, y, size, 1);

      const streaks = 2 + Math.floor(rand() * 3);
      for (let s = 0; s < streaks; s++) {
        const sx = Math.floor(rand() * size);
        const sw = 18 + Math.floor(rand() * 88);
        const v = 46 + Math.floor(rand() * 58);
        rCtx.fillStyle = `rgba(${v},${v},${v},0.35)`;
        rCtx.fillRect(sx, y, sw, 1);
      }
    }
  }

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(2, 2);
  roughnessMap.colorSpace = THREE.NoColorSpace;
  roughnessMap.anisotropy = Math.min(8, maxAnisotropy);
  roughnessMap.needsUpdate = true;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(2, 2);
  bumpMap.colorSpace = THREE.NoColorSpace;
  bumpMap.anisotropy = Math.min(8, maxAnisotropy);
  bumpMap.needsUpdate = true;

  return {
    roughnessMap,
    bumpMap,
    dispose: () => {
      roughnessMap.dispose();
      bumpMap.dispose();
    },
  };
}

export function createStudioRenderer(
  container: HTMLElement,
  isSoftwareGl: boolean,
  alpha = false
) {
  const renderer = new THREE.WebGLRenderer({
    antialias: !isSoftwareGl,
    powerPreference: 'high-performance',
    alpha,
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));

  const width = Math.max(1, container.clientWidth);
  const height = Math.max(1, container.clientHeight);
  renderer.setSize(width, height, false);
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.display = 'block';
  container.appendChild(renderer.domElement);

  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const roomEnv = new RoomEnvironment();
  const envRenderTarget = pmremGenerator.fromScene(roomEnv, 0.04);
  roomEnv.dispose();
  pmremGenerator.dispose();

  return {
    renderer,
    envRenderTarget,
    envTexture: envRenderTarget.texture,
  };
}

export interface EmblemLightRig {
  applyTheme: (isDark: boolean, renderer: THREE.WebGLRenderer) => void;
}

export function createEmblemLighting(scene: THREE.Scene, isDark: boolean): EmblemLightRig {
  const p = isDark ? STUDIO_PALETTES.dark : STUDIO_PALETTES.light;

  const keyLight = new THREE.DirectionalLight(p.keyColor, p.keyIntensity);
  keyLight.position.set(3.8, 4.6, 4.2);
  scene.add(keyLight);

  const hemiLight = new THREE.HemisphereLight(p.hemiSky, p.hemiGround, p.hemiIntensity);
  scene.add(hemiLight);

  const rimLight = new THREE.DirectionalLight(p.rimColor, p.rimIntensity);
  rimLight.position.set(-4.2, 2.8, -3.5);
  scene.add(rimLight);

  return {
    applyTheme(nextDark: boolean, renderer: THREE.WebGLRenderer) {
      const next = nextDark ? STUDIO_PALETTES.dark : STUDIO_PALETTES.light;
      keyLight.color.setHex(next.keyColor);
      keyLight.intensity = next.keyIntensity;
      hemiLight.color.setHex(next.hemiSky);
      hemiLight.groundColor.setHex(next.hemiGround);
      hemiLight.intensity = next.hemiIntensity;
      rimLight.color.setHex(next.rimColor);
      rimLight.intensity = next.rimIntensity;
      renderer.toneMappingExposure = next.exposure;
    },
  };
}

export type FeatureEmblemKind = 'NAV' | 'MARKET' | 'BUDGET' | 'SECURITY';

export interface FeatureEmblemHandle {
  group: THREE.Group;
  updateMotion: (
    dt: number,
    elapsed: number,
    isHovered: boolean,
    pointerX: number,
    pointerY: number,
    reducedMotion: boolean
  ) => void;
  getExplodeProgress: () => number;
  applyTheme: (isDark: boolean) => void;
}

// Module-scope reusable scratch object to keep render-loop GC at zero
const _instanceDummy = new THREE.Object3D();

function makeCrystalMaterial(palette: StudioPalette, isSoftwareGl: boolean) {
  return new THREE.MeshPhysicalMaterial({
    color: palette.crystalTint,
    metalness: 0.04,
    roughness: 0.06,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    ior: 1.66,
    thickness: 1.25,
    attenuationColor: new THREE.Color(palette.crystalAttenuation),
    attenuationDistance: 1.5,
    transmission: isSoftwareGl ? 0 : 0.86,
    transparent: true,
    opacity: isSoftwareGl ? 0.46 : 1.0,
    depthWrite: false,
    envMapIntensity: 1.45,
  });
}

function makeBrushedMetalMaterial(
  colorHex: number,
  brushedTextures: BrushedTextures,
  roughness = 0.22
) {
  return new THREE.MeshPhysicalMaterial({
    color: colorHex,
    metalness: 0.92,
    roughness,
    anisotropy: 0.82,
    roughnessMap: brushedTextures.roughnessMap,
    bumpMap: brushedTextures.bumpMap,
    bumpScale: 0.006,
    emissive: new THREE.Color(colorHex),
    emissiveIntensity: 0.08,
    envMapIntensity: 1.25,
  });
}

/**
 * 1. NAV Vault Core — Split Crystal Prism Caps + Expanding Dual Gimbal Rings + Radial Cardinal Nodes + Hidden Calibration Halo
 */
function createNavVaultEmblem(
  isDark: boolean,
  isSoftwareGl: boolean,
  brushedTextures: BrushedTextures
): FeatureEmblemHandle {
  const p = isDark ? STUDIO_PALETTES.dark : STUDIO_PALETTES.light;
  const group = new THREE.Group();

  const goldMat = makeBrushedMetalMaterial(p.gold, brushedTextures, 0.2);
  const emeraldMat = makeBrushedMetalMaterial(p.emerald, brushedTextures, 0.24);
  const crystalMat = makeCrystalMaterial(p, isSoftwareGl);

  // Outer gimbal ring + 4 instanced cardinal diamond nodes that flare radially on hover
  const outerRingGroup = new THREE.Group();
  const outerRing = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.04, 14, 72), goldMat);
  outerRingGroup.add(outerRing);

  const markerGeo = new THREE.OctahedronGeometry(0.085, 0);
  const markers = new THREE.InstancedMesh(markerGeo, goldMat, 4);
  markers.frustumCulled = false;
  const updateMarkers = (explode: number) => {
    const r = 1.1 + explode * 0.38;
    const s = 1 + explode * 0.28;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      _instanceDummy.position.set(Math.cos(a) * r, Math.sin(a) * r, 0);
      _instanceDummy.rotation.set(0, explode * 0.5, a);
      _instanceDummy.scale.setScalar(s);
      _instanceDummy.updateMatrix();
      markers.setMatrixAt(i, _instanceDummy.matrix);
    }
    markers.instanceMatrix.needsUpdate = true;
  };
  updateMarkers(0);
  markers.computeBoundingSphere();
  outerRingGroup.add(markers);
  group.add(outerRingGroup);

  // Inner meridian ring that expands outward on hover
  const innerRingGroup = new THREE.Group();
  const innerRing = new THREE.Mesh(new THREE.TorusGeometry(0.84, 0.032, 12, 64), emeraldMat);
  innerRing.rotation.y = Math.PI / 2;
  innerRingGroup.add(innerRing);
  group.add(innerRingGroup);

  // Equatorial calibration halo revealed as the crystal caps separate
  const coreHalo = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.018, 12, 64), goldMat);
  coreHalo.rotation.x = Math.PI / 2;
  group.add(coreHalo);

  // Inner faceted metallic emerald heart
  const heartGeo = new THREE.OctahedronGeometry(0.35, 0);
  heartGeo.scale(1, 1.28, 1);
  const heartMesh = new THREE.Mesh(heartGeo, emeraldMat);
  group.add(heartMesh);

  // Split upper & lower faceted crystal pyramid caps (nested flush at rest, lifting apart ±Y on hover)
  const crystalRig = new THREE.Group();
  const capGeo = new THREE.ConeGeometry(0.62, 0.82, 4);
  const capEdgesGeo = new THREE.EdgesGeometry(capGeo, 15);
  const edgeMat = new THREE.LineBasicMaterial({
    color: p.edgeLine,
    transparent: true,
    opacity: isDark ? 0.52 : 0.36,
  });

  const upperCap = new THREE.Mesh(capGeo, crystalMat);
  upperCap.position.y = 0.41;
  upperCap.renderOrder = 4;
  upperCap.add(new THREE.LineSegments(capEdgesGeo, edgeMat));

  const lowerCap = new THREE.Mesh(capGeo, crystalMat);
  lowerCap.rotation.x = Math.PI;
  lowerCap.position.y = -0.41;
  lowerCap.renderOrder = 4;
  lowerCap.add(new THREE.LineSegments(capEdgesGeo, edgeMat));

  crystalRig.add(upperCap, lowerCap);
  group.add(crystalRig);

  let explodeFactor = 0;
  let spinAccum = 0;

  return {
    group,
    getExplodeProgress: () => explodeFactor,
    updateMotion(dt, elapsed, isHovered, pointerX, pointerY, reducedMotion) {
      const targetExplode = isHovered ? 1 : 0;
      explodeFactor = THREE.MathUtils.damp(explodeFactor, targetExplode, 6.2, dt);

      // Subtle overall breath scale combined with dramatic per-part separation
      group.scale.setScalar(1 + explodeFactor * 0.16);

      // Separate crystal caps vertically to reveal the glowing core + equatorial halo
      const capOffset = 0.41 + explodeFactor * 0.38;
      upperCap.position.y = capOffset;
      lowerCap.position.y = -capOffset;

      // Expand outer gimbal ring, inner meridian ring, and equatorial halo
      outerRing.scale.setScalar(1 + explodeFactor * 0.18);
      innerRing.scale.setScalar(1 + explodeFactor * 0.22);
      coreHalo.scale.setScalar(0.65 + explodeFactor * 0.65);
      heartMesh.scale.setScalar(1 + explodeFactor * 0.16);
      updateMarkers(explodeFactor);

      const speed = reducedMotion ? 0 : isHovered ? 1.55 : 0.45;
      spinAccum += dt * speed;

      const targetTiltX = isHovered ? pointerY * 0.34 : 0.16;
      const targetTiltY = isHovered ? pointerX * 0.4 : 0;
      group.rotation.x = THREE.MathUtils.damp(group.rotation.x, targetTiltX, 6.0, dt);
      group.rotation.y = THREE.MathUtils.damp(group.rotation.y, targetTiltY, 6.0, dt);

      outerRingGroup.rotation.x = 0.55 + spinAccum * 0.65 + explodeFactor * 0.28;
      outerRingGroup.rotation.y = spinAccum * 0.85;
      innerRingGroup.rotation.z = -0.45 - spinAccum * 0.72 - explodeFactor * 0.25;
      innerRingGroup.rotation.y = -spinAccum * 0.95;
      crystalRig.rotation.y = spinAccum * 0.8;
      coreHalo.rotation.z = spinAccum * 1.1;
      heartMesh.rotation.y = -spinAccum * 1.25;
      if (!reducedMotion) {
        group.position.y = Math.sin(elapsed * 1.6) * 0.055;
      }

      emeraldMat.emissiveIntensity = THREE.MathUtils.damp(
        emeraldMat.emissiveIntensity,
        isHovered ? 0.32 : 0.08,
        6,
        dt
      );
      goldMat.emissiveIntensity = THREE.MathUtils.damp(
        goldMat.emissiveIntensity,
        isHovered ? 0.26 : 0.06,
        6,
        dt
      );
    },
    applyTheme(nextDark) {
      const next = nextDark ? STUDIO_PALETTES.dark : STUDIO_PALETTES.light;
      goldMat.color.setHex(next.gold);
      goldMat.emissive.setHex(next.gold);
      emeraldMat.color.setHex(next.emerald);
      emeraldMat.emissive.setHex(next.emerald);
      crystalMat.color.setHex(next.crystalTint);
      crystalMat.attenuationColor.setHex(next.crystalAttenuation);
      edgeMat.color.setHex(next.edgeLine);
      edgeMat.opacity = nextDark ? 0.52 : 0.36;
    },
  };
}

/**
 * 2. Market Equilibrium Helix — Dual Spreading Ribbons + Radially Flaring Crystal Lot Diamonds + Equilibrium Rings
 */
function createMarketHelixEmblem(
  isDark: boolean,
  isSoftwareGl: boolean,
  brushedTextures: BrushedTextures
): FeatureEmblemHandle {
  const p = isDark ? STUDIO_PALETTES.dark : STUDIO_PALETTES.light;
  const group = new THREE.Group();

  const emeraldMat = makeBrushedMetalMaterial(p.emerald, brushedTextures, 0.2);
  const goldMat = makeBrushedMetalMaterial(p.gold, brushedTextures, 0.22);
  const crystalMat = makeCrystalMaterial(p, isSoftwareGl);

  const helixRoot = new THREE.Group();
  helixRoot.rotation.z = -0.32;
  group.add(helixRoot);

  // Build intertwined 3D market & average-cost ribbon curves
  const ptsA: THREE.Vector3[] = [];
  const ptsB: THREE.Vector3[] = [];
  const steps = 28;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const angle = t * Math.PI * 2.3;
    const y = (t - 0.5) * 1.9;
    const r = 0.5 + Math.sin(t * Math.PI) * 0.2;
    ptsA.push(new THREE.Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r));
    ptsB.push(new THREE.Vector3(Math.cos(angle + Math.PI) * r, y, Math.sin(angle + Math.PI) * r));
  }

  const curveA = new THREE.CatmullRomCurve3(ptsA);
  const curveB = new THREE.CatmullRomCurve3(ptsB);
  const ribbonA = new THREE.Mesh(new THREE.TubeGeometry(curveA, 64, 0.044, 12, false), emeraldMat);
  const ribbonB = new THREE.Mesh(new THREE.TubeGeometry(curveB, 64, 0.034, 12, false), goldMat);
  helixRoot.add(ribbonA, ribbonB);

  // Subtle equilibrium axis spindle + 3 calibration collars
  const spindleMat = new THREE.MeshStandardMaterial({
    color: p.slate,
    metalness: 0.78,
    roughness: 0.42,
  });
  const spindle = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 2.02, 8), spindleMat);
  helixRoot.add(spindle);

  const collarGeo = new THREE.TorusGeometry(0.24, 0.014, 10, 48);
  const collars: THREE.Mesh[] = [];
  [-0.58, 0, 0.58].forEach((cy) => {
    const collar = new THREE.Mesh(collarGeo, goldMat);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = cy;
    helixRoot.add(collar);
    collars.push(collar);
  });

  // 5 Floating Faceted Crystal Lot Nodes that flare radially outward on hover
  const lotNodes: Array<{
    mesh: THREE.Group;
    basePos: THREE.Vector3;
    outDir: THREE.Vector3;
    phase: number;
  }> = [];
  const crystalGeo = new THREE.OctahedronGeometry(0.175, 0);
  crystalGeo.scale(1, 1.28, 1);
  const coreGeo = new THREE.OctahedronGeometry(0.082, 0);
  coreGeo.scale(1, 1.28, 1);

  for (let i = 0; i < 5; i++) {
    const t = 0.14 + (i / 4) * 0.72;
    const pos = curveA.getPoint(t);
    const radial = new THREE.Vector3(pos.x, 0, pos.z);
    if (radial.lengthSq() < 1e-4) {
      radial.set(1, 0, 0);
    } else {
      radial.normalize();
    }
    const node = new THREE.Group();
    node.position.copy(pos);
    const inner = new THREE.Mesh(coreGeo, i % 2 === 0 ? goldMat : emeraldMat);
    const outer = new THREE.Mesh(crystalGeo, crystalMat);
    outer.renderOrder = 4;
    node.add(inner, outer);
    helixRoot.add(node);
    lotNodes.push({ mesh: node, basePos: pos.clone(), outDir: radial, phase: i * 1.1 });
  }

  let explodeFactor = 0;
  let spinAccum = 0;

  return {
    group,
    getExplodeProgress: () => explodeFactor,
    updateMotion(dt, elapsed, isHovered, pointerX, pointerY, reducedMotion) {
      const targetExplode = isHovered ? 1 : 0;
      explodeFactor = THREE.MathUtils.damp(explodeFactor, targetExplode, 6.2, dt);

      group.scale.setScalar(1 + explodeFactor * 0.14);

      // Spread the two intertwined market/cost ribbons radially apart cleanly
      ribbonA.position.x = explodeFactor * 0.24;
      ribbonA.position.z = explodeFactor * 0.1;
      ribbonB.position.x = -explodeFactor * 0.24;
      ribbonB.position.z = -explodeFactor * 0.1;
      ribbonA.scale.set(1 + explodeFactor * 0.12, 1, 1 + explodeFactor * 0.12);
      ribbonB.scale.set(1 + explodeFactor * 0.12, 1, 1 + explodeFactor * 0.12);

      // Expand central calibration collars
      collars.forEach((c, idx) => {
        c.scale.setScalar(0.8 + explodeFactor * (0.65 + (idx === 1 ? 0.2 : 0)));
      });

      const speed = reducedMotion ? 0 : isHovered ? 1.45 : 0.42;
      spinAccum += dt * speed;

      helixRoot.rotation.y = spinAccum;
      const targetTiltX = isHovered ? pointerY * 0.32 : 0.08;
      const targetTiltY = isHovered ? pointerX * 0.36 : 0;
      group.rotation.x = THREE.MathUtils.damp(group.rotation.x, targetTiltX, 6.0, dt);
      group.rotation.y = THREE.MathUtils.damp(group.rotation.y, targetTiltY, 6.0, dt);

      // Flare crystal lot nodes outward along their radial normals and scale up
      const radialPush = explodeFactor * 0.4;
      const nodeScale = 1 + explodeFactor * 0.28;
      lotNodes.forEach((n) => {
        const bob = reducedMotion ? 0 : Math.sin(elapsed * 2.1 + n.phase) * 0.05;
        n.mesh.position.set(
          n.basePos.x + n.outDir.x * radialPush,
          n.basePos.y + bob,
          n.basePos.z + n.outDir.z * radialPush
        );
        n.mesh.scale.setScalar(nodeScale);
        if (!reducedMotion) {
          n.mesh.rotation.y = elapsed * (isHovered ? 1.6 : 0.6) + n.phase;
        }
      });

      emeraldMat.emissiveIntensity = THREE.MathUtils.damp(
        emeraldMat.emissiveIntensity,
        isHovered ? 0.3 : 0.08,
        6,
        dt
      );
      goldMat.emissiveIntensity = THREE.MathUtils.damp(
        goldMat.emissiveIntensity,
        isHovered ? 0.28 : 0.07,
        6,
        dt
      );
    },
    applyTheme(nextDark) {
      const next = nextDark ? STUDIO_PALETTES.dark : STUDIO_PALETTES.light;
      emeraldMat.color.setHex(next.emerald);
      emeraldMat.emissive.setHex(next.emerald);
      goldMat.color.setHex(next.gold);
      goldMat.emissive.setHex(next.gold);
      spindleMat.color.setHex(next.slate);
      crystalMat.color.setHex(next.crystalTint);
      crystalMat.attenuationColor.setHex(next.crystalAttenuation);
    },
  };
}

/**
 * 3. Budget Guard Horological Dial — Layered Exploding Tolerance Arcs + Flaring Droplets + Detaching Crystal Hub
 */
function createBudgetDialEmblem(
  isDark: boolean,
  isSoftwareGl: boolean,
  brushedTextures: BrushedTextures
): FeatureEmblemHandle {
  const p = isDark ? STUDIO_PALETTES.dark : STUDIO_PALETTES.light;
  const group = new THREE.Group();

  const emeraldMat = makeBrushedMetalMaterial(p.emerald, brushedTextures, 0.22);
  const goldMat = makeBrushedMetalMaterial(p.gold, brushedTextures, 0.2);
  const crimsonMat = makeBrushedMetalMaterial(p.crimson, brushedTextures, 0.24);
  const crystalMat = makeCrystalMaterial(p, isSoftwareGl);

  const dialGroup = new THREE.Group();
  dialGroup.rotation.x = 0.36;
  group.add(dialGroup);

  // 3 Tolerance Arcs with angular bisectors for radial + Z-plane exploded separation
  const safeArc = new THREE.Mesh(
    new THREE.TorusGeometry(1.04, 0.052, 14, 64, Math.PI * 1.18),
    emeraldMat
  );
  const safeBisector = Math.PI * 0.59;

  const warnArc = new THREE.Mesh(
    new THREE.TorusGeometry(1.04, 0.05, 14, 28, Math.PI * 0.36),
    goldMat
  );
  warnArc.rotation.z = Math.PI * 1.24;
  const warnBisector = Math.PI * 1.42;

  const alertArc = new THREE.Mesh(
    new THREE.TorusGeometry(1.04, 0.05, 14, 22, Math.PI * 0.28),
    crimsonMat
  );
  alertArc.rotation.z = Math.PI * 1.66;
  const alertBisector = Math.PI * 1.8;

  // Slender outer calibration ring
  const outerHalo = new THREE.Mesh(new THREE.TorusGeometry(1.24, 0.015, 10, 80), goldMat);
  dialGroup.add(safeArc, warnArc, alertArc, outerHalo);

  // Sweeping metallic pace pointer
  const needlePivot = new THREE.Group();
  const needleGeo = new THREE.ConeGeometry(0.065, 0.72, 4);
  needleGeo.rotateZ(-Math.PI / 2);
  needleGeo.translate(0.56, 0, 0);
  needlePivot.add(new THREE.Mesh(needleGeo, goldMat));
  dialGroup.add(needlePivot);

  // Central crystal hub cap (lifts forward +Z on hover) & escapement emerald core
  const hubCrystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), crystalMat);
  hubCrystal.renderOrder = 4;
  const hubCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), emeraldMat);
  dialGroup.add(hubCore, hubCrystal);

  // 16 Instanced orbiting cashflow droplets that flare radially outward on hover
  const dropletCount = 16;
  const droplets = new THREE.InstancedMesh(
    new THREE.OctahedronGeometry(0.044, 0),
    goldMat,
    dropletCount
  );
  droplets.frustumCulled = false;
  const updateDroplets = (explode: number) => {
    const r = 1.24 + explode * 0.34;
    const zWave = explode * 0.14;
    for (let i = 0; i < dropletCount; i++) {
      const a = (i / dropletCount) * Math.PI * 2;
      _instanceDummy.position.set(
        Math.cos(a) * r,
        Math.sin(a) * r,
        (i % 2 === 0 ? 1 : -1) * zWave
      );
      _instanceDummy.rotation.set(a, explode * 0.7, 0);
      _instanceDummy.scale.setScalar((i % 2 === 0 ? 1.15 : 0.82) * (1 + explode * 0.25));
      _instanceDummy.updateMatrix();
      droplets.setMatrixAt(i, _instanceDummy.matrix);
    }
    droplets.instanceMatrix.needsUpdate = true;
  };
  updateDroplets(0);
  droplets.computeBoundingSphere();
  dialGroup.add(droplets);

  let explodeFactor = 0;
  let spinAccum = 0;

  return {
    group,
    getExplodeProgress: () => explodeFactor,
    updateMotion(dt, elapsed, isHovered, pointerX, pointerY, reducedMotion) {
      const targetExplode = isHovered ? 1 : 0;
      explodeFactor = THREE.MathUtils.damp(explodeFactor, targetExplode, 6.2, dt);

      group.scale.setScalar(1 + explodeFactor * 0.14);

      // Explode the 3 tolerance arcs radially along their bisectors and into layered Z depth planes
      const arcRadial = explodeFactor * 0.22;
      safeArc.position.set(
        Math.cos(safeBisector) * arcRadial,
        Math.sin(safeBisector) * arcRadial,
        explodeFactor * 0.18
      );
      warnArc.position.set(
        Math.cos(warnBisector) * arcRadial,
        Math.sin(warnBisector) * arcRadial,
        0
      );
      alertArc.position.set(
        Math.cos(alertBisector) * arcRadial,
        Math.sin(alertBisector) * arcRadial,
        -explodeFactor * 0.18
      );

      // Expand calibration ring, flare cashflow droplets, and lift crystal hub cap forward
      outerHalo.scale.setScalar(1 + explodeFactor * 0.18);
      hubCrystal.position.z = explodeFactor * 0.38;
      hubCrystal.scale.setScalar(1 + explodeFactor * 0.14);
      needlePivot.position.z = explodeFactor * 0.14;
      updateDroplets(explodeFactor);

      const speed = reducedMotion ? 0 : isHovered ? 1.5 : 0.48;
      spinAccum += dt * speed;

      const targetTiltX = isHovered ? pointerY * 0.32 : 0.04;
      const targetTiltY = isHovered ? pointerX * 0.4 : 0;
      group.rotation.x = THREE.MathUtils.damp(group.rotation.x, targetTiltX, 6.0, dt);
      group.rotation.y = THREE.MathUtils.damp(group.rotation.y, targetTiltY, 6.0, dt);

      if (!reducedMotion) {
        needlePivot.rotation.z = 0.55 + Math.sin(elapsed * (isHovered ? 2.2 : 0.95)) * 0.82;
        droplets.rotation.z = -spinAccum * 0.6;
        hubCrystal.rotation.y = spinAccum * 0.9;
        hubCore.rotation.y = -spinAccum * 1.2;
        dialGroup.rotation.y = Math.sin(elapsed * 0.7) * 0.24;
      } else {
        needlePivot.rotation.z = 0.65;
      }

      emeraldMat.emissiveIntensity = THREE.MathUtils.damp(
        emeraldMat.emissiveIntensity,
        isHovered ? 0.28 : 0.08,
        6,
        dt
      );
      goldMat.emissiveIntensity = THREE.MathUtils.damp(
        goldMat.emissiveIntensity,
        isHovered ? 0.28 : 0.08,
        6,
        dt
      );
      crimsonMat.emissiveIntensity = THREE.MathUtils.damp(
        crimsonMat.emissiveIntensity,
        isHovered ? 0.36 : 0.12,
        6,
        dt
      );
    },
    applyTheme(nextDark) {
      const next = nextDark ? STUDIO_PALETTES.dark : STUDIO_PALETTES.light;
      emeraldMat.color.setHex(next.emerald);
      emeraldMat.emissive.setHex(next.emerald);
      goldMat.color.setHex(next.gold);
      goldMat.emissive.setHex(next.gold);
      crimsonMat.color.setHex(next.crimson);
      crimsonMat.emissive.setHex(next.crimson);
      crystalMat.color.setHex(next.crystalTint);
      crystalMat.attenuationColor.setHex(next.crystalAttenuation);
    },
  };
}

/**
 * 4. Vault Shield Prism — Dual-Shell Crystal Icosahedron + 6 Detachable Axial Armor Plates + Expanding Meridian Lock Rings
 */
function createVaultShieldEmblem(
  isDark: boolean,
  isSoftwareGl: boolean,
  brushedTextures: BrushedTextures
): FeatureEmblemHandle {
  const p = isDark ? STUDIO_PALETTES.dark : STUDIO_PALETTES.light;
  const group = new THREE.Group();

  const slateMat = makeBrushedMetalMaterial(p.slate, brushedTextures, 0.22);
  const goldMat = makeBrushedMetalMaterial(p.gold, brushedTextures, 0.2);
  const emeraldMat = makeBrushedMetalMaterial(p.emerald, brushedTextures, 0.24);
  const crystalMat = makeCrystalMaterial(p, isSoftwareGl);

  // Outer faceted crystal icosahedron shell + crisp wireframe edges
  const outerGeo = new THREE.IcosahedronGeometry(0.78, 0);
  const outerShell = new THREE.Mesh(outerGeo, crystalMat);
  outerShell.renderOrder = 4;
  const edgeMat = new THREE.LineBasicMaterial({
    color: p.edgeLine,
    transparent: true,
    opacity: isDark ? 0.54 : 0.38,
  });
  outerShell.add(new THREE.LineSegments(new THREE.EdgesGeometry(outerGeo, 12), edgeMat));
  group.add(outerShell);

  // Inner solid brushed-emerald vault core
  const innerCore = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4, 0), emeraldMat);
  group.add(innerCore);

  // 6 Precision Hexagonal Armor Shield Plates aligned along ±X, ±Y, ±Z that explode outward on hover
  const plateRig = new THREE.Group();
  const plateGeo = new THREE.CylinderGeometry(0.24, 0.3, 0.068, 6);
  const plateDirs: Array<{ dir: THREE.Vector3; rot: THREE.Euler; isGold: boolean }> = [
    { dir: new THREE.Vector3(1, 0, 0), rot: new THREE.Euler(0, 0, -Math.PI / 2), isGold: false },
    { dir: new THREE.Vector3(-1, 0, 0), rot: new THREE.Euler(0, 0, Math.PI / 2), isGold: false },
    { dir: new THREE.Vector3(0, 1, 0), rot: new THREE.Euler(0, 0, 0), isGold: true },
    { dir: new THREE.Vector3(0, -1, 0), rot: new THREE.Euler(Math.PI, 0, 0), isGold: true },
    { dir: new THREE.Vector3(0, 0, 1), rot: new THREE.Euler(Math.PI / 2, 0, 0), isGold: false },
    { dir: new THREE.Vector3(0, 0, -1), rot: new THREE.Euler(-Math.PI / 2, 0, 0), isGold: false },
  ];
  const shieldPlates = plateDirs.map((spec) => {
    const plate = new THREE.Mesh(plateGeo, spec.isGold ? goldMat : slateMat);
    plate.rotation.copy(spec.rot);
    plate.position.copy(spec.dir).multiplyScalar(0.84);
    plateRig.add(plate);
    return { mesh: plate, dir: spec.dir };
  });
  group.add(plateRig);

  // Two interlocking meridian lock bands that expand & counter-tilt on hover
  const lockRingA = new THREE.Mesh(new THREE.TorusGeometry(1.04, 0.034, 12, 72), slateMat);
  const lockRingB = new THREE.Mesh(new THREE.TorusGeometry(1.04, 0.026, 12, 72), goldMat);
  lockRingB.rotation.x = Math.PI / 2;
  const lockRig = new THREE.Group();
  lockRig.add(lockRingA, lockRingB);
  group.add(lockRig);

  let explodeFactor = 0;
  let spinAccum = 0;

  return {
    group,
    getExplodeProgress: () => explodeFactor,
    updateMotion(dt, elapsed, isHovered, pointerX, pointerY, reducedMotion) {
      const targetExplode = isHovered ? 1 : 0;
      explodeFactor = THREE.MathUtils.damp(explodeFactor, targetExplode, 6.2, dt);

      group.scale.setScalar(1 + explodeFactor * 0.14);

      // Explode the 6 hexagonal shield plates cleanly along their ±X/±Y/±Z face normals
      const plateRadius = 0.84 + explodeFactor * 0.44;
      const plateScale = 1 + explodeFactor * 0.14;
      shieldPlates.forEach(({ mesh, dir }) => {
        mesh.position.set(dir.x * plateRadius, dir.y * plateRadius, dir.z * plateRadius);
        mesh.scale.setScalar(plateScale);
      });

      // Expand outer crystal shell, meridian lock bands, and brighten vault core
      outerShell.scale.setScalar(1 + explodeFactor * 0.15);
      lockRingA.scale.setScalar(1 + explodeFactor * 0.22);
      lockRingB.scale.setScalar(1 + explodeFactor * 0.22);
      lockRingA.rotation.y = explodeFactor * 0.34;
      lockRingB.rotation.z = -explodeFactor * 0.34;
      innerCore.scale.setScalar(1 + explodeFactor * 0.18);

      const speed = reducedMotion ? 0 : isHovered ? 1.5 : 0.42;
      spinAccum += dt * speed;

      const targetTiltX = isHovered ? pointerY * 0.34 : 0.14;
      const targetTiltY = isHovered ? pointerX * 0.4 : 0;
      group.rotation.x = THREE.MathUtils.damp(group.rotation.x, targetTiltX, 6.0, dt);
      group.rotation.y = THREE.MathUtils.damp(group.rotation.y, targetTiltY, 6.0, dt);

      outerShell.rotation.y = spinAccum * 0.65;
      outerShell.rotation.x = spinAccum * 0.32;
      plateRig.rotation.y = spinAccum * 0.65;
      plateRig.rotation.x = spinAccum * 0.32;
      innerCore.rotation.y = -spinAccum * 1.15;
      lockRig.rotation.z = spinAccum * 0.58;
      lockRig.rotation.y = -spinAccum * 0.44;
      if (!reducedMotion) {
        group.position.y = Math.sin(elapsed * 1.5 + 1.2) * 0.055;
      }

      emeraldMat.emissiveIntensity = THREE.MathUtils.damp(
        emeraldMat.emissiveIntensity,
        isHovered ? 0.34 : 0.1,
        6,
        dt
      );
      goldMat.emissiveIntensity = THREE.MathUtils.damp(
        goldMat.emissiveIntensity,
        isHovered ? 0.28 : 0.06,
        6,
        dt
      );
      slateMat.emissiveIntensity = THREE.MathUtils.damp(
        slateMat.emissiveIntensity,
        isHovered ? 0.22 : 0.05,
        6,
        dt
      );
    },
    applyTheme(nextDark) {
      const next = nextDark ? STUDIO_PALETTES.dark : STUDIO_PALETTES.light;
      slateMat.color.setHex(next.slate);
      slateMat.emissive.setHex(next.slate);
      goldMat.color.setHex(next.gold);
      goldMat.emissive.setHex(next.gold);
      emeraldMat.color.setHex(next.emerald);
      emeraldMat.emissive.setHex(next.emerald);
      crystalMat.color.setHex(next.crystalTint);
      crystalMat.attenuationColor.setHex(next.crystalAttenuation);
      edgeMat.color.setHex(next.edgeLine);
      edgeMat.opacity = nextDark ? 0.54 : 0.38;
    },
  };
}

export function createFeatureEmblem(
  kind: FeatureEmblemKind,
  isDark: boolean,
  isSoftwareGl: boolean,
  brushedTextures: BrushedTextures
): FeatureEmblemHandle {
  switch (kind) {
    case 'NAV':
      return createNavVaultEmblem(isDark, isSoftwareGl, brushedTextures);
    case 'MARKET':
      return createMarketHelixEmblem(isDark, isSoftwareGl, brushedTextures);
    case 'BUDGET':
      return createBudgetDialEmblem(isDark, isSoftwareGl, brushedTextures);
    case 'SECURITY':
      return createVaultShieldEmblem(isDark, isSoftwareGl, brushedTextures);
  }
}

export type StudioModelKind =
  | 'ABOUT_BALANCE'
  | 'WHY_NAV'
  | 'WHY_MARKET'
  | 'WHY_BUDGET'
  | 'WHY_SECURITY'
  | 'APP_FLOW'
  | 'PRIVACY_VAULT'
  | 'COMPACT_WALLET'
  | 'COMPACT_KEYS';

export interface StudioModelHandle {
  group: THREE.Group;
  cameraPos: [number, number, number];
  cameraFov: number;
  updateAmbient: (dt: number, elapsed: number, reducedMotion: boolean) => void;
  applyTheme: (isDark: boolean) => void;
  disposeExtra: () => void;
}

function createRoundedRectShape(width: number, height: number, radius: number): THREE.Shape {
  const s = new THREE.Shape();
  const hw = width / 2;
  const hh = height / 2;
  const r = Math.min(radius, hw, hh);
  s.moveTo(-hw + r, -hh);
  s.lineTo(hw - r, -hh);
  s.quadraticCurveTo(hw, -hh, hw, -hh + r);
  s.lineTo(hw, hh - r);
  s.quadraticCurveTo(hw, hh, hw - r, hh);
  s.lineTo(-hw + r, hh);
  s.quadraticCurveTo(-hw, hh, -hw, hh - r);
  s.lineTo(-hw, -hh + r);
  s.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
  return s;
}

function makeMatteSlateMaterial(isDark: boolean): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: isDark ? 0x1d2633 : 0xd9d5ca,
    roughness: 0.74,
    metalness: 0.14,
    envMapIntensity: 0.75,
  });
}

function makeAccentSlateMaterial(isDark: boolean): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: isDark ? 0x2a3748 : 0xb8b3a5,
    roughness: 0.58,
    metalness: 0.28,
    envMapIntensity: 0.9,
  });
}

function createContactShadow(
  isDark: boolean,
  radius: number,
  yPos: number
): {
  mesh: THREE.Mesh;
  applyTheme: (nextDark: boolean) => void;
  dispose: () => void;
} {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(
      size / 2,
      size / 2,
      size * 0.04,
      size / 2,
      size / 2,
      size * 0.5
    );
    grad.addColorStop(0, 'rgba(6, 12, 18, 0.85)');
    grad.addColorStop(0.45, 'rgba(6, 12, 18, 0.36)');
    grad.addColorStop(0.78, 'rgba(6, 12, 18, 0.08)');
    grad.addColorStop(1, 'rgba(6, 12, 18, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: isDark ? 0.42 : 0.22,
    depthWrite: false,
  });

  const geo = new THREE.PlaneGeometry(radius * 2, radius * 2);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.y = yPos;
  mesh.renderOrder = 0;

  return {
    mesh,
    applyTheme(nextDark: boolean) {
      material.opacity = nextDark ? 0.42 : 0.22;
    },
    dispose() {
      texture.dispose();
    },
  };
}

/**
 * Studio Sculpture A: ABOUT_BALANCE
 * Architectural stepped matte slate plinth + 3 beveled frosted-emerald ledger slabs +
 * brushed-brass precision balance fulcrum & counterweight beam.
 */
function createAboutBalanceModel(
  isDark: boolean,
  isSoftwareGl: boolean,
  brushedTextures: BrushedTextures
): StudioModelHandle {
  const p = isDark ? STUDIO_PALETTES.dark : STUDIO_PALETTES.light;
  const root = new THREE.Group();

  const shadow = createContactShadow(isDark, 1.85, -1.16);
  root.add(shadow.mesh);

  const sculpture = new THREE.Group();
  root.add(sculpture);

  const slateMat = makeMatteSlateMaterial(isDark);
  const accentSlateMat = makeAccentSlateMaterial(isDark);
  const goldMat = makeBrushedMetalMaterial(p.gold, brushedTextures, 0.2);
  const emeraldMat = makeBrushedMetalMaterial(p.emerald, brushedTextures, 0.24);
  const crystalMat = makeCrystalMaterial(p, isSoftwareGl);
  const edgeMat = new THREE.LineBasicMaterial({
    color: p.edgeLine,
    transparent: true,
    opacity: isDark ? 0.44 : 0.3,
  });

  // 1. Stepped matte slate architectural plinth with brass datum inlay
  const baseLower = new THREE.Mesh(new THREE.CylinderGeometry(1.26, 1.34, 0.14, 48), slateMat);
  baseLower.position.y = -1.06;
  const baseUpper = new THREE.Mesh(new THREE.CylinderGeometry(1.04, 1.1, 0.08, 48), accentSlateMat);
  baseUpper.position.y = -0.95;
  const baseRing = new THREE.Mesh(new THREE.TorusGeometry(1.16, 0.018, 12, 72), goldMat);
  baseRing.rotation.x = Math.PI / 2;
  baseRing.position.y = -0.97;
  sculpture.add(baseLower, baseUpper, baseRing);

  // 2. Three stacked beveled optical-glass ledger slabs
  const slabSpecs = [
    { w: 1.52, d: 0.94, h: 0.14, y: -0.76, rotY: 0.08 },
    { w: 1.32, d: 0.84, h: 0.14, y: -0.5, rotY: -0.1 },
    { w: 1.12, d: 0.74, h: 0.14, y: -0.24, rotY: 0.05 },
  ];

  const slabsGroup = new THREE.Group();
  slabSpecs.forEach((spec, idx) => {
    const shape = createRoundedRectShape(spec.w, spec.d, 0.11);
    const slabGeo = new THREE.ExtrudeGeometry(shape, {
      depth: spec.h,
      bevelEnabled: true,
      bevelThickness: 0.024,
      bevelSize: 0.024,
      bevelSegments: 3,
      curveSegments: 12,
    });
    slabGeo.center();
    slabGeo.rotateX(Math.PI / 2);

    const slabMesh = new THREE.Mesh(slabGeo, crystalMat);
    slabMesh.position.y = spec.y;
    slabMesh.rotation.y = spec.rotY;
    slabMesh.renderOrder = 3 + idx;

    const slabEdges = new THREE.LineSegments(new THREE.EdgesGeometry(slabGeo, 24), edgeMat);
    slabMesh.add(slabEdges);

    // Thin emerald inlay core strip inside each slab for rich depth
    const coreMesh = new THREE.Mesh(
      new THREE.BoxGeometry(spec.w * 0.78, 0.032, spec.d * 0.66),
      idx === 1 ? goldMat : emeraldMat
    );
    coreMesh.position.y = spec.y;
    coreMesh.rotation.y = spec.rotY;

    slabsGroup.add(coreMesh, slabMesh);
  });
  sculpture.add(slabsGroup);

  // 3. Central brushed-brass balance fulcrum & oscillating equilibrium beam
  const fulcrumStand = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.085, 0.72, 24), goldMat);
  fulcrumStand.position.y = 0.22;
  const fulcrumCollar = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.02, 12, 36), emeraldMat);
  fulcrumCollar.rotation.x = Math.PI / 2;
  fulcrumCollar.position.y = 0.04;
  sculpture.add(fulcrumStand, fulcrumCollar);

  const beamGroup = new THREE.Group();
  beamGroup.position.y = 0.58;

  const beamBar = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 1.72, 20), goldMat);
  beamBar.rotation.z = Math.PI / 2;
  const pivotOrb = new THREE.Mesh(new THREE.OctahedronGeometry(0.125, 0), emeraldMat);
  beamGroup.add(beamBar, pivotOrb);

  // Dual balanced counterweight trays (left emerald glass disc, right brass precision weight)
  [-0.82, 0.82].forEach((xPos, idx) => {
    const panRing = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.022, 12, 48), goldMat);
    panRing.rotation.x = Math.PI / 2;
    panRing.position.set(xPos, -0.02, 0);

    const panDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.21, 0.21, 0.055, 32),
      idx === 0 ? crystalMat : emeraldMat
    );
    panDisc.position.set(xPos, -0.02, 0);
    if (idx === 0) panDisc.renderOrder = 6;

    const finial = new THREE.Mesh(new THREE.OctahedronGeometry(0.075, 0), goldMat);
    finial.position.set(xPos, 0.08, 0);

    beamGroup.add(panRing, panDisc, finial);
  });

  // Subtle vertical framing meridian ring uniting the whole sculpture
  const haloRing = new THREE.Mesh(new THREE.TorusGeometry(1.18, 0.014, 10, 80), goldMat);
  haloRing.position.y = -0.02;
  haloRing.rotation.y = Math.PI / 5;

  sculpture.add(beamGroup, haloRing);

  // Initial photogenic 3/4 studio pose
  const baseYaw = -0.42;
  sculpture.rotation.set(0.12, baseYaw, 0);
  beamGroup.rotation.z = 0.06;

  let turnAngle = 0;

  return {
    group: root,
    cameraPos: [0, 0.28, 4.45],
    cameraFov: 34,
    updateAmbient(dt, elapsed, reducedMotion) {
      if (reducedMotion) {
        sculpture.rotation.set(0.12, baseYaw, 0);
        sculpture.position.y = 0;
        beamGroup.rotation.z = 0.06;
        return;
      }
      turnAngle += dt * 0.26;
      sculpture.rotation.y = baseYaw + turnAngle;
      sculpture.position.y = Math.sin(elapsed * 1.05) * 0.048;
      beamGroup.rotation.z = Math.sin(elapsed * 0.9) * 0.095;
      pivotOrb.rotation.y = -turnAngle * 1.4;
      haloRing.rotation.z = turnAngle * 0.35;
    },
    applyTheme(nextDark) {
      const next = nextDark ? STUDIO_PALETTES.dark : STUDIO_PALETTES.light;
      slateMat.color.setHex(nextDark ? 0x1d2633 : 0xd9d5ca);
      accentSlateMat.color.setHex(nextDark ? 0x2a3748 : 0xb8b3a5);
      goldMat.color.setHex(next.gold);
      goldMat.emissive.setHex(next.gold);
      emeraldMat.color.setHex(next.emerald);
      emeraldMat.emissive.setHex(next.emerald);
      crystalMat.color.setHex(next.crystalTint);
      crystalMat.attenuationColor.setHex(next.crystalAttenuation);
      edgeMat.color.setHex(next.edgeLine);
      edgeMat.opacity = nextDark ? 0.44 : 0.3;
      shadow.applyTheme(nextDark);
    },
    disposeExtra() {
      shadow.dispose();
    },
  };
}

/**
 * Studio Sculpture B: APP_FLOW
 * Stepped matte slate datum disc + 5 ascending frosted-emerald crystal growth bars with brass caps +
 * sweeping brushed-brass 3D cashflow trajectory ribbon & milestone crystals.
 */
function createAppFlowModel(
  isDark: boolean,
  isSoftwareGl: boolean,
  brushedTextures: BrushedTextures
): StudioModelHandle {
  const p = isDark ? STUDIO_PALETTES.dark : STUDIO_PALETTES.light;
  const root = new THREE.Group();

  const shadow = createContactShadow(isDark, 1.9, -1.16);
  root.add(shadow.mesh);

  const sculpture = new THREE.Group();
  root.add(sculpture);

  const slateMat = makeMatteSlateMaterial(isDark);
  const accentSlateMat = makeAccentSlateMaterial(isDark);
  const goldMat = makeBrushedMetalMaterial(p.gold, brushedTextures, 0.2);
  const emeraldMat = makeBrushedMetalMaterial(p.emerald, brushedTextures, 0.22);
  const crystalMat = makeCrystalMaterial(p, isSoftwareGl);
  const edgeMat = new THREE.LineBasicMaterial({
    color: p.edgeLine,
    transparent: true,
    opacity: isDark ? 0.45 : 0.32,
  });

  // 1. Stepped matte slate base disc + fine brass calibration ring
  const basePlate = new THREE.Mesh(new THREE.CylinderGeometry(1.36, 1.44, 0.14, 56), slateMat);
  basePlate.position.y = -1.04;
  const innerDeck = new THREE.Mesh(new THREE.CylinderGeometry(1.16, 1.2, 0.06, 56), accentSlateMat);
  innerDeck.position.y = -0.94;
  const datumRing = new THREE.Mesh(new THREE.TorusGeometry(1.26, 0.018, 12, 80), goldMat);
  datumRing.rotation.x = Math.PI / 2;
  datumRing.position.y = -0.95;
  sculpture.add(basePlate, innerDeck, datumRing);

  // 2. Five ascending beveled emerald-glass growth bars with brushed brass crowns
  const barSpecs = [
    { x: -0.78, z: 0.24, h: 0.56, isSolid: false },
    { x: -0.39, z: 0.08, h: 0.86, isSolid: true },
    { x: 0.0, z: -0.04, h: 1.16, isSolid: false },
    { x: 0.39, z: -0.14, h: 1.46, isSolid: true },
    { x: 0.78, z: -0.22, h: 1.78, isSolid: false },
  ];

  const barBaseY = -0.91;
  const barShape = createRoundedRectShape(0.27, 0.27, 0.055);
  barSpecs.forEach((spec, idx) => {
    const barGeo = new THREE.ExtrudeGeometry(barShape, {
      depth: spec.h,
      bevelEnabled: true,
      bevelThickness: 0.016,
      bevelSize: 0.016,
      bevelSegments: 2,
      curveSegments: 8,
    });
    barGeo.rotateX(-Math.PI / 2);

    const barMesh = new THREE.Mesh(barGeo, spec.isSolid ? emeraldMat : crystalMat);
    barMesh.position.set(spec.x, barBaseY, spec.z);
    if (!spec.isSolid) {
      barMesh.renderOrder = 3 + idx;
      barMesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(barGeo, 24), edgeMat));
      // Inner emerald spine inside glass column
      const spine = new THREE.Mesh(
        new THREE.CylinderGeometry(0.042, 0.042, spec.h * 0.86, 12),
        emeraldMat
      );
      spine.position.set(spec.x, barBaseY + spec.h * 0.45, spec.z);
      sculpture.add(spine);
    }

    // Brushed brass cap bezel atop each growth column
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.034, 0.28), goldMat);
    cap.position.set(spec.x, barBaseY + spec.h + 0.032, spec.z);

    sculpture.add(barMesh, cap);
  });

  // 3. Sweeping brushed-brass 3D orbital cashflow curve arcing upward past the bars
  const arcPts = [
    new THREE.Vector3(-1.18, -0.54, 0.62),
    new THREE.Vector3(-0.62, -0.1, 0.72),
    new THREE.Vector3(0.04, 0.34, 0.54),
    new THREE.Vector3(0.66, 0.82, 0.2),
    new THREE.Vector3(1.16, 1.12, -0.32),
  ];
  const cashflowCurve = new THREE.CatmullRomCurve3(arcPts);
  const flowTube = new THREE.Mesh(
    new THREE.TubeGeometry(cashflowCurve, 64, 0.034, 14, false),
    goldMat
  );
  sculpture.add(flowTube);

  // Subtle counter-orbital hairline ring
  const orbitRing = new THREE.Mesh(new THREE.TorusGeometry(1.38, 0.012, 10, 84), emeraldMat);
  orbitRing.rotation.set(1.18, 0.32, 0.22);
  orbitRing.position.y = 0.06;
  sculpture.add(orbitRing);

  // 3 Faceted milestone crystal nodes along the cashflow ribbon
  const nodeGeo = new THREE.OctahedronGeometry(0.11, 0);
  const milestoneNodes: Array<{ mesh: THREE.Mesh; phase: number }> = [];
  [0.18, 0.54, 0.92].forEach((t, idx) => {
    const pos = cashflowCurve.getPoint(t);
    const node = new THREE.Mesh(nodeGeo, idx === 2 ? goldMat : crystalMat);
    node.position.copy(pos);
    if (idx !== 2) node.renderOrder = 8;
    sculpture.add(node);
    milestoneNodes.push({ mesh: node, phase: idx * 1.3 });
  });

  const baseYaw = -0.34;
  sculpture.rotation.set(0.14, baseYaw, 0);

  let turnAngle = 0;

  return {
    group: root,
    cameraPos: [0, 0.32, 4.6],
    cameraFov: 34,
    updateAmbient(dt, elapsed, reducedMotion) {
      if (reducedMotion) {
        sculpture.rotation.set(0.14, baseYaw, 0);
        sculpture.position.y = 0;
        return;
      }
      turnAngle += dt * 0.28;
      sculpture.rotation.y = baseYaw + turnAngle;
      sculpture.position.y = Math.sin(elapsed * 1.1 + 0.6) * 0.045;
      orbitRing.rotation.z = 0.22 + turnAngle * 0.45;
      milestoneNodes.forEach((n) => {
        n.mesh.rotation.y = elapsed * 0.75 + n.phase;
      });
    },
    applyTheme(nextDark) {
      const next = nextDark ? STUDIO_PALETTES.dark : STUDIO_PALETTES.light;
      slateMat.color.setHex(nextDark ? 0x1d2633 : 0xd9d5ca);
      accentSlateMat.color.setHex(nextDark ? 0x2a3748 : 0xb8b3a5);
      goldMat.color.setHex(next.gold);
      goldMat.emissive.setHex(next.gold);
      emeraldMat.color.setHex(next.emerald);
      emeraldMat.emissive.setHex(next.emerald);
      crystalMat.color.setHex(next.crystalTint);
      crystalMat.attenuationColor.setHex(next.crystalAttenuation);
      edgeMat.color.setHex(next.edgeLine);
      edgeMat.opacity = nextDark ? 0.45 : 0.32;
      shadow.applyTheme(nextDark);
    },
    disposeExtra() {
      shadow.dispose();
    },
  };
}

/**
 * Studio Sculpture C: PRIVACY_VAULT
 * Beveled hexagonal matte slate pedestal + faceted deep emerald optical crystal core +
 * 3 concentric interlocking brushed-brass & slate gyroscopic vault rings with 6 instanced lock studs.
 */
function createPrivacyVaultModel(
  isDark: boolean,
  isSoftwareGl: boolean,
  brushedTextures: BrushedTextures
): StudioModelHandle {
  const p = isDark ? STUDIO_PALETTES.dark : STUDIO_PALETTES.light;
  const root = new THREE.Group();

  const shadow = createContactShadow(isDark, 1.85, -1.24);
  root.add(shadow.mesh);

  const sculpture = new THREE.Group();
  root.add(sculpture);

  const slateMat = makeMatteSlateMaterial(isDark);
  const accentSlateMat = makeAccentSlateMaterial(isDark);
  const metalSlateMat = makeBrushedMetalMaterial(p.slate, brushedTextures, 0.26);
  const goldMat = makeBrushedMetalMaterial(p.gold, brushedTextures, 0.2);
  const emeraldMat = makeBrushedMetalMaterial(p.emerald, brushedTextures, 0.22);
  const crystalMat = makeCrystalMaterial(p, isSoftwareGl);
  const edgeMat = new THREE.LineBasicMaterial({
    color: p.edgeLine,
    transparent: true,
    opacity: isDark ? 0.5 : 0.36,
  });

  // 1. Beveled hexagonal matte slate pedestal + brass inlay crown
  const pedLower = new THREE.Mesh(new THREE.CylinderGeometry(1.06, 1.18, 0.16, 6), slateMat);
  pedLower.position.y = -1.12;
  const pedUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.84, 0.92, 0.08, 6), accentSlateMat);
  pedUpper.position.y = -0.99;
  const pedRing = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.018, 12, 6), goldMat);
  pedRing.rotation.x = Math.PI / 2;
  pedRing.position.y = -0.98;
  sculpture.add(pedLower, pedUpper, pedRing);

  // 2. Floating Vault Assembly centered above the pedestal
  const vaultCoreGroup = new THREE.Group();
  vaultCoreGroup.position.y = 0.08;
  sculpture.add(vaultCoreGroup);

  // Inner solid emerald heart
  const innerHeart = new THREE.Mesh(new THREE.OctahedronGeometry(0.36, 0), emeraldMat);
  vaultCoreGroup.add(innerHeart);

  // Outer faceted optical crystal icosahedron shell + crisp facet edges
  const shellGeo = new THREE.IcosahedronGeometry(0.66, 0);
  const outerShell = new THREE.Mesh(shellGeo, crystalMat);
  outerShell.renderOrder = 5;
  outerShell.add(new THREE.LineSegments(new THREE.EdgesGeometry(shellGeo, 14), edgeMat));
  vaultCoreGroup.add(outerShell);

  // 3 Concentric interlocking gyroscopic vault lock rings
  const ringOuter = new THREE.Group();
  const ringOuterTorus = new THREE.Mesh(new THREE.TorusGeometry(1.12, 0.036, 14, 72), goldMat);
  ringOuter.add(ringOuterTorus);

  // 6 Instanced cardinal lock studs mounted on outer vault ring
  const studGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.09, 6);
  const studs = new THREE.InstancedMesh(studGeo, metalSlateMat, 6);
  studs.frustumCulled = false;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    _instanceDummy.position.set(Math.cos(a) * 1.12, Math.sin(a) * 1.12, 0);
    _instanceDummy.rotation.set(0, 0, a - Math.PI / 2);
    _instanceDummy.scale.setScalar(1);
    _instanceDummy.updateMatrix();
    studs.setMatrixAt(i, _instanceDummy.matrix);
  }
  studs.instanceMatrix.needsUpdate = true;
  studs.computeBoundingSphere();
  ringOuter.add(studs);
  vaultCoreGroup.add(ringOuter);

  const ringMid = new THREE.Mesh(new THREE.TorusGeometry(0.94, 0.028, 12, 68), metalSlateMat);
  ringMid.rotation.set(Math.PI / 3, 0.4, 0);
  vaultCoreGroup.add(ringMid);

  const ringInner = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.02, 12, 64), goldMat);
  ringInner.rotation.set(-Math.PI / 3, -0.5, 0);
  vaultCoreGroup.add(ringInner);

  // Initial photogenic 3/4 pose
  const baseYaw = 0.36;
  sculpture.rotation.set(0.1, baseYaw, 0);
  ringOuter.rotation.set(0.32, 0.25, 0);

  let turnAngle = 0;

  return {
    group: root,
    cameraPos: [0, 0.24, 4.5],
    cameraFov: 34,
    updateAmbient(dt, elapsed, reducedMotion) {
      if (reducedMotion) {
        sculpture.rotation.set(0.1, baseYaw, 0);
        vaultCoreGroup.position.y = 0.08;
        return;
      }
      turnAngle += dt * 0.26;
      sculpture.rotation.y = baseYaw + turnAngle;
      vaultCoreGroup.position.y = 0.08 + Math.sin(elapsed * 1.05 + 1.4) * 0.048;

      ringOuter.rotation.z = turnAngle * 0.42;
      ringMid.rotation.y = 0.4 - turnAngle * 0.56;
      ringMid.rotation.x = Math.PI / 3 + turnAngle * 0.22;
      ringInner.rotation.z = turnAngle * 0.68;
      outerShell.rotation.y = turnAngle * 0.48;
      innerHeart.rotation.y = -turnAngle * 0.85;
    },
    applyTheme(nextDark) {
      const next = nextDark ? STUDIO_PALETTES.dark : STUDIO_PALETTES.light;
      slateMat.color.setHex(nextDark ? 0x1d2633 : 0xd9d5ca);
      accentSlateMat.color.setHex(nextDark ? 0x2a3748 : 0xb8b3a5);
      metalSlateMat.color.setHex(next.slate);
      metalSlateMat.emissive.setHex(next.slate);
      goldMat.color.setHex(next.gold);
      goldMat.emissive.setHex(next.gold);
      emeraldMat.color.setHex(next.emerald);
      emeraldMat.emissive.setHex(next.emerald);
      crystalMat.color.setHex(next.crystalTint);
      crystalMat.attenuationColor.setHex(next.crystalAttenuation);
      edgeMat.color.setHex(next.edgeLine);
      edgeMat.opacity = nextDark ? 0.5 : 0.36;
      shadow.applyTheme(nextDark);
    },
    disposeExtra() {
      shadow.dispose();
    },
  };
}

/**
 * Calm non-interactive turntable wrapper for the 4 Why-Choose-FinFlow sculptures.
 * Adds soft contact shadow grounding and steady turntable spin + gentle vertical float.
 */
function createCalmWhyStudioModel(
  emblemKind: FeatureEmblemKind,
  isDark: boolean,
  isSoftwareGl: boolean,
  brushedTextures: BrushedTextures
): StudioModelHandle {
  const root = new THREE.Group();
  const shadow = createContactShadow(isDark, 1.48, -1.32);
  root.add(shadow.mesh);

  const emblem = createFeatureEmblem(emblemKind, isDark, isSoftwareGl, brushedTextures);
  const turntable = new THREE.Group();
  turntable.add(emblem.group);
  root.add(turntable);

  // Settle initial rest pose at explode = 0
  emblem.updateMotion(0.016, 0, false, 0, 0, true);
  let turnAngle = 0;

  return {
    group: root,
    cameraPos: [0, 0.14, 4.65],
    cameraFov: 34,
    updateAmbient(dt, elapsed, reducedMotion) {
      if (reducedMotion) {
        turntable.rotation.y = 0.25;
        turntable.position.y = 0;
        emblem.updateMotion(0.016, 0, false, 0, 0, true);
        return;
      }
      turnAngle += dt * 0.28;
      turntable.rotation.y = 0.25 + turnAngle;
      turntable.position.y = Math.sin(elapsed * 1.1) * 0.042;
      // Gentle internal mechanism cadence with zero hover or pointer distortion
      emblem.updateMotion(dt * 0.55, elapsed * 0.65, false, 0, 0, false);
    },
    applyTheme(nextDark) {
      emblem.applyTheme(nextDark);
      shadow.applyTheme(nextDark);
    },
    disposeExtra() {
      shadow.dispose();
    },
  };
}

/**
 * Compact Studio Model D: COMPACT_WALLET
 * Layered matte-slate & frosted-emerald ledger wallet slab with brushed-brass clasp strap
 * and a gently hovering faceted brass & emerald coin medallion above.
 */
function createCompactWalletModel(
  isDark: boolean,
  isSoftwareGl: boolean,
  brushedTextures: BrushedTextures
): StudioModelHandle {
  const p = isDark ? STUDIO_PALETTES.dark : STUDIO_PALETTES.light;
  const root = new THREE.Group();

  const shadow = createContactShadow(isDark, 1.45, -1.04);
  root.add(shadow.mesh);

  const sculpture = new THREE.Group();
  root.add(sculpture);

  const slateMat = makeMatteSlateMaterial(isDark);
  const goldMat = makeBrushedMetalMaterial(p.gold, brushedTextures, 0.2);
  const emeraldMat = makeBrushedMetalMaterial(p.emerald, brushedTextures, 0.22);
  const crystalMat = makeCrystalMaterial(p, isSoftwareGl);
  const edgeMat = new THREE.LineBasicMaterial({
    color: p.edgeLine,
    transparent: true,
    opacity: isDark ? 0.48 : 0.34,
  });

  // 1. Primary beveled matte-slate wallet body
  const bodyShape = createRoundedRectShape(1.56, 1.02, 0.16);
  const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, {
    depth: 0.36,
    bevelEnabled: true,
    bevelThickness: 0.045,
    bevelSize: 0.045,
    bevelSegments: 3,
    curveSegments: 12,
  });
  bodyGeo.center();
  const walletBody = new THREE.Mesh(bodyGeo, slateMat);
  walletBody.position.y = -0.18;
  sculpture.add(walletBody);

  // 2. Frosted optical emerald ledger card tucked neatly behind the front face
  const cardShape = createRoundedRectShape(1.38, 0.88, 0.11);
  const cardGeo = new THREE.ExtrudeGeometry(cardShape, {
    depth: 0.08,
    bevelEnabled: true,
    bevelThickness: 0.018,
    bevelSize: 0.018,
    bevelSegments: 2,
    curveSegments: 10,
  });
  cardGeo.center();
  const glassCard = new THREE.Mesh(cardGeo, crystalMat);
  glassCard.position.set(0.06, 0.18, -0.06);
  glassCard.rotation.z = -0.08;
  glassCard.renderOrder = 4;
  glassCard.add(new THREE.LineSegments(new THREE.EdgesGeometry(cardGeo, 24), edgeMat));
  sculpture.add(glassCard);

  // Inner brushed emerald strip inside card for depth
  const innerStrip = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.16, 0.03), emeraldMat);
  innerStrip.position.set(0.06, 0.24, -0.06);
  innerStrip.rotation.z = -0.08;
  sculpture.add(innerStrip);

  // 3. Brushed-brass front clasp strap & emerald latch stud
  const claspShape = createRoundedRectShape(0.54, 0.28, 0.08);
  const claspGeo = new THREE.ExtrudeGeometry(claspShape, {
    depth: 0.12,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 2,
    curveSegments: 8,
  });
  claspGeo.center();
  const clasp = new THREE.Mesh(claspGeo, goldMat);
  clasp.position.set(0.56, -0.18, 0.22);
  const latchStud = new THREE.Mesh(new THREE.OctahedronGeometry(0.085, 0), emeraldMat);
  latchStud.position.set(0.46, -0.18, 0.31);
  sculpture.add(clasp, latchStud);

  // 4. Hovering brushed-brass & emerald ledger coin above the wallet
  const coinGroup = new THREE.Group();
  coinGroup.position.set(-0.32, 0.62, 0.16);
  const coinRim = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.042, 12, 48), goldMat);
  const coinCore = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.06, 32), emeraldMat);
  coinCore.rotation.x = Math.PI / 2;
  coinGroup.add(coinRim, coinCore);
  sculpture.add(coinGroup);

  const baseYaw = -0.38;
  sculpture.rotation.set(0.14, baseYaw, 0);

  let turnAngle = 0;

  return {
    group: root,
    cameraPos: [0, 0.24, 4.35],
    cameraFov: 34,
    updateAmbient(dt, elapsed, reducedMotion) {
      if (reducedMotion) {
        sculpture.rotation.set(0.14, baseYaw, 0);
        sculpture.position.y = 0;
        coinGroup.position.y = 0.62;
        return;
      }
      turnAngle += dt * 0.28;
      sculpture.rotation.y = baseYaw + turnAngle;
      sculpture.position.y = Math.sin(elapsed * 1.1) * 0.045;
      coinGroup.position.y = 0.62 + Math.sin(elapsed * 1.7) * 0.055;
      coinGroup.rotation.y = turnAngle * 1.4;
    },
    applyTheme(nextDark) {
      const next = nextDark ? STUDIO_PALETTES.dark : STUDIO_PALETTES.light;
      slateMat.color.setHex(nextDark ? 0x1d2633 : 0xd9d5ca);
      goldMat.color.setHex(next.gold);
      goldMat.emissive.setHex(next.gold);
      emeraldMat.color.setHex(next.emerald);
      emeraldMat.emissive.setHex(next.emerald);
      crystalMat.color.setHex(next.crystalTint);
      crystalMat.attenuationColor.setHex(next.crystalAttenuation);
      edgeMat.color.setHex(next.edgeLine);
      edgeMat.opacity = nextDark ? 0.48 : 0.34;
      shadow.applyTheme(nextDark);
    },
    disposeExtra() {
      shadow.dispose();
    },
  };
}

/**
 * Compact Studio Model E: COMPACT_KEYS
 * 3 interlocking precision brushed-brass, emerald & slate access rings symbolizing
 * 3-account quick login, orbiting a faceted crystal center core with 3 diamond pins.
 */
function createCompactKeysModel(
  isDark: boolean,
  isSoftwareGl: boolean,
  brushedTextures: BrushedTextures
): StudioModelHandle {
  const p = isDark ? STUDIO_PALETTES.dark : STUDIO_PALETTES.light;
  const root = new THREE.Group();

  const shadow = createContactShadow(isDark, 1.42, -1.12);
  root.add(shadow.mesh);

  const sculpture = new THREE.Group();
  root.add(sculpture);

  const goldMat = makeBrushedMetalMaterial(p.gold, brushedTextures, 0.2);
  const emeraldMat = makeBrushedMetalMaterial(p.emerald, brushedTextures, 0.22);
  const slateMetalMat = makeBrushedMetalMaterial(p.slate, brushedTextures, 0.26);
  const crystalMat = makeCrystalMaterial(p, isSoftwareGl);
  const edgeMat = new THREE.LineBasicMaterial({
    color: p.edgeLine,
    transparent: true,
    opacity: isDark ? 0.52 : 0.36,
  });

  // 1. Central faceted crystal core + emerald inner prism
  const coreGeo = new THREE.OctahedronGeometry(0.42, 0);
  const outerCore = new THREE.Mesh(coreGeo, crystalMat);
  outerCore.renderOrder = 4;
  outerCore.add(new THREE.LineSegments(new THREE.EdgesGeometry(coreGeo, 14), edgeMat));
  const innerCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), emeraldMat);
  sculpture.add(innerCore, outerCore);

  // 2. Three interlocking account access rings arranged at 120-degree symmetry
  const ringGeo = new THREE.TorusGeometry(0.74, 0.056, 14, 56);
  const ring1 = new THREE.Mesh(ringGeo, goldMat);
  ring1.position.set(0.26, 0.16, 0);
  ring1.rotation.set(0.45, 0.3, 0);

  const ring2 = new THREE.Mesh(ringGeo, emeraldMat);
  ring2.position.set(-0.26, 0.16, 0.06);
  ring2.rotation.set(-0.45, -0.35, Math.PI / 3);

  const ring3 = new THREE.Mesh(ringGeo, slateMetalMat);
  ring3.position.set(0, -0.26, -0.06);
  ring3.rotation.set(Math.PI / 2.4, 0.25, -Math.PI / 4);

  const ringsGroup = new THREE.Group();
  ringsGroup.add(ring1, ring2, ring3);
  sculpture.add(ringsGroup);

  // 3. Three cardinal diamond access tokens orbiting the cluster
  const pinGeo = new THREE.OctahedronGeometry(0.11, 0);
  const pinsGroup = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const pin = new THREE.Mesh(pinGeo, i === 0 ? goldMat : i === 1 ? emeraldMat : slateMetalMat);
    pin.position.set(Math.cos(a) * 1.04, Math.sin(a) * 0.42, Math.sin(a) * 0.85);
    pinsGroup.add(pin);
  }
  sculpture.add(pinsGroup);

  const baseYaw = 0.28;
  sculpture.rotation.set(0.12, baseYaw, 0);

  let turnAngle = 0;

  return {
    group: root,
    cameraPos: [0, 0.16, 4.45],
    cameraFov: 34,
    updateAmbient(dt, elapsed, reducedMotion) {
      if (reducedMotion) {
        sculpture.rotation.set(0.12, baseYaw, 0);
        sculpture.position.y = 0;
        return;
      }
      turnAngle += dt * 0.28;
      sculpture.rotation.y = baseYaw + turnAngle;
      sculpture.position.y = Math.sin(elapsed * 1.15 + 0.8) * 0.045;
      ringsGroup.rotation.z = turnAngle * 0.35;
      outerCore.rotation.y = -turnAngle * 0.7;
      innerCore.rotation.y = turnAngle * 1.1;
      pinsGroup.rotation.y = -turnAngle * 0.55;
    },
    applyTheme(nextDark) {
      const next = nextDark ? STUDIO_PALETTES.dark : STUDIO_PALETTES.light;
      goldMat.color.setHex(next.gold);
      goldMat.emissive.setHex(next.gold);
      emeraldMat.color.setHex(next.emerald);
      emeraldMat.emissive.setHex(next.emerald);
      slateMetalMat.color.setHex(next.slate);
      slateMetalMat.emissive.setHex(next.slate);
      crystalMat.color.setHex(next.crystalTint);
      crystalMat.attenuationColor.setHex(next.crystalAttenuation);
      edgeMat.color.setHex(next.edgeLine);
      edgeMat.opacity = nextDark ? 0.52 : 0.36;
      shadow.applyTheme(nextDark);
    },
    disposeExtra() {
      shadow.dispose();
    },
  };
}

export function createStudioModel(
  kind: StudioModelKind,
  isDark: boolean,
  isSoftwareGl: boolean,
  brushedTextures: BrushedTextures
): StudioModelHandle {
  switch (kind) {
    case 'ABOUT_BALANCE':
      return createAboutBalanceModel(isDark, isSoftwareGl, brushedTextures);
    case 'APP_FLOW':
      return createAppFlowModel(isDark, isSoftwareGl, brushedTextures);
    case 'PRIVACY_VAULT':
      return createPrivacyVaultModel(isDark, isSoftwareGl, brushedTextures);
    case 'WHY_NAV':
      return createCalmWhyStudioModel('NAV', isDark, isSoftwareGl, brushedTextures);
    case 'WHY_MARKET':
      return createCalmWhyStudioModel('MARKET', isDark, isSoftwareGl, brushedTextures);
    case 'WHY_BUDGET':
      return createCalmWhyStudioModel('BUDGET', isDark, isSoftwareGl, brushedTextures);
    case 'WHY_SECURITY':
      return createCalmWhyStudioModel('SECURITY', isDark, isSoftwareGl, brushedTextures);
    case 'COMPACT_WALLET':
      return createCompactWalletModel(isDark, isSoftwareGl, brushedTextures);
    case 'COMPACT_KEYS':
      return createCompactKeysModel(isDark, isSoftwareGl, brushedTextures);
  }
}

export function scheduleAfterDraw(
  renderer: THREE.WebGLRenderer,
  cb: () => void,
  onTimer: (id: number) => void
) {
  const gl = renderer.getContext() as WebGL2RenderingContext | null;
  if (!gl || typeof gl.fenceSync !== 'function') {
    onTimer(window.setTimeout(cb, 80));
    return;
  }
  const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
  gl.flush();
  const poll = () => {
    const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
    if (state === gl.UNSIGNALED) {
      onTimer(window.setTimeout(poll, 5));
    } else {
      if (sync) gl.deleteSync(sync);
      onTimer(window.setTimeout(cb, 80));
    }
  };
  onTimer(window.setTimeout(poll, 5));
}

export function disposeSceneTree(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) {
      geometries.add(mesh.geometry);
    }
    if (mesh.material) {
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => materials.add(m));
      } else {
        materials.add(mesh.material);
      }
    }
  });

  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
}
