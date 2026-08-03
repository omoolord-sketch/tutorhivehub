import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#061C3D",
          50: "#EAF1FB",
          100: "#D6E2F3",
          700: "#0A2B5F",
          800: "#061C3D",
          900: "#03142C",
        },
        gold: {
          DEFAULT: "#F2AA00",
          50: "#FFF7DB",
          100: "#FFE8A3",
          500: "#F2AA00",
          600: "#D68E00",
        },
        ink: "#102033",
      },
      boxShadow: {
        soft: "0 18px 45px rgba(6, 28, 61, 0.12)",
      },
    },
  },
  plugins: [],
} satisfies Config;
