import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";

// Leaflet and Chart.js need real layout measurements, so the panels are stubbed
// here; they have their own coverage. This spec is about App's data flow.
vi.mock("../components/Map", () => ({
  default: ({ center, zoom, casesType }) => (
    <div
      data-testid="map"
      data-center={center.join(",")}
      data-zoom={zoom}
      data-cases-type={casesType}
    />
  ),
}));

vi.mock("../components/LineGraph", () => ({
  default: ({ casesType }) => <div data-testid="graph" data-cases-type={casesType} />,
}));

const WORLD = {
  cases: 704753890,
  todayCases: 1000,
  recovered: 675619811,
  todayRecovered: 790,
  deaths: 7010681,
  todayDeaths: 5,
};

const COUNTRIES = [
  {
    country: "India",
    cases: 45035393,
    recovered: 0,
    deaths: 533570,
    countryInfo: { _id: 356, iso2: "IN", lat: 20, long: 77, flag: "in.png" },
  },
  {
    country: "Brazil",
    cases: 99999999,
    recovered: 10,
    deaths: 700000,
    countryInfo: { _id: 76, iso2: "BR", lat: -14, long: -51, flag: "br.png" },
  },
];

const INDIA = {
  cases: 45035393,
  todayCases: 12,
  recovered: 0,
  todayRecovered: 0,
  deaths: 533570,
  todayDeaths: 1,
  countryInfo: { _id: 356, iso2: "IN", lat: 20, long: 77 },
};

const ok = (body) => ({ ok: true, status: 200, json: async () => body });

const routeFetch = (overrides = {}) =>
  vi.fn((url) => {
    if (overrides[url]) return overrides[url]();
    if (url.endsWith("/all")) return Promise.resolve(ok(WORLD));
    if (url.endsWith("/countries")) return Promise.resolve(ok(COUNTRIES));
    if (url.includes("/countries/IN")) return Promise.resolve(ok(INDIA));
    if (url.includes("/historical/")) return Promise.resolve(ok({ cases: {} }));
    return Promise.reject(new Error(`unexpected request: ${url}`));
  });

beforeEach(() => {
  vi.stubGlobal("fetch", routeFetch());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("App", () => {
  it("loads worldwide stats and the country table on mount", async () => {
    render(<App />);

    expect(await screen.findByText("+704.8m Total")).toBeInTheDocument();
    expect(await screen.findByText("Brazil")).toBeInTheDocument();
  });

  it("orders the table by cases, not by API order", async () => {
    const { container } = render(<App />);

    await screen.findByText("Brazil");
    const names = [...container.querySelectorAll("tbody tr td:first-child")].map(
      (cell) => cell.textContent
    );

    expect(names).toEqual(["Brazil", "India"]);
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
    await screen.findByText("Brazil");

    await user.click(screen.getByLabelText("Select a country"));
    await user.click(await screen.findByRole("option", { name: "India" }));

    await waitFor(() =>
      expect(screen.getByTestId("map")).toHaveAttribute("data-center", "20,77")
    );
    expect(screen.getByTestId("map")).toHaveAttribute("data-zoom", "4");

    await user.click(screen.getByLabelText("Select a country"));
    await user.click(await screen.findByRole("option", { name: "Worldwide" }));

    // Regression: zoom used to stay at 4 forever once a country was picked.
    await waitFor(() =>
      expect(screen.getByTestId("map")).toHaveAttribute("data-zoom", "2")
    );
    expect(screen.getByTestId("map")).toHaveAttribute("data-center", "20,10");
  });

  it("propagates the selected cases type to the map and chart", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("Brazil");

    await user.click(screen.getByRole("button", { name: /deaths/i }));

    expect(screen.getByTestId("map")).toHaveAttribute("data-cases-type", "deaths");
    expect(screen.getByTestId("graph")).toHaveAttribute("data-cases-type", "deaths");
  });

  it("surfaces an error banner and stops loading when the API fails", async () => {
    vi.stubGlobal(
      "fetch",
      routeFetch({
        "https://disease.sh/v3/covid-19/all": () =>
          Promise.resolve({ ok: false, status: 503, json: async () => ({}) }),
      })
    );

    render(<App />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Couldn.t load the latest figures .* 503/
    );
    // Regression: the spinner used to hang forever because setLoading(false)
    // only ran on the success path.
    await waitFor(() =>
      expect(screen.queryByRole("status")).not.toBeInTheDocument()
    );
  });

  it("reports a failure of the country list without blanking the page", async () => {
    vi.stubGlobal(
      "fetch",
      routeFetch({
        "https://disease.sh/v3/covid-19/countries": () =>
          Promise.resolve({ ok: false, status: 502, json: async () => ({}) }),
      })
    );

    render(<App />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Couldn.t load the country list .* 502/
    );
    // Regression: the stats request succeeding used to wipe this error, because
    // both requests wrote to one shared error slot.
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    // Worldwide stats come from a separate request and must still render.
    expect(await screen.findByText("+704.8m Total")).toBeInTheDocument();
  });

  it("skips countries the API returns without coordinates", async () => {
    vi.stubGlobal(
      "fetch",
      routeFetch({
        "https://disease.sh/v3/covid-19/countries": () =>
          Promise.resolve(
            ok([
              ...COUNTRIES,
              { country: "Nowhere", cases: 1, countryInfo: { _id: 999 } },
            ])
          ),
      })
    );

    render(<App />);

    // Listed in the table, but never handed to Leaflet as a NaN coordinate.
    expect(await screen.findByText("Nowhere")).toBeInTheDocument();
    expect(screen.getByTestId("map")).toBeInTheDocument();
  });

  it("survives a country entry with no countryInfo at all", async () => {
    vi.stubGlobal(
      "fetch",
      routeFetch({
        "https://disease.sh/v3/covid-19/countries": () =>
          Promise.resolve(ok([...COUNTRIES, { country: "Limbo", cases: 3 }])),
      })
    );

    render(<App />);

    // Regression: reading entry.countryInfo._id unguarded threw here and took
    // the whole country list, table and map down with it.
    expect(await screen.findByText("Limbo")).toBeInTheDocument();
    expect(await screen.findByText("Brazil")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("aborts the in-flight stats request when the country changes", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("Brazil");

    const signals = fetch.mock.calls
      .filter(([url]) => url.endsWith("/all"))
      .map(([, init]) => init.signal);

    await user.click(screen.getByLabelText("Select a country"));
    await user.click(await screen.findByRole("option", { name: "India" }));

    await waitFor(() => expect(signals.some((s) => s.aborted)).toBe(true));
  });

  it("does not refetch country data when only the cases type changes", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("Brazil");

    const before = fetch.mock.calls.length;
    await user.click(screen.getByRole("button", { name: /recovered/i }));
    await user.click(screen.getByRole("button", { name: /deaths/i }));

    expect(fetch.mock.calls.length).toBe(before);
  });
});
