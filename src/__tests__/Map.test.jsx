import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import L from "leaflet";
import Map from "../components/Map";
import { METRICS } from "../lib/metrics";
import { SNAPSHOT } from "./fixtures";

const renderMap = (/** @type {import("../lib/metrics").MetricKey} */ metric = "cases", props = {}) =>
  render(
    <Map
      countries={SNAPSHOT.countries}
      metric={metric}
      center={[20, 10]}
      zoom={2}
      {...props}
    />
  );

describe("Map circles", () => {
  // Regression: the circles previously used react-leaflet v3+'s `pathOptions`
  // against react-leaflet v2, so Leaflet ignored it and every circle rendered
  // in the default blue instead of the metric's colour.
  it("paints circles with the colour for the selected metric", () => {
    const { container } = renderMap("cases");
    const path = container.querySelector(".leaflet-overlay-pane path");

    expect(path).not.toBeNull();
    expect(path.getAttribute("stroke")).toBe(METRICS.cases.hex);
    expect(path.getAttribute("fill")).toBe(METRICS.cases.hex);
  });

  it("uses a different colour for each metric", () => {
    const cases = renderMap("cases").container.querySelector(
      ".leaflet-overlay-pane path"
    );
    const deaths = renderMap("deaths").container.querySelector(
      ".leaflet-overlay-pane path"
    );

    expect(cases.getAttribute("stroke")).not.toBe(deaths.getAttribute("stroke"));
    expect(deaths.getAttribute("stroke")).toBe(METRICS.deaths.hex);
  });

  it("renders one circle per country", () => {
    const { container } = renderMap();
    expect(container.querySelectorAll(".leaflet-overlay-pane path")).toHaveLength(
      SNAPSHOT.countries.length
    );
  });

  it("leaves off countries that have no coordinates instead of crashing", () => {
    // WHO lists territories the geometry source does not cover. They still
    // belong in the totals and the table, but Leaflet throws on a null LatLng.
    const unmapped = {
      ...SNAPSHOT.countries[0],
      code: "PR",
      name: "Puerto Rico",
      lat: null,
      long: null,
      flag: null,
    };

    const { container } = renderMap("cases", {
      countries: [...SNAPSHOT.countries, unmapped],
    });

    expect(container.querySelectorAll(".leaflet-overlay-pane path")).toHaveLength(
      SNAPSHOT.countries.length
    );
  });

  it("draws no circle for a country with nothing to show", () => {
    // A zero-radius circle still draws its outline, so over a short period the
    // map filled with points that each read as "cases here".
    const quiet = { ...SNAPSHOT.countries[0], code: "QQ", newCases: 0 };

    const { container } = renderMap("newCases", {
      countries: [...SNAPSHOT.countries, quiet],
    });

    expect(container.querySelectorAll(".leaflet-overlay-pane path")).toHaveLength(
      SNAPSHOT.countries.filter((country) => country.newCases > 0).length
    );
  });

  it("renders a tile layer attributing OpenStreetMap", () => {
    const { container } = renderMap();
    expect(
      container.querySelector(".leaflet-control-attribution").textContent
    ).toMatch(/OpenStreetMap/);
  });
});

describe("Map sizing", () => {
  it("re-measures when its container resizes, not only the window", () => {
    // The map fills its column, whose height settles only after the table and
    // chart beside it render. Leaflet measures once, so without this it kept
    // its first size and left grey, untiled strips.
    /** @type {Array<() => void>} */
    const callbacks = [];
    const observed = [];
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback) {
          callbacks.push(callback);
        }
        observe(element) {
          observed.push(element);
        }
        disconnect() {}
      }
    );
    const invalidate = vi.spyOn(L.Map.prototype, "invalidateSize");

    const { container } = renderMap();
    invalidate.mockClear();
    callbacks.forEach((callback) => callback());

    expect(observed).toContain(container.querySelector(".leaflet-container"));
    expect(invalidate).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe("Map recentring", () => {
  // react-leaflet documents MapContainer's center/zoom as immutable after mount:
  // "changing them after they have been set a first time will have no effect".
  // Panning therefore has to go through the Leaflet instance, and this proves it
  // does — the App spec mocks Map, so nothing else covers it.
  it("flies the Leaflet instance to a new centre when the props change", () => {
    const flyTo = vi.spyOn(L.Map.prototype, "flyTo");

    const { rerender } = renderMap("cases");
    flyTo.mockClear();

    rerender(
      <Map
        countries={SNAPSHOT.countries}
        metric="cases"
        center={[20, 77]}
        zoom={4}
      />
    );

    expect(flyTo).toHaveBeenCalledWith([20, 77], 4, expect.anything());
  });

  it("does not re-fly when only the metric changes", () => {
    const flyTo = vi.spyOn(L.Map.prototype, "flyTo");
    const center = /** @type {[number, number]} */ ([20, 10]);

    const { rerender } = renderMap("cases", { center });
    flyTo.mockClear();

    rerender(
      <Map countries={SNAPSHOT.countries} metric="deaths" center={center} zoom={2} />
    );

    expect(flyTo).not.toHaveBeenCalled();
  });
});
