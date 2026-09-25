import type { RoomIconKey } from "@/lib/selectors";
import type { ReactNode, SVGProps } from "react";

interface SvgProps extends Omit<SVGProps<SVGSVGElement>, "d"> {
  size?: number;
  strokeWidth?: number;
  children: ReactNode;
}

export function Svg({
  size = 22,
  strokeWidth = 1.9,
  children,
  ...rest
}: SvgProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconCheck = ({ size = 16 }: { size?: number }) => (
  <Svg size={size} strokeWidth={3}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Svg>
);

export const IconSun = () => (
  <Svg size={19} strokeWidth={2}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Svg>
);

export const IconMoon = () => (
  <Svg size={19} strokeWidth={2}>
    <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
  </Svg>
);

export const IconSliders = () => (
  <Svg size={19} strokeWidth={2}>
    <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="10" cy="17" r="2" />
  </Svg>
);

export const IconFlame = ({ size = 26 }: { size?: number }) => (
  <Svg size={size}>
    <path d="M12 3c1 3 4 4.5 4 8.5a4 4 0 0 1-8 0c0-1.6.7-2.8 1.6-3.8.2 1.4 1 2.3 2 2.3 0-2.6-.8-4.6.4-7z" />
  </Svg>
);

export const IconStar = ({ size = 30 }: { size?: number }) => (
  <Svg size={size}>
    <path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z" />
  </Svg>
);

const BED = (
  <path d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6M3 15h18M6 10V7h5v3M13 10V7h5v3M3 18v2M21 18v2" />
);
const BATH = (
  <>
    <path d="M3 12h18v3a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5z" />
    <path d="M6 12V6a2 2 0 0 1 3.6-1.2M7 20l-1 2M17 20l1 2" />
  </>
);
const PETS = (
  <>
    <path d="M5 20v-8l-1-7 4 3h8l4-3-1 7v8z" />
    <circle cx="9.5" cy="13" r=".8" fill="currentColor" />
    <circle cx="14.5" cy="13" r=".8" fill="currentColor" />
  </>
);

const ROOM_PATHS: Record<RoomIconKey, ReactNode> = {
  quarto: BED,
  banheiro: BATH,
  lavabo: (
    <>
      <path d="M4 10h16v2a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6z" />
      <path d="M12 10V6a2 2 0 0 1 3.4-1.4M9 18l-1 3M15 18l1 3" />
    </>
  ),
  sala: (
    <>
      <path d="M5 11V8a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v3" />
      <path d="M2 13a2 2 0 0 1 4 0v2h12v-2a2 2 0 0 1 4 0v5H2z" />
      <path d="M5 18v2M19 18v2" />
    </>
  ),
  cozinha: (
    <>
      <path d="M4 10h16v3a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6z" />
      <path d="M2 10h2M20 10h2M9 6c0-1 1-1 1-2M14 6c0-1 1-1 1-2" />
    </>
  ),
  servico: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="3" />
      <circle cx="12" cy="13" r="4" />
      <path d="M8 6.5h.01M11 6.5h.01" />
    </>
  ),
  varanda: (
    <>
      <path d="M3 10h18M5 10v9M9 10v9M15 10v9M19 10v9M3 19h18" />
      <path d="M4 10V6h16v4" />
    </>
  ),
  quintal: (
    <>
      <path d="M12 21v-6M12 15c-4 0-6-2.5-6-6a6 6 0 0 1 12 0c0 3.5-2 6-6 6z" />
      <path d="M7 21h10" />
    </>
  ),
  garagem: (
    <>
      <path d="M3 11l2-5a2 2 0 0 1 1.9-1.3h10.2A2 2 0 0 1 19 6l2 5v6H3z" />
      <path d="M3 14h18M7 17v2M17 17v2" />
      <circle cx="7.5" cy="14" r=".8" fill="currentColor" />
      <circle cx="16.5" cy="14" r=".8" fill="currentColor" />
    </>
  ),
  escritorio: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </>
  ),
  piscina: (
    <>
      <path d="M3 17c2 0 2 1.5 4.5 1.5S10 17 12 17s2 1.5 4.5 1.5S19 17 21 17" />
      <path d="M3 13c2 0 2 1.5 4.5 1.5S10 13 12 13s2 1.5 4.5 1.5S19 13 21 13" />
      <path d="M8 13V6a2 2 0 0 1 4 0M14 13V6a2 2 0 0 1 4 0" />
    </>
  ),
  pets: PETS,
  casa: <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
};

export function RoomIcon({
  room,
  size = 22,
}: { room: RoomIconKey; size?: number }) {
  return <Svg size={size}>{ROOM_PATHS[room]}</Svg>;
}

/* ---------- navegação ---------- */
export const NAV_ICONS = {
  hoje: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" />
    </>
  ),
  rotinas: (
    <>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2" />
    </>
  ),
  cozinha: ROOM_PATHS.cozinha,
  gatos: ROOM_PATHS.pets,
  compras: (
    <>
      <path d="M3 4h2.4l2 10.2a1 1 0 0 0 1 .8h8.7a1 1 0 0 0 1-.8L20 8H6.2" />
      <circle cx="9.5" cy="19" r="1.4" />
      <circle cx="17" cy="19" r="1.4" />
    </>
  ),
  loja: (
    <>
      <path d="M4 8h16l-1.2 11a1 1 0 0 1-1 .9H6.2a1 1 0 0 1-1-.9z" />
      <path d="M8.5 8V6.5a3.5 3.5 0 0 1 7 0V8" />
    </>
  ),
  placar: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
} as const;

export type NavIconKey = keyof typeof NAV_ICONS;

export const Coin = () => <span className="coin" aria-hidden="true" />;
