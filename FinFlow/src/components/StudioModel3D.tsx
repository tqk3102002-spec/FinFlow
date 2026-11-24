import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  type BrushedTextures,
  type EmblemLightRig,
  type StudioModelHandle,
  type StudioModelKind,
  createBrushedMetalTextures,
  createEmblemLighting,
  createStudioModel,
  detectSoftwareWebGL,
  disposeSceneTree,
  isWebGLAvailable,
  scheduleAfterDraw,
} from '../lib/threeStudio';

interface CachedModelEntry {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  lightRig: EmblemLightRig;
  handle: StudioModelHandle;
}

interface SlotRecord {
  id: number;
  kind: StudioModelKind;
  canvas: HTMLCanvasElement;
  visible: boolean;
  onReady: () => void;
  onFallback: () => void;
}

/**
 * Single shared offscreen WebGL studio renderer for all compact 72–96px 3D feature medallions.
 * Uses exactly ONE WebGL context for the entire landing content regardless of how many
 * compact 3D models appear on screen, eliminating context eviction and scroll hitching.
 */
class SharedStudioEngine {
  private renderer: THREE.WebGLRenderer | null = null;
  private envRenderTarget: THREE.WebGLRenderTarget | null = null;
  private envTexture: THREE.Texture | null = null;
  private brushedTextures: BrushedTextures | null = null;
  private models = new Map<StudioModelKind, CachedModelEntry>();
  private slots = new Map<number, SlotRecord>();
  private nextSlotId = 1;

  private isSoftwareGl = false;
  private isDark = false;
  private reducedMotion = false;
  private contextLost = false;
  private failed = false;
  private tabVisible = true;

  private loopActive = false;
  private frameId = 0;
  private afterDrawTimer = 0;
  private renderBusy = false;
  private renderDirty = false;
  private lastTime = 0;
  private elapsed = 0;

  private boundOnVisibilityChange = () => {
    this.tabVisible = document.visibilityState !== 'hidden';
    this.syncLoop();
  };

  private boundOnContextLost = (e: Event) => {
    e.preventDefault();
    this.contextLost = true;
    this.loopActive = false;
    cancelAnimationFrame(this.frameId);
    window.clearTimeout(this.afterDrawTimer);
    this.slots.forEach((slot) => slot.onFallback());
  };

  private boundOnContextRestored = () => {
    this.contextLost = false;
    this.syncLoop();
  };

  private ensureRenderer(): boolean {
    if (this.failed) return false;
    if (this.renderer) return true;
    if (!isWebGLAvailable()) {
      this.failed = true;
      return false;
    }

    this.isSoftwareGl = detectSoftwareWebGL();
    try {
      const renderer = new THREE.WebGLRenderer({
        antialias: !this.isSoftwareGl,
        powerPreference: 'high-performance',
        alpha: true,
      });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.08;
      const dpr = this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2);
      const bufferSize = this.isSoftwareGl ? 128 : Math.round(96 * dpr);
      renderer.setPixelRatio(1);
      renderer.setSize(bufferSize, bufferSize, false);
      renderer.setClearColor(0x000000, 0);

      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      const roomEnv = new RoomEnvironment();
      const envRenderTarget = pmremGenerator.fromScene(roomEnv, 0.04);
      roomEnv.dispose();
      pmremGenerator.dispose();

      const brushedTextures = createBrushedMetalTextures(
        renderer.capabilities.getMaxAnisotropy()
      );

      renderer.domElement.addEventListener('webglcontextlost', this.boundOnContextLost, false);
      renderer.domElement.addEventListener(
        'webglcontextrestored',
        this.boundOnContextRestored,
        false
      );
      document.addEventListener('visibilitychange', this.boundOnVisibilityChange);

      this.renderer = renderer;
      this.envRenderTarget = envRenderTarget;
      this.envTexture = envRenderTarget.texture;
      this.brushedTextures = brushedTextures;
      this.tabVisible = document.visibilityState !== 'hidden';
      return true;
    } catch {
      this.failed = true;
      return false;
    }
  }

  private getOrCreateModel(kind: StudioModelKind): CachedModelEntry | null {
    if (!this.renderer || !this.envTexture || !this.brushedTextures) return null;
    const existing = this.models.get(kind);
    if (existing) return existing;

    const scene = new THREE.Scene();
    scene.environment = this.envTexture;

    const handle = createStudioModel(kind, this.isDark, this.isSoftwareGl, this.brushedTextures);
    scene.add(handle.group);

    const camera = new THREE.PerspectiveCamera(handle.cameraFov, 1, 0.1, 30);
    camera.position.set(handle.cameraPos[0], handle.cameraPos[1], handle.cameraPos[2]);
    camera.lookAt(0, -0.04, 0);

    const lightRig = createEmblemLighting(scene, this.isDark);
    lightRig.applyTheme(this.isDark, this.renderer);

    if (!this.isSoftwareGl) {
      this.renderer.compile(scene, camera);
    }

    const entry: CachedModelEntry = { scene, camera, lightRig, handle };
    this.models.set(kind, entry);
    return entry;
  }

  public registerSlot(
    kind: StudioModelKind,
    canvas: HTMLCanvasElement,
    isDark: boolean,
    reducedMotion: boolean,
    onReady: () => void,
    onFallback: () => void
  ): number {
    this.isDark = isDark;
    this.reducedMotion = reducedMotion;

    if (!this.ensureRenderer()) {
      onFallback();
      return -1;
    }

    const id = this.nextSlotId++;
    this.slots.set(id, {
      id,
      kind,
      canvas,
      visible: false,
      onReady,
      onFallback,
    });
    return id;
  }

  public updateSlotVisibility(id: number, visible: boolean) {
    const slot = this.slots.get(id);
    if (!slot) return;
    if (slot.visible === visible) return;
    slot.visible = visible;
    if (visible) {
      this.requestSingleRender();
    }
    this.syncLoop();
  }

  public updatePreferences(isDark: boolean, reducedMotion: boolean) {
    let themeChanged = false;
    if (this.isDark !== isDark) {
      this.isDark = isDark;
      themeChanged = true;
      if (this.renderer) {
        this.models.forEach((entry) => {
          entry.lightRig.applyTheme(isDark, this.renderer!);
          entry.handle.applyTheme(isDark);
        });
      }
    }

    const motionChanged = this.reducedMotion !== reducedMotion;
    if (motionChanged) {
      this.reducedMotion = reducedMotion;
    }

    if (themeChanged || motionChanged) {
      this.syncLoop();
      this.requestSingleRender();
    }
  }

  public unregisterSlot(id: number) {
    if (id < 0) return;
    this.slots.delete(id);
    if (this.slots.size === 0) {
      this.disposeAll();
    } else {
      this.syncLoop();
    }
  }

  private hasVisibleSlots(): boolean {
    for (const slot of this.slots.values()) {
      if (slot.visible) return true;
    }
    return false;
  }

  private renderVisibleKinds(now: number) {
    if (!this.renderer || this.contextLost || !this.tabVisible) return;

    // Group currently visible slots by model kind so each unique 3D model renders only once per frame
    const grouped = new Map<StudioModelKind, SlotRecord[]>();
    this.slots.forEach((slot) => {
      if (!slot.visible) return;
      const list = grouped.get(slot.kind);
      if (list) {
        list.push(slot);
      } else {
        grouped.set(slot.kind, [slot]);
      }
    });

    if (grouped.size === 0) return;

    const dt = this.reducedMotion
      ? 0
      : this.isSoftwareGl
        ? 0.08
        : Math.min(0.05, Math.max(0.001, (now - this.lastTime) / 1000));
    this.lastTime = now;
    if (!this.reducedMotion) {
      this.elapsed += dt;
    }

    grouped.forEach((targetSlots, kind) => {
      const entry = this.getOrCreateModel(kind);
      if (!entry || !this.renderer) return;

      entry.handle.updateAmbient(dt, this.elapsed, this.reducedMotion);
      this.renderer.render(entry.scene, entry.camera);

      const src = this.renderer.domElement;
      for (const slot of targetSlots) {
        const ctx = slot.canvas.getContext('2d');
        if (!ctx) continue;
        const w = slot.canvas.width;
        const h = slot.canvas.height;
        if (w <= 0 || h <= 0) continue;
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(src, 0, 0, w, h);
        slot.onReady();
      }
    });
  }

  public requestSingleRender() {
    if (!this.renderer || this.contextLost || !this.tabVisible || !this.hasVisibleSlots()) return;
    if (!this.reducedMotion && this.loopActive) return;
    if (this.renderBusy) {
      this.renderDirty = true;
      return;
    }
    this.renderBusy = true;
    this.frameId = requestAnimationFrame((now) => {
      this.renderDirty = false;
      this.renderVisibleKinds(now);
      const done = () => {
        this.renderBusy = false;
        if (this.renderDirty) this.requestSingleRender();
      };
      if (this.isSoftwareGl && this.renderer) {
        scheduleAfterDraw(this.renderer, done, (timerId) => {
          this.afterDrawTimer = timerId;
        });
      } else {
        done();
      }
    });
  }

  private tick = (now: number) => {
    if (!this.renderer || this.contextLost || !this.loopActive || !this.tabVisible) {
      this.loopActive = false;
      return;
    }
    if (!this.hasVisibleSlots()) {
      this.loopActive = false;
      return;
    }

    this.renderVisibleKinds(now);

    if (this.isSoftwareGl) {
      scheduleAfterDraw(
        this.renderer,
        () => {
          if (this.renderer && !this.contextLost && this.loopActive && this.tabVisible) {
            this.tick(performance.now());
          }
        },
        (timerId) => {
          this.afterDrawTimer = timerId;
        }
      );
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  private syncLoop() {
    if (!this.renderer || this.contextLost) return;
    if (!this.tabVisible || !this.hasVisibleSlots()) {
      this.loopActive = false;
      return;
    }

    if (!this.reducedMotion) {
      if (!this.loopActive) {
        this.loopActive = true;
        this.lastTime = performance.now();
        this.frameId = requestAnimationFrame(this.tick);
      }
    } else {
      this.loopActive = false;
      this.requestSingleRender();
    }
  }

  private disposeAll() {
    this.loopActive = false;
    this.renderBusy = false;
    this.renderDirty = false;
    cancelAnimationFrame(this.frameId);
    window.clearTimeout(this.afterDrawTimer);
    document.removeEventListener('visibilitychange', this.boundOnVisibilityChange);

    this.models.forEach((entry) => {
      entry.handle.disposeExtra();
      disposeSceneTree(entry.scene);
    });
    this.models.clear();

    this.brushedTextures?.dispose();
    this.brushedTextures = null;

    this.envRenderTarget?.dispose();
    this.envRenderTarget = null;
    this.envTexture = null;

    if (this.renderer) {
      this.renderer.domElement.removeEventListener('webglcontextlost', this.boundOnContextLost);
      this.renderer.domElement.removeEventListener(
        'webglcontextrestored',
        this.boundOnContextRestored
      );
      this.renderer.dispose();
      this.renderer = null;
    }
  }
}

const sharedStudioEngine = new SharedStudioEngine();

function StudioFallbackSvg({ kind }: { kind: StudioModelKind }) {
  return (
    <div className="w-full h-full flex items-center justify-center p-2">
      <svg
        viewBox="0 0 120 120"
        className="w-full h-full text-[#0E5A4F] dark:text-[#38B29A] opacity-85"
        fill="none"
        aria-hidden="true"
      >
        {kind === 'ABOUT_BALANCE' && (
          <>
            <ellipse cx="60" cy="94" rx="36" ry="8" stroke="#B47B2B" strokeWidth="2" />
            <rect
              x="30"
              y="66"
              width="60"
              height="14"
              rx="4"
              stroke="currentColor"
              strokeWidth="2"
              fill="currentColor"
              fillOpacity="0.12"
            />
            <line x1="60" y1="30" x2="60" y2="66" stroke="#B47B2B" strokeWidth="2.2" />
            <line x1="26" y1="36" x2="94" y2="28" stroke="#B47B2B" strokeWidth="2.4" />
            <circle cx="26" cy="36" r="7" stroke="currentColor" strokeWidth="2" />
            <circle cx="94" cy="28" r="7" stroke="#B47B2B" strokeWidth="2" />
          </>
        )}
        {kind === 'WHY_NAV' && (
          <>
            <ellipse cx="60" cy="60" rx="42" ry="18" stroke="#B47B2B" strokeWidth="2" />
            <polygon
              points="60,20 84,60 60,100 36,60"
              stroke="currentColor"
              strokeWidth="2.2"
              fill="currentColor"
              fillOpacity="0.14"
            />
          </>
        )}
        {kind === 'WHY_MARKET' && (
          <>
            <path
              d="M20 86 C42 38, 74 82, 100 26"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
            />
            <path
              d="M20 94 C48 64, 72 62, 100 44"
              stroke="#B47B2B"
              strokeWidth="2"
              strokeDasharray="4 4"
            />
          </>
        )}
        {kind === 'WHY_BUDGET' && (
          <>
            <circle
              cx="60"
              cy="60"
              r="36"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeDasharray="140 88"
            />
            <circle
              cx="60"
              cy="60"
              r="36"
              stroke="#B47B2B"
              strokeWidth="2.6"
              strokeDasharray="50 178"
              strokeDashoffset="-146"
            />
            <line
              x1="60"
              y1="60"
              x2="84"
              y2="44"
              stroke="#B47B2B"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
          </>
        )}
        {(kind === 'WHY_SECURITY' || kind === 'PRIVACY_VAULT') && (
          <>
            <polygon
              points="60,18 94,38 94,82 60,102 26,82 26,38"
              stroke="currentColor"
              strokeWidth="2.2"
              fill="currentColor"
              fillOpacity="0.12"
            />
            <circle cx="60" cy="60" r="24" stroke="#B47B2B" strokeWidth="2" />
            <polygon points="60,44 74,60 60,76 46,60" stroke="currentColor" strokeWidth="1.8" />
          </>
        )}
        {kind === 'APP_FLOW' && (
          <>
            <rect x="22" y="72" width="13" height="22" rx="2" stroke="currentColor" strokeWidth="2" />
            <rect
              x="40"
              y="58"
              width="13"
              height="36"
              rx="2"
              stroke="currentColor"
              strokeWidth="2"
              fill="currentColor"
              fillOpacity="0.14"
            />
            <rect x="58" y="44" width="13" height="50" rx="2" stroke="currentColor" strokeWidth="2" />
            <rect
              x="76"
              y="30"
              width="13"
              height="64"
              rx="2"
              stroke="currentColor"
              strokeWidth="2"
              fill="currentColor"
              fillOpacity="0.16"
            />
            <path
              d="M18 80 C40 62, 68 48, 100 22"
              stroke="#B47B2B"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
          </>
        )}
        {kind === 'COMPACT_WALLET' && (
          <>
            <rect
              x="22"
              y="44"
              width="76"
              height="52"
              rx="10"
              stroke="currentColor"
              strokeWidth="2.2"
              fill="currentColor"
              fillOpacity="0.12"
            />
            <rect x="66" y="62" width="32" height="16" rx="5" stroke="#B47B2B" strokeWidth="2.2" />
            <circle cx="48" cy="30" r="12" stroke="#B47B2B" strokeWidth="2.2" />
          </>
        )}
        {kind === 'COMPACT_KEYS' && (
          <>
            <circle cx="46" cy="52" r="22" stroke="#B47B2B" strokeWidth="2.2" />
            <circle cx="74" cy="52" r="22" stroke="currentColor" strokeWidth="2.2" />
            <circle cx="60" cy="74" r="22" stroke="currentColor" strokeWidth="2" strokeOpacity="0.7" />
          </>
        )}
      </svg>
    </div>
  );
}

export interface StudioModel3DProps {
  kind: StudioModelKind;
  isDark?: boolean;
  reducedMotion?: boolean;
  className?: string;
}

/**
 * Compact, non-interactive studio-style Three.js 3D medallion (typically 72–96px).
 * Backed by a single shared offscreen WebGL studio renderer so any number of compact feature
 * badges share one GPU context with zero scroll lag and automatic cleanup.
 */
export function StudioModel3D({
  kind,
  isDark = false,
  reducedMotion = false,
  className = '',
}: StudioModel3DProps) {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const readyRef = useRef(false);

  const [webglFailed, setWebglFailed] = useState(() => !isWebGLAvailable());
  const [canvasReady, setCanvasReady] = useState(false);

  useEffect(() => {
    sharedStudioEngine.updatePreferences(isDark, reducedMotion);
  }, [isDark, reducedMotion]);

  useEffect(() => {
    const outer = outerRef.current;
    const canvas = canvasRef.current;
    if (!outer || !canvas || !isWebGLAvailable()) {
      setWebglFailed(true);
      return;
    }

    readyRef.current = false;
    setCanvasReady(false);

    const syncCanvasSize = () => {
      const rect = outer.getBoundingClientRect();
      const dpr = detectSoftwareWebGL() ? 1 : Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(48, Math.round((rect.width || 80) * dpr));
      const h = Math.max(48, Math.round((rect.height || 80) * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    };
    syncCanvasSize();

    const slotId = sharedStudioEngine.registerSlot(
      kind,
      canvas,
      isDark,
      reducedMotion,
      () => {
        if (!readyRef.current) {
          readyRef.current = true;
          setCanvasReady(true);
        }
      },
      () => {
        readyRef.current = false;
        setWebglFailed(true);
      }
    );

    if (slotId < 0) return;

    const resizeObserver = new ResizeObserver(() => {
      syncCanvasSize();
      sharedStudioEngine.requestSingleRender();
    });
    resizeObserver.observe(outer);

    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        const isVisible = entries.some((entry) => entry.isIntersecting);
        sharedStudioEngine.updateSlotVisibility(slotId, isVisible);
      },
      { rootMargin: '80px 0px', threshold: 0.01 }
    );
    intersectionObserver.observe(outer);

    return () => {
      intersectionObserver.disconnect();
      resizeObserver.disconnect();
      sharedStudioEngine.unregisterSlot(slotId);
    };
    // Intentionally re-register only when model kind changes; theme/motion sync dynamically via engine
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  return (
    <div
      ref={outerRef}
      aria-hidden="true"
      className={`relative overflow-hidden rounded-xl border border-[#E4E2DB] dark:border-[#262F3D] pointer-events-none select-none shrink-0 ${className}`}
      style={{
        background: isDark
          ? 'radial-gradient(circle at 50% 42%, #1C2738 0%, #121823 68%, #0E131C 100%)'
          : 'radial-gradient(circle at 50% 42%, #FFFFFF 0%, #F1EFE8 70%, #E7E4DA 100%)',
      }}
    >
      {(!canvasReady || webglFailed) && (
        <div className="absolute inset-0">
          <StudioFallbackSvg kind={kind} />
        </div>
      )}

      {!webglFailed && (
        <canvas
          ref={canvasRef}
          className={`relative block w-full h-full transition-opacity duration-300 ${
            canvasReady ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}
    </div>
  );
}
