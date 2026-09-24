"use client";

import { useEffect, useRef } from "react";

/**
 * Logo animada da abertura (Web Animations API, sem biblioteca):
 * a oca é desenhada traço a traço, ganha cor, as listras varrem o telhado,
 * a porta sobe, o coração pulsa, faíscas saem do teto e "ocafy" entra letra por letra.
 * Com `prefers-reduced-motion` mostra direto o estado final.
 */

const HUT = "M14 104 C14 60 32 20 60 16 C88 20 106 60 106 104 Z";
const STRIPE_A = "M27 62 Q60 50 93 62";
const STRIPE_B = "M20 83 Q60 71 100 83";
const DOOR = "M47 104 V87 A13 13 0 0 1 73 87 V104 Z";
const HEART =
  "M60 101 C54 96.5 51.5 93.5 51.5 90.6 C51.5 88.3 53.3 86.6 55.5 86.6 C57.2 86.6 58.9 87.6 60 89.2 C61.1 87.6 62.8 86.6 64.5 86.6 C66.7 86.6 68.5 88.3 68.5 90.6 C68.5 93.5 66 96.5 60 101 Z";

const WORD = ["o", "c", "a", "f", "y"];
const SPARKS = [
  { x: -34, y: -30, c: "#D5F3D8" },
  { x: 0, y: -44, c: "#FFB7C5" },
  { x: 34, y: -30, c: "#D5F3D8" },
  { x: -46, y: 2, c: "#FFB7C5" },
  { x: 46, y: 2, c: "#FFB7C5" },
];

const EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";
const EASE_DRAW = "cubic-bezier(0.65, 0, 0.35, 1)";
const EASE_BACK = "cubic-bezier(0.34, 1.56, 0.64, 1)";

/** Duração total aproximada (ms) — a splash espera por isso antes de sair. */
export const LOGO_ANIMATION_MS = 1900;

export function AnimatedLogo({
  size = 120,
  tagline = "Deixa a casa ok.",
  onDone,
}: {
  size?: number;
  tagline?: string;
  onDone?: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const q = <T extends Element>(s: string) =>
      el.querySelector<T>(`[data-a="${s}"]`);
    const all = <T extends Element>(s: string) =>
      Array.from(el.querySelectorAll<T>(`[data-a="${s}"]`));

    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const show = (node: Element | null) => {
      if (node instanceof HTMLElement || node instanceof SVGElement) {
        node.style.opacity = node.dataset.final ?? "1";
      }
    };

    if (reduced) {
      for (const n of el.querySelectorAll("[data-a]")) show(n);
      const t = setTimeout(() => done.current?.(), 250);
      return () => clearTimeout(t);
    }

    const timeline: Animation[] = [];
    const play = (
      target: Element | null,
      keyframes: Keyframe[],
      options: KeyframeAnimationOptions,
    ) => {
      if (!target) return;
      timeline.push(target.animate(keyframes, { fill: "both", ...options }));
    };

    // 1) contorno da oca sendo desenhado
    const outline = q<SVGPathElement>("outline");
    if (outline) {
      const len = outline.getTotalLength();
      outline.style.strokeDasharray = `${len}`;
      play(
        outline,
        [
          { strokeDashoffset: len, opacity: 1 },
          { strokeDashoffset: 0, opacity: 1, offset: 0.7 },
          { strokeDashoffset: 0, opacity: 0 },
        ],
        { duration: 900, easing: EASE_DRAW },
      );
    }

    // 2) preenchimento rosa "assenta" (squash & stretch a partir do chão)
    play(
      q("fill"),
      [
        { opacity: 0, transform: "scale(0.92, 0.6)" },
        { opacity: 1, transform: "scale(1.04, 1.07)", offset: 0.6 },
        { opacity: 1, transform: "scale(1, 1)" },
      ],
      { duration: 520, delay: 420, easing: EASE_OUT },
    );

    // 3) listras varrem o telhado
    const stripes = all<SVGPathElement>("stripe");
    stripes.forEach((s, i) => {
      const len = s.getTotalLength();
      s.style.strokeDasharray = `${len}`;
      play(
        s,
        [
          { strokeDashoffset: len, opacity: 0.75 },
          { strokeDashoffset: 0, opacity: 0.75 },
        ],
        { duration: 420, delay: 760 + i * 140, easing: EASE_DRAW },
      );
    });

    // 4) porta sobe do chão
    play(
      q("door"),
      [
        { opacity: 0, transform: "translateY(20px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      { duration: 380, delay: 950, easing: EASE_BACK },
    );

    // 5) coração aparece com um "pop"
    play(
      q("heart"),
      [
        { opacity: 0, transform: "scale(0)" },
        { opacity: 1, transform: "scale(1.45)", offset: 0.6 },
        { opacity: 1, transform: "scale(1)" },
      ],
      { duration: 460, delay: 1180, easing: EASE_OUT },
    );

    // 6) faíscas saem do telhado
    all<SVGCircleElement>("spark").forEach((s, i) => {
      const x = Number(s.dataset.x);
      const y = Number(s.dataset.y);
      play(
        s,
        [
          { opacity: 0, transform: "translate(0, 0) scale(0.3)" },
          {
            opacity: 1,
            transform: `translate(${x * 0.7}px, ${y * 0.7}px) scale(1.1)`,
            offset: 0.45,
          },
          { opacity: 0, transform: `translate(${x}px, ${y}px) scale(0.4)` },
        ],
        { duration: 700, delay: 1150 + i * 40, easing: EASE_OUT },
      );
    });

    // 7) "ocafy" entra letra por letra
    all("letter").forEach((l, i) => {
      play(
        l,
        [
          { opacity: 0, transform: "translateY(18px) scale(0.9)" },
          { opacity: 1, transform: "translateY(0) scale(1)" },
        ],
        { duration: 460, delay: 1180 + i * 75, easing: EASE_BACK },
      );
    });

    // 8) frase de apoio
    play(
      q("tagline"),
      [
        { opacity: 0, transform: "translateY(8px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      { duration: 420, delay: 1500, easing: EASE_OUT },
    );

    let cancelled = false;
    Promise.all(timeline.map((a) => a.finished))
      .then(() => {
        if (cancelled) return;
        // enquanto a splash espera os dados, o coração segue "batendo"
        const heart = q("heart");
        heart?.animate(
          [
            { transform: "scale(1)" },
            { transform: "scale(1.16)" },
            { transform: "scale(1)" },
          ],
          {
            duration: 1300,
            iterations: Number.POSITIVE_INFINITY,
            easing: "ease-in-out",
          },
        );
        done.current?.();
      })
      .catch(() => {
        /* animação cancelada (desmontou) */
      });

    return () => {
      cancelled = true;
      for (const a of timeline) a.cancel();
    };
  }, []);

  return (
    <div ref={root} className="alogo" aria-hidden="true">
      <svg
        viewBox="0 0 120 120"
        width={size}
        height={size}
        overflow="visible"
        aria-hidden="true"
      >
        <g style={{ transformOrigin: "60px 104px" }}>
          <path
            data-a="fill"
            d={HUT}
            fill="#FFB7C5"
            style={{ opacity: 0, transformOrigin: "60px 104px" }}
          />
          <path
            data-a="outline"
            d={HUT}
            fill="none"
            stroke="#F08FA6"
            strokeWidth="5"
            strokeLinejoin="round"
            strokeLinecap="round"
            style={{ opacity: 0 }}
          />
        </g>
        {[STRIPE_A, STRIPE_B].map((d) => (
          <path
            key={d}
            data-a="stripe"
            data-final="0.75"
            d={d}
            fill="none"
            stroke="var(--logo-stroke)"
            strokeWidth="5"
            strokeLinecap="round"
            style={{ opacity: 0 }}
          />
        ))}
        <path
          data-a="door"
          d={DOOR}
          fill="var(--logo-door)"
          style={{ opacity: 0 }}
        />
        <path
          data-a="heart"
          d={HEART}
          fill="#D5F3D8"
          style={{ opacity: 0, transformOrigin: "60px 93px" }}
        />
        {SPARKS.map((s) => (
          <circle
            key={`${s.x},${s.y}`}
            data-a="spark"
            data-x={s.x}
            data-y={s.y}
            data-final="0"
            cx="60"
            cy="56"
            r="3.2"
            fill={s.c}
            style={{ opacity: 0 }}
          />
        ))}
      </svg>
      <div
        className="owm alogo-word"
        style={{ fontSize: Math.round(size * 0.5) }}
      >
        {WORD.map((ch, i) => (
          <span
            key={`${ch}${i.toString()}`}
            data-a="letter"
            style={{ opacity: 0 }}
          >
            {ch}
          </span>
        ))}
      </div>
      <div data-a="tagline" className="alogo-tag" style={{ opacity: 0 }}>
        {tagline}
      </div>
    </div>
  );
}
