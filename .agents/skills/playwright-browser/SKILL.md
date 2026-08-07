---
name: playwright-browser
description: Run and debug Playwright tests, traces, snapshots, reports, and CI suites.
disable-model-invocation: true
---

# Playwright Test CLI

Use the project's installed Playwright Test runner. Prefer its package manager and existing scripts/config; do not install or upgrade Playwright unless asked.

## Workflow

1. Inspect `package.json`, the lockfile, and `playwright.config.*` before running tests.
2. Start with the narrowest relevant test file, title, or project.
3. Diagnose failures from terminal output and artifacts in `test-results/`.
4. Re-run only failed or affected tests before expanding scope.
5. Report the exact command, outcome, and artifact paths.

## Run Tests

```bash
npx playwright test                              # all tests
npx playwright test tests/example.spec.ts        # matching file path
npx playwright test -g "test title"              # matching title regex
npx playwright test --project=chromium            # selected project
npx playwright test tests/example.spec.ts:42      # test near a line
npx playwright test --last-failed                 # previous failures
npx playwright test --only-changed                # uncommitted Git changes
npx playwright test --list                        # collect without running
```

Non-option arguments are regular expressions matched against full test-file paths. Quote or escape shell metacharacters such as `*` and `$`.

Use `-c <file>` or `--config <file>` for another config file or test directory.

## Debug and Inspect

```bash
npx playwright test --headed
npx playwright test --debug
npx playwright test --ui
npx playwright test --trace on
npx playwright show-report
npx playwright show-report playwright-report/ --port 8080
```

`--debug` enables Playwright Inspector and effectively runs headed with one worker, no timeout, and one maximum failure.

## Reliability and Scope

```bash
npx playwright test --workers=1
npx playwright test --retries=2
npx playwright test --repeat-each=10
npx playwright test --max-failures=1
npx playwright test --timeout=60000
npx playwright test --project=chromium --project=firefox
npx playwright test --grep-invert "@slow"
```

Useful CI safeguards:

```bash
npx playwright test --forbid-only --fail-on-flaky-tests
```

Use `--no-deps` only when intentionally skipping project dependencies. Use `--pass-with-no-tests` only when an empty selection is expected.

## Parallelism and Reports

```bash
npx playwright test --fully-parallel
npx playwright test --shard=1/4 --reporter=blob
npx playwright merge-reports ./blob-report --reporter=html
npx playwright test --reporter=line
```

Set workers with `-j <workers>` or `--workers=<workers>`; percentages such as `50%` are supported.

## Snapshots and Cache

Snapshot updates modify repository files. Only update them when requested or when the intended output change has been verified.

```bash
npx playwright test --update-snapshots=changed
npx playwright test --ignore-snapshots
npx playwright clear-cache
```

Snapshot update modes are `all`, `changed`, `missing`, and `none`. Source update methods are `patch`, `3way`, and `overwrite` via `--update-source-method`.

## Help and Reference

```bash
npx playwright test --help
npx playwright show-report --help
npx playwright merge-reports --help
```

Official reference: [test-cli.md](test-cli.md)
