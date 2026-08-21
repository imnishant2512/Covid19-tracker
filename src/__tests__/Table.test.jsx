import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import Table from "../components/Table";

const countries = [
  { country: "India", cases: 412, countryInfo: { _id: 356 } },
  { country: "Brazil", cases: 1234567, countryInfo: { _id: 76 } },
];

describe("Table", () => {
  it("renders rows inside a real table element", () => {
    const { container } = render(<Table countries={countries} />);

    expect(container.querySelector("table tbody tr")).not.toBeNull();
    expect(container.querySelector("div > tr")).toBeNull();
  });

  it("formats counts without zero padding", () => {
    render(<Table countries={countries} />);

    expect(screen.getByText("412")).toBeInTheDocument();
    expect(screen.getByText("1,234,567")).toBeInTheDocument();
  });

  it("renders an empty table without crashing", () => {
    const { container } = render(<Table countries={[]} />);
    expect(container.querySelectorAll("tbody tr")).toHaveLength(0);
  });
});
