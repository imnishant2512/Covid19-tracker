import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import L from "leaflet";
import Map from "../components/Map";
import { METRICS } from "../util";
import { SNAPSHOT } from "./fixtures";

const renderMap = (metric = "cases", props = {}) =>
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

  it("renders a tile layer attributing OpenStreetMap", () => {
    const { container } = renderMap();
    expect(
      container.querySelector(".leaflet-control-attribution").textContent
    ).toMatch(/OpenStreetMap/);
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
    const center = [20, 10];

    const { rerender } = renderMap("cases", { center });
    flyTo.mockClear();

    rerender(
      <Map countries={SNAPSHOT.countries} metric="deaths" center={center} zoom={2} />
    );

    expect(flyTo).not.toHaveBeenCalled();
  });
});
