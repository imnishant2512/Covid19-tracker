import { expect, test } from "@playwright/test";
import { stubApi } from "./fixtures.js";

const CASES_RED = "#cc1034";
const DEATHS_GREY = "#6c757d";
const LEAFLET_DEFAULT_BLUE = "#3388ff";

/**
 * Tile URLs are `/{z}/{x}/{y}.png`, so the zoom levels present in the DOM are a
 * direct, observable record of where the map actually is. Reading the DOM
 * rather than network traffic matters because Leaflet caches tiles: returning
 * to a zoom level already visited issues no new request at all.
 */
const tileZooms = (page) =>
  page.evaluate(() => [
    ...new Set(
      [...document.querySelectorAll("img.leaflet-tile")]
        .map((img) => /** @type {HTMLImageElement} */ (img).src)
        .map((src) => src.match(/tile\.openstreetmap\.org\/(\d+)\//)?.[1])
        .filter(Boolean)
        .map(Number)
    ),
  ]);

const selectCountry = async (page, name) => {
  await page.getByLabel("Select a country").click();
  await page.getByRole("option", { name, exact: true }).click();
};

test.beforeEach(async ({ page }) => {
  await stubApi(page);
  await page.goto("/");
});

test("loads worldwide figures into the cards", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Covid-19 tracker" })).toBeVisible();
  await expect(page.getByText("777.6m")).toBeVisible();
  await expect(page.getByText("7.1m")).toBeVisible();
});

test("renders the country table ordered by the selected metric", async ({ page }) => {
  const first = page.locator("tbody tr td:first-child").first();
  await expect(first).toHaveText("United States of America");
  await expect(page.getByText("103,436,829")).toBeVisible();

  await page.getByRole("button", { name: /new cases/i }).click();
  await expect(first).toHaveText("India");
});

test("draws map circles in the colour of the selected metric", async ({ page }) => {
  // The original bug: pathOptions was ignored, so every circle rendered in
  // Leaflet's default blue regardless of the selected tab.
  const circle = page.locator(".leaflet-overlay-pane path").first();
  await expect(circle).toHaveAttribute("stroke", CASES_RED);
  await expect(circle).not.toHaveAttribute("stroke", LEAFLET_DEFAULT_BLUE);

  await page.getByRole("button", { name: /deaths/i }).click();
  await expect(circle).toHaveAttribute("stroke", DEATHS_GREY);
});

test("never refetches when switching country or metric", async ({ page }) => {
  const requests = [];
  page.on("request", (r) => {
    if (r.url().includes("covid-snapshot.json")) requests.push(r.url());
  });

  // Reload with the listener already attached and wait for the snapshot
  // response, so the baseline is guaranteed to include at least one request
  // and the assertion below cannot pass vacuously.
  await Promise.all([
    page.waitForResponse((r) => r.url().includes("covid-snapshot.json")),
    page.reload(),
  ]);
  await expect(page.locator("canvas")).toBeVisible();

  // Compared relative to the page load rather than as an absolute count: the
  // listener attaches after the first navigation, so a still in-flight request
  // from it can also land here.
  const afterLoad = requests.length;
  expect(afterLoad).toBeGreaterThan(0);

  await selectCountry(page, "India");
  await page.getByRole("button", { name: /deaths/i }).click();
  await selectCountry(page, "Worldwide");
  await expect(page.getByText("777.6m")).toBeVisible();

  // The previous build issued a request per country and another per metric.
  expect(requests.length).toBe(afterLoad);
});

test("lazy-loads the map and chart bundles after first paint", async ({ page }) => {
  const chunks = [];
  page.on("response", (r) => {
    if (r.url().endsWith(".js")) chunks.push(r.url());
  });

  await page.reload();
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();

  expect(chunks.some((url) => /Map-.*\.js/.test(url))).toBe(true);
  expect(chunks.some((url) => /LineGraph-.*\.js/.test(url))).toBe(true);
});

test("renders the trend chart on a canvas", async ({ page }) => {
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();

  // Chart.js draws nothing if the date adapter fails to parse the ISO dates.
  const isPainted = await canvas.evaluate((node) => {
    const el = /** @type {HTMLCanvasElement} */ (node);
    const ctx = el.getContext("2d");
    const { data } = ctx.getImageData(0, 0, el.width, el.height);
    return data.some((channel, i) => i % 4 === 3 && channel !== 0);
  });
  expect(isPainted).toBe(true);
});

test("selecting a country updates the stats and flies the map to it", async ({
  page,
}) => {
  await expect(page.locator("img.leaflet-tile").first()).toBeAttached();
  await expect.poll(() => tileZooms(page)).toContain(2);

  await selectCountry(page, "India");

  await expect(page.getByText("45.1m")).toBeVisible();
  await expect.poll(() => tileZooms(page)).toContain(4);
});

test("returns to the world view when Worldwide is reselected", async ({ page }) => {
  await expect(page.locator("img.leaflet-tile").first()).toBeAttached();

  await selectCountry(page, "India");
  await expect.poll(() => tileZooms(page)).toContain(4);

  await selectCountry(page, "Worldwide");
  await expect(page.getByText("777.6m")).toBeVisible();

  // Regression: zoom used to stay at the country level forever.
  await expect.poll(() => tileZooms(page)).toContain(2);
  await expect.poll(() => tileZooms(page)).not.toContain(4);
});

test("credits the source and the period the figures cover", async ({ page }) => {
  const note = page.locator(".app__provenance");
  await expect(note).toContainText("World Health Organization");
  await expect(note).toContainText("2026-08-02");
});

test("exposes landmarks and a single top-level heading", async ({ page }) => {
  await expect(page.getByText("777.6m")).toBeVisible();

  // Regression: there was no main landmark at all, so landmark navigation and
  // skip-to-content had nothing to target.
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("banner")).toHaveCount(0); // header is inside main
});

test("stat cards are reachable and operable by keyboard", async ({ page }) => {
  await expect(page.getByText("777.6m")).toBeVisible();

  const deaths = page.getByRole("button", { name: /deaths/i });
  await deaths.focus();
  await page.keyboard.press("Enter");

  await expect(deaths).toHaveAttribute("aria-pressed", "true");
});

test("shows an error banner when the data fails, without blanking the page", async ({
  page,
}) => {
  await page.route("**/data/covid-snapshot.json", (route) =>
    route.fulfill({ status: 503, body: "unavailable" })
  );
  await page.reload();

  await expect(page.getByRole("alert")).toContainText("503");
  await expect(page.getByRole("heading", { name: "Covid-19 tracker" })).toBeVisible();
});

test("logs no console errors during a normal session", async ({ page }) => {
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));

  await page.reload();
  await expect(page.locator("canvas")).toBeVisible();
  await page.getByRole("button", { name: /new cases/i }).click();
  await page.getByRole("button", { name: /deaths/i }).click();

  expect(errors).toEqual([]);
});

test("keeps long country names inside their row", async ({ page }) => {
  const table = page.locator(".table");
  const row = page.locator("tbody tr", {
    hasText: "United Kingdom of Great Britain and Northern Ireland",
  });
  await expect(row).toBeVisible();

  const figure = row.locator("td").last();
  await expect(figure).toHaveText("25,118,755");

  // Regression: with the name column set to nowrap the row grew wider than its
  // container and pushed the figure past the right edge, where it was clipped.
  // Comparing box geometry catches that; scrollWidth on a <tr> does not.
  const container = await table.boundingBox();
  const box = await figure.boundingBox();

  expect(box.x + box.width).toBeLessThanOrEqual(container.x + container.width + 1);
});

test("is usable at a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByText("777.6m")).toBeVisible();

  const overflows = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth + 1
  );
  expect(overflows).toBe(false);
});
