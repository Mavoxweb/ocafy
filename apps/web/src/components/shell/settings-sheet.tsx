"use client";

import { AvatarFace } from "@/components/ui/avatar";
import { OcafyLockup } from "@/components/ui/logo";
import { Chip, Chips, Segmented } from "@/components/ui/primitives";
import { Sheet, SheetHead } from "@/components/ui/sheet";
import {
  deleteHousehold,
  removeMyAvatar,
  renameMe,
  setMyAvatar,
  toggleRoom,
} from "@/lib/actions";
import { authClient } from "@/lib/auth/client";
import { ROOM_ORDER } from "@/lib/catalog";
import { currentMember, partnerOf } from "@/lib/selectors";
import { useAppState } from "@/lib/store";
import { errorMessage } from "@/lib/trpc";
import {
  type Theme,
  closeSheet,
  openSheet,
  setTheme,
  useTheme,
} from "@/lib/ui";
import { ROOM_NAMES } from "@ocafy/core";
import { useState } from "react";
import { AvatarCropper } from "./avatar-cropper";
import { InvitePanel } from "./invite-panel";

export function SettingsSheet() {
  const s = useAppState();
  const theme = useTheme();
  const me = currentMember(s);
  const partner = partnerOf(s, me?.id);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [error, setError] = useState("");

  async function signOut() {
    setBusy(true);
    try {
      await authClient.signOut();
    } finally {
      // recarrega para limpar todo o estado em memória da sessão anterior
      window.location.assign("/entrar");
    }
  }

  async function removeHouse() {
    setBusy(true);
    setError("");
    try {
      await deleteHousehold();
      closeSheet();
    } catch (e) {
      setError(errorMessage(e, "Não foi possível apagar a casa."));
      setBusy(false);
    }
  }

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

      <h4 style={{ marginTop: 6 }}>Foto de perfil</h4>
      {cropFile ? (
        <AvatarCropper
          file={cropFile}
          onCancel={() => setCropFile(null)}
          onSave={(url) => {
            setMyAvatar(url);
            setCropFile(null);
          }}
        />
      ) : (
        <div className="frow" style={{ gap: 14 }}>
          <span
            className="avatar"
            style={{
              width: 64,
              height: 64,
              display: "grid",
              placeItems: "center",
            }}
          >
            <AvatarFace member={me} />
          </span>
          <label className="btn btn-small" style={{ cursor: "pointer" }}>
            {me?.avatar ? "Trocar foto" : "Escolher foto"}
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.currentTarget.files?.[0];
                e.currentTarget.value = ""; // permite escolher o mesmo arquivo de novo
                if (f) setCropFile(f);
              }}
            />
          </label>
          {me?.avatar && (
            <button type="button" className="link" onClick={removeMyAvatar}>
              Remover
            </button>
          )}
        </div>
      )}

      <div className="grid2">
        <label className="f">
          Seu nome
          <input
            key={me?.name}
            type="text"
            maxLength={24}
            defaultValue={me?.name}
            onBlur={(e) => {
              renameMe(e.currentTarget.value);
              if (e.currentTarget.value.trim().length < 2)
                e.currentTarget.value = me?.name ?? "";
            }}
          />
        </label>
        <label className="f">
          Outra pessoa
          <input type="text" value={partner?.name ?? "—"} readOnly disabled />
        </label>
      </div>

      {!partner && <InvitePanel />}

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

      <h4>Método</h4>
      <button
        type="button"
        className="btn"
        onClick={() => openSheet({ kind: "method" })}
      >
        Como o método funciona
      </button>

      <h4>Conta</h4>
      <div className="frow">
        <button type="button" className="btn" disabled={busy} onClick={signOut}>
          Sair
        </button>
      </div>
      <p className="meta">
        Os dados ficam na nuvem e sincronizam entre os aparelhos de vocês dois.
      </p>

      {s.isOwner &&
        (confirmDelete ? (
          <div className="mt-2">
            <p className="meta">
              Isso apaga <b>todos os dados da casa, dos dois</b>. Não dá para
              desfazer.
            </p>
            <div className="frow">
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy}
                onClick={removeHouse}
              >
                Sim, apagar a casa
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => setConfirmDelete(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="link"
            onClick={() => setConfirmDelete(true)}
          >
            Apagar a casa e todos os dados
          </button>
        ))}
      {error && (
        <p role="alert" className="text-[0.9rem] font-bold text-late-t">
          {error}
        </p>
      )}
    </Sheet>
  );
}
