/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./src/src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        // Unified trust-fintech accent — single indigo ramp used app-wide
        brand: {
          50:  "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        // Soft, layered depth for cards — subtle, not a hard drop shadow
        card: "0 1px 2px 0 rgba(0,0,0,0.3), 0 8px 24px -8px rgba(0,0,0,0.5)",
        "brand-glow": "0 0 0 1px rgba(99,102,241,0.4), 0 8px 30px -6px rgba(79,70,229,0.45)",
      },
      keyframes: {
        float: {
          "0%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-6px)" },
          "100%": { transform: "translateY(0px)" },
        },
        aurora: {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "33%": { transform: "translate(4vw, -5vh) scale(1.12)" },
          "66%": { transform: "translate(-3vw, 4vh) scale(0.94)" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 24px -6px rgba(99,102,241,0.45)" },
          "50%": { boxShadow: "0 0 48px -6px rgba(99,102,241,0.75)" },
        },
        glow: {
          "0%, 100%": {
            filter: "drop-shadow(0 0 6px rgba(0,255,136,0.8))",
          },
          "50%": {
            filter: "drop-shadow(0 0 14px rgba(0,255,136,1))",
          },
        },
      },
      animation: {
        float: "float 3s ease-in-out infinite",
        glow: "glow 2.5s ease-in-out infinite",
        aurora: "aurora 16s ease-in-out infinite",
        "aurora-slow": "aurora 24s ease-in-out infinite reverse",
        "pulse-glow": "pulse-glow 3s ease-in-out infinite",
      },
    },
  },
  plugins: [],
  darkMode: "class",
};
