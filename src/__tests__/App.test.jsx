import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";
import { HISTORY, SNAPSHOT, dataFetch } from "./fixtures";

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
  await user.click(await screen.findByRole("option", { name }));
};

const choosePeriod = async (user, name) => {
  await user.click(screen.getByLabelText("Time period"));
  await user.click(await screen.findByRole("option", { name }));
};

const fetchesOf = (/** @type {string} */ file) =>
  vi.mocked(fetch).mock.calls.filter(([url]) => String(url).includes(file)).length;

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(dataFetch()));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  // The date filter lives in the URL, which jsdom keeps between specs.
  window.history.replaceState(null, "", "/");
});

describe("App", () => {
  it("loads the snapshot and shows worldwide figures", async () => {
    render(<App />);

    expect(await screen.findByText("777.6m")).toBeInTheDocument();
    expect(await screen.findByText("India")).toBeInTheDocument();
  });

  it("fetches each data file exactly once, not per country or period", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("India");

    await selectCountry(user, "India");
    await user.click(screen.getByRole("button", { name: /deaths/i }));
    await choosePeriod(user, "Last 4 weeks");
    await selectCountry(user, "Worldwide");

    // Country, metric and period are all local lookups; the old build issued a
    // request per country and another per metric change.
    expect(fetchesOf("covid-snapshot.json")).toBe(1);
    expect(fetchesOf("covid-history.json")).toBe(1);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
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

  it("keeps the world view for a country that has no coordinates", async () => {
    // WHO lists territories the geometry source does not cover. Selecting one
    // must still show its figures, without flying the map to [null, null].
    const unmapped = {
      ...SNAPSHOT.countries[0],
      code: "PR",
      name: "Puerto Rico",
      lat: null,
      long: null,
      flag: null,
      cases: 1252713,
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(
        dataFetch({ snapshot: { ...SNAPSHOT, countries: [...SNAPSHOT.countries, unmapped] } })
      )
    );

    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("Puerto Rico");

    await selectCountry(user, "India");
    await waitFor(() =>
      expect(screen.getByTestId("map")).toHaveAttribute("data-center", "20,77")
    );

    await selectCountry(user, "Puerto Rico");

    await waitFor(() =>
      expect(screen.getByTestId("map")).toHaveAttribute("data-center", "20,10")
    );
    expect(screen.getByTestId("map")).toHaveAttribute("data-zoom", "2");
    expect(await screen.findByText("1.3m")).toBeInTheDocument();
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

    const { signal } = vi.mocked(fetch).mock.calls[0][1];
    await waitFor(() => expect(signal.aborted).toBe(true));
  });
});

describe("date filter", () => {
  // SNAPSHOT.weeks: 07-19 (500 cases, 12 deaths), 07-26 (700, 9), 08-02 (300, 4).
  // HISTORY splits those between the US and India.
  const inRange = "?from=2026-07-26&to=2026-08-02";

  it("shows all-time totals until a period is chosen", async () => {
    render(<App />);

    expect(await screen.findByText("777.6m")).toBeInTheDocument();
    expect(screen.getByLabelText("Time period")).toHaveTextContent("All time");
    expect(screen.getAllByText("total reported")).toHaveLength(2);
  });

  it("totals the worldwide figures over the chosen weeks", async () => {
    window.history.replaceState(null, "", `/${inRange}`);
    render(<App />);

    // 700 + 300 cases and 9 + 4 deaths; new cases are the final week's.
    expect(await screen.findByText("1.0k")).toBeInTheDocument();
    expect(screen.getByText("13")).toBeInTheDocument();
    expect(screen.getByText("300")).toBeInTheDocument();
    expect(screen.getAllByText("reported 26 Jul 2026 – 2 Aug 2026")).toHaveLength(2);
    expect(screen.getByText("in the week of 2 Aug 2026")).toBeInTheDocument();
  });

  it("totals each country over the chosen weeks and re-orders the table", async () => {
    window.history.replaceState(null, "", `/${inRange}`);
    render(<App />);

    // All time the US leads; over these two weeks India reported 600 to 400.
    const rows = await screen.findAllByRole("row");
    expect(rows[0]).toHaveTextContent("India");
    expect(rows[0]).toHaveTextContent("600");
    expect(rows[1]).toHaveTextContent("United States of America");
    expect(rows[1]).toHaveTextContent("400");
  });

  it("shows a selected country's figures for the period", async () => {
    window.history.replaceState(null, "", `/${inRange}`);
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("1.0k");

    await selectCountry(user, "India");

    // Scoped to the card: the table row shows the same total.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /coronavirus cases/i })).toHaveTextContent(
        "600"
      )
    );
  });

  it("writes a preset to the URL as a relative period, and clears it for all time", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("777.6m");

    await choosePeriod(user, "Last 4 weeks");
    expect(window.location.search).toBe("?period=4w");

    await choosePeriod(user, "All time");
    expect(window.location.search).toBe("");
    expect(await screen.findByText("777.6m")).toBeInTheDocument();
  });

  it("restores a period from the URL on load", async () => {
    window.history.replaceState(null, "", "/?period=4w");
    render(<App />);

    await waitFor(() =>
      expect(screen.getByLabelText("Time period")).toHaveTextContent("Last 4 weeks")
    );
  });

  it("offers week pickers for a custom range and writes explicit dates", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("777.6m");

    await choosePeriod(user, "Custom range");
    await user.click(screen.getByLabelText("From week"));
    await user.click(await screen.findByRole("option", { name: "2 Aug 2026" }));

    expect(window.location.search).toBe("?from=2026-08-02&to=2026-08-02");
    // Over a single week the period's cases and that week's new cases coincide.
    expect(await screen.findAllByText("300")).toHaveLength(2);

    // The To picker offers nothing before the From week, and moves the end.
    await user.click(screen.getByLabelText("From week"));
    await user.click(await screen.findByRole("option", { name: "19 Jul 2026" }));
    await user.click(screen.getByLabelText("To week"));
    await user.click(await screen.findByRole("option", { name: "26 Jul 2026" }));

    expect(window.location.search).toBe("?from=2026-07-19&to=2026-07-26");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /coronavirus cases/i })).toHaveTextContent(
        "1.2k"
      )
    );
  });

  it("never offers a From week after the To week", async () => {
    window.history.replaceState(null, "", "/?from=2026-07-19&to=2026-07-26");
    const user = userEvent.setup();
    render(<App />);
    await screen.findByLabelText("From week");

    await user.click(screen.getByLabelText("From week"));
    const options = await screen.findAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual(["19 Jul 2026", "26 Jul 2026"]);
  });

  it("charts the selected country and trims the chart to the period", async () => {
    window.history.replaceState(null, "", `/${inRange}`);
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("1.0k");

    expect(screen.getByText("Worldwide weekly cases")).toBeInTheDocument();
    expect(screen.getByTestId("graph")).toHaveAttribute("data-weeks", "2");

    await selectCountry(user, "India");

    expect(await screen.findByText("India weekly cases")).toBeInTheDocument();
    expect(screen.getByTestId("graph")).toHaveAttribute("data-weeks", "2");
  });

  it("says figures for a period are unavailable if the history fails, and keeps all time working", async () => {
    vi.stubGlobal("fetch", vi.fn(dataFetch({ history: new Error("down") })));
    window.history.replaceState(null, "", `/${inRange}`);
    render(<App />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/unavailable/);
    expect(
      await screen.findByText("Figures for this period are unavailable.")
    ).toBeInTheDocument();
    // Worldwide figures for the range come from the snapshot alone.
    expect(screen.getByText("1.0k")).toBeInTheDocument();
  });

  it("shows a country's period figures as unavailable, not zero, if the history fails", async () => {
    vi.stubGlobal("fetch", vi.fn(dataFetch({ history: new Error("down") })));
    window.history.replaceState(null, "", `/${inRange}`);
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("alert");

    await selectCountry(user, "India");

    const cases = screen.getByRole("button", { name: /coronavirus cases/i });
    await waitFor(() => expect(cases).toHaveTextContent("—"));
    // No figure at all: any digit here would be a made-up number.
    expect(cases).not.toHaveTextContent(/[0-9]/);
    expect(cases).toHaveTextContent("unavailable for this period");
  });

  it("keeps the worldwide chart, labelled as such, if the history fails", async () => {
    vi.stubGlobal("fetch", vi.fn(dataFetch({ history: new Error("down") })));
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("alert");

    await selectCountry(user, "India");

    expect(screen.getByText("Worldwide weekly cases")).toBeInTheDocument();
    expect(screen.getByTestId("graph")).toHaveAttribute(
      "data-weeks",
      String(SNAPSHOT.weeks.length)
    );
  });

  it("ignores a period it does not recognise", async () => {
    window.history.replaceState(null, "", "/?period=forever");
    render(<App />);

    expect(await screen.findByText("777.6m")).toBeInTheDocument();
    expect(screen.getByLabelText("Time period")).toHaveTextContent("All time");
  });
});

// Keeps the fixture honest: the range figures above are only meaningful if the
// two files agree the way the real ones do.
it("uses a history fixture that sums to the snapshot's weekly series", () => {
  HISTORY.weeks.forEach((date, i) => {
    const [, cases, deaths] = SNAPSHOT.weeks[i];
    const sum = (k) =>
      Object.values(HISTORY.countries).reduce((t, series) => t + series[k][i], 0);
    expect(date).toBe(SNAPSHOT.weeks[i][0]);
    expect(sum(0)).toBe(cases);
    expect(sum(1)).toBe(deaths);
  });
});
