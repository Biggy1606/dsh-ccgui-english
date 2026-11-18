/**
 * What to tell the user after a CLI fails to start. The default asks them to
 * install and log in, but an adapter pulled by `npx` can fail because npm left
 * its cache half-installed (a skipped optional dependency, an interrupted
 * download). Reinstalling globally does not help there: npx keeps reusing the
 * broken cache until that directory is deleted.
 * @module dsh-ccgui/session/start-hint
 */

import { fileURLToPath } from 'node:url'

const INSTALL_HINT = 'Make sure it is installed and you are logged in.'
const REINSTALL_HINT = 'Its installation is incomplete; reinstall it as indicated above.'

/**
 * Errors that mean files are missing from the install, not that the CLI itself refused.
 * `Could not read package.json` is npm's own: npx found an entry whose install never finished
 * and does not install again until that directory is gone.
 */
const INCOMPLETE_INSTALL =
  /Missing optional dependency|Cannot find module|ERR_MODULE_NOT_FOUND|Could not read package\.json/

/**
 * An npx cache entry, `<npm cache>/_npx/<hash>`, as a path or a `file://` URL. A Windows
 * path is taken from its drive letter so that `Program Files` keeps its space.
 */
const NPX_ENTRY = /(?:[A-Za-z]:[\\/](?:[^\\/\n'"()]+[\\/])*?|[^\s'"()]*[\\/])_npx[\\/][0-9a-f]+/

function npxEntry(message: string): string | undefined {
  const found = NPX_ENTRY.exec(message)?.[0]
  if (found === undefined) return undefined
  return found.startsWith('file:') ? fileURLToPath(found) : found
}

/**
 * @param message - the startup error's text.
 * @returns the sentence to append to the startup failure.
 */
export function startHint(message: string): string {
  if (!INCOMPLETE_INSTALL.test(message)) return INSTALL_HINT
  const entry = npxEntry(message)
  if (entry === undefined) return REINSTALL_HINT
  return `The installation in the npx cache is incomplete. Delete ${entry} and retry; it will be downloaded again on the next start.`
}
