import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { MeshTransmissionMaterial, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  createBrushedMetalTextures,
  detectSoftwareWebGL,
  isWebGLAvailable,
  scheduleAfterDraw,
} from '../lib/threeStudio';

interface PointerRefValue {
  x: number;
  y: number;
}

const STATIC_POSE_TIME = 1.45;
const _nodeDummy = new THREE.Object3D();
const _lookAtTarget = new THREE.Vector3(0, 0.04, 0);

const ORB_DISPLACEMENT_GLSL = `
float finflowOrganicWave(vec3 p, float t) {
  float w1 = sin(p.x * 1.95 + t * 0.62) * cos(p.y * 2.15 - t * 0.48) * sin(p.z * 1.85 + t * 0.41);
  float w2 = sin(p.y * 3.1 - p.z * 2.4 + t * 0.76) * 0.42;
  float w3 = cos(p.z * 2.8 + p.x * 2.6 - t * 0.54) * 0.28;
  return (w1 + w2 + w3) * 0.115;
}
`;

function HeroOrbFallbackSvg() {
  return (
    <div className="w-full h-full bg-[#030508] relative overflow-hidden">
      <svg
        viewBox="0 0 1200 760"
        className="w-full h-full opacity-90"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="ff-orb-aura" cx="50%" cy="48%" r="42%">
            <stop offset="0%" stopColor="#38B29A" stopOpacity="0.34" />
            <stop offset="44%" stopColor="#0E5A4F" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#030508" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="ff-orb-core" cx="38%" cy="34%" r="62%">
            <stop offset="0%" stopColor="#65D9C1" stopOpacity="0.82" />
            <stop offset="38%" stopColor="#127A67" stopOpacity="0.88" />
            <stop offset="78%" stopColor="#07312B" stopOpacity="0.96" />
            <stop offset="100%" stopColor="#041816" stopOpacity="1" />
          </radialGradient>
        </defs>
        <rect width="1200" height="760" fill="#030508" />
        <circle cx="600" cy="365" r="340" fill="url(#ff-orb-aura)" />
        <ellipse
          cx="600"
          cy="365"
          rx="275"
          ry="84"
          transform="rotate(-18 600 365)"
          stroke="#E2B05E"
          strokeOpacity="0.34"
          strokeWidth="1.2"
          fill="none"
        />
        <ellipse
          cx="600"
          cy="365"
          rx="325"
          ry="102"
          transform="rotate(24 600 365)"
          stroke="#38B29A"
          strokeOpacity="0.22"
          strokeWidth="1"
          fill="none"
        />
        <circle cx="600" cy="365" r="146" fill="url(#ff-orb-core)" />
        <circle
          cx="600"
          cy="365"
          r="152"
          stroke="#38B29A"
          strokeOpacity="0.32"
          strokeWidth="1.2"
          fill="none"
        />
      </svg>
    </div>
  );
}

function StudioEnvironmentRig({
  isSoftwareGl,
  shouldAnimate,
  onContextLoss,
}: {
  isSoftwareGl: boolean;
  shouldAnimate: boolean;
  onContextLoss: (lost: boolean) => void;
}) {
  const { gl, scene, camera, invalidate } = useThree();
  const activeRef = useRef(shouldAnimate);
  const pendingAfterDrawRef = useRef(false);
  const afterDrawTimerRef = useRef(0);

  useEffect(() => {
    activeRef.current = shouldAnimate;
    invalidate();
  }, [shouldAnimate, invalidate]);

  useEffect(() => {
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.14;

    scene.background = new THREE.Color(0x030508);
    scene.fog = new THREE.FogExp2(0x030508, 0.024);

    // Zero-404 procedural studio IBL so MeshTransmissionMaterial & brushed gold catch crisp reflections
    const pmremGenerator = new THREE.PMREMGenerator(gl);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmremGenerator.fromScene(roomEnv, 0.04);
    roomEnv.dispose();
    pmremGenerator.dispose();
    scene.environment = envTarget.texture;

    if (!isSoftwareGl) {
      gl.compile(scene, camera);
    }

    const dom = gl.domElement;
    const handleLost = (event: Event) => {
      event.preventDefault();
      onContextLoss(true);
    };
    const handleRestored = () => {
      onContextLoss(false);
      invalidate();
    };
    dom.addEventListener('webglcontextlost', handleLost, false);
    dom.addEventListener('webglcontextrestored', handleRestored, false);

    invalidate();

    return () => {
      window.clearTimeout(afterDrawTimerRef.current);
      dom.removeEventListener('webglcontextlost', handleLost);
      dom.removeEventListener('webglcontextrestored', handleRestored);
      scene.environment = null;
      scene.fog = null;
      envTarget.dispose();
    };
  }, [gl, scene, camera, isSoftwareGl, onContextLoss, invalidate]);

  // Software-WebGL paced loop: render once, wait for GPU fence completion + 80ms cooldown
  useFrame(
    (state) => {
      if (!isSoftwareGl) return;
      state.gl.render(state.scene, state.camera);
      if (activeRef.current && !pendingAfterDrawRef.current) {
        pendingAfterDrawRef.current = true;
        scheduleAfterDraw(
          state.gl,
          () => {
            pendingAfterDrawRef.current = false;
            if (activeRef.current) {
              state.invalidate();
            }
          },
          (id) => {
            afterDrawTimerRef.current = id;
          }
        );
      }
    },
    isSoftwareGl ? 1 : 0
  );

  return (
    <>
      <hemisphereLight args={[0x26544e, 0x05080d, 1.05]} />
      <directionalLight position={[4.6, 5.2, 5.0]} intensity={2.3} color={0xfff3dd} />
      <directionalLight position={[-4.8, 2.2, -3.6]} intensity={1.85} color={0x38b29a} />
      <pointLight
        position={[2.8, -2.4, 3.2]}
        intensity={3.4}
        distance={14}
        decay={2}
        color={0xe2b05e}
      />
      <pointLight
        position={[-3.2, 1.8, 2.6]}
        intensity={3.0}
        distance={14}
        decay={2}
        color={0x10b981}
      />
    </>
  );
}

function FinFlowStarfield({
  reducedMotion,
  isSoftwareGl,
  pointerRef,
}: {
  reducedMotion: boolean;
  isSoftwareGl: boolean;
  pointerRef: React.MutableRefObject<PointerRefValue>;
}) {
  const starGroupRef = useRef<THREE.Group>(null);
  const starLerpRef = useRef<PointerRefValue>({ x: 0, y: 0 });
  const elapsedRef = useRef(STATIC_POSE_TIME);
  const { gl } = useThree();

  // Accent stardust in FinFlow Emerald & Warm Gold layered over drei <Stars />
  const { geometry, material } = useMemo(() => {
    let seed = 7919;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    const starCount = 480;
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);
    const scales = new Float32Array(starCount);
    const phases = new Float32Array(starCount);

    const emerald = new THREE.Color(0x38b29a);
    const gold = new THREE.Color(0xe2b05e);
    const ivory = new THREE.Color(0xecebe6);
    const tint = new THREE.Color();

    for (let i = 0; i < starCount; i++) {
      const i3 = i * 3;
      const radius = 8.8 + Math.pow(rand(), 0.85) * 16.5;
      const theta = rand() * Math.PI * 2;
      const phi = Math.acos(2 * rand() - 1);

      positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = radius * Math.cos(phi) * 0.72;
      positions[i3 + 2] = radius * Math.sin(phi) * Math.sin(theta) - 3.6;

      const pick = rand();
      if (pick < 0.48) {
        tint.copy(emerald).lerp(ivory, rand() * 0.3);
      } else if (pick < 0.78) {
        tint.copy(gold).lerp(ivory, rand() * 0.35);
      } else {
        tint.copy(ivory);
      }

      colors[i3] = tint.r;
      colors[i3 + 1] = tint.g;
      colors[i3 + 2] = tint.b;

      scales[i] = 0.55 + Math.pow(rand(), 2.1) * 1.9;
      phases[i] = rand() * Math.PI * 2;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

    const mat = new THREE.ShaderMaterial({
      depthWrite: false,
      transparent: true,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      uniforms: {
        uTime: { value: STATIC_POSE_TIME },
        uPixelRatio: { value: Math.min(gl.getPixelRatio(), isSoftwareGl ? 1 : 2) },
      },
      vertexShader: `
        attribute float aScale;
        attribute float aPhase;
        uniform float uTime;
        uniform float uPixelRatio;
        varying vec3 vColor;
        varying float vAlpha;

        void main() {
          vColor = color;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          float twinkle = 0.58 + 0.42 * sin(uTime * 1.15 + aPhase);
          float depthFade = smoothstep(32.0, 6.0, -mvPosition.z);
          vAlpha = twinkle * depthFade * 0.72;
          gl_PointSize = clamp((24.0 * aScale * uPixelRatio) / max(1.2, -mvPosition.z), 1.4, 11.0);
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;

        void main() {
          float dist = length(gl_PointCoord - vec2(0.5));
          if (dist > 0.5) discard;
          float core = pow(1.0 - dist * 2.0, 2.4);
          gl_FragColor = vec4(vColor, core * vAlpha);
        }
      `,
    });

    return { geometry: geo, material: mat };
  }, [gl, isSoftwareGl]);

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  useFrame((_, delta) => {
    const dt = Math.min(0.16, Math.max(0.001, delta));
    const lerpAlpha = 1 - Math.exp(-2.4 * dt);
    const targetX = reducedMotion ? 0 : pointerRef.current.x;
    const targetY = reducedMotion ? 0 : pointerRef.current.y;

    starLerpRef.current.x = THREE.MathUtils.lerp(starLerpRef.current.x, targetX, lerpAlpha);
    starLerpRef.current.y = THREE.MathUtils.lerp(starLerpRef.current.y, targetY, lerpAlpha);

    if (!reducedMotion) {
      elapsedRef.current += dt;
      material.uniforms.uTime.value = elapsedRef.current;
    }

    if (starGroupRef.current) {
      starGroupRef.current.position.x = -starLerpRef.current.x * 0.42;
      starGroupRef.current.position.y = starLerpRef.current.y * 0.26;
      if (!reducedMotion) {
        starGroupRef.current.rotation.y =
          elapsedRef.current * 0.01 - starLerpRef.current.x * 0.045;
        starGroupRef.current.rotation.x =
          Math.sin(elapsedRef.current * 0.035) * 0.035 - starLerpRef.current.y * 0.03;
      }
    }
  });

  return (
    <group ref={starGroupRef}>
      <Stars
        radius={34}
        depth={46}
        count={1200}
        factor={2.6}
        saturation={0.28}
        fade
        speed={reducedMotion ? 0 : 0.4}
      />
      <points geometry={geometry} material={material} />
    </group>
  );
}

function EmeraldOrbAssembly({
  reducedMotion,
  isSoftwareGl,
  pointerRef,
}: {
  reducedMotion: boolean;
  isSoftwareGl: boolean;
  pointerRef: React.MutableRefObject<PointerRefValue>;
}) {
  const { gl, camera } = useThree();
  const parallaxGroupRef = useRef<THREE.Group>(null);
  const floatGroupRef = useRef<THREE.Group>(null);
  const coreMeshRef = useRef<THREE.Mesh>(null);
  const innerHeartRef = useRef<THREE.Mesh>(null);
  const haloMeshRef = useRef<THREE.Mesh>(null);
  const ring1Ref = useRef<THREE.Group>(null);
  const ring2Ref = useRef<THREE.Group>(null);
  const ring3Ref = useRef<THREE.Mesh>(null);
  const nodesRef = useRef<THREE.InstancedMesh>(null);

  const elapsedRef = useRef(STATIC_POSE_TIME);
  const smoothedMouseRef = useRef<PointerRefValue>({ x: 0, y: 0 });
  const weightedMouseRef = useRef<PointerRefValue>({ x: 0, y: 0 });
  const coreUniformsRef = useRef<{ uTime: { value: number } }>({
    uTime: { value: STATIC_POSE_TIME },
  });

  const resources = useMemo(() => {
    const brushed = createBrushedMetalTextures(gl.capabilities.getMaxAnisotropy());

    // 1. Sculpted organic icosahedron geometry for the emerald orb
    const coreGeo = new THREE.IcosahedronGeometry(1.42, 6);

    // Software-WebGL single-pass PBR emerald material (matches MeshTransmissionMaterial aesthetic without extra FBO pass)
    const softwareCoreMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0x0b6c5b),
      emissive: new THREE.Color(0x0c4c40),
      emissiveIntensity: 0.48,
      metalness: 0.34,
      roughness: 0.16,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
      iridescence: 0.65,
      iridescenceIOR: 1.38,
      iridescenceThicknessRange: [180, 420],
      envMapIntensity: 1.48,
    });
    softwareCoreMat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = coreUniformsRef.current.uTime;
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
uniform float uTime;
${ORB_DISPLACEMENT_GLSL}`
        )
        .replace(
          '#include <beginnormal_vertex>',
          `#include <beginnormal_vertex>
vec3 ffBasePos = position;
float ffEps = 0.035;
float ffH0 = finflowOrganicWave(ffBasePos, uTime);
float ffHx = finflowOrganicWave(ffBasePos + vec3(ffEps, 0.0, 0.0), uTime);
float ffHy = finflowOrganicWave(ffBasePos + vec3(0.0, ffEps, 0.0), uTime);
float ffHz = finflowOrganicWave(ffBasePos + vec3(0.0, 0.0, ffEps), uTime);
vec3 ffGrad = vec3(ffHx - ffH0, ffHy - ffH0, ffHz - ffH0) / ffEps;
objectNormal = normalize(objectNormal - ffGrad * 0.58);`
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
transformed += normalize(position) * ffH0;`
        );
    };
    softwareCoreMat.customProgramCacheKey = () => 'finflow-organic-emerald-core-v2';

    // 2. Inner luminous emerald-gold crystalline heart (visible through MeshTransmissionMaterial)
    const heartGeo = new THREE.IcosahedronGeometry(0.76, 2);
    const heartMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0x168f78),
      emissive: new THREE.Color(0x14997e),
      emissiveIntensity: 0.95,
      metalness: 0.25,
      roughness: 0.42,
      clearcoat: 0.5,
      flatShading: true,
    });

    // 3. Soft Fresnel emerald/gold atmospheric halo shell
    const haloGeo = new THREE.IcosahedronGeometry(1.62, 5);
    const haloMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.FrontSide,
      uniforms: {
        uTime: { value: STATIC_POSE_TIME },
        uEmerald: { value: new THREE.Color(0x38b29a) },
        uGold: { value: new THREE.Color(0xe2b05e) },
      },
      vertexShader: `
        uniform float uTime;
        varying vec3 vNormalDir;
        varying vec3 vViewDir;
        varying float vCrest;
        ${ORB_DISPLACEMENT_GLSL}

        void main() {
          float disp = finflowOrganicWave(position * 0.92, uTime * 0.92) * 0.65;
          vec3 displaced = position + normal * disp;
          vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
          vNormalDir = normalize(normalMatrix * normal);
          vViewDir = normalize(-mvPosition.xyz);
          vCrest = smoothstep(-0.3, 0.9, position.y);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 uEmerald;
        uniform vec3 uGold;
        varying vec3 vNormalDir;
        varying vec3 vViewDir;
        varying float vCrest;

        void main() {
          float ndotv = clamp(dot(normalize(vNormalDir), normalize(vViewDir)), 0.0, 1.0);
          float fresnel = pow(1.0 - ndotv, 3.05);
          vec3 rimColor = mix(uEmerald, uGold, vCrest * 0.34);
          float alpha = fresnel * 0.52;
          gl_FragColor = vec4(rimColor * (0.95 + fresnel * 0.45), alpha);
        }
      `,
    });

    // 4. Primary brushed warm-gold thin orbital ring
    const ring1Geo = new THREE.TorusGeometry(2.12, 0.013, 20, 144);
    const goldRingMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0xe2b05e),
      emissive: new THREE.Color(0x7c5318),
      emissiveIntensity: 0.24,
      metalness: 0.94,
      roughness: 0.24,
      anisotropy: 0.78,
      roughnessMap: brushed.roughnessMap,
      bumpMap: brushed.bumpMap,
      bumpScale: 0.004,
      envMapIntensity: 1.55,
    });

    // 5. Secondary ultra-thin champagne-gold orbital ring
    const ring2Geo = new THREE.TorusGeometry(2.58, 0.0085, 16, 160);
    const champagneRingMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0xf0cd89),
      emissive: new THREE.Color(0x694717),
      emissiveIntensity: 0.18,
      metalness: 0.92,
      roughness: 0.2,
      anisotropy: 0.65,
      roughnessMap: brushed.roughnessMap,
      transparent: true,
      opacity: 0.84,
      envMapIntensity: 1.4,
    });

    // 6. Outer hairline emerald-slate precision ring
    const ring3Geo = new THREE.TorusGeometry(3.06, 0.0065, 16, 168);
    const emeraldRingMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x38b29a),
      emissive: new THREE.Color(0x166355),
      emissiveIntensity: 0.3,
      metalness: 0.72,
      roughness: 0.45,
      transparent: true,
      opacity: 0.48,
    });

    // 7. Faceted micro orbital satellite nodes (InstancedMesh)
    const nodeGeo = new THREE.OctahedronGeometry(0.044, 0);
    const nodeMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0xf4d48e),
      emissive: new THREE.Color(0x9a6d24),
      emissiveIntensity: 0.35,
      metalness: 0.96,
      roughness: 0.16,
      clearcoat: 0.8,
      envMapIntensity: 1.6,
    });

    return {
      brushed,
      coreGeo,
      softwareCoreMat,
      heartGeo,
      heartMat,
      haloGeo,
      haloMat,
      ring1Geo,
      goldRingMat,
      ring2Geo,
      champagneRingMat,
      ring3Geo,
      emeraldRingMat,
      nodeGeo,
      nodeMat,
    };
  }, [gl]);

  // Populate 6 micro orbital nodes across primary & secondary rings
  useEffect(() => {
    const inst = nodesRef.current;
    if (!inst) return;
    const nodeSpecs: Array<{ radius: number; angle: number; scale: number; ringIndex: 0 | 1 }> = [
      { radius: 2.12, angle: 0.35, scale: 1.15, ringIndex: 0 },
      { radius: 2.12, angle: 2.48, scale: 0.88, ringIndex: 0 },
      { radius: 2.12, angle: 4.62, scale: 1.0, ringIndex: 0 },
      { radius: 2.58, angle: 1.12, scale: 0.92, ringIndex: 1 },
      { radius: 2.58, angle: 3.38, scale: 0.78, ringIndex: 1 },
      { radius: 2.58, angle: 5.42, scale: 1.05, ringIndex: 1 },
    ];
    const r1Euler = new THREE.Euler(1.16, 0.28, 0.34);
    const r2Euler = new THREE.Euler(1.36, -0.52, -0.24);
    const pos = new THREE.Vector3();

    nodeSpecs.forEach((spec, idx) => {
      pos.set(Math.cos(spec.angle) * spec.radius, Math.sin(spec.angle) * spec.radius, 0);
      pos.applyEuler(spec.ringIndex === 0 ? r1Euler : r2Euler);
      _nodeDummy.position.copy(pos);
      _nodeDummy.rotation.set(spec.angle * 0.5, spec.angle, 0.3);
      _nodeDummy.scale.setScalar(spec.scale);
      _nodeDummy.updateMatrix();
      inst.setMatrixAt(idx, _nodeDummy.matrix);
    });
    inst.instanceMatrix.needsUpdate = true;
    inst.computeBoundingSphere();
  }, []);

  useEffect(() => {
    return () => {
      resources.brushed.dispose();
      resources.coreGeo.dispose();
      resources.softwareCoreMat.dispose();
      resources.heartGeo.dispose();
      resources.heartMat.dispose();
      resources.haloGeo.dispose();
      resources.haloMat.dispose();
      resources.ring1Geo.dispose();
      resources.goldRingMat.dispose();
      resources.ring2Geo.dispose();
      resources.champagneRingMat.dispose();
      resources.ring3Geo.dispose();
      resources.emeraldRingMat.dispose();
      resources.nodeGeo.dispose();
      resources.nodeMat.dispose();
    };
  }, [resources]);

  useFrame((_, delta) => {
    const dt = Math.min(0.16, Math.max(0.001, delta));

    if (!reducedMotion) {
      elapsedRef.current += dt;
    } else {
      elapsedRef.current = STATIC_POSE_TIME;
    }

    const t = elapsedRef.current;
    coreUniformsRef.current.uTime.value = t;
    resources.haloMat.uniforms.uTime.value = t;

    // Ambient float & subtle organic breathing
    if (floatGroupRef.current) {
      floatGroupRef.current.position.y = reducedMotion ? 0.08 : 0.08 + Math.sin(t * 0.62) * 0.16;
      const breathe = reducedMotion ? 1.0 : 1.0 + Math.sin(t * 0.44) * 0.018;
      floatGroupRef.current.scale.setScalar(breathe);
    }

    // Slow sculpted core rotation
    if (coreMeshRef.current && haloMeshRef.current) {
      const rotY = reducedMotion ? 0.42 : t * 0.125;
      const rotX = reducedMotion ? 0.12 : Math.sin(t * 0.32) * 0.15;
      coreMeshRef.current.rotation.set(rotX, rotY, 0.08);
      haloMeshRef.current.rotation.set(rotX, rotY, 0.08);
    }

    if (innerHeartRef.current) {
      innerHeartRef.current.rotation.set(-t * 0.11, -t * 0.18, t * 0.06);
    }

    // Counter-rotating thin gold & emerald orbital rings
    if (ring1Ref.current) {
      ring1Ref.current.rotation.z = reducedMotion ? 0.34 : 0.34 + t * 0.095;
    }
    if (ring2Ref.current) {
      ring2Ref.current.rotation.z = reducedMotion ? -0.24 : -0.24 - t * 0.068;
    }
    if (ring3Ref.current) {
      ring3Ref.current.rotation.z = reducedMotion ? 0.18 : 0.18 + t * 0.042;
    }
    if (nodesRef.current) {
      nodesRef.current.rotation.y = reducedMotion ? 0 : t * 0.055;
      nodesRef.current.rotation.x = reducedMotion ? 0 : Math.sin(t * 0.28) * 0.06;
    }

    // Responsive two-stage smoothed mouse lerp for weight-sensitive physical inertia
    const targetX = reducedMotion ? 0 : pointerRef.current.x;
    const targetY = reducedMotion ? 0 : pointerRef.current.y;

    // Stage 1: Responsive primary mouse lerp (frame-rate independent linear interpolation)
    const responsiveAlpha = 1 - Math.exp(-7.6 * dt);
    const smoothed = smoothedMouseRef.current;
    smoothed.x = THREE.MathUtils.lerp(smoothed.x, targetX, responsiveAlpha);
    smoothed.y = THREE.MathUtils.lerp(smoothed.y, targetY, responsiveAlpha);

    // Stage 2: Heavier inertial follow lerp for physical mass & subtle banking lean
    const weightedAlpha = 1 - Math.exp(-3.4 * dt);
    const weighted = weightedMouseRef.current;
    weighted.x = THREE.MathUtils.lerp(weighted.x, smoothed.x, weightedAlpha);
    weighted.y = THREE.MathUtils.lerp(weighted.y, smoothed.y, weightedAlpha);

    const velocityX = smoothed.x - weighted.x;
    const velocityY = smoothed.y - weighted.y;

    if (parallaxGroupRef.current) {
      parallaxGroupRef.current.position.x = THREE.MathUtils.lerp(
        parallaxGroupRef.current.position.x,
        smoothed.x * 0.48,
        responsiveAlpha
      );
      parallaxGroupRef.current.position.y = THREE.MathUtils.lerp(
        parallaxGroupRef.current.position.y,
        0.04 - smoothed.y * 0.3,
        responsiveAlpha
      );
      parallaxGroupRef.current.rotation.y = THREE.MathUtils.lerp(
        parallaxGroupRef.current.rotation.y,
        smoothed.x * 0.38,
        responsiveAlpha
      );
      parallaxGroupRef.current.rotation.x = THREE.MathUtils.lerp(
        parallaxGroupRef.current.rotation.x,
        smoothed.y * 0.26,
        responsiveAlpha
      );
      // Weight-sensitive banking roll during lateral cursor sweeps, settling back to 0 at rest
      parallaxGroupRef.current.rotation.z = THREE.MathUtils.lerp(
        parallaxGroupRef.current.rotation.z,
        THREE.MathUtils.clamp(-velocityX * 0.32, -0.14, 0.14),
        responsiveAlpha
      );
    }

    // Subtle secondary refractive offset for inner emerald heart & suspended rings
    if (innerHeartRef.current) {
      innerHeartRef.current.position.x = weighted.x * 0.14;
      innerHeartRef.current.position.y = -weighted.y * 0.1;
    }
    if (ring1Ref.current) {
      ring1Ref.current.rotation.x = THREE.MathUtils.lerp(
        ring1Ref.current.rotation.x,
        velocityY * 0.24 + weighted.y * 0.1,
        weightedAlpha
      );
      ring1Ref.current.rotation.y = THREE.MathUtils.lerp(
        ring1Ref.current.rotation.y,
        -velocityX * 0.24 - weighted.x * 0.1,
        weightedAlpha
      );
    }
    if (ring2Ref.current) {
      ring2Ref.current.rotation.x = THREE.MathUtils.lerp(
        ring2Ref.current.rotation.x,
        -velocityY * 0.18 - weighted.y * 0.08,
        weightedAlpha
      );
      ring2Ref.current.rotation.y = THREE.MathUtils.lerp(
        ring2Ref.current.rotation.y,
        velocityX * 0.18 + weighted.x * 0.08,
        weightedAlpha
      );
    }

    // Weighted camera parallax amplifies foreground-to-starfield depth separation
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, weighted.x * 0.72, weightedAlpha);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, -weighted.y * 0.44, weightedAlpha);
    _lookAtTarget.set(smoothed.x * 0.14, 0.04 - smoothed.y * 0.08, 0);
    camera.lookAt(_lookAtTarget);
  });

  return (
    <group ref={parallaxGroupRef} position={[0, 0.04, 0]}>
      <group ref={floatGroupRef}>
        {/* Inner Luminous Emerald Heart refracted through outer glass shell */}
        <mesh
          ref={innerHeartRef}
          geometry={resources.heartGeo}
          material={resources.heartMat}
        />

        {/* Outer Sculpted Organic Emerald Orb (MeshTransmissionMaterial on GPU, PBR organic shader on software WebGL) */}
        {isSoftwareGl ? (
          <mesh
            ref={coreMeshRef}
            geometry={resources.coreGeo}
            material={resources.softwareCoreMat}
          />
        ) : (
          <mesh ref={coreMeshRef} geometry={resources.coreGeo}>
            <MeshTransmissionMaterial
              color="#149e83"
              attenuationColor="#05382e"
              attenuationDistance={1.15}
              transmission={0.93}
              thickness={1.45}
              ior={1.52}
              roughness={0.14}
              metalness={0.08}
              chromaticAberration={0.04}
              anisotropy={0.28}
              distortion={0.42}
              distortionScale={0.45}
              temporalDistortion={reducedMotion ? 0 : 0.14}
              clearcoat={1}
              clearcoatRoughness={0.08}
              samples={6}
              resolution={512}
              backside
              envMapIntensity={1.45}
            />
          </mesh>
        )}

        {/* Atmospheric Fresnel Emerald-Gold Rim Shell */}
        <mesh
          ref={haloMeshRef}
          geometry={resources.haloGeo}
          material={resources.haloMat}
          renderOrder={2}
        />

        {/* Ring 1: Primary Brushed Warm-Gold Orbital Ring */}
        <group rotation={[1.16, 0.28, 0]}>
          <group ref={ring1Ref}>
            <mesh geometry={resources.ring1Geo} material={resources.goldRingMat} />
          </group>
        </group>

        {/* Ring 2: Secondary Fine Champagne-Gold Orbital Ring */}
        <group rotation={[1.36, -0.52, 0]}>
          <group ref={ring2Ref}>
            <mesh geometry={resources.ring2Geo} material={resources.champagneRingMat} />
          </group>
        </group>

        {/* Ring 3: Outer Hairline Emerald Precision Ring */}
        <group rotation={[0.92, 0.64, 0]}>
          <mesh
            ref={ring3Ref}
            geometry={resources.ring3Geo}
            material={resources.emeraldRingMat}
          />
        </group>

        {/* Micro Faceted Gold Orbital Nodes */}
        <instancedMesh
          ref={nodesRef}
          args={[resources.nodeGeo, resources.nodeMat, 6]}
          frustumCulled={false}
        />
      </group>
    </group>
  );
}

export function HeroCanvas({ reducedMotion = false }: { reducedMotion?: boolean }) {
  const isSoftwareGl = useMemo(() => detectSoftwareWebGL(), []);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const pointerRef = useRef<PointerRefValue>({ x: 0, y: 0 });

  const [inViewport, setInViewport] = useState(true);
  const [webglFailed, setWebglFailed] = useState(() => !isWebGLAvailable());

  // Passive window-level pointer tracking so foreground buttons stay 100% interactive
  useEffect(() => {
    if (reducedMotion) {
      pointerRef.current.x = 0;
      pointerRef.current.y = 0;
      return;
    }

    const handlePointerMove = (e: PointerEvent) => {
      const nx = (e.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
      const ny = (e.clientY / Math.max(1, window.innerHeight)) * 2 - 1;
      pointerRef.current.x = THREE.MathUtils.clamp(nx, -1, 1);
      pointerRef.current.y = THREE.MathUtils.clamp(ny, -1, 1);
    };
    const handlePointerLeave = () => {
      pointerRef.current.x = 0;
      pointerRef.current.y = 0;
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerleave', handlePointerLeave, { passive: true });
    window.addEventListener('pointercancel', handlePointerLeave, { passive: true });
    window.addEventListener('blur', handlePointerLeave);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerleave', handlePointerLeave);
      window.removeEventListener('pointercancel', handlePointerLeave);
      window.removeEventListener('blur', handlePointerLeave);
    };
  }, [reducedMotion]);

  // Pause render loop whenever hero scrolls off-screen to preserve GPU for section models
  useEffect(() => {
    const el = hostRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        setInViewport(entries.some((entry) => entry.isIntersecting));
      },
      { threshold: 0.02 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (webglFailed) {
    return <HeroOrbFallbackSvg />;
  }

  const shouldAnimate = inViewport && !reducedMotion;

  return (
    <div ref={hostRef} className="w-full h-full pointer-events-none" aria-hidden="true">
      <Canvas
        dpr={isSoftwareGl ? 1 : [1, 2]}
        frameloop={shouldAnimate && !isSoftwareGl ? 'always' : 'demand'}
        camera={{ position: [0, 0, 7.1], fov: 42, near: 0.1, far: 80 }}
        gl={{
          antialias: !isSoftwareGl,
          powerPreference: 'high-performance',
          alpha: false,
        }}
        style={{ width: '100%', height: '100%', display: 'block', pointerEvents: 'none' }}
      >
        <StudioEnvironmentRig
          isSoftwareGl={isSoftwareGl}
          shouldAnimate={shouldAnimate}
          onContextLoss={setWebglFailed}
        />
        <FinFlowStarfield
          reducedMotion={reducedMotion}
          isSoftwareGl={isSoftwareGl}
          pointerRef={pointerRef}
        />
        <EmeraldOrbAssembly
          reducedMotion={reducedMotion}
          isSoftwareGl={isSoftwareGl}
          pointerRef={pointerRef}
        />
      </Canvas>
    </div>
  );
}
