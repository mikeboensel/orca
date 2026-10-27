import type { CommandSpec } from '../args'
import { GLOBAL_FLAGS } from '../args'

const LOCAL_ONLY_NOTE =
  "Runs on this machine without the Orca app. Memories are read where agents keep them: Claude's project memory (main checkout and every worktree), ~/.claude/CLAUDE.md, ~/.codex/AGENTS.md, and the repo's CLAUDE.md/AGENTS.md on its base branch."
const SCOPE_NOTE =
  'Scope: --global for the user-level files, or --workspace [<path>] (default: the repo containing the current directory). Worktrees resolve to their main checkout.'
const SCOPE_FLAGS = ['global', 'workspace']
const USER_ONLY_NOTE =
  'USER ONLY. Agents must not run this; propose changes with `orca agent-memory suggest` instead.'

export const AGENT_MEMORY_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['agent-memory', 'list'],
    summary: "List agents' memories with their review state",
    usage:
      'orca agent-memory list [--global | --workspace [<path>]] [--unreviewed] [--type <type>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, ...SCOPE_FLAGS, 'unreviewed', 'type'],
    notes: [LOCAL_ONLY_NOTE, SCOPE_NOTE, 'Types: user, feedback, project, reference, instruction.'],
    examples: ['orca agent-memory list --unreviewed', 'orca agent-memory list --global --json']
  },
  {
    path: ['agent-memory', 'show'],
    summary: 'Print one memory with its review record',
    usage: 'orca agent-memory show <id> [--global | --workspace [<path>]] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, ...SCOPE_FLAGS, 'id'],
    positionalArgs: ['id'],
    notes: [SCOPE_NOTE],
    examples: ['orca agent-memory show claude-memory:feedback_explicit_naming.md']
  },
  {
    path: ['agent-memory', 'history'],
    summary: "Print a memory's review history, including archived and deleted ones",
    usage: 'orca agent-memory history <id> [--global | --workspace [<path>]] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, ...SCOPE_FLAGS, 'id'],
    positionalArgs: ['id'],
    notes: [SCOPE_NOTE],
    examples: ['orca agent-memory history claude-memory:feedback_explicit_naming.md']
  },
  {
    path: ['agent-memory', 'suggest'],
    summary: 'Suggest what the user should decide for a memory (agents may run this)',
    usage:
      'orca agent-memory suggest <id> --verdict <verdict> --reason <text> [--merge-target <id>] [--by <agent>] ' +
      '| orca agent-memory suggest --from-json <file> [--by <agent>]',
    allowedFlags: [
      ...GLOBAL_FLAGS,
      ...SCOPE_FLAGS,
      'id',
      'verdict',
      'reason',
      'merge-target',
      'by',
      'from-json'
    ],
    positionalArgs: ['id'],
    notes: [
      SCOPE_NOTE,
      'Verdicts: KEEP, SHARE, ARCHIVE, MERGE, EDIT, DELETE, NEEDS_REVIEW.',
      'A suggestion is shown on the memory card; it never decides or marks the memory reviewed.',
      '--from-json takes [{ "file" | "id", "verdict", "reason", "mergeTarget" }]; audit verdicts REVIEW, CLAUDE_ONLY and DUPLICATE_OF_CLAUDE_MD map to NEEDS_REVIEW, KEEP and ARCHIVE.'
    ],
    examples: [
      'orca agent-memory suggest claude-memory:project_old_flag.md --verdict ARCHIVE --reason "PR #12 merged" --by claude',
      'orca agent-memory suggest --from-json memory-audit.json --by audit'
    ]
  },
  {
    path: ['agent-memory', 'add'],
    summary: "Add a memory to the workspace's Claude project memory",
    usage:
      'orca agent-memory add --name <name> --type user|feedback|project|reference [--description <line>] ' +
      '[--body <text> | --body-file <path>] [--workspace [<path>]] [--json]',
    allowedFlags: [
      ...GLOBAL_FLAGS,
      'workspace',
      'name',
      'type',
      'description',
      'body',
      'body-file'
    ],
    notes: [
      SCOPE_NOTE,
      "Writes <type>_<name>.md and a MEMORY.md line in the main checkout's Claude project memory. It starts unreviewed."
    ],
    examples: [
      'orca agent-memory add --name "Explicit naming" --type feedback --description "Favor explicit names" --body "No utils/helpers."'
    ]
  },
  {
    path: ['agent-memory', 'edit'],
    summary: "Rewrite a memory's text in its source file",
    usage:
      'orca agent-memory edit <id> (--body <text> | --body-file <path>) [--global | --workspace [<path>]] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, ...SCOPE_FLAGS, 'id', 'body', 'body-file'],
    positionalArgs: ['id'],
    notes: [
      SCOPE_NOTE,
      'Frontmatter is kept. The edit makes the memory unreviewed until the user reviews it. In-repo files are read from main and cannot be edited here.'
    ],
    examples: ['orca agent-memory edit claude-memory:feedback_x.md --body-file new.md']
  },
  {
    path: ['agent-memory', 'review'],
    summary: "Record the user's decision for a memory (user only)",
    usage:
      'orca agent-memory review <id> --decision KEEP|SHARE|ARCHIVE|MERGE|EDIT|DELETE [--share claude,codex,gemini] ' +
      '[--merge-target <id>] [--body-file <path>] [--yes] [--global | --workspace [<path>]] [--json]',
    allowedFlags: [
      ...GLOBAL_FLAGS,
      ...SCOPE_FLAGS,
      'id',
      'decision',
      'share',
      'merge-target',
      'body-file',
      'yes'
    ],
    positionalArgs: ['id'],
    notes: [
      USER_ONLY_NOTE,
      'Without --yes it prints the exact file changes and writes nothing.',
      'ARCHIVE moves a Claude memory into memory/archive/ and DELETE removes it; both drop its MEMORY.md line. `orca agent-memory undo <undo-id>` restores them.'
    ],
    examples: [
      'orca agent-memory review claude-memory:feedback_x.md --decision SHARE --share codex',
      'orca agent-memory review claude-memory:project_y.md --decision ARCHIVE --yes'
    ]
  },
  {
    path: ['agent-memory', 'undo'],
    summary: 'Undo a review batch (user only)',
    usage: 'orca agent-memory undo <undo-id> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'undo-id'],
    positionalArgs: ['undo-id'],
    notes: [USER_ONLY_NOTE, 'Refuses when a file changed after the decision.'],
    examples: ['orca agent-memory undo 0b6f6c2e-5d1a-4c1e-9a43-2f1f3c1d9e7a']
  },
  {
    path: ['agent-memory', 'sync'],
    summary: "Check or repair Orca's link block in each agent's instruction file",
    usage: 'orca agent-memory sync [--dry-run] [--overwrite-drifted <path>]... [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'dry-run', 'overwrite-drifted'],
    repeatableFlags: ['overwrite-drifted'],
    notes: [
      'Shared memories are rendered into Orca-owned files; ~/.claude/CLAUDE.md, ~/.codex/AGENTS.md and ~/.gemini/GEMINI.md get one Orca-marked block that links them. Text outside the block is kept.',
      'Review decisions update the block already; sync repairs it, e.g. after a hand edit (`drifted`), replaced with --overwrite-drifted <path>.'
    ],
    examples: ['orca agent-memory sync --dry-run']
  }
]
