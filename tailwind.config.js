/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // Disable preflight so Ant Design base styles are not overridden
  corePlugins: { preflight: false },
  theme: { extend: {} },
  plugins: [],
};
