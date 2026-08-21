/**
 * These specs touch no DOM, so they skip the ~5s jsdom construction.
 *
 * @vitest-environment node
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { getJSON, isAbort } from "../api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getJSON", () => {
  it("throws on a non-2xx response instead of returning the error body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ message: "Country not found" }),
      })
    );

    await expect(getJSON("/countries/zz")).rejects.toThrow(/404/);
  });

  it("returns parsed JSON on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ cases: 5 }),
      })
    );

    await expect(getJSON("/all")).resolves.toEqual({ cases: 5 });
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
