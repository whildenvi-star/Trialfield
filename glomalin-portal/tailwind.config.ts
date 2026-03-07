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
    },
  },
  plugins: [],
};
export default config;
