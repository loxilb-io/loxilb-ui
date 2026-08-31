//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import BlockIcon from '@mui/icons-material/Block';
import {CircularProgress, Stack, Typography} from '@mui/material';
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

function DetectingInstanceCapabilities() {
	return (
		<Stack data-testid="flavor-loading" alignItems="center" justifyContent="center" spacing={2} sx={{height: '100%', minHeight: 240, p: 4}}>
			<CircularProgress size={32} />
			<Typography variant="body2" color="text.secondary">{t('Detecting instance capabilities…')}</Typography>
		</Stack>
	);
}

// The probe was answered with 401/403: the user is not allowed to see this
// instance's capabilities. Distinct from "loading" (no spinner that never
// ends) and from "not available" (which would misattribute a security
// denial to the product). Minimal rendering — the shared page-state set
// arrives with the standardized-page-states task and replaces these.
function CapabilityDenied() {
	return (
		<Stack data-testid="flavor-denied" alignItems="center" justifyContent="center" spacing={1} sx={{height: '100%', minHeight: 240, p: 4}}>
			<BlockIcon color="error" sx={{fontSize: 48}} />
			<Typography variant="h6">{t('Permission denied')}</Typography>
			<Typography variant="body2" color="text.secondary" sx={{maxWidth: 480, textAlign: 'center'}}>
				{t('Your session is not authorized to read this instance. Sign in again or contact an administrator.')}
			</Typography>
		</Stack>
	);
}

// Transport failure / 5xx after retries: the instance cannot be probed at
// all. Distinct from a denial — this one is about reachability.
function CapabilityUnavailable() {
	return (
		<Stack data-testid="flavor-unavailable" alignItems="center" justifyContent="center" spacing={1} sx={{height: '100%', minHeight: 240, p: 4}}>
			<BlockIcon color="disabled" sx={{fontSize: 48}} />
			<Typography variant="h6">{t('Instance unreachable')}</Typography>
			<Typography variant="body2" color="text.secondary" sx={{maxWidth: 480, textAlign: 'center'}}>
				{t('The instance did not answer the capability probe. Check that it is running and reachable, then reload.')}
			</Typography>
		</Stack>
	);
}

// Route-level twin of the SideMenu requiresFeature/requiresFlavor gating.
// Wrap a gated route's element (or use as a parent element for whole
// families) — renders the children/Outlet when the instance has the
// capability, the "not available" state when it resolved to plain loxilb,
// and a distinct non-mutating state per non-resolved situation (loading /
// denied / unreachable). A permissive pre-resolution window used to mount
// Gateway-only pages briefly on loxilb and issue requests outside the OSS
// contract, and a denial used to render as a fully-featured product.
export function RequireFeature(props: {feature?: InstanceFeature; flavor?: InstanceFlavor; children?: ReactNode}) {
	const {feature, flavor, children} = props;
	const caps = useInstanceCapabilities();
	const gated = feature !== undefined || flavor !== undefined;
	if (gated && caps.resolution.state === 'denied') return <CapabilityDenied />;
	if (gated && caps.resolution.state === 'unavailable') return <CapabilityUnavailable />;
	if (gated && caps.resolution.state === 'loading') return <DetectingInstanceCapabilities />;

	const allowed =
		(!feature || caps.hasFeature(feature)) &&
		(!flavor || caps.flavor === flavor);
	if (!allowed) return <NotAvailableOnInstance />;
	return children ? <>{children}</> : <Outlet />;
}
