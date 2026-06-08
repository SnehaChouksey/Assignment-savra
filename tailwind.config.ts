import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          teal: "#0E6E84",
          deep: "#0A5466",
          cyan: "#22D3EE",
          red: "#D63D2F",
          ink: "#0B1220",
        },
      },
      fontFamily: {
        serifx: ["Georgia", "Liberation Serif", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
