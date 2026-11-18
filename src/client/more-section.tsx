/**
 * The settings page's 更多功能 tab: features that are planned but not ready yet. Each row says
 * what the feature will do and that it is not open yet; nothing here is clickable, so the list
 * only sets expectations and never pretends to be a control.
 * @module dsh-ccgui/client/more-section
 */

import type { ReactElement } from 'react'

/** A feature the page announces without offering a control for it yet. */
export interface UpcomingFeature {
  readonly id: 'autoRename' | 'worktree' | 'gitInfo' | 'promptBoost' | 'accountQuota'
  readonly title: string
  readonly description: string
}

const INTRO = 'Features in development will become available here.'
const SOON_LABEL = 'Coming soon…'
const SOON_CLASS = 'dsh-ccgui-more-soon'

/** In the order the settings page lists them. */
export const UPCOMING_FEATURES: readonly UpcomingFeature[] = [
  {
    id: 'autoRename',
    title: 'Automatic session naming',
    description: 'Generate session titles from the conversation automatically.',
  },
  {
    id: 'worktree',
    title: 'WorkTree',
    description: 'Create a separate Git worktree for each session to isolate tasks.',
  },
  {
    id: 'gitInfo',
    title: 'Automatic Git messages',
    description: 'Generate commit messages and change descriptions from your changes.',
  },
  {
    id: 'promptBoost',
    title: 'Prompt enhancement',
    description: 'Expand a short request into a complete prompt with context.',
  },
  {
    id: 'accountQuota',
    title: 'AI account quota alerts',
    description: 'Show remaining quota and reset times for AI accounts, with low-quota alerts.',
  },
]

export const MORE_SECTION_STYLES = `
.${SOON_CLASS} { flex: 0 0 auto; padding: 2px 8px; border: 0.5px solid var(--dsw-alias-border-l2); border-radius: 999px; color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary)); font-size: 12px; line-height: 18px; }
`

/**
 * @returns the section.
 */
export function MoreSection(): ReactElement {
  return (
    <section>
      <p className="dsh-ccgui-settings-intro">{INTRO}</p>
      <ul className="dsh-ccgui-settings-list">
        {UPCOMING_FEATURES.map((feature) => (
          <li key={feature.id} className="dsh-ccgui-settings-row">
            <div>
              <div className="dsh-ccgui-settings-title">{feature.title}</div>
              <div className="dsh-ccgui-settings-desc">{feature.description}</div>
            </div>
            <span className={SOON_CLASS}>{SOON_LABEL}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
