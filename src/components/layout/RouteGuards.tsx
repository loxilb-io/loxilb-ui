//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import BlockIcon from '@mui/icons-material/Block';
import {Stack, Typography} from '@mui/material';
import type {InstanceFeature, InstanceFlavor} from 'api/capabilities';
import {is_logged_in} from 'common';
import {useInstanceCapabilities} from 'hooks/query/flavorHook';
import {t} from 'i18next';
import {ReactNode} from 'react';
import {Navigate, Outlet} from 'react-router-dom';
import {useRole} from 'hooks/query/oamHooks';

//---------------------------------------------------------
// Route Guards (RBAC — UX only, the OAM server is the
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

//---------------------------------------------------------
// Flavor gating (plain loxilb vs inference gateway)
//---------------------------------------------------------

// Friendly terminal state for a direct route hit on a page the current
// instance's flavor doesn't serve — deliberately NOT an error banner or /404:
// the URL is valid, the instance just doesn't have the feature.
function NotAvailableOnInstance() {
	return (
		<Stack alignItems="center" justifyContent="center" spacing={1} sx={{height: '100%', minHeight: 240, p: 4}}>
			<BlockIcon color="disabled" sx={{fontSize: 48}} />
			<Typography variant="h6">{t('Not available on this instance')}</Typography>
			<Typography variant="body2" color="text.secondary" sx={{maxWidth: 480, textAlign: 'center'}}>
				{t('This page manages a feature of loxilb-inference-gateway. The selected instance runs plain loxilb, which does not serve this API family.')}
			</Typography>
		</Stack>
	);
}

// Route-level twin of the SideMenu requiresFeature/requiresFlavor gating.
// Wrap a gated route's element (or use as a parent element for whole
// families) — renders the children/Outlet when the instance has the
// capability, the "not available" state when it resolved to plain loxilb,
// and stays permissive while the flavor probe is in flight (matching the
// nav, which shows the entries until then).
export function RequireFeature(props: {feature?: InstanceFeature; flavor?: InstanceFlavor; children?: ReactNode}) {
	const {feature, flavor, children} = props;
	const caps = useInstanceCapabilities();

	const allowed =
		(!feature || caps.hasFeature(feature)) &&
		(!flavor || (caps.flavor ?? 'inference-gateway') === flavor);
	if (!allowed) return <NotAvailableOnInstance />;
	return children ? <>{children}</> : <Outlet />;
}
