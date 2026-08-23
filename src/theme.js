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

/** "#cc1034" -> "rgba(204, 16, 52, 0.5)", for chart fills derived from the palette. */
export const withAlpha = (hex, alpha) => {
  const value = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/**
 * MUI follows the same preference as the CSS tokens, so Cards, Select and Alert
 * change with the rest of the page instead of staying stubbornly light.
 */
export const muiTheme = createTheme({
  colorSchemes: { light: true, dark: true },
  cssVariables: { colorSchemeSelector: "media" },
});
