"use client";

import { IconMoon, IconSliders, IconSun } from "@/components/ui/icons";
import { OcafyLockup } from "@/components/ui/logo";
import { WEEKDAYS, capitalize } from "@/lib/dates";
import { useNow } from "@/lib/hooks";
import { currentMember } from "@/lib/selectors";
import { useAppState } from "@/lib/store";
import { isDark, openSheet, setTheme, toast, useTheme } from "@/lib/ui";
import { usePathname } from "next/navigation";

const TITLES: Record<string, string> = {
  "/rotinas": "Rotinas",
  "/cozinha": "Cozinha",
  "/gatos": "Gatos",
  "/loja": "Lojinha",
  "/placar": "Placar",
  "/escritorio": "Escritório",
};

export function AppBar() {
  const s = useAppState();
  const now = useNow();
  const theme = useTheme();
  const path = usePathname();
  const me = currentMember(s);
  const home = path === "/";
  const h = now.getHours();

  const title = home
    ? `${capitalize(WEEKDAYS[now.getDay()])}, ${now.getDate()} de ${now.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}`
    : (TITLES[path] ?? "Ocafy");

  const dark = isDark(theme);

  return (
    <div className="appbar -mx-4">
      <header className="flex items-center justify-between gap-3">
        <button
          type="button"
          className="avatar"
          onClick={() => openSheet({ kind: "settings" })}
          aria-label={`${me?.name}: abrir ajustes`}
        >
          {(me?.name[0] ?? "?").toUpperCase()}
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[0.82rem] font-semibold text-muted">
            {home ? (
              `${h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite"}, ${me?.name}`
            ) : (
              <OcafyLockup size={16} />
            )}
          </div>
          <h1 className="truncate">{title}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            className="icon-btn"
            aria-label="Alternar modo claro e escuro"
            onClick={() => {
              setTheme(dark ? "light" : "dark");
              toast(dark ? "Modo claro ativado" : "Modo escuro ativado");
            }}
          >
            {dark ? <IconSun /> : <IconMoon />}
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label="Ajustes"
            onClick={() => openSheet({ kind: "settings" })}
          >
            <IconSliders />
          </button>
        </div>
      </header>
      <div className="sync">
        <span>
          <b className="font-bold">{s.household?.name}</b> · sincronizado
        </span>
      </div>
    </div>
  );
}
