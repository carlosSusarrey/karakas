// Zinc/amber dark theme matching the web app
export const colors = {
  background: "#09090b",
  surface: "#18181b",
  surfaceLight: "#27272a",
  surfaceLighter: "#3f3f46",
  border: "#3f3f46",
  borderLight: "#52525b",

  text: "#fafafa",
  textSecondary: "#a1a1aa",
  textMuted: "#71717a",

  amber: "#f59e0b",
  amberDark: "#d97706",
  amberLight: "#fbbf24",

  red: "#ef4444",
  green: "#22c55e",
  blue: "#3b82f6",
  purple: "#a855f7",

  // Player panel colors (muted to not compete with life totals)
  playerColors: [
    "#991b1b", // red-800
    "#1e3a5f", // blue-800
    "#166534", // green-800
    "#6b21a8", // purple-800
    "#92400e", // amber-800
    "#0e7490", // cyan-800
  ] as const,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const fontSize = {
  sm: 12,
  md: 14,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  life: 72,
  lifeLarge: 96,
};
