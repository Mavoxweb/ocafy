"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const VIEW = 240; // tamanho do preview (px)
const OUT = 256; // tamanho final da foto (px)
const MAX_INPUT_BYTES = 15 * 1024 * 1024;

/** Recorte quadrado com arrastar + zoom. Devolve uma data URL pequena (WebP/JPEG 256 px). */
export function AvatarCropper({
  file,
  onCancel,
  onSave,
}: {
  file: File;
  onCancel: () => void;
  onSave: (dataUrl: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(
    null,
  );
  const [bmp, setBmp] = useState<ImageBitmap | null>(null);
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });

  useEffect(() => {
    let alive = true;
    if (!file.type.startsWith("image/") || file.size > MAX_INPUT_BYTES) {
      setError("Escolha uma imagem (JPG, PNG ou WebP) de até 15 MB.");
      return;
    }
    createImageBitmap(file, { imageOrientation: "from-image" })
      .then((b) => alive && setBmp(b))
      .catch(
        () =>
          alive &&
          setError("Não consegui abrir esta imagem. Tente JPG, PNG ou WebP."),
      );
    return () => {
      alive = false;
    };
  }, [file]);

  /** Geometria da imagem para uma área de `size` px, dado o zoom. */
  const geometry = useCallback(
    (size: number) => {
      if (!bmp) return null;
      const scale = (size / Math.min(bmp.width, bmp.height)) * zoom;
      const w = bmp.width * scale;
      const h = bmp.height * scale;
      return { w, h, maxX: (w - size) / 2, maxY: (h - size) / 2 };
    },
    [bmp, zoom],
  );

  const clamp = useCallback(
    (o: { x: number; y: number }) => {
      const g = geometry(VIEW);
      if (!g) return o;
      return {
        x: Math.max(-g.maxX, Math.min(g.maxX, o.x)),
        y: Math.max(-g.maxY, Math.min(g.maxY, o.y)),
      };
    },
    [geometry],
  );

  const paint = useCallback(
    (ctx: CanvasRenderingContext2D, size: number) => {
      const g = geometry(VIEW);
      if (!bmp || !g) return;
      const k = size / VIEW;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(
        bmp,
        (VIEW / 2 - g.w / 2 + off.x) * k,
        (VIEW / 2 - g.h / 2 + off.y) * k,
        g.w * k,
        g.h * k,
      );
    },
    [bmp, geometry, off],
  );

  useEffect(() => {
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const d = window.devicePixelRatio || 1;
    c.width = VIEW * d;
    c.height = VIEW * d;
    paint(ctx, VIEW * d);
  }, [paint]);

  // Depois de mudar o zoom, mantém a imagem cobrindo o círculo.
  useEffect(() => {
    setOff((o) => clamp(o));
  }, [clamp]);

  function save() {
    const c = document.createElement("canvas");
    c.width = OUT;
    c.height = OUT;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    paint(ctx, OUT);
    let url = c.toDataURL("image/webp", 0.85);
    // Alguns navegadores (Safari) ignoram WebP e devolvem PNG: usa JPEG nesse caso.
    if (!url.startsWith("data:image/webp"))
      url = c.toDataURL("image/jpeg", 0.88);
    if (url.length > 150_000) url = c.toDataURL("image/jpeg", 0.6);
    onSave(url);
  }

  return (
    <div className="mt-2">
      {error ? (
        <p role="alert" className="text-[0.9rem] font-bold text-late-t">
          {error}
        </p>
      ) : (
        <>
          <p className="meta">Arraste para enquadrar e use o zoom.</p>
          <div className="my-3 flex justify-center">
            <canvas
              ref={canvasRef}
              aria-label="Prévia da foto de perfil"
              style={{
                width: VIEW,
                height: VIEW,
                borderRadius: "50%",
                touchAction: "none",
                cursor: "grab",
                background: "var(--soft)",
                boxShadow: "0 0 0 3px var(--tint), 0 8px 24px rgba(0,0,0,.12)",
              }}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                drag.current = {
                  x: e.clientX,
                  y: e.clientY,
                  ox: off.x,
                  oy: off.y,
                };
              }}
              onPointerMove={(e) => {
                const d = drag.current;
                if (!d) return;
                setOff(
                  clamp({
                    x: d.ox + (e.clientX - d.x),
                    y: d.oy + (e.clientY - d.y),
                  }),
                );
              }}
              onPointerUp={() => {
                drag.current = null;
              }}
              onPointerCancel={() => {
                drag.current = null;
              }}
            />
          </div>
          <label
            className="f"
            style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
          >
            <span>Zoom</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              style={{ flex: 1, minHeight: 0 }}
            />
          </label>
        </>
      )}
      <div className="frow mt-3">
        {!error && (
          <button
            type="button"
            className="btn btn-primary"
            disabled={!bmp}
            onClick={save}
          >
            Usar esta foto
          </button>
        )}
        <button type="button" className="btn" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
