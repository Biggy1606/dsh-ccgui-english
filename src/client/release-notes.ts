/**
 * The release notes the settings page's 版本记录 tab pages through, newest first. They live
 * as data rather than as the repository's `docs/release-notes/v*.md` files because the client is a
 * browser bundle with no markdown reader, and this tab should read the same offline.
 * @module dsh-ccgui/client/release-notes
 */

/** One line of a release's notes; the optional `title` is the bold lead-in. */
export interface ReleaseNoteItem {
  readonly title?: string
  readonly text: string
}

/** One heading and its lines. */
export interface ReleaseNoteSection {
  /** The category, e.g. `✨ 新功能`, as the release notes file writes it. */
  readonly heading: string
  readonly items: readonly ReleaseNoteItem[]
}

/** One page of the 版本记录 tab. */
export interface ReleaseNote {
  /** Without the leading `v`, like package.json's version. */
  readonly version: string
  /** The release date, ISO-shaped like the notes file's 发布日期. */
  readonly date: string
  readonly sections: readonly ReleaseNoteSection[]
}

/** In display order: the first page is the newest release. */
export const RELEASE_NOTES: readonly ReleaseNote[] = [
  {
    version: '1.0.6',
    date: '2026-11-12',
    sections: [
      {
        heading: '✨ New Features',
        items: [
          {
            title: 'Native CLI modes',
            text: 'The CLI mode button lists modes reported by the CLI over ACP and sends their IDs and names unchanged, without mapping them to DSH permission presets. Changes apply immediately while the process is running, or with the next message before startup, as indicated on the button. If the CLI rejects a mode, the message is still sent and the response identifies the mode used.',
          },
          {
            title: 'EXP auto-review in CLI sessions',
            text: 'Review requests go to an independent stateless model provider and do not enter CLI session history. Set `reviewProvider` (not a CLI) and optionally `reviewModel` in the plugin configuration. The plugin does not choose a provider automatically and will prompt you if none is configured.',
          },
          {
            title: 'Model icons by provider',
            text: 'Recognizes Hunyuan, Zhipu, MiniMax, StepFun and Xiaomi MiMo. Aggregating CLIs no longer use their own logo for every model; unknown providers use a neutral question mark.',
          },
          {
            title: 'Model multipliers beside names',
            text: 'Model names remain as reported by the CLI. A short description, such as CodeBuddy’s `x0.29 credits`, appears beside the name to distinguish free and paid tiers; long promotional text is omitted.',
          },
          {
            title: 'Native sessions retain their model menu',
            text: 'Non-CLI sessions keep the DSH model control, reasoning level and agent team toggle. The plugin only hides CLI groups that cannot be selected in the native menu.',
          },
        ],
      },
      {
        heading: '🐛 Bug Fixes',
        items: [
          {
            title: 'Reasons for CLI rejection',
            text: 'The reason is taken in order from the turn output, named response `_meta` fields (such as CodeBuddy’s `codebuddy.ai/errorMessage`), or the last two lines of stderr. Diagnostic JSON and trace headers are hidden; if none is available, the reason is unspecified.',
          },
          {
            title: 'CLI questions no longer silently denied with full permissions',
            text: 'The session temporarily switches to Ask only while the CLI asks a question, then returns to its previous mode. Changes no longer disappear silently and an approval card is shown.',
          },
          {
            title: 'Mode button hint clears automatically',
            text: 'The next-message hint disappears automatically once the CLI accepts the mode, without reopening the menu.',
          },
        ],
      },
      {
        heading: '📄 Documentation',
        items: [
          {
            text: 'README now covers CLI modes, auto-review configuration, rejection reasons, and model icons and multiplier labels.',
          },
          { text: '`THIRD_PARTY_NOTICES.md` credits the new icons; the development section now matches AGENTS.md.' },
        ],
      },
      {
        heading: '🔧 Maintenance',
        items: [
          {
            text: 'Added CLI mode state, routes and UI, plus an approval policy active only during CLI questions. End-to-end tests now read session logs frame by frame. Version updated to 1.0.6.',
          },
        ],
      },
    ],
  },
  {
    version: '1.0.5',
    date: '2026-11-09',
    sections: [
      {
        heading: '✨ New Features',
        items: [
          {
            title: 'Create a worktree from the project menu',
            text: 'Right-click a project in the sidebar and choose New Worktree to create a Git worktree from a new branch, existing branch or PR. It defaults to `<repo>-worktrees/<branch>` next to the repository, is added to the sidebar, and can open a new session immediately.',
          },
          {
            title: 'Create from PR without gh',
            text: 'Accepts `123`, `#123` or a PR URL and fetches from `refs/pull/<number>/head`. Prefers `upstream` when available; a URL selects the remote matching its repository.',
          },
          {
            title: 'Worktrees grouped by repository',
            text: 'The sidebar groups worktrees under their repository in Worktrees · N and remembers expansion. Right-click menus remain native DSH menus. If the DSH sidebar structure changes, worktrees fall back to the top level.',
          },
          {
            title: 'Optional worktree menu',
            text: 'The settings page now has a Create worktree from project menu switch, enabled by default.',
          },
        ],
      },
      {
        heading: '🐛 Bug Fixes',
        items: [
          {
            title: 'Incorrect CLI token figures removed',
            text: 'ACP reports cumulative usage per turn, but DSH treated it as per-request usage, producing incorrect speed and context figures. CLI sessions no longer report tok/s, token usage or cache hits.',
          },
          {
            title: 'CLI startup failure details',
            text: 'Failure messages include the last 800 characters of CLI stderr and the exit code. Windows unsigned exit codes also show their signed value. The npm `Could not read package.json` error is recognized as an incomplete installation and identifies the `_npx/<hash>` directory to delete.',
          },
        ],
      },
      {
        heading: '📄 Documentation',
        items: [
          {
            text: 'README now explains worktrees, why DSH context compression does not apply to CLI sessions, and alternatives.',
          },
          { text: 'Release notes files are now collected in `docs/release-notes/`.' },
        ],
      },
      {
        heading: '🔧 Maintenance',
        items: [
          {
            text: 'Added Git worktree reading and creation, sidebar grouping and shared git POST handling. Removed token-usage forwarding; each change includes tests and end-to-end coverage. Version updated to 1.0.5.',
          },
        ],
      },
    ],
  },
  {
    version: '1.0.4',
    date: '2026-11-09',
    sections: [
      {
        heading: '✨ New Features',
        items: [
          {
            title: 'Per-model reasoning levels',
            text: 'Reads `thought_level` from the CLI, remembers available levels per model and sends the selection with the next message. Unseen models initially use the default model levels; actual CLI-reported levels replace them and are cached after use.',
          },
          {
            title: 'Provider icons in the model menu',
            text: 'Recognizes DeepSeek, Kimi, Claude and OpenAI from model IDs and names. Falls back to the CLI icon or an empty space to keep names aligned.',
          },
          {
            title: 'Group models by provider',
            text: 'OMP, PI and OpenCode model IDs carry a `vendor/` prefix. Models are grouped when two or more vendors appear; unprefixed rows, including the default, remain at the top. Selection still sends the full ID.',
          },
          {
            title: 'CLI support in PTC mode',
            text: 'CLI tool calls run as `run_code` programs and appear as `run_code` cards. Each call, including approval wait time, is subject to the PTC runtime timeout; use standard mode for long tasks. Incompatible runtimes are reported before the CLI starts.',
          },
        ],
      },
      {
        heading: '🔧 Improvements',
        items: [
          {
            title: 'Cleaner model menu',
            text: 'Rows duplicating the default name and older versions superseded within the same family are hidden. Sessions already using those models are unaffected.',
          },
          {
            title: 'Warning for unsupported reasoning levels',
            text: 'If a newly selected model does not support the previously selected level, the current CLI level is retained and the user is prompted to choose again instead of failing the message.',
          },
        ],
      },
      {
        heading: '📄 Documentation',
        items: [
          {
            text: 'Added Kimi CLI to the README title, keywords and screenshots, and documented PTC support and its limitations.',
          },
        ],
      },
      {
        heading: '🔧 Maintenance',
        items: [
          {
            text: 'Updated version to 1.0.4 and added directly tested modules for reasoning levels, older-version detection, PTC wrapping and model icons.',
          },
        ],
      },
    ],
  },
  {
    version: '1.0.3',
    date: '2026-11-09',
    sections: [
      {
        heading: '🐛 Bug Fixes',
        items: [
          {
            title: 'npx-based CLIs failed to start on Windows',
            text: 'The `npx.cmd` bundled with Node.js stores its path in a variable that the plugin previously could not parse, preventing Claude Code, Codex, Kimi and PI from starting without a shell. It now recognizes this form and runs `npx-cli.js` directly using the adjacent `node.exe` or node on `PATH`.',
          },
          {
            title: 'Upgrade note',
            text: 'If you worked around this by setting `cmd /c npx ...` in `cordis.patch.yml`, remove that override after upgrading to restore the default and receive future adapter updates.',
          },
        ],
      },
    ],
  },
  {
    version: '1.0.2',
    date: '2026-11-08',
    sections: [
      {
        heading: '✨ New Features',
        items: [
          {
            title: 'Release history in settings',
            text: 'The CC GUI settings now include a Release Notes tab, with one version per page, arrow and dot navigation, and a marker for the running version.',
          },
          {
            title: 'Bundled Kimi CLI',
            text: 'Kimi Code includes an `acp` subcommand and starts with the pinned `npx -y @moonshot-ai/kimi-code@2.5.2 acp`, without an adapter. Verified with a real account.',
          },
          {
            title: 'Model control for every session',
            text: 'CLI sessions list their own models; other sessions list only DSH providers, with a reasoning level menu alongside. Models with the same name are distinguished by description or ID.',
          },
          {
            title: 'CLI token usage reporting',
            text: 'Maps usage from each ACP response to DSH TokenUsage, allowing CLI sessions to display speed and cache hits.',
          },
          {
            title: 'Update notice in settings',
            text: 'When a newer release is available, the version pill links to its release notes.',
          },
          {
            title: 'One harness entry in the switcher',
            text: 'All non-CLI providers are combined into a single DeepSeek entry instead of being listed separately.',
          },
        ],
      },
      {
        heading: '🐛 Bug Fixes',
        items: [
          {
            title: 'Windows `.cmd` launchers failed to start',
            text: 'Reads and runs the script and interpreter directly from the shim. The interpreter need not be node; resolution follows `PATH` up to four levels.',
          },
          {
            title: 'node missing when launched from the macOS / Linux Dock',
            text: 'Reads `PATH` from the login shell at startup and adds common installation directories until it is available, preventing npx-based CLIs from failing with exit code 127.',
          },
          {
            title: 'Correct guidance for an incomplete npx cache',
            text: 'Identifies the `_npx` cache directory and suggests deleting it and retrying instead of reinstalling.',
          },
        ],
      },
      {
        heading: '🔧 Refactoring',
        items: [
          { text: 'Extracted `menu-models.ts` and `effort-menu.tsx` from the model menu without changing rendering.' },
          {
            text: 'The switcher now uses `isBuiltInChoice` to share built-in detection between settings locks and preference cleanup.',
          },
        ],
      },
      {
        heading: '📄 Documentation',
        items: [
          { text: 'Documented release conventions in AGENTS.md and README.' },
          { text: 'Added Kimi CLI Node.js 22.19 requirements and login steps to README.' },
        ],
      },
    ],
  },
  {
    version: '1.0.1',
    date: '2026-11-08',
    sections: [
      {
        heading: '🐛 Bug Fixes',
        items: [
          {
            title: 'Settings GitHub link pointed to the wrong repository',
            text: 'The GitHub pill now links to this plugin repository instead of desktop-cc-gui. Tests read the repository URL from `package.json` to prevent drift.',
          },
        ],
      },
      {
        heading: '🔧 Maintenance',
        items: [
          {
            text: 'Releases now use npm Trusted Publishing with the OIDC identity in `release.yml`, without storing a token.',
          },
        ],
      },
      {
        heading: '📄 Documentation',
        items: [{ text: 'Repositioned the feature table and updated the package description in README.' }],
      },
    ],
  },
  {
    version: '1.0.0',
    date: '2026-11-08',
    sections: [
      {
        heading: '✨ New Features',
        items: [
          {
            title: 'Agent CLI integration',
            text: 'Claude Code, Codex CLI, PI CLI, OMP CLI, OpenCode and CodeBuddy CLI register as DSH model providers through ACP. Tool calls, approvals and changes use the native DSH interface.',
          },
          {
            title: 'CLI and model menus',
            text: 'Switch CLIs beside the composer. The model menu lists models actually available from the CLI; changes during a session apply to the next message.',
          },
          {
            title: 'Changes panel',
            text: 'The right sidebar groups changes as staged, unstaged or untracked. Stage, discard, commit, push, pull, switch branches and open files for inline diffs.',
          },
          {
            title: 'Startup scripts and terminal',
            text: 'Save common commands in the session header and run them in terminal tabs with one click. The header terminal button toggles the right sidebar terminal.',
          },
          {
            title: 'File and session status',
            text: 'Right-click a workspace file and choose Add to chat to insert an `@path` mention. The session list shows the CLI icon and a blue dot while running.',
          },
          {
            title: 'CC GUI settings',
            text: 'Manage CLI menu order and visibility, interface switches and upcoming feature notices in one settings page.',
          },
        ],
      },
    ],
  },
]
