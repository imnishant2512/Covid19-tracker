import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useSnapshot } from "../hooks/useSnapshot";
import { SNAPSHOT, okResponse } from "./fixtures";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okResponse(SNAPSHOT)));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useSnapshot", () => {
  it("starts in a loading state with no data", () => {
    const { result } = renderHook(() => useSnapshot());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.snapshot).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("returns the snapshot and clears loading once it arrives", async () => {
    const { result } = renderHook(() => useSnapshot());

    await waitFor(() => expect(result.current.snapshot).not.toBeNull());
    expect(result.current.snapshot.updated).toBe("2026-08-02");
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("fetches once, not once per render", async () => {
    const { result, rerender } = renderHook(() => useSnapshot());
    await waitFor(() => expect(result.current.snapshot).not.toBeNull());

    rerender();
    rerender();

    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });

  it("surfaces a failure and stops loading", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) })
    );

    const { result } = renderHook(() => useSnapshot());

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error.message).toMatch(/503/);
    // Regression: the spinner hung forever when loading was only cleared on
    // the success path.
    expect(result.current.isLoading).toBe(false);
  });

  it("aborts the request when unmounted mid-flight", async () => {
    const { unmount } = renderHook(() => useSnapshot());
    unmount();

    const { signal } = vi.mocked(fetch).mock.calls[0][1];
    await waitFor(() => expect(signal.aborted).toBe(true));
  });

  it("treats an abort as cancellation rather than an error", async () => {
    const abort = new Error("aborted");
    abort.name = "AbortError";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abort));

    const { result } = renderHook(() => useSnapshot());

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(result.current.error).toBeNull();
  });
});
