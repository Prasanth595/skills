#!/usr/bin/env bun

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const skillsDir = resolve(import.meta.dir, "../plugins/expo/skills");
export const simulatorFingerprintPath = join(skillsDir, "eas-simulator/source.sha256");

// skills CLI update hashes do not follow symlinks. A regular file in the legacy
// directory must change when its shared workflow or references change.
export function simulatorSourceFingerprint(): string {
  const canonical = join(skillsDir, "expo-simulators");
  const hash = createHash("sha256");
  const files = ["SKILL.md", ...readdirSync(join(canonical, "references")).sort().map((name) => `references/${name}`)];
  for (const file of files) {
    hash.update(file);
    hash.update("\0");
    hash.update(readFileSync(join(canonical, file)));
    hash.update("\0");
  }
  return `${hash.digest("hex")}\n`;
}

if (import.meta.main) {
  writeFileSync(simulatorFingerprintPath, simulatorSourceFingerprint());
  console.log("Updated eas-simulator/source.sha256 from expo-simulators.");
}
