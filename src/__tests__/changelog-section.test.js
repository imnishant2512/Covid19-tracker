/**
 * These specs touch no DOM, so they skip the ~5s jsdom construction.
 *
 * @vitest-environment node
 */
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { extractSection } from "../../scripts/changelog-section.mjs";

const SAMPLE = `# Changelog

Preamble that must never appear in release notes.

## [1.1.0] - 2026-08-24

### Changed

- Second release note.

## [1.0.0] - 2026-08-22

Intro line for the first release.

### Fixed

- First release note.

[1.1.0]: https://example.com/releases/tag/v1.1.0
[1.0.0]: https://example.com/releases/tag/v1.0.0
`;

describe("extractSection", () => {
  it("returns only the requested version's section", () => {
    const section = extractSection(SAMPLE, "v1.1.0");

    expect(section).toContain("Second release note.");
    expect(section).not.toContain("First release note.");
    expect(section).not.toContain("Preamble");
  });

  it("stops at the link-reference block rather than swallowing it", () => {
    // The oldest entry is the one at risk: nothing but link definitions follows it.
    const section = extractSection(SAMPLE, "v1.0.0");

    expect(section).toContain("First release note.");
    expect(section).not.toContain("[1.0.0]: https://");
    expect(section).not.toContain("[1.1.0]: https://");
  });

  it("keeps prose that sits above the first sub-heading", () => {
    expect(extractSection(SAMPLE, "v1.0.0")).toContain(
      "Intro line for the first release."
    );
  });

  it("accepts the tag with or without a leading v", () => {
    expect(extractSection(SAMPLE, "1.1.0")).toBe(
      extractSection(SAMPLE, "v1.1.0")
    );
  });

  it("throws rather than returning empty notes for an unknown version", () => {
    // A silent empty string would publish a release with no notes at all.
    expect(() => extractSection(SAMPLE, "v9.9.9")).toThrow(/No CHANGELOG section/);
  });

  it("works against the real CHANGELOG for every released tag", async () => {
    const markdown = await readFile(
      new URL("../../CHANGELOG.md", import.meta.url),
      "utf8"
    );

    for (const tag of ["v1.0.0", "v1.1.0"]) {
      const section = extractSection(markdown, tag);
      expect(section.length).toBeGreaterThan(200);
      expect(section).not.toMatch(/^\[\d+\.\d+\.\d+\]:/m);
      expect(section).not.toContain("## [");
    }
  });
});
