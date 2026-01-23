import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border, 215 20% 88%))",
        input: "hsl(var(--input, 215 20% 88%))",
        ring: "hsl(var(--ring, 215 85% 25%))",
        background: "hsl(var(--background, 0 0% 98%))",
        foreground: "hsl(var(--foreground, 215 25% 15%))",
        primary: {
          DEFAULT: "hsl(var(--primary, 215 85% 25%))",
          foreground: "hsl(var(--primary-foreground, 0 0% 100%))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary, 187 85% 45%))",
          foreground: "hsl(var(--secondary-foreground, 0 0% 100%))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive, 0 72% 51%))",
          foreground: "hsl(var(--destructive-foreground, 0 0% 100%))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted, 215 20% 95%))",
          foreground: "hsl(var(--muted-foreground, 215 15% 45%))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent, 187 75% 92%))",
          foreground: "hsl(var(--accent-foreground, 215 85% 25%))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover, 0 0% 100%))",
          foreground: "hsl(var(--popover-foreground, 215 25% 15%))",
        },
        card: {
          DEFAULT: "hsl(var(--card, 0 0% 100%))",
          foreground: "hsl(var(--card-foreground, 215 25% 15%))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background, 215 85% 25%))",
          foreground: "hsl(var(--sidebar-foreground, 0 0% 100%))",
          primary: "hsl(var(--sidebar-primary, 187 85% 45%))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground, 0 0% 100%))",
          accent: "hsl(var(--sidebar-accent, 215 75% 30%))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground, 0 0% 100%))",
          border: "hsl(var(--sidebar-border, 215 75% 20%))",
          ring: "hsl(var(--sidebar-ring, 187 85% 45%))",
        },
        role: {
          "super-admin": "hsl(var(--role-super-admin))",
          "admin": "hsl(var(--role-admin))",
          "registration": "hsl(var(--role-registration))",
          "debtor": "hsl(var(--role-debtor))",
          "hod": "hsl(var(--role-hod))",
          "assessment": "hsl(var(--role-assessment))",
          "stock": "hsl(var(--role-stock))",
          "asset": "hsl(var(--role-asset))",
          "procurement": "hsl(var(--role-procurement))",
          "placement": "hsl(var(--role-placement))",
          "trainer": "hsl(var(--role-trainer))",
          "trainee": "hsl(var(--role-trainee))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "graduation-bounce": {
          "0%, 100%": { 
            transform: "translateY(0) rotate(-5deg)",
          },
          "50%": { 
            transform: "translateY(-8px) rotate(5deg)",
          },
        },
        "graduation-shadow": {
          "0%, 100%": { 
            transform: "translateX(-50%) scaleX(1)",
            opacity: "0.3",
          },
          "50%": { 
            transform: "translateX(-50%) scaleX(0.7)",
            opacity: "0.15",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "graduation-bounce": "graduation-bounce 1s ease-in-out infinite",
        "graduation-shadow": "graduation-shadow 1s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
