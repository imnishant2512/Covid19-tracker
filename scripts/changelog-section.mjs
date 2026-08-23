/**
 * Prints the CHANGELOG section for one version, for use as GitHub Release notes.
 *
 * Keeping the release notes derived from CHANGELOG.md means the two can never
 * drift: there is one source of truth, and publishing a release is a read of it
 * rather than a re-write.
 *
 * Usage: node scripts/changelog-section.mjs v1.1.0
 */
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const CHANGELOG = new URL("../CHANGELOG.md", import.meta.url);

/** "v1.1.0" and "1.1.0" both refer to the "## [1.1.0] - date" heading. */
const normalise = (tag) => tag.replace(/^v/, "");

export const extractSection = (markdown, tag) => {
  const version = normalise(tag);
  const lines = markdown.split("\n");

  const isHeading = (line) => /^## /.test(line);
  const matchesVersion = (line) =>
    line.startsWith(`## [${version}]`) || line.startsWith(`## ${version}`);

  const start = lines.findIndex(matchesVersion);
  if (start === -1) {
    throw new Error(`No CHANGELOG section found for ${tag}`);
  }

  // Run to the next version heading, or to the link-reference block at the end.
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (isHeading(lines[i]) || /^\[\d+\.\d+\.\d+\]:/.test(lines[i])) {
      end = i;
      break;
    }
  }

  return lines
    .slice(start + 1, end)
    .join("\n")
    .trim();
};

const main = async () => {
  const tag = process.argv[2];
  if (!tag) {
    console.error("Usage: node scripts/changelog-section.mjs <tag>");
    process.exit(1);
  }

  const markdown = await readFile(CHANGELOG, "utf8");
  process.stdout.write(`${extractSection(markdown, tag)}\n`);
};

// Only run when invoked directly, so the export stays unit-testable.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
