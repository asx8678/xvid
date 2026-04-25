# Security Advisories

## GHSA-67mh-4wv8-2f99 — esbuild dev server request smuggling (Moderate)

**Affected versions**: esbuild ≤ 0.24.2, pulled in transitively via `vitest → vite-node → vite → esbuild`.

### Risk assessment

- **Dev-only dependency** — esbuild is never included in the production extension bundle.
- **Exposure vector**: the vulnerability requires running `vitest --watch` (or `vite dev`) with `--host 0.0.0.0` on an untrusted network. Our CI uses `vitest run` (one-shot, no dev server).
- **No user-facing impact** — the extension's runtime code (`background.js`, `content.js`, `popup.js`) is unaffected.

### Decision

**Risk accepted.** Upgrading to vitest 4.x (which bundles esbuild ≥ 0.25) is a breaking change requiring API migration. We will revisit at the next major Vitest upgrade cycle.

### Mitigation

- CI and local test commands use `vitest run` (no persistent dev server).
- Do NOT run `vitest --watch --host 0.0.0.0` on untrusted networks.
- Monitor vitest release notes for a 1.x backport if one becomes available.
