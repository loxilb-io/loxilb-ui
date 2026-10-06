//---------------------------------------------------------
// Gateway readiness banner — the two states an operator must act on
//---------------------------------------------------------
// Renders nothing for a ready gateway in normal operation, for an unread or
// failed diagnostics read, and for a gateway that predates the fields. See
// observability/gatewayReadiness for what each field means.
//
// GET /diagnostics is its own REST read with its own receive time, so each
// line carries a freshness badge: react-query keeps the last answer while a
// refresh is failing, and a verdict that old must look old.

import {Alert, Box, Stack} from '@mui/material';
import {useTranslation} from 'react-i18next';
import FreshnessBadge from 'components/observability/FreshnessBadge';
import {DIAGNOSTICS_CADENCE_MS, useDiagnostics} from 'hooks/query/gatewayTelemetryHooks';
import {gatewayReadiness, isQuiet} from 'observability/gatewayReadiness';
import {IInstance} from 'types/oam';

interface GatewayReadinessBannerProps {
	instance: IInstance | null;
	/** False until the instance is proven to be a gateway; the hook guards the flavor as well. */
	active: boolean;
}

export default function GatewayReadinessBanner({instance, active}: GatewayReadinessBannerProps) {
	const {t} = useTranslation();
	const diagnostics = useDiagnostics(instance, active);
	const read = diagnostics.data;
	const readiness = gatewayReadiness(read?.data);
	if (!read || isQuiet(readiness)) return null;

	const badge = <FreshnessBadge receivedAtMs={read.receivedAtMs} cadenceMs={DIAGNOSTICS_CADENCE_MS} />;
	const {notReady, maintenance} = readiness;

	return (
		<Stack spacing={1} sx={{mx: '10px', mt: 1}} data-testid="gateway-readiness">
			{notReady && (
				<Alert severity="error" action={<Box sx={{alignSelf: 'center'}}>{badge}</Box>}>
					{notReady.reasons.length > 0
						? t('This gateway reports it is not ready: {{reasons}}', {reasons: notReady.reasons.join('; ')})
						: t('This gateway reports it is not ready and gave no reason.')}
					{notReady.more > 0 && <> {t('({{n}} more in the gateway diagnostics)', {n: notReady.more})}</>}
				</Alert>
			)}
			{maintenance && (
				<Alert severity="warning" action={<Box sx={{alignSelf: 'center'}}>{badge}</Box>}>
					{t('This gateway is in maintenance. It refuses configuration changes until an operator ends the maintenance.')}
				</Alert>
			)}
		</Stack>
	);
}
