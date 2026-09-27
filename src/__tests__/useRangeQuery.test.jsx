import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useRangeQuery } from "../hooks/useRangeQuery";

afterEach(() => {
  window.history.replaceState(null, "", "/");
});

describe("useRangeQuery", () => {
  it("reads the range from the URL on first render", () => {
    window.history.replaceState(null, "", "/?from=2026-06-14&to=2026-09-06");
    const { result } = renderHook(() => useRangeQuery());

    expect(result.current[0]).toEqual({ period: null, from: "2026-06-14", to: "2026-09-06" });
  });

  it("replaces the URL rather than pushing, so Back leaves the page", () => {
    const push = vi.spyOn(window.history, "pushState");
    const before = window.history.length;
    const { result } = renderHook(() => useRangeQuery());

    act(() => result.current[1]({ period: "3m" }));

    expect(window.location.search).toBe("?period=3m");
    expect(result.current[0].period).toBe("3m");
    expect(push).not.toHaveBeenCalled();
    expect(window.history.length).toBe(before);
  });

  it("swaps a preset for explicit dates without leaving the other behind", () => {
    window.history.replaceState(null, "", "/?period=3m");
    const { result } = renderHook(() => useRangeQuery());

    act(() => result.current[1]({ from: "2026-08-16", to: "2026-08-30" }));

    expect(window.location.search).toBe("?from=2026-08-16&to=2026-08-30");
  });

  it("leaves parameters that belong to anything else alone", () => {
    window.history.replaceState(null, "", "/?utm_source=newsletter#map");
    const { result } = renderHook(() => useRangeQuery());

    act(() => result.current[1]({ period: "4w" }));
    act(() => result.current[1]({}));

    expect(window.location.search).toBe("?utm_source=newsletter");
    expect(window.location.hash).toBe("#map");
  });

  it("follows Back and Forward to a URL with a different range", () => {
    const { result } = renderHook(() => useRangeQuery());

    act(() => {
      window.history.replaceState(null, "", "/?period=1y");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    expect(result.current[0].period).toBe("1y");
  });
});
