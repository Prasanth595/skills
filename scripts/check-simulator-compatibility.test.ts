import { describe, expect, test } from "bun:test";
import { cpSync, existsSync, lstatSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { simulatorFingerprintPath, simulatorSourceFingerprint } from "./sync-simulator-compatibility";

const skillsDir = resolve(import.meta.dir, "../plugins/expo/skills");
const canonical = join(skillsDir, "expo-simulators");
const legacy = join(skillsDir, "eas-simulator");

function checkRelativeLinks(path: string) {
  const markdown = readFileSync(path, "utf8");
  for (const [, target, anchor] of markdown.matchAll(/\]\((\.\.?\/[^)#]+)(?:#([^)]*))?\)/g)) {
    const linkedPath = resolve(dirname(path), target!);
    expect(existsSync(linkedPath)).toBe(true);
    if (anchor) {
      const headings = [...readFileSync(linkedPath, "utf8").matchAll(/^#+ (.+)$/gm)]
        .map(([, heading]) => heading!.toLowerCase().replace(/[^\w\s-]/g, "").replace(/ /g, "-"));
      expect(headings).toContain(anchor);
    }
  }
}

describe("Expo Simulators skill compatibility", () => {
  test("legacy update fingerprint is current (refresh with bun scripts/sync-simulator-compatibility.ts)", () => {
    expect(readFileSync(simulatorFingerprintPath, "utf8")).toBe(simulatorSourceFingerprint());
  });

  test("both names have real discovery entrypoints and matching trigger metadata", () => {
    for (const name of ["expo-simulators", "eas-simulator"]) {
      const dir = join(skillsDir, name);
      expect(lstatSync(dir).isDirectory()).toBe(true);
      expect(lstatSync(join(dir, "SKILL.md")).isFile()).toBe(true);
      expect(readFileSync(join(dir, "SKILL.md"), "utf8")).toContain(`name: ${name}\n`);
      expect(readFileSync(join(dir, "agents/openai.yaml"), "utf8")).toContain(`$${name} `);
    }
    expect(readFileSync(join(legacy, "SKILL.md"), "utf8")).toContain("disable-model-invocation: true");
    expect(readFileSync(join(legacy, "agents/openai.yaml"), "utf8")).toContain("allow_implicit_invocation: false");
  });

  test("the legacy workflow and old reference paths share the canonical source", () => {
    expect(realpathSync(join(canonical, "workflow.md"))).toBe(realpathSync(join(canonical, "SKILL.md")));
    for (const [oldPath, newPath] of [["workflow.md", "SKILL.md"], ["references", "references"]]) {
      expect(lstatSync(join(legacy, oldPath!)).isSymbolicLink()).toBe(true);
      expect(realpathSync(join(legacy, oldPath!))).toBe(realpathSync(join(canonical, newPath!)));
    }
    checkRelativeLinks(join(legacy, "SKILL.md"));
    checkRelativeLinks(join(legacy, "workflow.md"));
    for (const name of readdirSync(join(canonical, "references"))) {
      checkRelativeLinks(join(legacy, "references", name));
    }
  });

  test("a dereferenced legacy-only package is self-contained", () => {
    const destination = mkdtempSync(join(tmpdir(), "expo-simulators-compat-"));
    try {
      const installed = join(destination, "eas-simulator");
      cpSync(legacy, installed, { recursive: true, dereference: true });
      expect(existsSync(join(destination, "expo-simulators"))).toBe(false);
      expect(lstatSync(join(installed, "workflow.md")).isFile()).toBe(true);
      expect(lstatSync(join(installed, "references")).isDirectory()).toBe(true);
      expect(readFileSync(join(installed, "workflow.md"), "utf8")).toBe(readFileSync(join(canonical, "SKILL.md"), "utf8"));
      checkRelativeLinks(join(installed, "SKILL.md"));
      checkRelativeLinks(join(installed, "workflow.md"));
      for (const name of readdirSync(join(canonical, "references"))) {
        expect(readFileSync(join(installed, "references", name), "utf8")).toBe(readFileSync(join(canonical, "references", name), "utf8"));
        checkRelativeLinks(join(installed, "references", name));
      }
    } finally {
      rmSync(destination, { recursive: true, force: true });
    }
  });
});
