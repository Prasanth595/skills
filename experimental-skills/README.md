# Experimental Expo skills

These skills target experimental or pre-release Expo APIs. They can be rewritten, renamed, or removed as those APIs evolve. They are kept outside the stable `skills/` directory and are not shipped in the Expo plugin or its upload ZIP.

Install an experimental skill explicitly:

```text
npx skills@latest add https://github.com/expo/skills/tree/main/experimental-skills/expo-migrate-module
```

| Skill | Use it for |
| --- | --- |
| `expo-migrate-module` | Migrate a Swift Expo module from the Modules API 1.0 definition DSL to the 2.0 macro API. |

When an API stabilizes, move its skill to `skills/`, add it to the stable catalogs and overview router, and bump the plugin version. The former `expo-experiments` plugin and repository marketplace are no longer maintained.

MIT licensed; see [LICENSE](../LICENSE).
