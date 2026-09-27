import { createTheme } from "@mui/material";

/**
 * Metric colours for code that needs values rather than CSS: Leaflet circle
 * options and Chart.js datasets both take plain strings.
 *
 * These mirror the custom properties in src/styles/tokens.css, and
 * src/__tests__/theme.test.js parses that stylesheet to prove the two agree.
 *
 * There are two sets because no single colour can meet WCAG AA against both a
 * white and a dark surface — the required luminance ranges do not overlap.
 */
export const palette = {
  cases: "#cc1034",
  newCases: "#a16207",
  deaths: "#6c757d",
};

export const paletteDark = {
  cases: "#ff7a8a",
  newCases: "#e8b339",
  deaths: "#aeb6bf",
};

/**
 * "#cc1034" -> "rgba(204, 16, 52, 0.5)", for chart fills derived from the palette.
 *
 * @param {string} hex
 * @param {number} alpha
 */
export const withAlpha = (hex, alpha) => {
  const value = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/**
 * Surface and text colours for MUI, mirroring tokens.css.
 *
 * Without these MUI used its own defaults, so the page had two colour systems
 * side by side: in dark mode the cards and the right-hand panel were MUI's
 * neutral grey (#121212 plus a white overlay) while the map frame and the table
 * were the tokens' blue-grey. The page background was MUI's too, because
 * CssBaseline's body rule is injected after index.css and won. It also meant
 * the WCAG check on the metric colours measured them against a surface the
 * cards did not actually use.
 *
 * MUI needs plain colour values here, not var() references, because it derives
 * other colours from them. src/__tests__/theme.test.js asserts they match the
 * tokens.
 */
export const surfaces = {
  light: {
    page: "#f5f6fa",
    surface: "#ffffff",
    text: "#1f2328",
    textMuted: "#6c757d",
    border: "#e3e6ea",
  },
  dark: {
    page: "#12161a",
    surface: "#1b2027",
    text: "#e6e9ec",
    textMuted: "#a4adb8",
    border: "#2c333c",
  },
};

/** @param {typeof surfaces.light} s */
const schemePalette = (s) => ({
  background: { default: s.page, paper: s.surface },
  text: { primary: s.text, secondary: s.textMuted },
  divider: s.border,
});

/**
 * MUI follows the same preference as the CSS tokens, so Cards, Select and Alert
 * change with the rest of the page instead of staying stubbornly light.
 */
export const muiTheme = createTheme({
  colorSchemes: {
    light: { palette: schemePalette(surfaces.light) },
    dark: { palette: schemePalette(surfaces.dark) },
  },
  cssVariables: { colorSchemeSelector: "media" },
  // Matches --radius-sm, for inputs, menus and alerts.
  shape: { borderRadius: 8 },
  components: {
    MuiPaper: {
      styleOverrides: {
        // MUI lightens elevated surfaces in dark mode with a white gradient,
        // which is what made them grey rather than the token surface.
        root: { backgroundImage: "none" },
      },
    },
    MuiCard: {
      styleOverrides: {
        // Every panel shares one radius and shadow with the map frame, instead
        // of MUI's 4px corners and elevation shadow beside the tokens' own.
        root: {
          borderRadius: "var(--radius-md)",
          boxShadow: "var(--shadow-card)",
        },
      },
    },
  },
});
