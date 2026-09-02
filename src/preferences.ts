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
	/** Dashboard grid geometry, `_v2` since the react-grid-layout reflow fix. JSON. */
	dashboardLayout: 'dashboard_layout_v2',
} as const;

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
