import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import Table from "../components/Table";
import { SNAPSHOT } from "./fixtures";

const renderTable = (metric = "cases") =>
  render(<Table countries={SNAPSHOT.countries} metric={metric} />);

describe("Table", () => {
  it("renders rows inside a real table element", () => {
    const { container } = renderTable();

    expect(container.querySelector("table tbody tr")).not.toBeNull();
    expect(container.querySelector("div > tr")).toBeNull();
  });

  it("formats counts without zero padding", () => {
    renderTable();
    expect(screen.getByText("103,436,829")).toBeInTheDocument();
  });

  it("shows the figure for the selected metric", () => {
    renderTable("newCases");
    expect(screen.getByText("5,000")).toBeInTheDocument();
    expect(screen.queryByText("103,436,829")).not.toBeInTheDocument();
  });

  it("renders an empty table without crashing", () => {
    const { container } = render(<Table countries={[]} metric="cases" />);
    expect(container.querySelectorAll("tbody tr")).toHaveLength(0);
  });
});
