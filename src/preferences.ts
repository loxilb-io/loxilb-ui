//---------------------------------------------------------
// the supported-customization list, in code.
//
// ("operational procedure and UI customization") is evaluated by
// discovering each customization the product claims, changing it, reloading,
// and checking it survived. That claim needs one place to live: these are the
// preferences we support, the exact keys they persist under, and the defaults
// the "restore" step returns to.
//
// The keys are literal strings an operator's browser already holds — renaming
// one silently discards their saved preference, so `preferences.test.tsx`
// pins each literal and any change here has to be a reviewed one carrying a
// migration.
//
// EXCLUDED from the claimed list, deliberately: log-console filters. They are
// in-memory only and reset on reload; asks for the supported list AND
// the excluded items, so this is recorded as unavailable rather than fixed.
//---------------------------------------------------------

export const PREFERENCE_KEYS = {
	/** Row height shared by every DataTable in the app. JSON. */
	tableDensity: 'table_density',
	/** Side navigation expanded vs collapsed to the icon rail. JSON. */
	sideMenuOpen: 'is_open_side_menu',
	/** UI language. Written RAW (not JSON) by save_local_storage. */
	language: 'language',
	/**
	 * LEGACY dashboard grid geometry (`_v2`, one global key for both
	 * flavors). READ-ONLY migration source since the per-flavor `_v3` split:
	 * never written any more, never deleted (an older build may still run
	 * against the same browser), consulted once per flavor to seed its v3
	 * layout. JSON.
	 */
	dashboardLayoutLegacy: 'dashboard_layout_v2',
	/**
	 * Dashboard grid geometry, per flavor. `_v3` replaced the v2
	 * length-equality validity check with card-key-set reconciliation
	 * (`reconcileDashboardLayout`) so adding a card amends a saved layout
	 * instead of silently resetting it, and split the key by flavor so a
	 * gateway layout is never overwritten by saving the OSS one. JSON.
	 */
	dashboardLayoutGateway: 'dashboard_layout_v3:inference-gateway',
	dashboardLayoutLoxilb: 'dashboard_layout_v3:loxilb',
	/**
	 * Network cadence of the shared observability metrics snapshot, in
	 * milliseconds. One global preference: every consumer shares ONE query,
	 * so a per-page cadence cannot exist. Only the pinned option values are
	 * trusted; anything else falls back to the honest default. JSON.
	 */
	observabilityCadence: 'observability_cadence_ms',
} as const;

export function dashboardLayoutKey(flavor: 'inference-gateway' | 'loxilb'): string {
	return flavor === 'inference-gateway' ? PREFERENCE_KEYS.dashboardLayoutGateway : PREFERENCE_KEYS.dashboardLayoutLoxilb;
}

export type TableDensity = 'comfortable' | 'compact';

export const DEFAULT_TABLE_DENSITY: TableDensity = 'comfortable';
export const DEFAULT_SIDE_MENU_OPEN = true;

//---------------------------------------------------------
// Shape guards
//---------------------------------------------------------
// A stored preference is operator-writable input: it survives upgrades, it can
// be edited by hand, and it can be left behind by an older build that wrote a
// different shape. `useLocalStorageState` uses these to reject a value it
// cannot trust instead of adopting it — see the hook for why adopting was the
// worse failure (the component ends up outside its own declared type, and
// nothing throws to say so).

export function isTableDensity(value: unknown): value is TableDensity {
	return value === 'comfortable' || value === 'compact';
}

export function isBooleanPreference(value: unknown): value is boolean {
	return typeof value === 'boolean';
}

//---------------------------------------------------------
// Observability snapshot cadence
//---------------------------------------------------------
// The selectable refresh intervals for the shared metrics snapshot query.
// Rates and freshness derive from the chosen interval (freshness thresholds
// are 1.5×/3× of it; the rate gap tolerance is 3.5×), so every value here is
// honest by construction — a faster DISPLAY tick is presentation smoothing
// and is not what this preference controls.

export const OBSERVABILITY_CADENCE_OPTIONS_MS = [5_000, 10_000, 30_000, 60_000] as const;
export type ObservabilityCadenceMs = (typeof OBSERVABILITY_CADENCE_OPTIONS_MS)[number];

export const DEFAULT_OBSERVABILITY_CADENCE_MS: ObservabilityCadenceMs = 10_000;

export function isObservabilityCadence(value: unknown): value is ObservabilityCadenceMs {
	return typeof value === 'number' && (OBSERVABILITY_CADENCE_OPTIONS_MS as readonly number[]).includes(value);
}
