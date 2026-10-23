#!/usr/bin/env bun
import { resolve } from "node:path";
import { validatePlugin } from "./plugin-package";

const args = process.argv.slice(2);
if (args.length === 1 && ["--help", "-h"].includes(args[0])) {
  console.log("Usage: bun scripts/check-plugin.ts [plugin-root]\n\nValidates Expo's source package or an extracted release ZIP offline.");
} else {
  try {
    if (args.length > 1 || args[0]?.startsWith("-")) throw new Error("Usage: bun scripts/check-plugin.ts [plugin-root]");
    const result = await validatePlugin(resolve(args[0] ?? "."));
    console.log(`Expo ${result.version}: ${result.skills.length} skills, ${result.files.length} package files, ${result.bytes} bytes. Offline validation passed.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
