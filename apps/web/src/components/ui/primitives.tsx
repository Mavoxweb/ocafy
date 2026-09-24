import type { TaskStatusState } from "@ocafy/core";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export const cx = (...c: (string | false | null | undefined)[]) =>
  c.filter(Boolean).join(" ");

export function Group({ children }: { children: ReactNode }) {
  return <div className="group">{children}</div>;
}

export function Panel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cx("panel", className)}>{children}</div>;
}

export function Meta({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <p className={cx("meta", className)}>{children}</p>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}

export function Dot({ state }: { state: TaskStatusState | "nunca" }) {
  return <i className={`dot d-${state}`} />;
}

export function StatusPill({
  state,
  children,
}: {
  state: TaskStatusState;
  children: ReactNode;
}) {
  return (
    <span className={`tpill st-${state}`}>
      <Dot state={state} />
      {children}
    </span>
  );
}

export function Bar({ pct }: { pct: number }) {
  return (
    <div className="bar" aria-hidden="true">
      <i style={{ width: `${pct}%` }} />
    </div>
  );
}

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "primary" | "small" | "mint";
  block?: boolean;
}

export function Button({
  variant = "default",
  block,
  className,
  type = "button",
  ...rest
}: BtnProps) {
  return (
    <button
      type={type}
      className={cx(
        "btn",
        variant === "primary" && "btn-primary",
        variant === "small" && "btn-small",
        variant === "mint" && "btn-mint",
        block && "btn-block",
        className,
      )}
      {...rest}
    />
  );
}

export function Chips({ children }: { children: ReactNode }) {
  return <div className="chips">{children}</div>;
}

export function Chip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className="chip"
      aria-pressed={pressed}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label?: string;
}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: <fieldset> não aceita display:inline-flex de forma consistente
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          type="button"
          key={String(o.value)}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: o controle chega por `children`
    <label className="f">
      {label}
      {children}
    </label>
  );
}

export function Legend() {
  return (
    <div className="legend">
      <span>
        <Dot state="ok" />
        Em dia
      </span>
      <span>
        <Dot state="due" />
        Pode fazer
      </span>
      <span>
        <Dot state="late" />
        Atrasada
      </span>
      <span>
        <Dot state="nunca" />
        Sem registro
      </span>
    </div>
  );
}

/** Campo numérico que só confirma no blur/Enter (evita re-render a cada tecla). */
export function NumberInput({
  value,
  onCommit,
  min,
  max,
  step,
  label,
}: {
  value: number;
  onCommit: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  label: string;
}) {
  return (
    <input
      key={value}
      type="number"
      inputMode="decimal"
      min={min}
      max={max}
      step={step}
      defaultValue={value}
      aria-label={label}
      onBlur={(e) => {
        const v = Number(e.currentTarget.value);
        if (v >= min && v <= max) onCommit(v);
        else e.currentTarget.value = String(value);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
    />
  );
}
