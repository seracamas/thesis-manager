/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Backgrounds
        'bg-page': '#FFFFFF',
        'bg-surface': '#FAFAF8',
        'bg-card': '#FFFFFF',
        'bg-input': '#F7F5F0',
        'bg-hover': '#F2EEE8',
        
        // Borders
        'border-light': '#EEEBE4',
        'border-default': '#E2DDD6',
        'border-focus': '#E8C96A',
        
        // Text
        'text-primary': '#1A1714',
        'text-secondary': '#7C7469',
        'text-muted': '#B5AFA8',
        'text-placeholder': '#C5BFB8',
        
        // Accent
        'accent': '#E8C96A',
        'accent-hover': '#D9B84F',
        'accent-soft': '#FBF6E8',
        
        // Semantic
        'success': '#5A9E76',
        'error': '#C05454',
        'info': '#5A7FA8',
      },
      fontFamily: {
        'playfair': ['Playfair Display', 'serif'],
        'inter': ['Inter', 'sans-serif'],
        'mono': ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        'page-title': ['26px', { lineHeight: '1.2', fontWeight: '700' }],
        'section-title': ['18px', { lineHeight: '1.3', fontWeight: '600' }],
        'card-title': ['15px', { lineHeight: '1.4', fontWeight: '600' }],
        'body': ['14px', { lineHeight: '1.6', fontWeight: '400' }],
        'secondary': ['13px', { lineHeight: '1.5', fontWeight: '400' }],
        'muted': ['12px', { lineHeight: '1.4', fontWeight: '400' }],
        'label': ['11px', { lineHeight: '1.3', fontWeight: '400', letterSpacing: '0.05em' }],
        'button': ['13px', { lineHeight: '1.4', fontWeight: '600' }],
      },
      spacing: {
        'page-x': '40px',
        'page-y': '32px',
        'card': '24px',
        'section': '32px',
        'card-gap': '16px',
      },
      borderRadius: {
        'card': '16px', // rounded-2xl
        'input': '12px', // rounded-xl
        'chip': '9999px', // rounded-full
      },
      boxShadow: {
        'soft': '0 1px 4px rgba(0,0,0,0.04)',
        'soft-hover': '0 4px 16px rgba(0,0,0,0.06)',
        'accent': '0 2px 8px rgba(232,201,106,0.25)',
        'modal': '0 20px 60px rgba(0,0,0,0.08)',
      },
    },
  },
  plugins: [],
}
