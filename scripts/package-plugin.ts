#!/usr/bin/env bun
import { resolve } from "node:path";
import { packagePlugin, validatePlugin } from "./plugin-package";

const args = process.argv.slice(2);
if (args.length === 1 && ["--help", "-h"].includes(args[0])) {
  console.log("Usage: bun scripts/package-plugin.ts [--output path.zip]\n\nCreates and validates a ZIP offline. Requires Bun and Python 3.\nDefault output: dist/expo-plugin-<version>.zip. Existing files are never overwritten.");
} else {
  try {
    if (!(args.length === 0 || (args.length === 2 && args[0] === "--output" && !args[1].startsWith("-")))) {
      throw new Error("Usage: bun scripts/package-plugin.ts [--output path.zip]");
    }
    const output = args[1] ?? `dist/expo-plugin-${(await validatePlugin(process.cwd())).version}.zip`;
    const result = await packagePlugin(process.cwd(), resolve(output));
    console.log(`Created ${result.archive}\nExpo ${result.version}: ${result.skills.length} skills, ${result.files.length} files, ${result.archiveBytes} ZIP bytes. Extracted contents validated; no publication performed.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
