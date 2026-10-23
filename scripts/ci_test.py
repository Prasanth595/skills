"""Offline regression tests for plugin relocation and private evaluation setup."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

SCRIPTS = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("expo_ci", SCRIPTS / "ci.py")
ci = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ci)


def write(root, name, contents):
    path = root / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(contents)
    return path


def run(command, root, check=True):
    env = dict(os.environ)
    env.pop("EVAL_HARNESS_ACCESS_TOKEN", None)
    env.update(GIT_CONFIG_GLOBAL=os.devnull, GIT_CONFIG_NOSYSTEM="1")
    return subprocess.run(command, cwd=root, env=env, text=True, capture_output=True, check=check)


def git(root, *args):
    return run(["git", *args], root).stdout.strip()


def initialize(root):
    root.mkdir(parents=True, exist_ok=True)
    git(root, "init", "-q")
    git(root, "config", "user.name", "Fixture")
    git(root, "config", "user.email", "fixture@example.test")


def commit(root, message):
    git(root, "add", ".")
    git(root, "commit", "-qm", message)
    return git(root, "rev-parse", "HEAD")


def plugin(root):
    write(root, "skills/expo-example/SKILL.md", "example skill\n")
    write(root, "skills/expo-example/references/example.md", "example reference\n")
    write(root, ".claude-plugin/plugin.json", '{"name":"expo","version":"2.0.0"}\n')
    write(root, "plugin.json", '{"name":"expo","version":"2.0.0"}\n')
    write(root, ".mcp.json", '{"mcpServers":{"expo":{"url":"https://mcp.expo.dev/mcp"}}}\n')
    write(root, "README.md", "Expo plugin\n")
    write(root, "LICENSE", "MIT\n")


class FingerprintTests(unittest.TestCase):
    def test_maintainer_outputs_do_not_change_plugin_fingerprint(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            plugin(root)
            original = ci.hash_plugin(root)
            for name in ["eval-harness/generated.txt", "node_modules/cache", ".context/report.json",
                         "tests/fixture.txt", "dist/plugin.zip", ".git/index", "experimental-skills/example/SKILL.md"]:
                write(root, name, "maintainer-only data")
            self.assertEqual(original, ci.hash_plugin(root))

    def test_skill_reference_and_mcp_changes_invalidate_cache(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            plugin(root)
            original = ci.hash_plugin(root)
            write(root, "skills/expo-example/references/example.md", "changed reference")
            reference_changed = ci.hash_plugin(root)
            self.assertNotEqual(original, reference_changed)
            write(root, ".mcp.json", "changed endpoint")
            mcp_changed = ci.hash_plugin(root)
            self.assertNotEqual(reference_changed, mcp_changed)
            write(root, "plugin.json", '{"name":"expo","version":"2.0.1"}')
            self.assertNotEqual(mcp_changed, ci.hash_plugin(root))

    def test_missing_skills_is_an_error(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(ValueError):
                ci.hash_plugin(Path(directory))

    def test_archive_normalizes_old_and_new_layouts_without_repo_outputs(self):
        for legacy in [True, False]:
            with self.subTest(legacy=legacy), tempfile.TemporaryDirectory() as directory:
                base = Path(directory)
                root = base / "repository"
                initialize(root)
                plugin_root = root / "plugins/expo" if legacy else root
                plugin(plugin_root)
                write(root, "tests/fixture.txt", "do not package")
                write(root, "experimental-skills/example/SKILL.md", "do not package")
                commit(root, "package fixture")
                write(root, ".context/generated.txt", "untracked output")
                extracted = base / "extracted plugin"
                run(["bash", str(SCRIPTS / "ci.sh"), "extract_plugin", "HEAD", str(extracted)], root)
                self.assertTrue((extracted / "skills/expo-example/SKILL.md").is_file())
                self.assertFalse((extracted / "tests").exists())
                self.assertFalse((extracted / "plugins").exists())
                self.assertEqual(ci.hash_plugin(plugin_root), ci.hash_plugin(extracted))
                # Existing destinations must not be silently merged with archives.
                result = run(["bash", str(SCRIPTS / "ci.sh"), "extract_plugin", "HEAD", str(extracted)], root, False)
                self.assertNotEqual(result.returncode, 0)


class HarnessSetupTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.source = self.base / "source"
        initialize(self.source)
        write(self.source, "revision.txt", "pinned version")
        self.pin = commit(self.source, "pinned version")
        write(self.source, "revision.txt", "newer version")
        self.newer = commit(self.source, "newer version")
        self.workspace = self.base / "workspace"
        self.workspace.mkdir()
        self.write_pin(self.pin)

    def write_pin(self, revision):
        write(self.workspace, "scripts/eval-harness.json", json.dumps({
            "repository": str(self.source), "revision": revision,
        }))

    def setup(self):
        return run(["bash", str(SCRIPTS / "setup-eval-harness.sh")], self.workspace, False)

    def test_fetches_exact_pin_and_reuses_clean_checkout(self):
        # A removed gitlink can leave this empty directory in a worktree.
        (self.workspace / "eval-harness").mkdir()
        result = self.setup()
        self.assertEqual(result.returncode, 0, result.stderr)
        checkout = self.workspace / "eval-harness"
        self.assertEqual(git(checkout, "rev-parse", "HEAD"), self.pin)
        result = self.setup()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(git(checkout, "rev-parse", "HEAD"), self.pin)
        self.assertEqual(git(checkout, "remote", "get-url", "origin"), str(self.source))

    def test_same_pin_refuses_dirty_checkout_without_discarding_edits(self):
        self.assertEqual(self.setup().returncode, 0)
        checkout = self.workspace / "eval-harness"
        write(checkout, "revision.txt", "local evaluator changes")
        result = self.setup()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("local changes", result.stderr)
        self.assertEqual(git(checkout, "rev-parse", "HEAD"), self.pin)
        self.assertEqual((checkout / "revision.txt").read_text(), "local evaluator changes")

    def test_pin_update_refuses_dirty_checkout(self):
        self.assertEqual(self.setup().returncode, 0)
        write(self.workspace / "eval-harness", "revision.txt", "local edit")
        self.write_pin(self.newer)
        result = self.setup()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("local changes", result.stderr)
        self.assertEqual(git(self.workspace / "eval-harness", "rev-parse", "HEAD"), self.pin)

    def test_clean_checkout_can_advance_to_another_reviewed_pin(self):
        self.assertEqual(self.setup().returncode, 0)
        self.write_pin(self.newer)
        result = self.setup()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(git(self.workspace / "eval-harness", "rev-parse", "HEAD"), self.newer)

    def test_rejects_invalid_pin_without_creating_checkout(self):
        self.write_pin("main")
        result = self.setup()
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse((self.workspace / "eval-harness").exists())


if __name__ == "__main__":
    unittest.main()
