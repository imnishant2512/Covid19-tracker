import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import InfoBox from "../components/InfoBox";
import { METRICS } from "../util";

const renderBox = (props = {}) =>
  render(
    <InfoBox
      title="Coronavirus Cases"
      metric="cases"
      value="777.6m"
      context="total reported"
      onSelect={() => {}}
      {...props}
    />
  );

describe("InfoBox", () => {
  it("never leaks a literal 'false' into the class list", () => {
    const { container } = renderBox({ active: false });
    expect(container.querySelector(".infoBox").className).not.toMatch(/false/);
  });

  it("marks the active box with aria-pressed", () => {
    renderBox({ active: true });
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
  });

  it("is selectable by keyboard", async () => {
    const onSelect = vi.fn();
    renderBox({ onSelect });

    await userEvent.tab();
    await userEvent.keyboard("{Enter}");

    expect(onSelect).toHaveBeenCalled();
  });

  it("does not expose the bare figure to heading navigation", () => {
    renderBox();

    // The number carries no context on its own; announcing "heading level 2:
    // 777.6m" to a screen reader is noise. The label is on the button instead.
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.getByRole("button")).toHaveAccessibleName(
      /show coronavirus cases/i
    );
  });

  it("colours the figure to match its metric on the map", () => {
    const { container } = renderBox({ metric: "deaths" });
    expect(container.querySelector(".infoBox__value")).toHaveStyle({
      color: METRICS.deaths.hex,
    });
  });

  it("shows a spinner instead of the figure while loading", () => {
    renderBox({ isLoading: true });

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("777.6m")).not.toBeInTheDocument();
  });
});
