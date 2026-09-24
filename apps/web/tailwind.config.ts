import type { Config } from "tailwindcss";

// Todas as cores vêm de variáveis CSS (globals.css) para o tema claro/escuro
// funcionar sem variantes `dark:` em cada componente.
const v = (name: string) => `var(--${name})`;

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: v("bg"),
        card: v("card"),
        soft: v("soft"),
        tile: v("tile"),
        line: v("line"),
        ink: v("ink"),
        muted: v("muted"),
        accent: v("accent"),
        "accent-strong": v("accent-strong"),
        "accent-ink": v("accent-ink"),
        tint: v("tint"),
        mint: v("mint"),
        "mint-deep": v("mint-deep"),
        "mint-ink": v("mint-ink"),
        "tint-mint": v("tint-mint"),
        blush: v("blush"),
        fresh: v("fresh"),
        due: v("due"),
        late: v("late"),
        "ok-t": v("ok-t"),
        "due-t": v("due-t"),
        "late-t": v("late-t"),
      },
      fontFamily: {
        sans: [
          "var(--font-manrope)",
          "Manrope",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "sans-serif",
        ],
      },
      borderRadius: {
        pill: "999px",
      },
    },
  },
  plugins: [],
};

export default config;
