import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        serif: ["var(--font-playfair)", "Georgia", "serif"],
        script: ["var(--font-dancing)", "cursive"],
      },
      colors: {
        ivory: "#FDFAF3",
        cream: "#F7EFE2",
        blush: {
          50: "#FDF2F3",
          100: "#FBE4E7",
          200: "#F6C7CC",
          300: "#EE9CA4",
          400: "#E37380",
          500: "#D64B5E",
        },
        wine: {
          500: "#9B2C3C",
          600: "#832532",
          700: "#6B1E28",
          800: "#531721",
        },
        gold: {
          100: "#FBEFC8",
          200: "#F4DE90",
          300: "#E9C768",
          400: "#D4A746",
          500: "#B78C2D",
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "soft-gold": "linear-gradient(135deg, #FDFAF3 0%, #FBE4E7 40%, #F4DE90 100%)",
        "wine-fade": "linear-gradient(180deg, rgba(83,23,33,0.0) 0%, rgba(83,23,33,0.75) 100%)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.7s ease-out both",
        shimmer: "shimmer 3s linear infinite",
        float: "float 5s ease-in-out infinite",
      },
      boxShadow: {
        soft: "0 10px 40px -15px rgba(83,23,33,0.15)",
        "soft-lg": "0 20px 60px -20px rgba(83,23,33,0.25)",
      },
    },
  },
  plugins: [],
};
export default config;
