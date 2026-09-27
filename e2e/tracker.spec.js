import { expect, test } from "@playwright/test";
import { HISTORY, SNAPSHOT, stubApi } from "./fixtures.js";
import { prettyPrintStat } from "../src/lib/format.js";

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

/**
 * Does the page scroll sideways? Measured only once the lazy map and chart
 * have rendered, since either could be what overflows.
 */
const overflowsHorizontally = async (page) => {
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
  return page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  );
};

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
  // Polled: the canvas exists before Chart.js has painted its first frame.
  const isPainted = () =>
    canvas.evaluate((node) => {
      const el = /** @type {HTMLCanvasElement} */ (node);
      const ctx = el.getContext("2d");
      const { data } = ctx.getImageData(0, 0, el.width, el.height);
      return data.some((channel, i) => i % 4 === 3 && channel !== 0);
    });
  await expect.poll(isPainted).toBe(true);
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

test("handles a territory with no map coordinates", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await expect(page.locator("img.leaflet-tile").first()).toBeAttached();

  // Drawn for every country that has coordinates, and none for the one without.
  const mapped = SNAPSHOT.countries.filter((c) => c.lat != null).length;
  await expect(page.locator(".leaflet-overlay-pane path")).toHaveCount(mapped);

  await selectCountry(page, "India");
  await expect.poll(() => tileZooms(page)).toContain(4);

  await selectCountry(page, "Puerto Rico");
  await expect(page.getByText("1.3m")).toBeVisible();
  await expect.poll(() => tileZooms(page)).toContain(2);
  await expect.poll(() => tileZooms(page)).not.toContain(4);

  expect(errors).toEqual([]);
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

  expect(await overflowsHorizontally(page)).toBe(false);
});

// ---------------------------------------------------------------------------
// Date filter
// ---------------------------------------------------------------------------

const choosePeriod = async (page, name) => {
  await page.getByLabel("Time period").click();
  await page.getByRole("option", { name, exact: true }).click();
};

/** Worldwide cases over the last `n` weeks of the fixture, as a card shows them. */
const lastWeeksCases = (n) =>
  prettyPrintStat(SNAPSHOT.weeks.slice(-n).reduce((total, [, cases]) => total + cases, 0));

test("filters the whole dashboard to a period and keeps it in the URL", async ({ page }) => {
  await expect(page.getByText("777.6m")).toBeVisible();

  await choosePeriod(page, "Last 3 months");

  await expect(page).toHaveURL(/\?period=3m$/);
  const casesCard = page.getByRole("button", { name: /coronavirus cases/i });
  await expect(casesCard).toContainText(lastWeeksCases(13));
  await expect(casesCard).toContainText(/reported \d+ \w{3} \d{4} – \d+ \w{3} \d{4}/);
  await expect(page.locator(".app__provenance")).toContainText("Showing figures reported");

  // A reload, or a shared link, restores the same view.
  await page.reload();
  await expect(page.getByLabel("Time period")).toHaveText("Last 3 months");
  await expect(casesCard).toContainText(lastWeeksCases(13));

  await choosePeriod(page, "All time");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("777.6m")).toBeVisible();
});

test("picks a custom range from WHO's reporting weeks", async ({ page }) => {
  await expect(page.getByText("777.6m")).toBeVisible();

  await choosePeriod(page, "Custom range");
  await expect(page).toHaveURL(/\?from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}$/);

  // Narrow it to the final week alone.
  const last = HISTORY.weeks.at(-1);
  await page.getByLabel("From week").click();
  const options = page.getByRole("option");
  await options.last().click();

  await expect(page).toHaveURL((url) => url.search === `?from=${last}&to=${last}`);
  await expect(page.getByRole("button", { name: /coronavirus cases/i })).toContainText(
    lastWeeksCases(1)
  );
});

test("totals countries over the period and re-draws the map to its scale", async ({
  page,
}) => {
  await page.goto("/?period=4w");

  // The table sums each country's weeks; the fixture gives the US half of
  // every week, India 30% and the UK the rest.
  const sumLast4 = (code) =>
    HISTORY.countries[code][0].slice(-4).reduce((total, value) => total + value, 0);
  const first = page.locator("tbody tr").first();
  await expect(first).toContainText("United States of America");
  await expect(first).toContainText(sumLast4("US").toLocaleString("en-US"));

  // Scaled to the largest value in view, so a four-week period is drawn at
  // the same size as all-time totals rather than as invisible dots. The map is
  // a lazy chunk that can finish after the table, so wait for its circles
  // before measuring them.
  const mapped = SNAPSHOT.countries.filter((c) => c.lat != null && HISTORY.countries[c.code]);
  await expect(page.locator(".leaflet-overlay-pane path")).toHaveCount(mapped.length);
  const largest = await page.evaluate(() =>
    Math.max(
      ...[...document.querySelectorAll(".leaflet-overlay-pane path")].map(
        (path) => path.getBoundingClientRect().width
      )
    )
  );
  expect(largest).toBeGreaterThan(40);
});

test("charts the selected country, and says which period a popup covers", async ({
  page,
}) => {
  await page.goto("/?period=4w");

  // Before any country is selected: selecting one flies the map, and a click
  // mid-flight lands on a moving circle.
  await page.locator(".leaflet-overlay-pane path").last().click();
  await expect(page.locator(".leaflet-popup .info-period")).toContainText(/^Reported /);

  await expect(page.getByText("Worldwide weekly cases")).toBeVisible();
  await selectCountry(page, "India");
  await expect(page.getByText("India weekly cases")).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
});

test("fits a custom range on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByText("777.6m")).toBeVisible();

  await choosePeriod(page, "Custom range");
  await expect(page.getByLabel("To week")).toBeVisible();

  expect(await overflowsHorizontally(page)).toBe(false);
});

test("ends both columns level on a desktop screen", async ({ page }) => {
  // Regression: the map was a fixed 500px, so the left column stopped
  // 140-160px above the panel beside it at every desktop width.
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();

  const bottom = (selector) =>
    page.locator(selector).evaluate((el) => el.getBoundingClientRect().bottom);
  await expect.poll(async () => Math.abs((await bottom(".map")) - (await bottom(".app__right")))).toBeLessThanOrEqual(1);

  // And Leaflet has been told: its container fills the frame it sits in.
  const frame = await page.locator(".map").boundingBox();
  const leaflet = await page.locator(".leaflet-container").boundingBox();
  expect(frame.y + frame.height - (leaflet.y + leaflet.height)).toBeLessThanOrEqual(17);
});

test("uses the tracker's own icon, not the template's React logo", async ({ page, request }) => {
  const svg = page.locator('link[rel="icon"][type="image/svg+xml"]');
  await expect(svg).toHaveAttribute("href", "/favicon.svg");

  const response = await request.get("/favicon.svg");
  expect(response.ok()).toBe(true);
  expect(await response.text()).toContain("#cc1034");
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
    "href",
    "/apple-touch-icon.png"
  );
});
