"use client";

import { NAV_ICONS, type NavIconKey, Svg } from "@/components/ui/icons";
import { hasPetOf } from "@/lib/selectors";
import { useAppState } from "@/lib/store";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV: { href: string; key: NavIconKey; label: string }[] = [
  { href: "/", key: "hoje", label: "Hoje" },
  { href: "/rotinas", key: "rotinas", label: "Rotinas" },
  { href: "/cozinha", key: "cozinha", label: "Cozinha" },
  { href: "/gatos", key: "gatos", label: "Gatos" },
  { href: "/loja", key: "loja", label: "Loja" },
  { href: "/placar", key: "placar", label: "Placar" },
];

export function BottomNav() {
  const path = usePathname();
  const s = useAppState();
  const cats = hasPetOf(s, "cat");
  const nav = NAV.filter((n) => n.href !== "/gatos" || cats);
  return (
    <nav className="tabs-nav" aria-label="Navegação principal">
      <div className="in">
        {nav.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            aria-label={n.label}
            aria-current={path === n.href ? "page" : undefined}
          >
            <span className="ico">
              <Svg size={22}>{NAV_ICONS[n.key]}</Svg>
            </span>
            <span className="lb">{n.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
