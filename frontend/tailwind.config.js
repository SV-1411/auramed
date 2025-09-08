/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Sapphire Blue Theme Colors
        sapphire: {
          50: '#f0f7ff',
          100: '#e0efff',
          200: '#b8deff',
          300: '#7cc4ff',
          400: '#36a7ff',
          500: '#0c8ce9',
          600: '#0066cc',
          700: '#0052a3',
          800: '#003d7a',
          900: '#002951',
          950: '#001a33',
        },
        // Primary colors (Sapphire Blue)
        primary: {
          50: '#f0f7ff',
          100: '#e0efff',
          200: '#b8deff',
          300: '#7cc4ff',
          400: '#36a7ff',
          500: '#0c8ce9',
          600: '#0066cc',
          700: '#0052a3',
          800: '#003d7a',
          900: '#002951',
        },
        // Matte variations
        matte: {
          blue: {
            50: '#f8fafc',
            100: '#f1f5f9',
            200: '#e2e8f0',
            300: '#cbd5e1',
            400: '#94a3b8',
            500: '#64748b',
            600: '#475569',
            700: '#334155',
            800: '#1e293b',
            900: '#0f172a',
          },
        },
        // Dark theme specific colors
        dark: {
          bg: '#0f172a',
          surface: '#1e293b',
          card: '#334155',
          border: '#475569',
          text: {
            primary: '#f8fafc',
            secondary: '#cbd5e1',
            muted: '#94a3b8',
          }
        },
        // Light theme specific colors
        light: {
          bg: '#ffffff',
          surface: '#f8fafc',
          card: '#ffffff',
          border: '#e2e8f0',
          text: {
            primary: '#0f172a',
            secondary: '#475569',
            muted: '#64748b',
          }
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-in': 'slideIn 0.3s ease-out',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(12, 140, 233, 0.5)' },
          '100%': { boxShadow: '0 0 20px rgba(12, 140, 233, 0.8)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
        'dark-glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
      },
    },
  },
  plugins: [],
}
