import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";
import { SNAPSHOT, okResponse } from "./fixtures";

// Leaflet and Chart.js need real layout measurements, so the panels are stubbed
// here; they have their own coverage. This spec is about App's data flow.
vi.mock("../components/Map", () => ({
  default: ({ center, zoom, metric, countries }) => (
    <div
      data-testid="map"
      data-center={center.join(",")}
      data-zoom={zoom}
      data-metric={metric}
      data-count={countries.length}
    />
  ),
}));

vi.mock("../components/LineGraph", () => ({
  default: ({ metric, weeks }) => (
    <div data-testid="graph" data-metric={metric} data-weeks={weeks?.length ?? 0} />
  ),
}));

const selectCountry = async (user, name) => {
  await user.click(screen.getByLabelText("Select a country"));
  await user.click(await screen.findByRole("option", { name, exact: true }));
};

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okResponse(SNAPSHOT)));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("App", () => {
  it("loads the snapshot and shows worldwide figures", async () => {
    render(<App />);

    expect(await screen.findByText("777.6m")).toBeInTheDocument();
    expect(await screen.findByText("India")).toBeInTheDocument();
  });

  it("fetches the dataset exactly once, not per country", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("India");

    await selectCountry(user, "India");
    await selectCountry(user, "Worldwide");

    // Country selection is a local lookup; the old build issued a request per
    // country and another per metric change.
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("orders the table by the selected metric", async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    await screen.findByText("India");

    const names = () =>
      [...container.querySelectorAll("tbody tr td:first-child")].map(
        (cell) => cell.textContent
      );

    expect(names()[0]).toBe("United States of America");

    await user.click(screen.getByRole("button", { name: /new cases/i }));
    await waitFor(() => expect(names()[0]).toBe("India"));
  });

  it("starts at the world view rather than a hardcoded country", async () => {
    render(<App />);

    const map = await screen.findByTestId("map");
    expect(map).toHaveAttribute("data-center", "20,10");
    expect(map).toHaveAttribute("data-zoom", "2");
  });

  it("flies to a country on selection and back out on Worldwide", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("India");

    await selectCountry(user, "India");
    await waitFor(() =>
      expect(screen.getByTestId("map")).toHaveAttribute("data-center", "20,77")
    );
    expect(screen.getByTestId("map")).toHaveAttribute("data-zoom", "4");

    await selectCountry(user, "Worldwide");

    // Regression: zoom used to stay at 4 forever once a country was picked.
    await waitFor(() =>
      expect(screen.getByTestId("map")).toHaveAttribute("data-zoom", "2")
    );
    expect(screen.getByTestId("map")).toHaveAttribute("data-center", "20,10");
  });

  it("shows the selected country's own figures", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("India");

    await selectCountry(user, "India");

    expect(await screen.findByText("45.1m")).toBeInTheDocument();
  });

  it("propagates the selected metric to the map and chart", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("India");

    await user.click(screen.getByRole("button", { name: /deaths/i }));

    expect(screen.getByTestId("map")).toHaveAttribute("data-metric", "deaths");
    expect(screen.getByTestId("graph")).toHaveAttribute("data-metric", "deaths");
  });

  it("credits the source and the date the data covers", async () => {
    render(<App />);

    const note = await screen.findByText(/World Health Organization/);
    expect(note).toHaveTextContent("2026-08-02");
    expect(note).toHaveTextContent("777,627,275");
  });

  it("surfaces an error and stops loading when the snapshot fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) })
    );

    render(<App />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/503/);
    // Regression: the spinner used to hang forever because the loading flag was
    // only cleared on the success path.
    await waitFor(() =>
      expect(screen.queryByRole("status")).not.toBeInTheDocument()
    );
  });

  it("aborts the in-flight request if it unmounts first", async () => {
    const { unmount } = render(<App />);
    unmount();

    const { signal } = fetch.mock.calls[0][1];
    await waitFor(() => expect(signal.aborted).toBe(true));
  });
});
