/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
 
    // Or if using `src` directory:
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        bg: '#F8F9FA',
        fg: '#111827',
        accent: '#4F46E5',
        ok: '#10B981',
        warn: '#F59E0B',
        danger: '#EF4444',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      fontSize: {
        'h1': '32px',
        'h2': '24px',
        'body': '16px',
        'small': '14px',
      },
      fontWeight: {
        'h1': '600',
        'h2': '600',
        'body': '400',
        'small': '400',
      },
      transitionDuration: {
        'progress': '250ms',
        'panel': '200ms',
      },
      transitionTimingFunction: {
        'progress': 'ease-in-out',
      },
      keyframes: {
        'float-in': {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-in': {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        }
      },
      animation: {
        'float-in': 'float-in 0.3s ease-out',
        'fade-slide-in': 'fade-in 0.2s ease-in-out, slide-in 0.2s ease-in-out',
      },
      slider: {
        track: {
          height: '4px',
          borderRadius: '2px',
          background: 'linear-gradient(90deg, #4F46E5 0%, #F59E0B 100%)',
        },
        thumb: {
          background: '#4F46E5',
          width: '16px',
          height: '16px',
          borderRadius: '50%',
        },
      },
    },
  },
  plugins: [],
}
