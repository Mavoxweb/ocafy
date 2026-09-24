"use client";

import { useSyncExternalStore } from "react";

/* ---------- confete (canvas) ---------- */
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  c: string;
  rot: number;
  vr: number;
  life: number;
}

let canvas: HTMLCanvasElement | null = null;
let particles: Particle[] = [];
let running = false;

const reducedMotion = () =>
  typeof matchMedia !== "undefined" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

export function registerCanvas(c: HTMLCanvasElement | null) {
  canvas = c;
}

function resizeCanvas() {
  if (!canvas) return;
  const d = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * d;
  canvas.height = window.innerHeight * d;
  canvas.getContext("2d")?.setTransform(d, 0, 0, d, 0, 0);
}

export function initCanvasResize() {
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);
  return () => window.removeEventListener("resize", resizeCanvas);
}

function tick() {
  const g = canvas?.getContext("2d");
  if (!canvas || !g) {
    running = false;
    return;
  }
  g.clearRect(0, 0, window.innerWidth, window.innerHeight);
  particles = particles.filter(
    (p) => p.life > 0 && p.y < window.innerHeight + 20,
  );
  for (const p of particles) {
    p.vy += 0.25;
    p.vx *= 0.985;
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;
    p.life -= 0.012;
    g.save();
    g.globalAlpha = Math.max(0, Math.min(1, p.life * 1.6));
    g.translate(p.x, p.y);
    g.rotate(p.rot);
    g.fillStyle = p.c;
    g.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
    g.restore();
  }
  if (particles.length) requestAnimationFrame(tick);
  else {
    running = false;
    g.clearRect(0, 0, window.innerWidth, window.innerHeight);
  }
}

export function confetti(x: number, y: number, n = 40, power = 1) {
  if (reducedMotion() || !canvas) return;
  const cs = getComputedStyle(document.documentElement);
  const cols = ["--accent", "--mint", "--fresh", "--due", "--late"].map((v) =>
    cs.getPropertyValue(v).trim(),
  );
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.3;
    const v = (4 + Math.random() * 7) * power;
    particles.push({
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      r: 3 + Math.random() * 4,
      c: cols[i % cols.length],
      rot: Math.random() * 6,
      vr: (Math.random() - 0.5) * 0.4,
      life: 1,
    });
  }
  if (!running) {
    running = true;
    requestAnimationFrame(tick);
  }
}

export function floatXP(rect: DOMRect | null | undefined, text: string) {
  const el = document.createElement("div");
  el.className = "xpf";
  el.textContent = text;
  el.style.left = `${rect ? rect.left + rect.width / 2 : window.innerWidth / 2}px`;
  el.style.top = `${rect ? rect.top : window.innerHeight / 2}px`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1100);
}

export function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* sem suporte */
  }
}

/* ---------- banners de conquista (fila) ---------- */
export interface BannerData {
  icon: string;
  title: string;
  sub?: string;
}

interface BannerState {
  current: BannerData | null;
  on: boolean;
}

let bannerState: BannerState = { current: null, on: false };
const bannerListeners = new Set<() => void>();
const queue: BannerData[] = [];
let bannerTimer: ReturnType<typeof setTimeout> | undefined;

function setBanner(next: BannerState) {
  bannerState = next;
  for (const l of bannerListeners) l();
}

function nextBanner() {
  const item = queue[0];
  if (!item) {
    setBanner({ current: null, on: false });
    return;
  }
  setBanner({ current: item, on: true });
  confetti(window.innerWidth / 2, window.innerHeight * 0.28, 90, 1.3);
  vibrate([20, 40, 30]);
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => {
    setBanner({ current: item, on: false });
    setTimeout(() => {
      queue.shift();
      nextBanner();
    }, 400);
  }, 2600);
}

export function banner(icon: string, title: string, sub?: string) {
  queue.push({ icon, title, sub });
  if (queue.length === 1) nextBanner();
}

const EMPTY_BANNER: BannerState = { current: null, on: false };

export function useBanner(): BannerState {
  return useSyncExternalStore(
    (l) => {
      bannerListeners.add(l);
      return () => {
        bannerListeners.delete(l);
      };
    },
    () => bannerState,
    () => EMPTY_BANNER,
  );
}
