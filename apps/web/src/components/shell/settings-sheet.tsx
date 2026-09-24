"use client";

import { OcafyLockup } from "@/components/ui/logo";
import { Chip, Chips, Segmented } from "@/components/ui/primitives";
import { Sheet, SheetHead } from "@/components/ui/sheet";
import { renameMember, resetAll, setMe, toggleRoom } from "@/lib/actions";
import { ROOM_ORDER } from "@/lib/catalog";
import { currentMember } from "@/lib/selectors";
import { useAppState } from "@/lib/store";
import {
  type Theme,
  closeSheet,
  openSheet,
  setTheme,
  useTheme,
} from "@/lib/ui";
import { ROOM_NAMES } from "@ocafy/core";
import { useState } from "react";

export function SettingsSheet() {
  const s = useAppState();
  const theme = useTheme();
  const me = currentMember(s);
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <Sheet onClose={closeSheet} label="Ajustes">
      <div className="brandfoot">
        <OcafyLockup size={30} />
        <span className="text-[0.85rem] font-semibold text-muted">
          Deixa a casa ok.
        </span>
      </div>
      <SheetHead onClose={closeSheet}>
        <h3>Ajustes</h3>
      </SheetHead>

      <div className="grid2">
        {s.members.map((m) => (
          <label key={m.id} className="f">
            {m.slot === "a" ? "Pessoa 1" : "Pessoa 2"}
            <input
              type="text"
              maxLength={24}
              defaultValue={m.name}
              onBlur={(e) => {
                renameMember(m.id, e.currentTarget.value);
                if (!e.currentTarget.value.trim())
                  e.currentTarget.value = m.name;
              }}
            />
          </label>
        ))}
      </div>

      <h4>Aparência</h4>
      <Segmented<Theme>
        label="Tema"
        value={theme}
        onChange={setTheme}
        options={[
          { value: "light", label: "Claro" },
          { value: "dark", label: "Escuro" },
          { value: "auto", label: "Automático" },
        ]}
      />
      <p className="meta">Automático segue o modo do aparelho.</p>

      <h4>Cômodos da casa</h4>
      <Chips>
        {ROOM_ORDER.filter((r) => r !== "casa").map((r) => (
          <Chip
            key={r}
            pressed={s.rooms.includes(r)}
            onClick={() => toggleRoom(r)}
          >
            {ROOM_NAMES[r]}
          </Chip>
        ))}
      </Chips>
      <p className="meta">Cômodos desligados somem de Hoje e das Rotinas.</p>

      <h4>Quem usa este aparelho</h4>
      <Segmented
        label="Quem usa"
        value={me?.id ?? ""}
        onChange={setMe}
        options={s.members.map((m) => ({ value: m.id, label: m.name }))}
      />
      <p className="meta">
        Cada “Feito” é registrado no nome de quem está usando. O botão no topo
        troca rápido.
      </p>

      <h4>Método</h4>
      <button
        type="button"
        className="btn"
        onClick={() => openSheet({ kind: "method" })}
      >
        Como o método funciona
      </button>

      <h4>Dados</h4>
      <p className="meta">
        Os dados ficam salvos só neste navegador. A sincronização entre os dois
        aparelhos chega com a conta Ocafy.
      </p>
      {confirmReset ? (
        <div className="frow">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              closeSheet();
              resetAll();
            }}
          >
            Sim, apagar tudo
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => setConfirmReset(false)}
          >
            Cancelar
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="link"
          onClick={() => setConfirmReset(true)}
        >
          Apagar dados e recomeçar
        </button>
      )}
    </Sheet>
  );
}
