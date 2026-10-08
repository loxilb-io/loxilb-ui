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

/**
 * Roles the management backend lets read the compliance sink's own record
 * (`/audit/sink`: its address and last transport error). A viewer is refused
 * with 403; the state of every sink is in `/audit/status`, which every role
 * may read, so a viewer loses the address and the error and nothing else.
 */
export const AUDIT_SINK_READER_ROLES: readonly TUserRole[] = ['admin', 'operator'];
