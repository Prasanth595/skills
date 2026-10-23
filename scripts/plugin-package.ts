import { constants } from "node:fs";
import { copyFile, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join, posix, relative, resolve } from "node:path";

// Keep this allowlist shared by validation and packaging. Repository tooling,
// experiments, marketplace catalogs and local configuration never enter a ZIP.
export const PACKAGE_PATHS = [
  "plugin.json", "mcp.json", ".mcp.json",
  ".claude-plugin/plugin.json",
  "assets/expo.png", "skills", "README.md", "LICENSE",
] as const;

export const MANIFEST_PATHS = PACKAGE_PATHS.filter((path) => path.endsWith("plugin.json"));
const RETIRED_MANIFEST_PATHS = [".codex-plugin/plugin.json", ".cursor-plugin/plugin.json", ".grok-plugin/plugin.json"];
export const LIMITS = {
  files: 512,
  textBytes: 256 * 1024,
  archiveBytes: 100 * 1024 * 1024,
  unpackedBytes: 512 * 1024 * 1024,
  iconBytes: 5 * 1024 * 1024,
} as const;
const ENDPOINT = "https://mcp.expo.dev/mcp";
const TEXT_EXTENSIONS = new Set([".md", ".yaml", ".yml", ".json", ".js", ".mjs", ".cjs", ".ts", ".py", ".sh", ".txt"]);
const IMAGE_FONT_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico", ".avif", ".woff", ".woff2", ".ttf", ".otf", ".eot"]);
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const decoder = new TextDecoder("utf-8", { fatal: true });

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function object(value: unknown, label: string): Record<string, any> {
  assert(value !== null && typeof value === "object" && !Array.isArray(value), `${label}: expected an object`);
  return value as Record<string, any>;
}

function onlyKeys(value: Record<string, unknown>, keys: string[], label: string) {
  for (const key of Object.keys(value)) assert(keys.includes(key), `${label}: unsupported field ${key}`);
}

function text(value: unknown, label: string, max = Infinity): asserts value is string {
  assert(typeof value === "string" && value.trim().length > 0 && value.length <= max, `${label}: expected nonempty text${max < Infinity ? ` of at most ${max} characters` : ""}`);
}

function https(value: unknown, label: string) {
  text(value, label);
  const url = new URL(value);
  assert(url.protocol === "https:" && !url.username && !url.password, `${label}: expected an HTTPS URL without credentials`);
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return JSON.stringify(value.map((item) => JSON.parse(canonical(item))));
  if (value !== null && typeof value === "object") {
    return JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, JSON.parse(canonical(item))])));
  }
  return JSON.stringify(value);
}

function allowedFile(path: string) {
  assert(!path.includes("\\") && !/[\x00-\x1f\x7f]/.test(path), `${path}: unsafe filename`);
  if (!path.startsWith("skills/")) return;
  const parts = path.split("/");
  assert(parts.every((part) => !part.startsWith(".") && !["node_modules", "__pycache__"].includes(part)), `${path}: hidden files and dependency caches are not package content`);
  assert(!/^(?:credentials?|secrets?|tokens?)\./i.test(parts.at(-1)!), `${path}: credential files are not package content`);
  assert(parts.at(-1) === "LICENSE" || TEXT_EXTENSIONS.has(extname(path)), `${path}: unsupported skill file type; update the explicit allowlist before shipping it`);
}

async function walk(root: string, path: string, files: string[]) {
  const stat = await lstat(join(root, path));
  assert(!stat.isSymbolicLink(), `${path}: symlinks are not allowed in the package`);
  if (stat.isDirectory()) {
    for (const name of (await readdir(join(root, path))).sort()) await walk(root, `${path}/${name}`, files);
  } else {
    assert(stat.isFile(), `${path}: only regular files are allowed`);
    allowedFile(path);
    files.push(path);
  }
}

export async function getPackageFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  for (const path of PACKAGE_PATHS) {
    // Check ancestors as well as leaves; a manifest directory must not be a link.
    let parent = dirname(path);
    while (parent !== ".") {
      assert(!(await lstat(join(root, parent))).isSymbolicLink(), `${parent}: symlinks are not allowed in the package`);
      parent = dirname(parent);
    }
    await walk(root, path, files);
  }
  assert(files.length <= LIMITS.files, `Package has ${files.length} files; maximum is ${LIMITS.files}`);
  assert(new Set(files.map((path) => path.toLowerCase())).size === files.length, "Package contains filenames that collide on case-insensitive filesystems");
  return files.sort();
}

function prose(markdown: string) {
  let fence: string | undefined;
  return markdown.split(/\r?\n/).map((line) => {
    const marker = line.match(/^\s*(`{3,}|~{3,})/);
    if (marker) {
      if (!fence) fence = marker[1];
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = undefined;
      return "";
    }
    return fence ? "" : line;
  }).join("\n");
}

function validateLinks(path: string, markdown: string, files: Set<string>) {
  const body = prose(markdown);
  const links = [
    ...body.matchAll(/\]\(\s*(?:<([^>]+)>|([^\s)]+))/g),
    ...body.matchAll(/^\s*\[[^\]]+\]:\s*(?:<([^>]+)>|([^\s]+))/gm),
  ].map((match) => ({ link: match[1] ?? match[2], base: posix.dirname(path) }));
  // Skills also cite their own supporting files as code or plain prose.
  if (path.startsWith("skills/")) {
    links.push(...[...body.matchAll(/(?:^|[\s`(])((?:\.\.\/|\.\/)*(?:references|scripts)\/[A-Za-z0-9_./-]+\.(?:md|js|mjs|cjs|ts|py|sh|json|yaml|yml))(?:[\s`),;:.]|$)/gm)].map((match) => ({
      link: match[1],
      base: match[1].startsWith(".") ? posix.dirname(path) : path.split("/").slice(0, 2).join("/"),
    })));
  }
  for (const { link, base } of links) {
    if (/^(?:[a-z][a-z0-9+.-]*:|#|\/\/)/i.test(link)) continue;
    const target = decodeURIComponent(link.split(/[?#]/)[0]);
    if (!target) continue;
    assert(!target.startsWith("/") && !target.includes("\\"), `${path}: local link must be relative: ${link}`);
    const destination = posix.normalize(posix.join(base, target)).replace(/\/$/, "");
    assert(!destination.startsWith("../"), `${path}: link escapes the package: ${link}`);
    assert(files.has(destination) || [...files].some((file) => file.startsWith(`${destination}/`)), `${path}: link is not included in the package: ${link}`);
  }
}

export type Validation = { version: string; skills: string[]; files: string[]; bytes: number };

// Official directories may scan the complete Git root, including files omitted
// from the ZIP. Run these checks only for that exact root, never an ancestor of
// an extracted package. Untracked, non-ignored files count until committed.
export async function validateSourceRepository(root: string): Promise<void> {
  root = await realpath(root);
  try { await lstat(join(root, ".git")); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  const git = (...args: string[]) => Bun.spawnSync(["git", "-C", root, ...args], { stdout: "pipe", stderr: "pipe" });
  const location = git("rev-parse", "--show-toplevel");
  if (location.exitCode !== 0 || await realpath(location.stdout.toString().trim()) !== root) return;
  const index = git("ls-files", "--stage", "-z");
  assert(index.exitCode === 0, "Unable to inspect the repository index");
  assert(!index.stdout.toString().split("\0").some((entry) => entry.startsWith("160000 ")), "Source repository contains a Git submodule; official submissions must be self-contained");
  const tracked = git("ls-files", "--cached", "--others", "--exclude-standard", "-z");
  assert(tracked.exitCode === 0, "Unable to enumerate source repository files");
  const files: string[] = [];
  let bytes = 0;
  for (const path of new Set(tracked.stdout.toString().split("\0").filter(Boolean))) {
    let info;
    try { info = await lstat(join(root, path)); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue; // unstaged deletion
      throw error;
    }
    assert(!info.isSymbolicLink(), `${path}: symlinks are not allowed in the source repository`);
    assert(info.isFile(), `${path}: source content must be a regular file`);
    const data = await readFile(join(root, path));
    files.push(path);
    bytes += data.length;
    assert(IMAGE_FONT_EXTENSIONS.has(extname(path).toLowerCase()) || data.length <= LIMITS.textBytes, `${path}: source file exceeds the ${LIMITS.textBytes}-byte non-image/font limit`);
    assert(!data.subarray(0, 128).toString().startsWith("version https://git-lfs.github.com/spec/v1"), `${path}: Git LFS pointers are not self-contained source content`);
    if (posix.basename(path) === ".gitattributes") {
      assert(!data.toString().split(/\r?\n/).some((line) => !line.trimStart().startsWith("#") && /\bexport-(?:ignore|subst)\b/.test(line)), `${path}: export-ignore/export-subst can remove or rewrite plugin content in distribution archives`);
    }
  }
  assert(files.length <= LIMITS.files, `Source repository has ${files.length} files; maximum is ${LIMITS.files}`);
  for (const path of RETIRED_MANIFEST_PATHS) {
    assert(!files.includes(path), `${path}: retired client manifest; use plugin.json and .claude-plugin/plugin.json`);
  }
  assert(bytes <= LIMITS.unpackedBytes, "Source repository exceeds the unpacked size limit");
  const readme = await readFile(join(root, "README.md"), "utf8");
  assert(readme.trim().split(/\s+/).length >= 40, "Source README.md must contain at least 40 words");
  if (files.includes("package.json")) {
    const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
    const dependencies = [manifest.dependencies, manifest.devDependencies, manifest.optionalDependencies].some((group) => group && Object.keys(group).length > 0);
    const lockfile = ["bun.lock", "bun.lockb", "package-lock.json", "pnpm-lock.yaml", "yarn.lock", "npm-shrinkwrap.json"].find((path) => files.includes(path));
    assert(!lockfile, `Root package.json beside ${lockfile} triggers Claude review; keep maintainer dependencies in separate tooling`);
    assert(!dependencies, "Keep maintainer dependencies in separate tooling; the root plugin package requires no dependency installation");
  }
}

// These are offline checks for Expo's supported package contract, not a claim
// that any directory has accepted the package. See docs/publishing.md for review.
export async function validatePlugin(root: string): Promise<Validation> {
  await validateSourceRepository(root);
  const files = await getPackageFiles(root);
  const members = new Set(files);
  const contents = new Map<string, string>();
  let bytes = 0;
  for (const path of files) {
    const data = await readFile(join(root, path));
    bytes += data.length;
    if (path === "assets/expo.png") {
      assert(data.length >= 33 && data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && data.readUInt32BE(8) === 13 && data.toString("ascii", 12, 16) === "IHDR", `${path}: expected a PNG image with an IHDR header`);
      assert(data.length <= LIMITS.iconBytes, `${path}: exceeds the 5 MiB icon limit`);
      const width = data.readUInt32BE(16);
      const height = data.readUInt32BE(20);
      assert(width >= 48 && width === height, `${path}: icon must be square and at least 48 pixels wide`);
      continue;
    }
    assert(data.length <= LIMITS.textBytes, `${path}: exceeds the ${LIMITS.textBytes}-byte text-file limit`);
    const decoded = decoder.decode(data);
    assert(!decoded.includes("\0"), `${path}: binary content is not allowed in text files`);
    contents.set(path, decoded);
    if (path.endsWith(".md")) validateLinks(path, decoded, members);
  }
  assert(bytes <= LIMITS.unpackedBytes, "Package exceeds the unpacked size limit");
  const json = (path: string) => object(JSON.parse(contents.get(path)!), path);
  const portable = json("plugin.json");
  const common = ["name", "version", "description", "author", "homepage", "repository", "license", "keywords"];
  for (const path of MANIFEST_PATHS) {
    const manifest = json(path);
    const extra = path === "plugin.json" ? ["$schema", "extensions"] : [];
    onlyKeys(manifest, [...common, ...extra], path);
    assert(manifest.name === "expo", `${path}: plugin name must be expo`);
    assert(typeof manifest.version === "string" && SEMVER.test(manifest.version), `${path}: version must be valid semver`);
    for (const key of ["version", "description", "author", "homepage", "repository", "license"]) {
      assert(canonical(manifest[key]) === canonical(portable[key]), `${path}: ${key} differs from plugin.json`);
    }
    text(manifest.description, `${path}: description`, 1024);
    const author = object(manifest.author, `${path}: author`);
    onlyKeys(author, ["name", "email", "url"], `${path}: author`);
    text(author.name, `${path}: author.name`);
    assert(typeof author.email === "string" && /@expo\.(dev|io)$/.test(author.email), `${path}: expected an Expo author email`);
    https(author.url, `${path}: author.url`);
    https(manifest.homepage, `${path}: homepage`);
    assert(manifest.repository === "https://github.com/expo/skills", `${path}: repository must point at the root Expo repository`);
    assert(manifest.license === "MIT", `${path}: license must be MIT`);
    if (manifest.keywords !== undefined) {
      assert(Array.isArray(manifest.keywords) && manifest.keywords.every((item: unknown) => typeof item === "string" && item.length > 0), `${path}: keywords must be nonempty strings`);
    }
  }
  assert(portable.$schema === "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json", "plugin.json: expected the Agent Plugins 1.0.0 schema");
  const extensions = object(portable.extensions, "plugin.json: extensions");
  onlyKeys(extensions, ["com.openai"], "plugin.json: extensions");
  const openai = object(extensions["com.openai"], "plugin.json: extensions.com.openai");
  onlyKeys(openai, ["interface"], "plugin.json: extensions.com.openai");
  const ui = object(openai.interface, "plugin.json: extensions.com.openai.interface");
  onlyKeys(ui, ["displayName", "shortDescription", "longDescription", "developerName", "category", "capabilities", "websiteURL", "supportURL", "privacyPolicyURL", "termsOfServiceURL", "defaultPrompt", "composerIcon", "logo", "screenshots", "brandColor"], "OpenAI interface");
  text(ui.displayName, "OpenAI interface.displayName", 30);
  text(ui.shortDescription, "OpenAI interface.shortDescription", 30);
  text(ui.longDescription, "OpenAI interface.longDescription", 4000);
  text(ui.developerName, "OpenAI interface.developerName", 80);
  assert(ui.category === "Developer Tools", "OpenAI interface.category must be Developer Tools");
  for (const key of ["websiteURL", "supportURL", "privacyPolicyURL", "termsOfServiceURL"]) https(ui[key], `OpenAI interface.${key}`);
  assert(Array.isArray(ui.defaultPrompt) && ui.defaultPrompt.length >= 1 && ui.defaultPrompt.length <= 3, "OpenAI interface.defaultPrompt requires one to three starter prompts");
  for (const prompt of ui.defaultPrompt) text(prompt, "OpenAI starter prompt", 128);
  assert(new Set(ui.defaultPrompt).size === ui.defaultPrompt.length, "OpenAI starter prompts must be unique");
  assert(Array.isArray(ui.capabilities) && ui.capabilities.every((capability: unknown) => ["Read", "Write", "MCP", "Interactive"].includes(capability as string)), "OpenAI interface.capabilities contains an unsupported capability");
  for (const key of ["composerIcon", "logo"]) assert(ui[key] === "./assets/expo.png", `OpenAI interface.${key}: unexpected icon path`);
  assert(/^#[0-9a-fA-F]{6}$/.test(ui.brandColor), "OpenAI interface.brandColor must be a hex color");
  assert(Array.isArray(ui.screenshots) && ui.screenshots.length === 0, "Add screenshot files to the package allowlist before using them");
  for (const [path, type] of [["mcp.json", "streamable-http"], [".mcp.json", "http"]]) {
    const config = json(path);
    onlyKeys(config, path === "mcp.json" ? ["$schema", "mcpServers"] : ["mcpServers"], path);
    const servers = object(config.mcpServers, `${path}: mcpServers`);
    onlyKeys(servers, ["expo"], `${path}: mcpServers`);
    const server = object(servers.expo, `${path}: mcpServers.expo`);
    onlyKeys(server, ["type", "url"], `${path}: mcpServers.expo`);
    assert(server.type === type && server.url === ENDPOINT, `${path}: expected ${type} at ${ENDPOINT}`);
    if (path === "mcp.json") assert(config.$schema === "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json", `${path}: expected the Agent Plugins 1.0.0 MCP schema`);
  }
  const skills = [...new Set(files.filter((path) => path.startsWith("skills/") && path !== "skills/README.md").map((path) => path.split("/")[1]))].sort();
  assert(skills.length > 0, "Package must contain at least one skill");
  for (const name of skills) {
    assert(/^(expo|eas)-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) && name.length <= 64, `Invalid skill directory: ${name}`);
    const path = `skills/${name}/SKILL.md`;
    assert(members.has(path), `${name}: missing SKILL.md`);
    const match = contents.get(path)!.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    assert(match, `${path}: missing YAML frontmatter`);
    const metadata = object(Bun.YAML.parse(match[1]), `${path}: frontmatter`);
    assert(metadata.name === name, `${path}: frontmatter name must match its directory`);
    text(metadata.description, `${path}: description`, 1024);
    assert(match[2].split(/\r?\n/).length <= 500, `${path}: body exceeds 500 lines`);
    const trigger = `skills/${name}/agents/openai.yaml`;
    assert(members.has(trigger), `${name}: missing Codex trigger metadata`);
    const triggers = object(Bun.YAML.parse(contents.get(trigger)!), trigger);
    const skillInterface = object(triggers.interface, `${trigger}: interface`);
    for (const key of ["display_name", "short_description", "default_prompt"]) text(skillInterface[key], `${trigger}: ${key}`);
  }
  return { version: portable.version, skills, files, bytes };
}

// Python's standard library writes deterministic ZIP metadata, verifies every
// member before extraction, and refuses symlinks and unsafe archive paths.
const ZIP_SCRIPT = String.raw`
import json, pathlib, stat, sys, zipfile
root, archive, extracted, inventory = map(pathlib.Path, sys.argv[1:])
files = json.loads(inventory.read_text())
with zipfile.ZipFile(archive, 'x', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for name in files:
        path = root / name
        if path.is_symlink() or not path.is_file(): raise ValueError('Not a regular file: ' + name)
        info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
        info.create_system = 3
        info.external_attr = (stat.S_IFREG | (0o755 if path.stat().st_mode & 0o111 else 0o644)) << 16
        info.compress_type = zipfile.ZIP_DEFLATED
        z.writestr(info, path.read_bytes(), compresslevel=9)
if archive.stat().st_size > 100 * 1024 * 1024: raise ValueError('ZIP exceeds 100 MiB')
with zipfile.ZipFile(archive) as z:
    infos = z.infolist()
    if [i.filename for i in infos] != files: raise ValueError('Archive membership differs from allowlist')
    if len(infos) > 512 or sum(i.file_size for i in infos) > 512 * 1024 * 1024: raise ValueError('Archive limits exceeded')
    for info in infos:
        name = pathlib.PurePosixPath(info.filename)
        if name.is_absolute() or '..' in name.parts or chr(92) in info.filename or not stat.S_ISREG(info.external_attr >> 16):
            raise ValueError('Unsafe archive entry: ' + info.filename)
        data = z.read(info)
        if data != (root / info.filename).read_bytes(): raise ValueError('Archive changed source bytes: ' + info.filename)
        path = extracted / info.filename
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open('xb') as f: f.write(data)
        path.chmod((info.external_attr >> 16) & 0o777)
`;

export async function packagePlugin(root: string, output: string): Promise<Validation & { archive: string; archiveBytes: number }> {
  root = await realpath(root);
  output = resolve(output);
  assert(extname(output) === ".zip", "Output must have a .zip extension");
  try {
    await lstat(output);
    throw new Error(`Refusing to overwrite ${output}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  // Resolve existing parent symlinks, including macOS /var -> /private/var,
  // before checking that the destination cannot become plugin content.
  const suffix = [basename(output)];
  let parent = dirname(output);
  while (true) {
    try {
      output = join(await realpath(parent), ...suffix);
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      suffix.unshift(basename(parent));
      parent = dirname(parent);
    }
  }
  const outputRelative = relative(root, output).split("\\").join("/");
  assert(!PACKAGE_PATHS.some((path) => outputRelative === path || outputRelative.startsWith(`${path}/`)), "Output must be outside the packaged content");
  const validation = await validatePlugin(root);
  const temporary = await mkdtemp(join(tmpdir(), "expo-plugin-"));
  try {
    const archive = join(temporary, "expo.zip");
    const extracted = join(temporary, "extracted");
    const inventory = join(temporary, "files.json");
    await writeFile(inventory, JSON.stringify(validation.files));
    const result = Bun.spawnSync(["python3", "-c", ZIP_SCRIPT, root, archive, extracted, inventory], { stdout: "pipe", stderr: "pipe" });
    assert(result.exitCode === 0, `ZIP creation or verification failed: ${result.stderr.toString().trim()}`);
    const packaged = await validatePlugin(extracted);
    assert(canonical(packaged) === canonical(validation), "Extracted package differs from source validation");
    const archiveBytes = (await lstat(archive)).size;
    await mkdir(dirname(output), { recursive: true });
    await copyFile(archive, output, constants.COPYFILE_EXCL);
    return { ...validation, archive: output, archiveBytes };
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}
