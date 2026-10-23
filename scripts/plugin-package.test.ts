import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, readFile, rm, symlink, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { getPackageFiles, LIMITS, MANIFEST_PATHS, packagePlugin, validatePlugin, validateSourceRepository } from "./plugin-package";

const temporary: string[] = [];
afterEach(async () => {
  await Promise.all(temporary.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

async function put(root: string, path: string, value: string | Buffer | object) {
  await mkdir(dirname(join(root, path)), { recursive: true });
  await writeFile(join(root, path), typeof value === "string" || Buffer.isBuffer(value) ? value : `${JSON.stringify(value, null, 2)}\n`);
}

async function modify(root: string, path: string, edit: (value: any) => void) {
  const value = JSON.parse(await readFile(join(root, path), "utf8"));
  edit(value);
  await put(root, path, value);
}

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "expo-package-test-"));
  temporary.push(root);
  const common = {
    name: "expo", version: "2.0.0", description: "Expo skills and MCP.",
    author: { name: "Expo Team", email: "support@expo.dev", url: "https://expo.dev" },
    homepage: "https://docs.expo.dev/skills/", repository: "https://github.com/expo/skills", license: "MIT",
  };
  const ui = {
    displayName: "Expo", shortDescription: "Build mobile apps", longDescription: "Expo skills and MCP.",
    developerName: "Expo", category: "Developer Tools", capabilities: ["Read", "Write", "MCP"],
    websiteURL: "https://expo.dev", supportURL: "https://github.com/expo/skills/issues",
    privacyPolicyURL: "https://expo.dev/privacy", termsOfServiceURL: "https://expo.dev/terms",
    defaultPrompt: ["Build a mobile app"], composerIcon: "./assets/expo.png", logo: "./assets/expo.png",
    screenshots: [], brandColor: "#000020",
  };
  await put(root, "plugin.json", { $schema: "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json", ...common, extensions: { "com.openai": { interface: ui } } });
  for (const path of MANIFEST_PATHS.filter((path) => path !== "plugin.json")) {
    await put(root, path, common);
  }
  await put(root, "mcp.json", { $schema: "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json", mcpServers: { expo: { type: "streamable-http", url: "https://mcp.expo.dev/mcp" } } });
  await put(root, ".mcp.json", { mcpServers: { expo: { type: "http", url: "https://mcp.expo.dev/mcp" } } });
  await put(root, "assets/expo.png", Buffer.from("iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAAH0lEQVR4nO3BAQEAAACCIP+vbkhAAQAAAAAAAAAALwYkMAAB5ewAXAAAAABJRU5ErkJggg==", "base64"));
  await put(root, "README.md", "# Expo\n\n[Skills](skills/README.md)\n");
  await put(root, "LICENSE", "MIT\n");
  await put(root, "skills/README.md", "# Skills\n\n[Test](expo-test/SKILL.md)\n");
  await put(root, "skills/expo-test/SKILL.md", "---\nname: expo-test\ndescription: Test Expo tasks.\n---\n# Test\n\n[Reference](references/guide.md#example)\n\nUse `scripts/task.js`.\n");
  await put(root, "skills/expo-test/agents/openai.yaml", "interface:\n  display_name: Test Expo\n  short_description: Test Expo tasks\n  default_prompt: Use Expo\n");
  await put(root, "skills/expo-test/references/guide.md", "# Example\n\n[Skill](../SKILL.md)\n\nExample project paths:\n```js\nconst file = '../not-a-plugin-file.md';\n```\n");
  await put(root, "skills/expo-test/scripts/task.js", "// Preserve this source exactly, including @latest.\nconsole.log('npx expo@latest');\n");
  return root;
}

describe("offline package validation", () => {
  test("discovers skills without hardcoding their count", async () => {
    const root = await fixture();
    const result = await validatePlugin(root);
    expect(result.version).toBe("2.0.0");
    expect(result.skills).toEqual(["expo-test"]);
    expect(result.files).toEqual(await getPackageFiles(root));
    expect(result.bytes).toBeGreaterThan(0);
  });

  test("rejects mismatched identity, versions and integration paths", async () => {
    for (const [key, value, error] of [["name", "Expo", "plugin name"], ["version", "2.0.1", "version differs"], ["mcpServers", "../outside.json", "unsupported field mcpServers"]]) {
      const root = await fixture();
      await modify(root, ".claude-plugin/plugin.json", (manifest) => { manifest[key] = value; });
      await expect(validatePlugin(root)).rejects.toThrow(error);
    }
  });

  test("checks portable and native endpoint and transport parity", async () => {
    const root = await fixture();
    await modify(root, "mcp.json", (config) => { config.mcpServers.expo.type = "http"; });
    await expect(validatePlugin(root)).rejects.toThrow("expected streamable-http");
    await modify(root, "mcp.json", (config) => { config.mcpServers.expo.type = "streamable-http"; });
    await modify(root, ".mcp.json", (config) => { config.mcpServers.expo.url = "https://example.com/mcp"; });
    await expect(validatePlugin(root)).rejects.toThrow("https://mcp.expo.dev/mcp");
  });

  test("rejects embedded authorization and credential files", async () => {
    const root = await fixture();
    await modify(root, ".mcp.json", (config) => { config.mcpServers.expo.headers = { Authorization: "Bearer example" }; });
    await expect(validatePlugin(root)).rejects.toThrow("unsupported field headers");
    await put(root, "skills/expo-test/credentials.json", "{}");
    await expect(getPackageFiles(root)).rejects.toThrow("credential files");
  });

  test("checks OpenAI metadata limits in the portable manifest", async () => {
    const root = await fixture();
    await modify(root, "plugin.json", (manifest) => { manifest.extensions["com.openai"].interface.shortDescription = "x".repeat(31); });
    await expect(validatePlugin(root)).rejects.toThrow("at most 30 characters");
  });

  test("checks icon dimensions and unique starter prompts", async () => {
    const root = await fixture();
    const image = await readFile(join(root, "assets/expo.png"));
    const invalid = Buffer.from(image);
    invalid.writeUInt32BE(47, 16);
    await put(root, "assets/expo.png", invalid);
    await expect(validatePlugin(root)).rejects.toThrow("square and at least 48 pixels");
    await put(root, "assets/expo.png", image);
    await modify(root, "plugin.json", (manifest) => { manifest.extensions["com.openai"].interface.defaultPrompt = ["same", "same"]; });
    await expect(validatePlugin(root)).rejects.toThrow("starter prompts must be unique");
  });

  test("checks local Markdown and bare supporting references against package membership", async () => {
    const root = await fixture();
    await put(root, "README.md", "[Contributing](CONTRIBUTING.md)\n");
    await put(root, "CONTRIBUTING.md", "Maintainer documentation excluded from ZIP.\n");
    await expect(validatePlugin(root)).rejects.toThrow("not included in the package: CONTRIBUTING.md");
    await put(root, "README.md", "# Expo\n");
    await put(root, "skills/expo-test/references/guide.md", "Read `references/missing.md`.\n");
    await expect(validatePlugin(root)).rejects.toThrow("not included in the package: references/missing.md");
    await put(root, "skills/expo-test/references/guide.md", "[Outside](../../../../outside.md)\n");
    await expect(validatePlugin(root)).rejects.toThrow("link escapes the package");
  });

  test("rejects missing or malformed skill metadata", async () => {
    const root = await fixture();
    await put(root, "skills/expo-test/SKILL.md", "---\nname: another-name\ndescription: Test\n---\nBody\n");
    await expect(validatePlugin(root)).rejects.toThrow("frontmatter name must match");
    await put(root, "skills/expo-test/SKILL.md", "No frontmatter\n");
    await expect(validatePlugin(root)).rejects.toThrow("missing YAML frontmatter");
  });

  test("rejects symlinked files and manifest ancestors", async () => {
    const root = await fixture();
    await symlink(join(root, "LICENSE"), join(root, "skills/expo-test/linked.md"));
    await expect(getPackageFiles(root)).rejects.toThrow("symlinks are not allowed");
    await rm(join(root, "skills/expo-test/linked.md"));
    await put(root, "manifest-backup/plugin.json", await readFile(join(root, ".claude-plugin/plugin.json")));
    await rm(join(root, ".claude-plugin"), { recursive: true });
    await symlink(join(root, "manifest-backup"), join(root, ".claude-plugin"));
    await expect(getPackageFiles(root)).rejects.toThrow("symlinks are not allowed");
  });

  test("rejects accidental hidden files, binaries and oversized text", async () => {
    const root = await fixture();
    for (const path of ["skills/expo-test/.env", "skills/expo-test/scripts/.cache/schema.json", "skills/expo-test/download.zip"]) {
      await put(root, path, "example");
      await expect(getPackageFiles(root)).rejects.toThrow();
      await rm(join(root, path));
    }
    await put(root, "skills/expo-test/binary.txt", Buffer.from([0, 1, 2]));
    await expect(validatePlugin(root)).rejects.toThrow("binary content");
    await rm(join(root, "skills/expo-test/binary.txt"));
    await put(root, "skills/expo-test/large.txt", "x".repeat(LIMITS.textBytes + 1));
    await expect(validatePlugin(root)).rejects.toThrow("text-file limit");
  });

  test("enforces archive file-count limits", async () => {
    const root = await fixture();
    await Promise.all(Array.from({ length: LIMITS.files }, (_, index) => put(root, `skills/expo-test/references/file-${index}.md`, "# File\n")));
    await expect(getPackageFiles(root)).rejects.toThrow("maximum is 512");
  });
});

describe("complete Git source checks", () => {
  async function repository() {
    const root = await fixture();
    await put(root, "README.md", `# Expo\n\n${"Repository documentation for Expo plugin users. ".repeat(10)}`);
    const initialized = Bun.spawnSync(["git", "init", "-q", root], { stdout: "pipe", stderr: "pipe" });
    expect(initialized.exitCode).toBe(0);
    return root;
  }

  test("checks untracked development files omitted from the ZIP", async () => {
    const root = await repository();
    await validateSourceRepository(root);
    await put(root, "fixtures/oversized-lock.json", "x".repeat(LIMITS.textBytes + 1));
    expect(await getPackageFiles(root)).not.toContain("fixtures/oversized-lock.json");
    await expect(validatePlugin(root)).rejects.toThrow("source file exceeds");
  });

  test("rejects retired client manifests that would override portable discovery", async () => {
    for (const directory of [".codex-plugin", ".cursor-plugin", ".grok-plugin"]) {
      const root = await repository();
      await put(root, `${directory}/plugin.json`, { name: "expo", version: "1.0.0" });
      await expect(validateSourceRepository(root)).rejects.toThrow("retired client manifest");
    }
  });

  test("rejects Git submodules and export-ignore attributes", async () => {
    const root = await repository();
    const added = Bun.spawnSync(["git", "-C", root, "update-index", "--add", "--cacheinfo", `160000,${"1".repeat(40)},external`], { stdout: "pipe", stderr: "pipe" });
    expect(added.exitCode).toBe(0);
    await expect(validateSourceRepository(root)).rejects.toThrow("Git submodule");
    Bun.spawnSync(["git", "-C", root, "update-index", "--force-remove", "external"]);
    await put(root, ".gitattributes", "skills/ export-ignore\n");
    await expect(validateSourceRepository(root)).rejects.toThrow("export-ignore");
  });

  test("rejects source symlinks and dependency lockfiles beside root package.json", async () => {
    const root = await repository();
    await symlink("README.md", join(root, "README-copy.md"));
    await expect(validateSourceRepository(root)).rejects.toThrow("symlinks are not allowed in the source");
    await rm(join(root, "README-copy.md"));
    await put(root, "package.json", { private: true });
    await put(root, "bun.lock", "{}\n");
    await expect(validateSourceRepository(root)).rejects.toThrow("keep maintainer dependencies in separate tooling");
  });
});

describe("offline ZIP generation", () => {
  test("CLI writes its documented versioned default and accepts extracted roots", async () => {
    const root = await fixture();
    const script = join(import.meta.dir, "package-plugin.ts");
    const run = Bun.spawnSync(["bun", script], { cwd: root, stdout: "pipe", stderr: "pipe" });
    expect(run.exitCode).toBe(0);
    expect(run.stdout.toString()).toContain("dist/expo-plugin-2.0.0.zip");
    const checked = Bun.spawnSync(["bun", join(import.meta.dir, "check-plugin.ts"), root], { stdout: "pipe", stderr: "pipe" });
    expect(checked.exitCode).toBe(0);
    const help = Bun.spawnSync(["bun", script, "--help"], { stdout: "pipe" });
    expect(help.stdout.toString()).toContain("dist/expo-plugin-<version>.zip");
    const invalid = Bun.spawnSync(["bun", script, "--output"], { stdout: "pipe", stderr: "pipe" });
    expect(invalid.exitCode).toBe(1);
  });

  test("ships only allowlisted content, preserves bytes and produces repeatable ZIPs", async () => {
    const root = await fixture();
    await put(root, ".env", "TOKEN=local-only\n");
    await put(root, ".git/config", "local-only\n");
    await put(root, "experimental-skills/expo-experiment/SKILL.md", "not published\n");
    await put(root, "scripts/maintainer.ts", "not published\n");
    const source = await readFile(join(root, "skills/expo-test/scripts/task.js"));
    const first = await packagePlugin(root, join(root, "output/first.zip"));
    await utimes(join(root, "skills/expo-test/scripts/task.js"), new Date(), new Date());
    const second = await packagePlugin(root, join(root, "output/second.zip"));
    expect(await readFile(first.archive)).toEqual(await readFile(second.archive));
    expect(await readFile(join(root, "skills/expo-test/scripts/task.js"))).toEqual(source);
    const inspect = Bun.spawnSync(["python3", "-c", "import json,sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); print(json.dumps({'files': z.namelist(), 'script': z.read('skills/expo-test/scripts/task.js').decode()}))", first.archive]);
    expect(inspect.exitCode).toBe(0);
    const actual = JSON.parse(inspect.stdout.toString());
    expect(actual.files).toEqual(first.files);
    expect(actual.script).toBe(source.toString());
    expect(first.files).not.toContain(".env");
    expect(first.files.every((path) => !path.startsWith("experimental-skills/"))).toBe(true);
  });

  test("refuses overwrite without changing an existing output", async () => {
    const root = await fixture();
    const output = join(root, "existing.zip");
    await writeFile(output, "retain this file");
    await expect(packagePlugin(root, output)).rejects.toThrow("Refusing to overwrite");
    expect(await readFile(output, "utf8")).toBe("retain this file");
    await expect(packagePlugin(root, join(root, "skills/expo-test/output.zip"))).rejects.toThrow("outside the packaged content");
  });
});
