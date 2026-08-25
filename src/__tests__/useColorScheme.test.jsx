import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useColorScheme } from "../hooks/useColorScheme";

/**
 * Install a controllable matchMedia. jsdom provides no implementation, so the
 * hook's listener path was never exercised until this spec existed — a gap the
 * v8 coverage provider only started reporting once it counted statements more
 * precisely.
 */
const stubMatchMedia = ({ matches = false } = {}) => {
  const listeners = new Set();

  const media = {
    matches,
    addEventListener: (_event, handler) => listeners.add(handler),
    removeEventListener: (_event, handler) => listeners.delete(handler),
  };

  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => media)
  );

  return {
    media,
    listeners,
    /** Simulate the OS switching scheme. */
    emit: (nowMatches) => {
      media.matches = nowMatches;
      act(() => {
        listeners.forEach((handler) => handler({ matches: nowMatches }));
      });
    },
  };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useColorScheme", () => {
  it("reports light when the system does not prefer dark", () => {
    stubMatchMedia({ matches: false });

    const { result } = renderHook(() => useColorScheme());

    expect(result.current).toBe("light");
  });

  it("reports dark when the system prefers it", () => {
    stubMatchMedia({ matches: true });

    const { result } = renderHook(() => useColorScheme());

    expect(result.current).toBe("dark");
  });

  it("queries the prefers-color-scheme media feature", () => {
    stubMatchMedia();

    renderHook(() => useColorScheme());

    expect(vi.mocked(matchMedia)).toHaveBeenCalledWith(
      "(prefers-color-scheme: dark)"
    );
  });

  it("follows the system changing scheme while the page is open", () => {
    const control = stubMatchMedia({ matches: false });
    const { result } = renderHook(() => useColorScheme());

    expect(result.current).toBe("light");

    control.emit(true);
    expect(result.current).toBe("dark");

    control.emit(false);
    expect(result.current).toBe("light");
  });

  it("removes its listener on unmount", () => {
    const control = stubMatchMedia();
    const { unmount } = renderHook(() => useColorScheme());

    expect(control.listeners.size).toBe(1);
    unmount();
    // A leaked listener would keep setting state on an unmounted component.
    expect(control.listeners.size).toBe(0);
  });

  it("falls back to light where matchMedia is unavailable", () => {
    // Older browsers and some server-rendered contexts have no matchMedia.
    vi.stubGlobal("matchMedia", undefined);

    const { result } = renderHook(() => useColorScheme());

    expect(result.current).toBe("light");
  });
});
