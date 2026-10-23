import { expect, test } from "bun:test";
import { renderSkill } from "./sync-animate-expo";

const guidance = "Use project/terminal or matching MCP tools when available; otherwise provide instructions and identify unexecuted steps. If `expo-overview` is installed, read its [execution guidance](../expo-overview/references/execution-environments.md) before acting.";
const upstream = `---
name: animate-expo
description: Build Expo animations.
---
# Building Animations in Expo

Upstream introduction.

## Operating Posture

Upstream implementation instructions.
`;

test("sync keeps Expo runtime guidance before upstream instructions", () => {
  const output = renderSkill(upstream, "1.0.1");
  expect(output).toContain("name: expo-animation\n");
  expect(output).toContain("version: 1.0.1\n");
  expect(output).toContain(`Upstream introduction.\n\n${guidance}\n\n## Operating Posture`);
  expect(output).toContain("This skill was created in collaboration with");
  expect(output).toContain("Upstream implementation instructions.");
  expect(output).toContain('feedback --category skills --subject "expo-animation"');
});

test("sync inserts runtime guidance only once if upstream includes it", () => {
  const output = renderSkill(upstream.replace("## Operating Posture", `${guidance}\n\n## Operating Posture`), "1.0.1");
  expect(output.split(guidance)).toHaveLength(2);
});
