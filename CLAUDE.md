# Project Instructions for AI Agents

This file provides instructions and context for AI coding agents working on this project.

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:ca08a54f -->

## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd dolt push
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**

- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds

<!-- END BEADS INTEGRATION -->

## Build & Test

There is no build step — the repo root loads directly as an unpacked
extension (`chrome://extensions` → Developer mode → Load unpacked). There is
no test suite (removed in 3.0.1); verify changes manually on x.com.

```bash
npm install          # dev deps only: eslint + prettier
npm run lint         # eslint .
npm run format:check # prettier --check .
```

## Architecture Overview

Manifest V3 Chrome extension for x.com ("xHelper"), no runtime dependencies:

- `manifest.json` — MV3 manifest; minimal permissions (`downloads`,
  `declarativeContent`, x.com + cdn.syndication.twimg.com hosts).
- `content.js` — runs in the ISOLATED world on x.com. Injects a download
  button into video tweets (throttled MutationObserver sweeps) and runs the
  ad-marker canary that backs up the CSS ad hiding.
- `content.css` — button styling plus the pure-CSS promoted-post hiding
  (X's `placementTracking` marker; first place to check when ads reappear).
- `background.js` — service worker. Resolves tweets via the syndication
  API, picks the best MP4 variant, and downloads via `chrome.downloads`.

## Conventions & Patterns

- Every release bumps the version in `manifest.json` and `package.json` and
  adds a `CHANGELOG.md` entry.
- Commit style: `type: vX.Y.Z — summary (bd-issue-id)`.
- No runtime dependencies and no new permissions without strong
  justification; the minimal permission set is a feature.
- X.com DOM selectors are fragile by nature — they live at the top of
  `content.js` behind named constants, with comments explaining each.
