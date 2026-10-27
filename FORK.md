# Orca Fork

Personal fork of [stablyai/orca](https://github.com/stablyai/orca). Upstream lands ~1,600 commits a week (about half fixes), so the fork stays thin and syncs often.

## Branches

- `upstream/main`: the base for all fork work. `origin/main` is stale; never branch from it.
- `mike/fork-main-integration`: upstream plus every carried change. Fork builds come from here.
- `mike/<feature>`: one branch per fork change, cut from `upstream/main`, merged into the integration branch.

## Syncing upstream

Daily, or before any fork build:

1. Clean worktree on `mike/fork-main-integration`; `git fetch upstream origin`.
2. `git merge upstream/main` (merge, not rebase: carried changes keep their SHAs, and feature branches stay mergeable).
3. On conflict, check the change's entry below for its seams and notes. `*.generated.ts` files are regenerated, never hand-merged.
4. `pnpm install`, typecheck, lint, `pnpm check:changed --base=upstream/main`. Some PTY and cross-version tests fail on plain upstream too; rerun a failure on `upstream/main` before blaming the fork.
5. Remove any entry below that upstream now covers, and record what was awkward under its conflict notes.

## Keeping changes cheap to carry

- Fork CLI command groups go in `src/cli/fork-handler-groups.ts`; `handler-group-manifest.ts` carries one import and one `...FORK_HANDLER_GROUPS` line (it sits at its 300-line lint limit).
- New code goes in new files; edits to upstream files stay at one import, one call, or one registry line.
- Prefer an Orca plugin (`src/shared/plugins/`) when the plugin API covers the feature: plugin code never conflicts.
- Changes stay fork-only: no upstream PRs or issues. If upstream ships an equivalent, drop the fork copy and its entry.

## Carried changes

Each entry: what it does, upstream status, the upstream files it hooks into, and conflict notes.

### Side-by-side fork builds (`ORCA_PACKAGED_APP_IDENTITY`)

- What: packages as "Orca Fork" with its own app id and user data, so it runs beside stock Orca.
- Upstream: fork-only.
- Seams: `config/electron-builder.config.cjs`.
- Commits: `dcacfee0c84` (PR #1).

### Status bar: active tab title and agent recap

- What: status bar shows the active tab's title and its agent's recap.
- Upstream: fork-only.
- Seams: `StatusBarSurface.tsx` (one segment slot); the rest is new files in `components/status-bar/`.
- Commits: `1f56449f62b` (PR #2).

### Gaze pane mapping

- What: `orca gaze` maps desktop gaze points to the Orca pane under them.
- Upstream: fork-only (personal hardware).
- Seams (the widest change; most likely to conflict): `src/cli/handler-group-manifest.ts`, `src/cli/specs/core.ts`, `root-help-text-*.ts`, `src/main/runtime/rpc/methods/index.ts`, `src/main/startup/cli-command-names.ts`, `src/preload/api/ui-bridge.ts`, `ui-command-event-api.ts`, `app-lifetime-ipc-bridge.ts`, `main.css`, `cli-argument-boundary.ts`, `host-operation-ownership.ts`, `rpc-params-catalog.generated.ts`, `resources/darwin/bin/orca`.
- Commits: `22af905a2cb`.

### Settings CLI (`orca settings list|show|set`)

- What: agents list, read and set app settings with types and valid values; the running app applies writes live through the same path as the Settings screen.
- Upstream: fork-only.
- Seams: `src/main/ipc/settings.ts` (handler body moved to `global-settings-update-from-client.ts`, one call left), one registration line each in `rpc/methods/index.ts`, `cli/specs/index.ts`, `main/startup/cli-command-names.ts`; CLI group listed in `src/cli/fork-handler-groups.ts`; regenerated `rpc-params-catalog.generated.ts`, `bundled-skill-guides.ts`.
- Conflict notes: upstream edits to the `settings:set` body land in `global-settings-update-from-client.ts`; a new closed-set setting fails `tc` until its members are added to the enum-values table.
- Branch: `mike/settings-cli`.

### Agent memory manager

- What: per-workspace Memory panel and `orca agent-memory` CLI over each agent's own memory files, with review state, staleness checks and link-based sharing.
- Upstream: fork-only, in core. A plugin port waits until upstream's plugin API gains panel-to-worker messaging, CLI access to plugin commands, a tab badge and a repo/worktree read.
- Seams (one-line hooks; logic lives in `src/main/agent-memory/`, `src/shared/agent-memory/`, `right-sidebar/agent-memory/`):
  - CLI: group listed in `src/cli/fork-handler-groups.ts`; `cli/specs/index.ts`, `cli-command-names.ts`, `cli-argument-boundary.ts` (`global`, `unreviewed` flags).
  - Main/preload: `attach-main-window-services.ts` (+ its test mock), `preload/index.ts`, `preload/api-types.ts`.
  - `'memory'` tab id: `ui-chrome-types.ts`, `client-ui-params.ts`, `ui-selection-normalization.ts`, `right-sidebar-route.ts`.
  - Tab: `right-sidebar-panel-content.tsx`, `use-right-sidebar-activity-items.ts`.
  - Build: `plain-node-entry-guard.ts`, `electron-builder.config.cjs`, `electron-vite-output-contract.test.ts` (CLI entry name).
  - Generated: `en.json` catalog; `skill-guides/orca-cli.md` section.
- Conflict notes: a new upstream right-sidebar tab touches the same four tab-id lists; add `'memory'` back beside it.
- Branch: `mike/agent-memory-manager`.

### In flight (not yet on the integration branch)

- difit diff review: `mike/difit-diff-review`.
