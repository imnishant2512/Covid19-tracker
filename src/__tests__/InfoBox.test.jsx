import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import InfoBox from "../components/InfoBox";

const renderBox = (props = {}) =>
  render(
    <InfoBox
      title="Coronavirus Cases"
      total="+1.2m"
      cases="+400"
      onSelect={() => {}}
      {...props}
    />
  );

describe("InfoBox", () => {
  it("never leaks a literal 'false' into the class list", () => {
    const { container } = renderBox({ active: false, isRed: false });

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

  it("shows a spinner instead of the delta while loading", () => {
    renderBox({ isLoading: true });

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("+400")).not.toBeInTheDocument();
  });
});
