import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import LineGraph from "../components/LineGraph";

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

const HISTORY = {
  cases: { "1/1/24": 10, "1/2/24": 15, "1/3/24": 40 },
  deaths: { "1/1/24": 1, "1/2/24": 3, "1/3/24": 4 },
  recovered: { "1/1/24": 0, "1/2/24": 2, "1/3/24": 5 },
};

const ok = (body) => ({ ok: true, status: 200, json: async () => body });

const points = () =>
  JSON.parse(screen.getByTestId("line").getAttribute("data-points"));

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok(HISTORY)));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("LineGraph", () => {
  it("plots day-over-day deltas, not cumulative totals", async () => {
    render(<LineGraph casesType="cases" />);

    await screen.findByTestId("line");
    expect(points().map((p) => p.y)).toEqual([5, 25]);
  });

  it("parses disease.sh's M/D/YY dates into real timestamps", async () => {
    render(<LineGraph casesType="cases" />);

    await screen.findByTestId("line");
    const [first] = points();

    expect(typeof first.x).toBe("number");
    expect(Number.isNaN(first.x)).toBe(false);
    expect(new Date(first.x).getFullYear()).toBe(2024);
    expect(new Date(first.x).getMonth()).toBe(0); // January, not February
    expect(new Date(first.x).getDate()).toBe(2);
  });

  it("feeds the time scale so dates are not treated as categories", async () => {
    render(<LineGraph casesType="cases" />);

    await screen.findByTestId("line");
    expect(screen.getByTestId("line")).toHaveAttribute("data-scale", "time");
  });

  it("recomputes from cached data when the cases type changes", async () => {
    const { rerender } = render(<LineGraph casesType="cases" />);
    await screen.findByTestId("line");
    expect(fetch).toHaveBeenCalledTimes(1);

    rerender(<LineGraph casesType="deaths" />);

    // Regression: this used to trigger a fresh 120-day fetch on every tab click.
    await waitFor(() => expect(points().map((p) => p.y)).toEqual([2, 1]));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("line")).toHaveAttribute("data-label", "New deaths");
  });

  it("requests the full 120-day window once", async () => {
    render(<LineGraph casesType="cases" />);

    await screen.findByTestId("line");
    expect(fetch.mock.calls[0][0]).toContain("lastdays=120");
  });

  it("colours the line to match the selected metric, like the map", async () => {
    const { rerender } = render(<LineGraph casesType="cases" />);
    await screen.findByTestId("line");

    expect(screen.getByTestId("line")).toHaveAttribute("data-border", "#cc1034");
    expect(screen.getByTestId("line")).toHaveAttribute(
      "data-fill",
      "rgba(204, 16, 52, 0.5)"
    );

    rerender(<LineGraph casesType="deaths" />);

    // Regression: the line stayed red while the map circles turned grey.
    await waitFor(() =>
      expect(screen.getByTestId("line")).toHaveAttribute("data-border", "#c0c0c0")
    );
  });

  it("lets Chart.js choose the time unit so short ranges still get labelled", async () => {
    render(<LineGraph casesType="cases" />);
    await screen.findByTestId("line");

    // Regression: a hardcoded "month" unit rendered an x-axis with no labels.
    expect(screen.getByTestId("line")).toHaveAttribute("data-time-unit", "undefined");
  });

  it("requests integer y-axis ticks", async () => {
    render(<LineGraph casesType="cases" />);
    await screen.findByTestId("line");

    // The root cause of the repeated "7 7 7 7" axis: Chart.js was free to pick
    // fractional ticks (6.5, 6.8, 7.0) which all rounded to the same label.
    expect(screen.getByTestId("line")).toHaveAttribute("data-y-precision", "0");
  });

  it("keeps adjacent y-axis labels distinguishable at every magnitude", async () => {
    render(<LineGraph casesType="cases" />);
    await screen.findByTestId("line");

    const ticks = JSON.parse(
      screen.getByTestId("line").getAttribute("data-y-ticks")
    );

    // "0a" rendered both 1500 and 2000 as "2k"; one decimal keeps them apart.
    expect(ticks).toEqual(["6", "7", "1.5k", "2k", "2m"]);
    expect(new Set(ticks).size).toBe(ticks.length);
  });

  it("shows a message instead of an empty chart when the API fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) })
    );

    render(<LineGraph casesType="cases" />);

    expect(await screen.findByText(/unavailable/i)).toBeInTheDocument();
    expect(screen.queryByTestId("line")).not.toBeInTheDocument();
  });

  it("shows a loading message before data arrives", async () => {
    // Hold the response open so the pending state can be asserted, then settle
    // it inside act() so React has no unflushed update when the test ends.
    let release;
    const pending = new Promise((resolve) => {
      release = () => resolve(ok(HISTORY));
    });
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(pending));

    render(<LineGraph casesType="cases" />);
    expect(screen.getByText(/loading chart/i)).toBeInTheDocument();
    expect(screen.queryByTestId("line")).not.toBeInTheDocument();

    await act(async () => {
      release();
      await pending;
    });

    expect(await screen.findByTestId("line")).toBeInTheDocument();
  });

  it("aborts the request when unmounted mid-flight", async () => {
    render(<LineGraph casesType="cases" />).unmount();

    const { signal } = fetch.mock.calls[0][1];
    await waitFor(() => expect(signal.aborted).toBe(true));
  });

  it("ignores an abort instead of showing it as an error", async () => {
    const abort = new Error("aborted");
    abort.name = "AbortError";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abort));

    render(<LineGraph casesType="cases" />);

    await waitFor(() =>
      expect(screen.queryByText(/unavailable/i)).not.toBeInTheDocument()
    );
  });
});
