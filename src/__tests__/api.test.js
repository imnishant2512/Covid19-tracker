/**
 * These specs touch no DOM, so they skip the ~5s jsdom construction.
 *
 * @vitest-environment node
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchSnapshot, isAbort } from "../api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchSnapshot", () => {
  it("throws on a non-2xx response instead of returning the error body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) })
    );

    await expect(fetchSnapshot()).rejects.toThrow(/404/);
  });

  it("returns the parsed snapshot on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ updated: "2026-08-02" }),
      })
    );

    await expect(fetchSnapshot()).resolves.toEqual({ updated: "2026-08-02" });
  });

  it("requests the snapshot from the app's own origin", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);

    await fetchSnapshot();

    // Same-origin matters: the upstream sources that carry current figures are
    // either CORS-blocked or multi-megabyte, which is why this is a build artefact.
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("data/covid-snapshot.json");
    expect(url).not.toMatch(/^https?:\/\//);
  });

  it("passes the abort signal through", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);

    const controller = new AbortController();
    await fetchSnapshot(controller.signal);

    expect(fetchMock.mock.calls[0][1].signal).toBe(controller.signal);
  });
});

describe("isAbort", () => {
  it("recognises abort errors and nothing else", () => {
    const abort = new Error("aborted");
    abort.name = "AbortError";

    expect(isAbort(abort)).toBe(true);
    expect(isAbort(new Error("network down"))).toBe(false);
    expect(isAbort(undefined)).toBe(false);
  });
});
