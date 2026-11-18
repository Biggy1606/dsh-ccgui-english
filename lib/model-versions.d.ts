/**
 * Finds the models in a CLI's list that a newer version of the same family replaces.
 * CLIs list pinned older versions next to their current ones, Claude Code's "Opus 5"
 * beside "Opus 5.5" among them, with descriptions that do not say which is older; rows
 * that differ by a digit alone read like a duplicated list, and the menu leaves them out.
 * @module dsh-ccgui/model-versions
 */
/**
 * Find the names a newer version of the same family also appears among.
 * @param names - the display names of a CLI's models.
 * @returns those that are older versions.
 */
export declare function olderVersions(names: readonly string[]): ReadonlySet<string>;
