# Audit notes

## Operating contract recorded before substantive review

- Target: `/home/adam/projects/xvid`; branch `main`; HEAD `8569aa44ff01de50ea656dec2120fc649bb15b14`. Initial tracked and untracked status clean (B002, B008); history is not shallow (B003). B003 did not resolve SHA correctly; B006 supplies the SHA.
- Audit date: 2026-09-08, user timezone Europe/Warsaw. Execution timestamps will be recorded independently.
- Write boundary: only this new audit output directory in the original checkout. No application, dependency, lockfile, configuration, or existing-test edits. Disposable copy for any execution that can change state. No production/application endpoints, discovered credentials, deploy, publish, commit, pull, push, stash clearing, or pruning. The current user audit contract overrides the repository session push instructions.
- Snapshot: byte-for-byte copy of all tracked files; SHA-256 manifest in `baseline-manifest.json`. Ignored local runtime state, Git configuration/hooks, and credentials are not copied. The disposable copy is outside the checkout.
- Documented context (README.md): local Chrome/Chromium Manifest V3 extension, xHelper, x.com-only video downloads and promoted-post hiding. Users: individuals using X in a supported browser. No build step and no runtime dependencies claimed. Distribution beyond local unpacked installation, supported browser versions, private-post requirements, and operational usage are unresolved. These are documentation claims awaiting code tracing.
- Review priority: extension privileges/message boundaries; URL/media lookup and download completion; DOM button ownership and page mutation handling; ad hiding/canary; scripts/CI and dependencies. Inventory is not end-to-end assurance.
- Included initially: all tracked runtime files, manifest, tooling/CI, docs, available Git history and metadata. Beads/agent files inspected for workflow and sensitive information only; icons inventoried with image metadata only. Live X/syndication/CDN traffic, real browser profiles, real downloads, remote repository operations, and actual deployed behavior excluded by safety boundary.
- Capabilities at baseline (B011): unrestricted filesystem and network technically available; user restricts usage to safe audit. Python, Node launcher, timeout, bwrap, unshare, Chromium launcher present. npm and bd absent from PATH. No user time/token limit specified; commands will have finite timeouts and no indefinite jobs. Actual executable availability and isolated-browser feasibility remain to be checked.
- Local historical memory registry unavailable (B005); no historical repository facts used.

## Evidence handling

Command IDs are stable. Exact commands, directories, environment, results, and concise redacted output are recorded in command artifacts. Source citations refer to the inspected baseline, not proposed changes. Findings use one F-number register. No live endpoint or credential validation is authorized.

## Review record

All runtime source was read: background.js (205 lines), content.js (252), content.css (56), manifest.json (35). The documented privacy/minimal-extension purpose matches the inspected no-server/no-storage design. Live product compatibility remains unverified.

### Tools and deviations

Node 24.20.0, Python 3.12.3, Git 2.43.0, Chrome for Testing 152.0.7977.64 (C004). Audit-only npm 12.0.2 bootstrapped with SHA-512 tarball verification, clean npm configs and disabled lifecycle scripts (D001-D005). Tools live outside the snapshot. bd onboard/prime were attempted only in the disposable copy and failed with exit 127 (B013/B014); tracker records were not changed.

A network namespace was unavailable (C008). Fresh-profile Chromium used blocked DNS/proxy, disabled background networking and a local fixture with restrictive CSP. Both the fixture and one blank-page startup diagnostic timed out (D010/D012). Root cause is unresolved; no native browser result exists. No further browser retries.

The fallback uses jsdom 30.0.1 with no resource loading and stubbed messaging; offsetParent is a declared visibility model based only on display:none ancestry. It cannot establish Chrome layout, native trusted input, actual extension installation/permissions, Save As, or service-worker behavior. All synthetic source lives in this audit directory; application tests remain untouched.

Audit date is 2026-09-08 Europe/Warsaw; registry retrieval timestamps are 2026-09-07 UTC, the same local date. External requests contained public documentation/package identifiers only, never repository source or credentials. No sub-agents, application endpoints, real downloads, commits, pushes or production operations were used.

### One finding register

| ID | Severity | Confidence | Established condition and evidence |
| --- | --- | --- | --- |
| F-001 | P2 | High for ordering; field frequency unknown | Late response A settles newer request B; content.js:204-228; D015 DOM-11 |
| F-002 | P2, conditional on retained post DOM | High for code/model; live reachability unknown | Button retains old post ID; content.js:24-56,79-91,194-218,238-242; D015 DOM-08 |
| F-003 | P2, conditional on cell reuse | High for code/model; live reachability unknown | One-way ad hiding hides replacement organic content; content.js:109-129; D015 DOM-09 |
| F-004 | P2, conditional on render shape | High for code/model; live frequency unknown | Descendant action-bar selection conflicts with nearest-post ownership; content.js:29-56,79-91; D015 DOM-10 |
| F-005 | P2 | High | No retained behavioral suite; lint/format pass despite reproduced defects; package.json:9-19, .github/workflows/lint.yml:18-20, CHANGELOG.md:119-126 |
| F-006 | P2 | High | CI Node 20 and resolved ESLint 9 are upstream EOL; project engines also understate lint minimum; package.json:6-19, .github/workflows/lint.yml:14-20, package-lock.json:140-148,445-484; E003-E005 |

Six distinct causes/remedies, all confirmed within their stated conditions. No credible P0/P1 concern established. Current X reachability is not inferred from synthetic models. Potential locale/schema/browser issues remain questions rather than extra findings.

### Component coverage ledger

| Component | Depth reached | Runtime evidence | Unfinished boundary |
| --- | --- | --- | --- |
| manifest.json | Entire file traced to runtime entries/permissions | None as installed extension | Real grants, activation, Chrome 105 |
| background.js | All source; both callers through lookup/ranking/naming/download/reply/badge | D009: 11 stubbed scenarios pass | Real HTTP/JSON, browser download manager, Save As, worker suspension |
| content.js | All source; observers, button ownership, clicks, results and ad lifecycle | D015: 7 model passes / 4 regression failures | Real X DOM, native browser input/visibility, accessibility |
| content.css | Entire file; ad and button rules | D015 CSS model only | Native rendering, contrast, selector performance |
| manifests/lock/tooling/CI | All configuration; resolved inventory | D005-D008 baseline passes | Exact CI Node 20 run, remote enforcement |
| docs/changelog/license | Product and setup docs read | Lint/format setup validated | Actual unpacked install and manual download smoke |
| icons | Inventoried; PNG dimensions read | None | Visual review excluded |
| beads/hooks/agent metadata | Hooks/config read; issue count/status and JSON keys only | bd unavailable; hooks not run | Issue bodies and automation correctness not reviewed |
| Git history | Local signals, test-removal provenance and heuristic secret search | None | No full old-code review, remote freshness or unreachable objects |

### Execution and metrics

- D006 lint, D007 format:check and D008 syntax checks pass on unchanged snapshot.
- D009: 11 background scenarios, 11 pass. BG-11 is characterization of partial exposure, not assurance that every source item downloads.
- D010/D012: two environmental timeouts, not application test failures. D015: 11 model scenarios, seven pass and four intended assertions fail. 22 audit scenarios total, 18 pass / four fail; not code coverage.
- C006: 31 tracked files. Runtime JS is 457 physical lines; CSS 56; manifest 35. Runtime counts exclude docs, lockfile, tracker/agent data, Git, audit artifacts, dependencies and images. Three PNGs are 16x16, 48x48 and 128x128.
- C007: four direct dev dependencies; 88 resolved entries / 86 unique names; zero runtime dependencies; all entries have integrity; none flagged hasInstallScript. Duplicate globals and eslint-visitor-keys versions are transitive, not an established defect.
- C006: 62 HEAD-reachable commits, first 2026-03-15, last 2026-08-31. Two raw author-email identities account for 61 and one commits; identities redacted. Each current runtime JS path appears in 18 path-touch log entries. Renames, merges, aliases and bots limit conclusions.
- C010: 346 unique locally reachable text blobs / 3,182,981 bytes scanned with three credential-pattern classes; 11 binary/oversize blobs excluded; zero candidates. This heuristic is not exhaustive.
- E002: npm bulk advisory database returned no matches for the 86 public package names / 88 resolved entries at retrieval. No guarantee of safety; audit-only tools and GitHub Actions not covered.
- No line/branch coverage percentage, current-X benchmark, live selector qualification, assistive-technology test or browser support matrix was measured.

### Consequential unresolved questions

- Does current X retain/reuse article, button and ad-cell nodes? Determines F-002/F-003 field frequency.
- Can a quote action bar render before its outer bar? Determines F-004 field frequency.
- Which browsers, platforms and locales must be supported? Determines compatibility, Save As, canary and accessibility work.
- Does the syndication endpoint still return the expected MP4 schema? Whole live download compatibility remains unverified.
- Should mixed MP4/non-MP4 posts report partial results? BG-11 observed silent skipping; README limitations may allow it.
- Is use beyond local unpacked installations required? Changes release/support obligations.
- Are remote checks enforced? Workflow configuration alone cannot establish this.

Targeted fixes and regression fixtures inside the existing stack are supported. No evidence makes incremental change impractical. The improvement plan itself did not authorize implementation.

## Subsequent implementation authorization and completion

The user then explicitly requested “fix all findings”. V001 first verified that the original tracked files still matched the audit baseline. All six findings were addressed in the disposable copy, then transferred after checking for concurrent user edits (I014). Version is now 3.6.1. The background runtime and permissions remain unchanged; content state/ownership, reversible ad hiding, tests, development tooling and docs changed.

I002 demonstrates eight failing pre-fix content assertions (four other content tests pass). I010 freshly installs the final lock, I011 passes all 23 retained tests, I012 lint passes and I013 format:check passes. E007 returns no advisory matches for the final dev-only dependency tree. Full findings-to-fixes mapping, source locations and limits are in REMEDIATION.md. Browser/live-provider verification remains incomplete; no further native retries or production calls were made. No commits, pushes or tracker mutations.
