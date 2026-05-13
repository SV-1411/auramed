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
        // Premium Earthy Theme (Brown/Beige/White)
        earthy: {
          50: '#fdfaf6',
          100: '#f7f0e8',
          200: '#ecdcc9',
          300: '#d9bea4',
          400: '#c19a7b',
          500: '#a67c52',
          600: '#8b5e3c',
          700: '#724a31',
          800: '#5c3c2a',
          900: '#4a3225',
          950: '#2d1e16',
        },
        // Primary colors (Brown/Amber)
        primary: {
          50: '#fdfaf6',
          100: '#f7f0e8',
          200: '#ecdcc9',
          300: '#d9bea4',
          400: '#c19a7b',
          500: '#a67c52',
          600: '#8b5e3c',
          700: '#724a31',
          800: '#5c3c2a',
          900: '#4a3225',
        },
        // Stone/Beige variations
        matte: {
          stone: {
            50: '#fafaf9',
            100: '#f5f5f4',
            200: '#e7e5e4',
            300: '#d6d3d1',
            400: '#a8a29e',
            500: '#78716c',
            600: '#57534e',
            700: '#44403c',
            800: '#292524',
            900: '#1c1917',
          },
        },
        // Dark theme specific colors (Coffee/Dark Earth)
        dark: {
          bg: '#1a1410',
          surface: '#2d1e16',
          card: '#3d2b1f',
          border: '#4a3225',
          text: {
            primary: '#fdfaf6',
            secondary: '#ecdcc9',
            muted: '#a8a29e',
          }
        },
        // Light theme specific colors (Cream/Beige)
        light: {
          bg: '#fdfaf6',
          surface: '#f7f0e8',
          card: '#ffffff',
          border: '#ecdcc9',
          text: {
            primary: '#2d1e16',
            secondary: '#5c3c2a',
            muted: '#8b5e3c',
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
