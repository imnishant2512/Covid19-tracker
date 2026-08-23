import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import LineGraph from "../components/LineGraph";
import { METRICS } from "../lib/metrics";
import { SNAPSHOT } from "./fixtures";

// Chart.js needs a real canvas, which jsdom lacks. Stubbing the renderer lets
// these specs assert on the data LineGraph computes, which is the part with logic.
vi.mock("react-chartjs-2", () => ({
  Line: ({ data, options }) => (
    <div
      data-testid="line"
      data-points={JSON.stringify(data.datasets[0].data)}
      data-label={data.datasets[0].label}
      data-scale={options.scales.x.type}
      data-border={data.datasets[0].borderColor}
      data-fill={data.datasets[0].backgroundColor}
      data-time-unit={String(options.scales.x.time.unit)}
      data-y-precision={options.scales.y.ticks.precision}
      data-y-ticks={JSON.stringify(
        [6, 7, 1500, 2000, 2000000].map((v) => options.scales.y.ticks.callback(v))
      )}
    />
  ),
}));

const points = () =>
  JSON.parse(screen.getByTestId("line").getAttribute("data-points"));

const renderGraph = (metric = "cases", ...rest) =>
  // Note: a default parameter would swallow an explicit `undefined`, so the
  // "no data yet" case is expressed by passing no second argument at all.
  render(
    <LineGraph
      weeks={rest.length ? rest[0] : SNAPSHOT.weeks}
      metric={metric}
    />
  );

describe("LineGraph", () => {
  it("plots the weekly counts the snapshot already provides", () => {
    renderGraph("cases");
    expect(points().map((p) => p.y)).toEqual([500, 700, 300]);
  });

  it("plots deaths when the deaths metric is selected", () => {
    renderGraph("deaths");
    expect(points().map((p) => p.y)).toEqual([12, 9, 4]);
    expect(screen.getByTestId("line")).toHaveAttribute("data-label", "New deaths");
  });

  it("parses the snapshot's ISO dates into real timestamps", () => {
    renderGraph("cases");
    const [first] = points();

    expect(typeof first.x).toBe("number");
    expect(Number.isNaN(first.x)).toBe(false);
    expect(new Date(first.x).toISOString().slice(0, 10)).toBe("2026-07-19");
  });

  it("feeds the time scale so dates are not treated as categories", () => {
    renderGraph("cases");
    expect(screen.getByTestId("line")).toHaveAttribute("data-scale", "time");
  });

  it("colours the line to match the selected metric, like the map", () => {
    renderGraph("cases");
    expect(screen.getByTestId("line")).toHaveAttribute(
      "data-border",
      METRICS.cases.hex
    );

    // Regression: the line stayed red while the map circles changed colour.
    renderGraph("deaths");
    expect(screen.getAllByTestId("line")[1]).toHaveAttribute(
      "data-border",
      METRICS.deaths.hex
    );
  });

  it("lets Chart.js choose the time unit so short ranges still get labelled", () => {
    renderGraph("cases");
    // Regression: a hardcoded "month" unit rendered an x-axis with no labels.
    expect(screen.getByTestId("line")).toHaveAttribute("data-time-unit", "undefined");
  });

  it("requests integer y-axis ticks", () => {
    renderGraph("cases");
    // The root cause of the repeated "7 7 7 7" axis: Chart.js was free to pick
    // fractional ticks (6.5, 6.8, 7.0) which all rounded to the same label.
    expect(screen.getByTestId("line")).toHaveAttribute("data-y-precision", "0");
  });

  it("keeps adjacent y-axis labels distinguishable at every magnitude", () => {
    renderGraph("cases");
    const ticks = JSON.parse(
      screen.getByTestId("line").getAttribute("data-y-ticks")
    );

    // "0a" rendered both 1500 and 2000 as "2k"; one decimal keeps them apart.
    expect(ticks).toEqual(["6", "7", "1.5k", "2k", "2m"]);
    expect(new Set(ticks).size).toBe(ticks.length);
  });

  it("shows a loading message until the snapshot arrives", () => {
    renderGraph("cases", undefined); // explicit: snapshot not loaded

    expect(screen.getByText(/loading chart/i)).toBeInTheDocument();
    expect(screen.queryByTestId("line")).not.toBeInTheDocument();
  });
});
