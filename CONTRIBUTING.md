# Contributing to @hidden-leaf/atlassian-skill

## Development Setup

```bash
git clone <repo-url>
cd atlassian-skill
npm install
npm run build
```

Requires Node.js >= 18.

## Commands

| Command | Description |
|---------|-------------|
| `npm run build` | Compile TypeScript |
| `npm test` | Run test suite |
| `npm run lint` | Run ESLint |
| `npm run watch` | Compile in watch mode |
| `npm run clean` | Remove build artifacts |

## Code Style

- TypeScript strict mode. No `any` unless absolutely necessary.
- No emojis in code or comments.
- Keep modules focused. One concern per file.
- Use JSDoc comments for public APIs.
- Follow the existing patterns in `src/` -- fluent builders, factory functions (`create*FromEnv`), typed errors.

## PR Process

1. Fork the repo and create a branch from `main`.
2. Make your changes.
3. Run `npm run lint` and `npm test`. Fix any failures.
4. Run `npm run build` to verify compilation.
5. Submit a pull request against `main`.

Keep PRs small and focused. One feature or fix per PR.

## Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add sprint velocity chart
fix: handle null assignee in triage
docs: update API examples
refactor: extract rate limit logic
test: add JQL builder edge cases
chore: update dependencies
```

First line under 72 characters. Add a body if the "why" isn't obvious.

## Reporting Issues

- Search existing issues before opening a new one.
- Include: what you expected, what happened, steps to reproduce.
- For bugs, include Node.js version, OS, and relevant error output.
- For feature requests, describe the use case, not just the solution.

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). Be respectful and constructive.
