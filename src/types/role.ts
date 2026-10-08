//---------------------------------------------------------
// Roles, and what each may read
//---------------------------------------------------------
// A leaf module on purpose: the menu table is built at import time and reads
// the list below, so it must not sit behind the hooks' import graph.

export type TUserRole = 'admin' | 'operator' | 'viewer';

/**
 * Roles the management backend lets read an instance's process log and log
 * archives. A viewer is refused both with 403: a process log can carry
 * anything the code paths touched. One list for the menu entry, the route and
 * the dashboard card, so they cannot disagree.
 */
export const LOG_READER_ROLES: readonly TUserRole[] = ['admin', 'operator'];
