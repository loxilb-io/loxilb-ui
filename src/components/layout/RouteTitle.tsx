//---------------------------------------------------------
// Per-route document.title (localized).
//
// Every route used to share the static "LoxiLB Dashboard"
// from public/index.html, so browser history, tabs and
// screen readers could not tell pages apart. Mounted once
// inside the router; re-runs on navigation and on language
// change.
//---------------------------------------------------------
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

export default function RouteTitle() {
	const {pathname} = useLocation();
	const {t, i18n} = useTranslation();

	useEffect(() => {
		const key = titleKeyFor(pathname);
		document.title = key ? `${t(key)} — LoxiLB` : 'LoxiLB';
	}, [pathname, t, i18n.language]);

	return null;
}
