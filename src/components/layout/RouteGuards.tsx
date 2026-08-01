//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {is_logged_in} from 'common';
import {useRole} from 'hooks/query/oamHooks';
import {Navigate, Outlet} from 'react-router-dom';

//---------------------------------------------------------
// Route Guards (RBAC Phase 3 — UX only, the OAM server is the
// security boundary)
//---------------------------------------------------------

// Blocks unauthenticated access to protected routes up front instead of
// waiting for the first 401 redirect.
export function RequireAuth() {
	if (!is_logged_in()) return <Navigate to="/login" replace />;
	return <Outlet />;
}

// Admin-only routes (e.g. config management). Must be nested inside
// RequireAuth. Renders nothing while the role is still loading so admins
// don't get bounced before /users/me resolves.
export function RequireAdminRoute() {
	const {role, is_admin} = useRole();

	if (role === null) return null;
	if (!is_admin) return <Navigate to="/instance" replace />;
	return <Outlet />;
}
