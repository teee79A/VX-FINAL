<!-- AUTO-GENERATED from package.json, tsconfig.json, and project conventions -->
<!-- Last updated: 2026-04-16 | Source: update-docs skill -->

# Contributing to KITTY / VXStation

## Prerequisites

- **Node.js** ≥ 22 (required for ESM + NodeNext)
- **npm** (lock file: `package-lock.json`)
- **TypeScript** 5.x (`strict` mode, `exactOptionalPropertyTypes`)

## Setup

```bash
git clone <repo-url> && cd KITTY
npm install
npx tsc --noEmit        # verify clean build
npx vitest run           # verify tests pass (142 tests, 64 suites)
```

## Available Commands

| Command | Description |
|---------|-------------|
| `npm run build` | Compile TypeScript (`tsc`) |
| `npm run check` | Type-check without emit (`tsc --noEmit`) |
| `npm run lint` | Lint with ESLint |
| `npm test` | Run test suite (`vitest run`) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run ci:mandatory` | Full CI gate: check + lint + test |
| `npm start` | Start VXSTATION server (`tsx server/index.ts`) |

## Code Style

- **TypeScript only** — no JS, no JSON config, no YAML, no shell scripts in source
- **ESM modules** — all imports use `.js` extension
- **Dot-separated kebab-case** file naming: `command.types.ts`, `hash-chain.ts`
- **Class-based module boundaries** — engines extend `BaseEngine`, servers extend `BaseCeoServerNode`
- **No `execSync`** — always use `promisify(exec)` or `execFile`
- **No hardcoded paths** — use env vars (`KITTY_ROOT`, `VYRDX_ROOT`, `VYRDOX_CORE_BASE`)
- **Sanitize shell arguments** — regex validation before interpolation

## Testing

- Framework: **Vitest**
- Location: `tests/` at repo root
- Naming: `{module}.test.ts`
- Pattern: `describe()` + `it()` with behavioral descriptions
- Run before every commit: `npx vitest run`

## Commit Conventions

Use **conventional commits**:
- `feat:` — new features or subsystems
- `fix:` — bug fixes, path corrections
- `chore:` — maintenance
- `docs:` — documentation only

All commits must include:
```
Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

## PR Checklist

- [ ] `npx tsc --noEmit` passes
- [ ] `npx vitest run` passes (142+ tests)
- [ ] `npm run lint` passes
- [ ] No hardcoded paths
- [ ] No `execSync` or `require()`
- [ ] Evidence chain integrity preserved
- [ ] VYRDON Law compliance verified
