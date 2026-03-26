import type { Config } from "tailwindcss";
import { tailwindColors, fonts } from "./src/lib/tokens";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        glomalin: tailwindColors,
      },
      fontFamily: {
        mono: [...fonts.mono],
      },
      fontSize: {
        'xs':   'var(--size-xs)',
        'sm':   'var(--size-sm)',
        'base': 'var(--size-base)',
        'lg':   'var(--size-lg)',
        'xl':   'var(--size-xl)',
        '2xl':  'var(--size-2xl)',
        '3xl':  'var(--size-3xl)',
        '4xl':  'calc(var(--base-size) * 3.14 * var(--text-scale))',
        '5xl':  'calc(var(--base-size) * 3.57 * var(--text-scale))',
      },
    },
  },
  plugins: [],
};
export default config;
