// Exercise both historical and root layouts in disposable repositories.
// The tests never modify this checkout's manifests or Git state.
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const checkScript = join(import.meta.dir, "check-plugin-version-bump.ts");
const manifests = [
  "plugin.json",
  ".claude-plugin/plugin.json",
];
const baseVersion = "1.14.0";
const nextVersion = "2.0.0";
const laterVersion = "2.0.1";
let repository: string;

function git(...args: string[]) {
  return execFileSync("git", args, { cwd: repository, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function write(path: string, contents: string) {
  mkdirSync(dirname(join(repository, path)), { recursive: true });
  writeFileSync(join(repository, path), contents);
}

type Layout = "root" | "nested" | "legacy";

function writeManifests(version: string, layout: Layout = "root") {
  for (const path of manifests) {
    const filename = layout === "legacy" && path === "plugin.json" ? ".codex-plugin/plugin.json" : path;
    write(`${layout === "root" ? "" : "plugins/expo/"}${filename}`, JSON.stringify({ name: "expo", version }, null, 2) + "\n");
  }
}

function createRepository(layout: Layout = "root") {
  if (repository) rmSync(repository, { recursive: true, force: true });
  repository = mkdtempSync(join(tmpdir(), "expo-plugin-version-"));
  git("init", "-q");
  git("config", "user.name", "Fixture");
  git("config", "user.email", "fixture@example.test");
  writeManifests(baseVersion, layout);
  git("add", ".");
  git("commit", "-qm", "initial package");
  writeManifests(nextVersion);
}

function runCheck(...args: string[]) {
  const result = Bun.spawnSync(["bun", checkScript, ...args], {
    cwd: repository,
    stdout: "pipe",
    stderr: "pipe",
  });
  return { exitCode: result.exitCode, output: `${result.stdout}${result.stderr}` };
}

function versionOf(path: string) {
  return JSON.parse(readFileSync(join(repository, path), "utf8")).version;
}

beforeEach(() => createRepository());
afterEach(() => rmSync(repository, { recursive: true, force: true }));

describe("arguments", () => {
  test("prints help and every manifest path", () => {
    for (const flag of ["--help", "-h"]) {
      const result = runCheck(flag);
      expect(result.exitCode).toBe(0);
      expect(result.output).toContain("Usage: bun scripts/check-plugin-version-bump.ts");
      for (const path of manifests) expect(result.output).toContain(path);
    }
  });
  for (const [args, message] of [
    [["--bogus"], "Unknown option: --bogus"],
    [["HEAD", "extra"], "Unexpected argument: extra"],
    [["--set-version"], "requires a version argument"],
    [["--set-version="], "requires a version argument"],
  ] as const) {
    test(`rejects ${args.join(" ")}`, () => {
      const result = runCheck(...args);
      expect(result.exitCode).toBe(1);
      expect(result.output).toContain(message);
    });
  }
  for (const version of ["1.9", "v2.0.0", "1.2.3.4", "01.2.3", "2.0.0."]) {
    test(`rejects invalid semver ${version}`, () => {
      const result = runCheck("HEAD", "--set-version", version);
      expect(result.exitCode).toBe(1);
      expect(result.output).toContain("not a valid semver version");
    });
  }
});

for (const layout of ["root", "nested", "legacy"] as const) {
  describe(`${layout} base migration`, () => {
    beforeEach(() => createRepository(layout));
    for (const version of [baseVersion, "0.0.1"]) {
      test(`rejects ${version} without changing manifests`, () => {
        const before = manifests.map((path) => readFileSync(join(repository, path), "utf8"));
        const result = runCheck("HEAD", "--set-version", version);
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain("is not greater than");
        expect(manifests.map((path) => readFileSync(join(repository, path), "utf8"))).toEqual(before);
      });
    }
    test("writes both versions and preserves other lines", () => {
      const before = manifests.map((path) => readFileSync(join(repository, path), "utf8").split("\n"));
      const result = runCheck("HEAD", "--set-version", laterVersion);
      expect(result.exitCode).toBe(0);
      expect(result.output).toContain("All 2 plugin manifests are now at 2.0.1");
      for (const [index, path] of manifests.entries()) {
        expect(versionOf(path)).toBe(laterVersion);
        const after = readFileSync(join(repository, path), "utf8").split("\n");
        expect(after.length).toBe(before[index]!.length);
        expect(after.filter((line, lineIndex) => line !== before[index]![lineIndex]).length).toBe(1);
      }
    });
    test("checks committed changes against the original base", () => {
      const base = git("rev-parse", "HEAD");
      write("skills/expo-example/SKILL.md", "new skill\n");
      git("add", ".");
      git("commit", "-qm", "move and update package");
      expect(runCheck(base).exitCode).toBe(0);
      writeManifests(baseVersion);
      const result = runCheck(base);
      expect(result.exitCode).toBe(1);
      expect(result.output).toContain(`version must be greater than main (${baseVersion})`);
    });
  });
}

test("prefers the nested portable manifest over a historical Codex manifest", () => {
  createRepository("nested");
  write("plugins/expo/.codex-plugin/plugin.json", JSON.stringify({ name: "expo", version: "9.0.0" }));
  git("add", "plugins/expo/.codex-plugin/plugin.json");
  git("commit", "-qm", "retain historical metadata");
  const result = runCheck("HEAD", "--set-version", laterVersion);
  expect(result.exitCode).toBe(0);
});

test("accepts equals syntax and reports unchanged versions", () => {
  const result = runCheck("HEAD", `--set-version=${nextVersion}`);
  expect(result.exitCode).toBe(0);
  expect(result.output).toContain(`Unchanged Claude: already ${nextVersion}`);
});

test("rejects out-of-sync portable and compatibility versions", () => {
  const base = git("rev-parse", "HEAD");
  git("add", ".");
  git("commit", "-qm", "bump package");
  write("plugin.json", JSON.stringify({ name: "expo", version: laterVersion }));
  const result = runCheck(base);
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain("plugin versions in this PR must match");
});
