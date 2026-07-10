import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        khops: {
          50: "#f1f8f6",
          100: "#dcefe9",
          500: "#167561",
          600: "#115d4d",
          700: "#0e4c40",
          900: "#09342d",
        },
      },
    },
  },
  plugins: [],
};

export default config;
