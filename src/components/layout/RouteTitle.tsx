//---------------------------------------------------------
// Per-route document.title (localized).
//
// Every route used to share the static "LoxiLB Dashboard"
// from public/index.html, so browser history, tabs and
// screen readers could not tell pages apart. Mounted once
// inside the router; re-runs on navigation and on language
// change.
//---------------------------------------------------------
import {Box} from '@mui/material';
import {visuallyHidden} from '@mui/utils';
import {useEffect} from 'react';
import {useTranslation} from 'react-i18next';
import {useLocation} from 'react-router-dom';
import {MENU_LIST} from 'types/menu';

// Instance sub-route → menu entry name, derived from MENU_LIST so a title can
// never drift from the navigation that leads to the page.
const INSTANCE_TITLES: Record<string, string> = {};
for (const section of MENU_LIST) {
	if (section.items) {
		for (const item of section.items) INSTANCE_TITLES[`${section.path}/${item.path}`] = item.name;
	} else {
		INSTANCE_TITLES[section.path] = section.name;
	}
}
// Instance pages outside the side menu.
INSTANCE_TITLES['dashboard'] = 'Dashboard';

// Non-instance routes (exact pathname, after the router basename).
const STATIC_TITLES: Record<string, string> = {
	'/': 'Login',
	'/login': 'Login',
	'/setup': 'Setup',
	'/instance': 'Instance',
	'/system': 'System',
	'/user': 'User Management',
	'/404': 'Page Not Found',
	'/500': 'Server Error',
	'/503': 'Service Unavailable',
	'/cors': 'CORS Error',
};

export function titleKeyFor(pathname: string): string | undefined {
	const clean = pathname.replace(/\/+$/, '') || '/';
	if (clean in STATIC_TITLES) return STATIC_TITLES[clean];
	const inst = clean.match(/^\/instance\/(.+)$/);
	if (inst) return INSTANCE_TITLES[inst[1]];
	return undefined;
}

//---------------------------------------------------------
// The page's one <h1> (Stage 5.2)
//---------------------------------------------------------
// ⚠️⚠️ WHY THIS IS IN THE LAYOUT AND NOT IN EACH PAGE. No route had an h1 at
// all — `page-has-heading-one` was the last rule frozen in the axe baseline —
// and the obvious fix (promote each page's title) does not reach: **29 of the
// 52 files under src/pages render no title of any kind** (no h4/h5/h6, no
// SubTitleBar, no PanelPaper), so per-page promotion would have
// meant inventing a visible heading for each, which is a design change, and
// would have left every future page to remember on its own.
//
// Deriving it from the route instead gives every page exactly one h1, now and
// for pages not yet written, from the SAME mapping `document.title` already
// uses — so the heading a screen reader announces and the title in the tab
// cannot disagree.
//
// ⭐ It is visually hidden because the visible design is unchanged by this
// stage: pages that show their own title keep it exactly as it looked, marked
// as ordinary text (see e.g. QosPage), because repeating the h1's words as a
// second heading would announce the page name twice.
export function PageHeading() {
	const {pathname} = useLocation();
	const {t} = useTranslation();
	const key = titleKeyFor(pathname);
	// A route with no mapped name still gets an h1 — the rule is about the
	// page having one, and a missing mapping is not the visitor's problem.
	return (
		<Box component="h1" sx={visuallyHidden}>
			{key ? t(key) : 'LoxiLB'}
		</Box>
	);
}

export default function RouteTitle() {
	const {pathname} = useLocation();
	const {t, i18n} = useTranslation();

	useEffect(() => {
		const key = titleKeyFor(pathname);
		document.title = key ? `${t(key)} — LoxiLB` : 'LoxiLB';
	}, [pathname, t, i18n.language]);

	return null;
}
