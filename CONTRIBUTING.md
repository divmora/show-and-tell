# Contributing to ShowAndTell

Thank you for your interest in contributing to **ShowAndTell**! We welcome bug fixes, documentation improvements, feature enhancements, and community feedback.

---

## Code of Conduct

All contributors and maintainers are expected to follow the [DIVMORA Code of Conduct](https://github.com/divmora/.github/blob/main/CODE_OF_CONDUCT.md). Please treat everyone with respect, dignity, and empathy.

---

## Prerequisites

Before setting up local development, make sure you have the following installed:
- **Node.js**: `22.x` or later (LTS recommended)
- **npm**: `10.x` or later
- **Make**: GNU Make (for running standard workflow targets)
- **Docker**: (Optional) For containerized testing and deployments

---

## Local Development Setup

1. **Clone the repository:**
   ```bash
   git clone git@github.com:divmora/show-and-tell.git
   cd show-and-tell
   ```

2. **Install all dependencies:**
   ```bash
   make dev-setup
   # or npm install
   ```

3. **Build the packages:**
   ```bash
   make build
   ```

4. **Run the test suite:**
   ```bash
   make test
   ```

5. **Start the interactive demo playground:**
   ```bash
   make demo
   # Open http://localhost:3000 in your browser
   ```

---

## Makefile Targets

| Target | Description |
| :--- | :--- |
| `make dev-setup` | Install dependencies across all monorepo packages. |
| `make build` | Compile both the SDK bundle and the companion server. |
| `make build-sdk` | Build SDK bundles (`dist/show-and-tell.{min.js,esm.js,cjs.js}`). |
| `make build-server` | Compile the demo server TypeScript into `dist/`. |
| `make test` | Run automated unit test suite with Vitest. |
| `make test-watch` | Run Vitest in watch mode for active SDK development. |
| `make lint` | Run TypeScript typechecking across SDK and server packages. |
| `make fmt` | Check code formatting standards. |
| `make clean` | Remove compiled build outputs (`dist/`) and caches. |
| `make demo` | Start companion demo server on port 3000. |
| `make start` | Build all packages and run demo server. |
| `make docker-build` | Build local Docker image `show-and-tell:latest`. |

---

## Conventional Commits

We enforce the [Conventional Commits](https://www.conventionalcommits.org/) specification on all commit messages and Pull Request titles. This powers automated changelog generation and semantic versioning via **Release Please**.

### Format:
```
<type>(<optional scope>): <description>

[optional body]

[optional footer(s)]
```

### Supported Types:
- `feat:` A new feature or capability (bumps minor version)
- `fix:` A bug fix (bumps patch version)
- `docs:` Documentation changes only
- `style:` Formatting, missing semi-colons, whitespace changes
- `refactor:` Code refactoring without changing functionality
- `perf:` Performance improvements
- `test:` Adding or refactoring tests
- `chore:` Dependency bumps, CI/build configuration, tooling
- `feat!:`, `fix!:` Breaking change (bumps major version)

### Example Commits:
```bash
feat(sdk): add custom countdown timer overlay before recording starts
fix(storage): resolve race condition in indexeddb flush on beforeunload
docs(readme): add configuration table for audio mixing options
chore(deps): bump vite to 6.4.3
```

---

## Pull Request Guidelines

1. **Branch Naming**: Use descriptive branch names like `feat/timer-overlay` or `fix/indexeddb-recovery`.
2. **Verification**: Run `make lint && make test && make build` locally before pushing changes.
3. **Semantic PR Titles**: Ensure your PR title adheres to Conventional Commits (enforced by GitHub Actions CI).
4. **Focused Scope**: Keep PRs focused on a single logical change.

---

## Licensing & IP

All contributions to **ShowAndTell** are licensed under the project's [Business Source License 1.1 (BSL 1.1)](LICENSE). By submitting a Pull Request, you certify that you have the right to license your contribution under these terms.
