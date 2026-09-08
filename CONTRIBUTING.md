# Contributing

Thank you for considering contributing to xHelper!

## How to contribute

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Use Node.js 24 LTS (24.15+) and `npm ci --ignore-scripts`, then run
   `npm test`, `npm run lint`, and `npm run format:check`
5. Verify manually in a disposable browser profile: reload both the extension
   and its tab, then check single/multi-video posts, nested quotes, Save As and
   cancellation, retry feedback, post reuse, and ad-to-organic cell replacement.
   Synthetic tests do not establish native browser or current-X compatibility.
6. Submit a Pull Request

## Guidelines

- Keep permissions minimal
- Keep the code minimal — this project deliberately has no popup, no
  settings, and no build step
- Be defensive against X.com UI changes

For AI-assisted development, refer to `AGENTS.md` and `CLAUDE.md`.
