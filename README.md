<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./assets/illustrations/01-hero-dark.webp" />
  <img alt="DSH CLI selection menu" src="./assets/illustrations/01-hero-light.webp" />
</picture>

# DSH CCGUI

Use Claude Code, Kimi, Codex, PI, OMP, OpenCode, Devin, and other ACP-compatible agent CLIs in [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH). Select a CLI beside the composer and use DSH's interface for conversations, tool records, and approval requests. The CLI executes its own tools and manages its own context and account.

[![CI][ci-shield]][ci-link] [![Coverage][coverage-shield]][coverage-link] [![License][license-shield]][license-link] ![DSH][dsh-shield]

## Installation and OpenCode

Requires DSH `>=0.2.2-rc.1 <0.3.0` and a working, authenticated CLI. Install `opencode` separately and make sure it is on the path available to DSH. OpenCode communicates through `opencode acp`; configure its account and model using OpenCode's own settings.

1. In DSH, open **Plugins**, choose **Add plugin**, enter `dsh-ccgui`, and install it.
2. If instructed to restart DSH, quit it completely and reopen it rather than choosing immediate activation; otherwise old and new code may be mixed in one process.
3. Start a session, select **OpenCode** from the CLI menu beside the composer, and send a message. Its available models appear in the model menu once the CLI has started. The model menu lists every provider the deployment offers, so the same menu moves the session to another CLI or back to a DSH provider. A CLI that starts after the conversation began does not receive the earlier messages; when DSH has a visible compaction summary, it is sent to the CLI as background.

Alternatively, install via the appropriate profile:

```sh
# macOS desktop: quit the app completely first
"/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh" plugin --profile desktop add dsh-ccgui@1.0.6
# DSH web
dsh plugin --profile web add dsh-ccgui@1.0.6
```

Replace `add ...` with `remove dsh-ccgui` to uninstall. To install from a local checkout, run `pnpm install && pnpm run build`, then provide the checkout path in **Add plugin** or instead of the package name in the command above. Peer dependency warnings from pnpm can be ignored.

The included Claude, Kimi, Codex and PI adapters are fetched with `npx`; OMP, OpenCode and Devin must be installed separately and available on DSH's PATH. Devin uses `devin acp`; a basic text-only ACP exchange succeeded with Devin CLI 3000.11.234, but approvals and stopping behavior have not yet been verified. CodeBuddy is disabled by default and has not been verified with a real account. CLI account usage and charges follow that CLI's own configuration.

## Configuration

**CC GUI Settings** in DSH settings controls CLI visibility and ordering and can disable individual interface additions. Settings are stored in the browser. Open a session first to populate the CLI list. DeepSeek remains available and cannot be disabled. In the native DSH model menu, add the current model to favorites and select saved favorites from the shortcuts below its settings. The same menu and other plugins' options remain available for CLI sessions. Favorites are stored in the browser. A favorite missing from the catalog remains visible so it can be removed. The plugin also offers a changes panel, launch scripts, worktree creation, workspace file actions and session status indicators.

To customize agents, add a `ccgui` entry to the profile's `cordis.patch.yml`. The `agents` list replaces the defaults, so retain every default you want to use:

```yaml
- id: ccgui
  name: dsh-ccgui
  config:
    agents:
      - { id: claude, name: Claude Code, command: npx, args: [-y, '@agentclientprotocol/claude-agent-acp@0.101.0'] }
      - { id: kimi, name: Kimi CLI, command: npx, args: [-y, '@moonshot-ai/kimi-code@2.5.2', acp] }
      - { id: codex, name: Codex CLI, command: npx, args: [-y, '@agentclientprotocol/codex-acp@2.5.0'] }
      - { id: pi, name: PI CLI, command: npx, args: [-y, 'pi-acp@0.0.34'] }
      - { id: omp, name: OMP CLI, command: omp, args: [acp] }
      - { id: opencode, name: OpenCode, command: opencode, args: [acp] }
      - { id: devin, name: Devin CLI, command: devin, args: [acp] }
      - { id: codebuddy, name: CodeBuddy CLI, command: codebuddy, args: [--acp] }
      - { id: my-cli, name: My CLI, command: my-cli, args: [acp] }
```

Pin versions for `npx` adapters. Agent `env` can supply CLI-specific environment variables; DSH removes inherited variables whose names contain `KEY`, `PASSWORD`, `SECRET`, or `TOKEN` when starting a CLI. Set any needed credentials in the agent's `env`, not in this document. `startTimeoutMs` defaults to 120 seconds; a first adapter download may require longer. On macOS, a Dock-launched app may have a different PATH from your shell; an agent's explicit `env.PATH` takes precedence.

The CLI mode menu shows modes reported by the CLI over ACP, not DSH permission presets. Mode changes apply immediately to a running process, or with the next message if it has not started. A rejected change is reported and is not retried automatically. A model change applies to the next request; a running turn keeps the model it started with. The model menu and `/model` share one catalog and both list the DSH providers and every CLI, so either surface can move the session between them. A CLI that starts mid-session does not replay the earlier conversation, but receives the latest visible DSH compaction summary when available. The default model label is probed from user-level settings and may differ from a project-specific configuration, although the CLI still uses its own settings.

## Permissions and stopping

> **DSH's sandbox does not control the external CLI.** The CLI decides which operations need approval; operations it permits can run without a DSH approval card. Configure the CLI's own permissions to restrict it.

For example, to have OpenCode ask before edits and shell commands, put this in the project's `opencode.json`:

```json
{ "permission": { "edit": "ask", "bash": "ask" } }
```

CLI permission requests are forwarded to DSH approval cards. DSH's `/permission` setting does not determine whether the CLI asks, but affects who answers when it does. For EXP auto-review, explicitly configure a non-CLI `reviewProvider` and, optionally, `reviewModel`; review requests can contain conversation content and incur provider charges. A reviewer cannot undo an operation that the CLI executed before reporting it. Even in full-access mode, a CLI's own requests can still appear for approval.

In the original author's single-machine default-configuration tests, OpenCode stopped its command when stopped; Codex commands already started and Claude commands sent to the background continued until session closure. Devin's approval and stopping behavior has not yet been verified. Behavior varies by CLI version and configuration, so verify it for your setup.

## Limitations and troubleshooting

- `/compact`, fork, rollback and interrupting a running turn are unsupported; messages sent during a turn are queued. Failed messages are not automatically resent.
- User messages, scheduled tasks, agent relays and selected DSH context injections are forwarded to the CLI. A fresh CLI also receives the latest visible DSH compaction summary, if present; this can disclose earlier conversation content to that CLI's provider. The CLI still manages its own context. Token speed and usage are not displayed because ACP usage figures are not directly comparable.
- Each open CLI session has its own process. A first model lookup may launch a temporary CLI session; an `npx` adapter may need to download first. An unavailable CLI can still appear in the menu but fails to start when used.
- Switching between a CLI and a native DSH provider in an existing session is supported through the model menu and `/model`. The new CLI starts without the full earlier conversation; it receives the latest visible DSH summary if one exists. Switching out of a CLI can also trigger DSH compaction on history that CLI never read. Changing models within a CLI is safe; test cross-provider switching for your workflow.
- In PTC mode each CLI tool call is wrapped in `run_code`; its runtime timeout includes approval time and may cancel long operations. Use standard mode for long builds or tests or if the PTC runtime cannot accept the wrapper.
- Kimi's pinned npm package requires Node.js 22.19 or later and a prior `/login`. CLI errors can contain paths and appear in the session log. CLI subscription use in third-party tools is subject to the respective provider's terms.

## Development and testing

See [AGENTS.md](AGENTS.md) for completion criteria, architecture boundaries and conventions. Run `pnpm check` for the full format, type, lint, architecture, dead-code and coverage gate. Add or adjust tests for behavior changes; run `pnpm build` after changes under `src/`. Use `pnpm size` before modifying source files, `pnpm test` for tests, and `pnpm run coverage` or `pnpm run typecheck` for focused checks. Do not weaken checks to make them pass.

Client UI or interaction changes also require the fake CLI end-to-end test. It drives a real DSH Web UI in an isolated `/tmp` environment with telemetry disabled and requires a built DSH checkout:

```sh
export DSH_REPO=/path/to/deepseek-harness
# Set CHROMIUM_PATH if the Playwright browser version is incompatible.
e2e/start-server.sh &
node e2e/fake-cli.mjs
```

If the DSH checkout has no `.git`, build it with `DSH_CLIENT_COMMIT_HASH=0000000`. Real-CLI tests, such as `E2E_CLI=OpenCode E2E_CLI_ID=opencode node e2e/real-cli.mjs`, use the CLI account and can incur charges and leave test sessions in its history. If required UI testing cannot be run, say so rather than claiming verification.

Releases occur only when requested: a `v*` tag triggers the [release workflow](.github/workflows/release.yml), which checks, publishes to npm using Trusted Publishing, and creates a GitHub Release. After merging to main, use `npm version <patch|minor|major> -m "chore: release v%s"` and `git push --follow-tags`; merging alone does not publish.

## License and acknowledgments

MIT; see [LICENSE](LICENSE). `src/stdio-transport.ts` is adapted from DSH's MIT-licensed `subagent-acp`; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). ACP behavior follows the [public specification](https://agentclientprotocol.com/protocol/overview) and observations of real CLIs.

Claude Code runs through [claude-agent-acp](https://github.com/agentclientprotocol/claude-agent-acp), which uses the Claude Agent SDK downloaded by `npx`. Check [subscription usage](https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan) and Anthropic's [terms](https://code.claude.com/docs/en/legal-and-compliance), including SDK and branding requirements, before distributing this default integration.

Thanks to the [contributors](https://github.com/zhukunpenglinyutong/dsh-ccgui/graphs/contributors). See the project's [star history](https://star-history.dera.page/#zhukunpenglinyutong/dsh-ccgui&type=date&legend=top-left).

[ci-shield]: https://img.shields.io/github/actions/workflow/status/zhukunpenglinyutong/dsh-ccgui/ci.yml?branch=main&label=CI&labelColor=black&style=flat-square
[ci-link]: https://github.com/zhukunpenglinyutong/dsh-ccgui/actions/workflows/ci.yml
[coverage-shield]: https://img.shields.io/codecov/c/github/zhukunpenglinyutong/dsh-ccgui?label=coverage&labelColor=black&style=flat-square
[coverage-link]: https://codecov.io/gh/zhukunpenglinyutong/dsh-ccgui
[license-shield]: https://img.shields.io/github/license/zhukunpenglinyutong/dsh-ccgui?color=white&labelColor=black&style=flat-square
[license-link]: ./LICENSE
[dsh-shield]: https://img.shields.io/badge/DSH-%3E%3D0.2.2--rc.1%20%3C0.3.0-4d6bfe?labelColor=black&style=flat-square
