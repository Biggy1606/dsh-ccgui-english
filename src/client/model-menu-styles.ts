/**
 * Class names and styles of the composer's compact CLI controls. Metrics and colors follow
 * the harness's own model seat, so the controls read as one row. The model list itself is
 * the harness's own picker (see native-favorites.tsx for the section added inside it).
 * @module dsh-ccgui/client/model-menu-styles
 */

export const TRIGGER_CLASS = 'dsh-cli-model-trigger'
export const LABEL_CLASS = 'dsh-cli-model-label'
export const CHEVRON_CLASS = 'dsh-cli-model-chevron'
export const MODE_CLASS = 'dsh-cli-model-mode'
/** The CLI's mode control, sitting in the composer's permission seat. */
export const MODE_SEAT_CLASS = 'dsh-cli-mode-seat'

// The harness's picker stays the only model control on every session, so there is no rule
// hiding its seat: the CLI's own controls sit beside it instead of replacing it.
export const MODEL_MENU_STYLES = `
.${TRIGGER_CLASS} {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  max-width: 360px;
  height: 28px;
  padding: 0 4px 0 8px;
  border: none;
  border-radius: var(--dsw-radius-sm);
  outline: none;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font-size: 13px;
  line-height: 20px;
  font-weight: 400;
  cursor: pointer;
}
.${TRIGGER_CLASS}:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }
.${TRIGGER_CLASS}:focus-visible:not([data-selection-focus]) {
  box-shadow: 0 0 0 2px var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
}
.${TRIGGER_CLASS}:disabled { color: var(--dsw-alias-label-dimmed); cursor: default; }
.${LABEL_CLASS} {
  display: var(--dsh-composer-model-text-display, block);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.${CHEVRON_CLASS} { flex: 0 0 auto; color: var(--dsw-alias-label-caption); transition: transform 120ms ease; }
.${TRIGGER_CLASS}[aria-expanded="true"] .${CHEVRON_CLASS} { transform: rotate(180deg); }
/* Where the composer is too narrow for the model's name, the mode gives way as well. */
.${MODE_CLASS} { display: var(--dsh-composer-model-text-display, block); flex: 0 0 auto; }
.${MODE_CLASS} .${TRIGGER_CLASS} { padding: 0 4px; color: var(--dsw-alias-label-caption); }
/* The permission seat holds one control: on a CLI session that is the CLI's own mode, so
   the harness's access control steps aside. It keys on the mode control itself, not its seat:
   a CLI that reports no modes leaves the seat empty, and the access control must then stay. */
.${MODE_SEAT_CLASS} { display: inline-flex; min-width: 0; }
.${MODE_SEAT_CLASS} .${TRIGGER_CLASS} { padding: 0 4px 0 8px; color: var(--dsw-alias-label-secondary); }
[data-composer-card]:has(.${MODE_CLASS}) [data-slot="conversation.input.permission"],
[data-composer-card]:has(.${MODE_CLASS}) [aria-label^="访问模式"] { display: none !important; }
`
