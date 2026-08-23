/**
 * These specs touch no DOM, so they skip the ~5s jsdom construction.
 *
 * @vitest-environment node
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { palette, paletteDark, withAlpha } from "../theme";

const tokens = readFileSync(
  new URL("../styles/tokens.css", import.meta.url),
  "utf8"
);

/** Read a custom property's value out of tokens.css. */
const token = (name) => {
  const match = tokens.match(new RegExp(`--${name}:\\s*([^;]+);`));
  return match?.[1].trim();
};

/** WCAG relative luminance / contrast ratio. */
const luminance = (hex) => {
  const value = hex.replace("#", "");
  const channels = [0, 2, 4]
    .map((i) => parseInt(value.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};

const contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

describe("palette and tokens", () => {
  it("keeps the JavaScript palette in step with the stylesheet", () => {
    // Leaflet and Chart.js take colour values rather than CSS, so the palette
    // is declared twice by necessity. This is the guard against drift.
    expect(palette.cases).toBe(token("metric-cases"));
    expect(palette.newCases).toBe(token("metric-new-cases"));
    expect(palette.deaths).toBe(token("metric-deaths"));
  });

  it("keeps the dark palette in step with the dark tokens", () => {
    const dark = tokens.slice(tokens.indexOf("prefers-color-scheme: dark"));
    const darkToken = (name) =>
      dark.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1].trim();

    expect(paletteDark.cases).toBe(darkToken("metric-cases"));
    expect(paletteDark.newCases).toBe(darkToken("metric-new-cases"));
    expect(paletteDark.deaths).toBe(darkToken("metric-deaths"));
  });

  it("meets WCAG AA against the card surface in both schemes", () => {
    const surface = token("surface");
    const darkSurface = "#1b2027";

    for (const [name, hex] of Object.entries(palette)) {
      // Regression: the original amber (#f2a900) sat at 2.01:1, failing even
      // the relaxed 3.0 threshold for large text.
      expect(contrast(hex, surface), `light ${name} (${hex})`).toBeGreaterThanOrEqual(4.5);
    }

    for (const [name, hex] of Object.entries(paletteDark)) {
      expect(contrast(hex, darkSurface), `dark ${name} (${hex})`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("cannot reuse one palette for both schemes", () => {
    // Documents why two palettes exist: the luminance a colour needs to pass on
    // white and the luminance it needs to pass on a dark ground do not overlap.
    for (const hex of Object.values(palette)) {
      expect(contrast(hex, "#1b2027")).toBeLessThan(4.5);
    }
  });

  it("keeps the metric colours far enough apart to tell apart on the map", () => {
    const rgb = (hex) =>
      [0, 2, 4].map((i) => parseInt(hex.replace("#", "").slice(i, i + 2), 16));
    const distance = (a, b) =>
      Math.hypot(...rgb(a).map((c, i) => c - rgb(b)[i]));

    const values = Object.values(palette);
    for (let i = 0; i < values.length; i += 1) {
      for (let j = i + 1; j < values.length; j += 1) {
        expect(distance(values[i], values[j])).toBeGreaterThan(80);
      }
    }
  });
});

describe("withAlpha", () => {
  it("converts a palette hex into a translucent rgba string", () => {
    expect(withAlpha("#cc1034", 0.5)).toBe("rgba(204, 16, 52, 0.5)");
  });

  it("handles greyscale values without producing NaN channels", () => {
    expect(withAlpha("#6c757d", 0.4)).toBe("rgba(108, 117, 125, 0.4)");
  });
});
