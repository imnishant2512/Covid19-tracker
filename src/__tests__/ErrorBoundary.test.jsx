import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ErrorBoundary from "../components/ErrorBoundary";

const Boom = () => {
  throw new Error("render exploded");
};

beforeEach(() => {
  // React logs the caught error; keep the suite output readable.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ErrorBoundary", () => {
  it("renders children when nothing throws", () => {
    render(
      <ErrorBoundary>
        <p>healthy</p>
      </ErrorBoundary>
    );

    expect(screen.getByText("healthy")).toBeInTheDocument();
  });

  it("contains a crash and shows the fallback", () => {
    render(
      <ErrorBoundary fallback="The map couldn't be displayed.">
        <Boom />
      </ErrorBoundary>
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "The map couldn't be displayed."
    );
  });

  it("falls back to a generic message when none is supplied", () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );

    expect(screen.getByRole("alert")).toHaveTextContent(/something went wrong/i);
  });

  it("isolates the failure so sibling panels survive", () => {
    render(
      <div>
        <ErrorBoundary fallback="panel down">
          <Boom />
        </ErrorBoundary>
        <p>sibling still here</p>
      </div>
    );

    expect(screen.getByText("sibling still here")).toBeInTheDocument();
  });
});
