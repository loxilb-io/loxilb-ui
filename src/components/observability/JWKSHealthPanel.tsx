//---------------------------------------------------------
// JWKS keyset health (J3, on the JWT Auth Profiles page)
//---------------------------------------------------------
// The profiles table is desired configuration: it says what an operator asked
// for, never whether it works. These four families are the only place the
// product says whether a profile's issuer is actually reachable and its keys
// usable, and the UI is their first consumer — no gateway dashboard or alert
// rule reads them.
//
// ⭐ The load-bearing design rule: a JWKS outage has TWO correct answers and
// only one is a failure. An IdP that never answered means bearer requests get
// 503. An IdP that answered and then went away means the gateway KEEPS
// ADMITTING on the last-known-good keyset until its own staleness cutoff
// arbitrates — an IdP restart is the ordinary way to reach that state, and a
// badge that painted it red would tell an operator their inference plane is
// down while every request is being served. So the amber state names what is
// actually wrong (refreshes are failing) and says out loud that admission is
// unaffected.
//
// ⚠️ The UI never applies a staleness threshold of its own. `jwks_usable` IS
// the gateway's verdict on whether it admits; the last-success age is shown as
// context beside it, never used to overrule it.

import {Alert, Box, Chip, Stack, Table, TableBody, TableCell, TableHead, TableRow, Tooltip, Typography} from '@mui/material';
import {IJWKSHealth, JWKSHealthReport} from 'observability/jwtAuth';
import {useTranslation} from 'react-i18next';
import type {TFunction} from 'i18next';
import {formatAgeSeconds, formatRate} from './rateText';

type ChipColor = 'success' | 'warning' | 'error' | 'default';

// One place the verdict becomes a colour and a sentence, so the amber case
// cannot drift into red in one renderer and not another.
function verdictOf(health: IJWKSHealth, t: TFunction): {color: ChipColor; label: string; detail: string} {
	switch (health.kind) {
		case 'healthy':
			return {
				color: 'success',
				label: t('Admitting'),
				detail: t('The keyset is current and bearer tokens are being verified against it.'),
			};
		case 'last-known-good':
			return {
				color: 'warning',
				label: t('Admitting on last-known-good keys'),
				// Says the non-obvious half first: nothing is being refused.
				detail: t('Admission is unaffected — the gateway is still verifying tokens. JWKS refreshes are failing, so the keys are no longer being renewed; fix the issuer before the gateway’s staleness cutoff turns this into an outage.'),
			};
		case 'never-fetched':
			return {
				color: 'error',
				label: t('Failing closed — never fetched'),
				detail: t('The issuer has never answered, so there are no keys to verify against and every bearer request for this profile is refused with 503.'),
			};
		case 'stale-cutoff':
			return {
				color: 'error',
				label: t('Failing closed — keys expired'),
				detail: t('The keyset aged past the gateway’s staleness cutoff after its last successful fetch, so bearer requests for this profile are now refused with 503.'),
			};
		case 'ambiguous-label':
			return {
				color: 'warning',
				label: t('Cannot attribute'),
				detail: t('Another profile’s name reduces to the same metric label ({{label}}), and the gateway reports one series for the pair. Health is not shown rather than risk showing the other profile’s. Rename one of them using only letters, digits, dot, dash or underscore.', {label: health.label}),
			};
		case 'not-reported':
			return {
				color: 'default',
				label: t('Not reported'),
				detail: t('The gateway reports no keyset state for this profile yet. A profile appears here once its key lifecycle starts, so this is expected immediately after saving one.'),
			};
	}
}

function LastSuccessText({health}: {health: IJWKSHealth}) {
	const {t} = useTranslation();
	const age = health.lastSuccess;
	if (age.kind === 'never') {
		// ⚠️ Absent, not zero. Upstream omits the series before the first
		// success precisely so nothing reads it as a 1970 timestamp.
		return <>{t('Never')}</>;
	}
	if (age.kind === 'clock-skew') {
		return (
			<Tooltip title={t('The gateway timestamped its last fetch {{age}} in the future relative to this browser. The same skew affects token exp/nbf validation, so it is worth correcting.', {age: formatAgeSeconds(age.aheadSec, t)})}>
				<Typography variant="body2" color="warning.main" component="span">
					{t('Clock skew')}
				</Typography>
			</Tooltip>
		);
	}
	return <>{t('{{age}} ago', {age: formatAgeSeconds(age.ageSec, t)})}</>;
}

export interface JWKSHealthPanelProps {
	report: JWKSHealthReport;
	/** True when at least one profile is configured — changes what an empty exposition means. */
	hasProfiles: boolean;
}

export default function JWKSHealthPanel({report, hasProfiles}: JWKSHealthPanelProps) {
	const {t} = useTranslation();

	if (report.kind === 'unavailable') {
		return (
			<Alert severity="info">
				{t('Keyset health is unavailable: the metrics scrape did not answer. The profiles above are unaffected — this says nothing about whether they are working.')}
			</Alert>
		);
	}

	if (report.kind === 'not-exported') {
		// ⚠️ A precondition, never an error. These families are
		// conditional-with-proven-writer: they exist once a profile's key
		// lifecycle is running. Absence is also how a gateway that predates
		// them looks, and neither case is a fault in any profile.
		return (
			<Alert severity="info">
				{hasProfiles
					? t('This gateway exports no JWKS keyset health. Either its build predates those metrics, or no profile’s key lifecycle has started yet. The profiles above are still enforced as configured.')
					: t('Keyset health appears here once a JWT auth profile is configured.')}
			</Alert>
		);
	}

	return (
		<Stack spacing={1}>
			<Typography variant="body2" color="text.secondary">
				{t('Live keyset state read from the gateway. “Admitting” is the gateway’s own verdict on whether it verifies tokens for the profile; the last-success age is context and does not overrule it.')}
			</Typography>
			{/* The table is wider than a phone viewport. It scrolls INSIDE this
			    box so the page body never grows a horizontal scrollbar — the
			    same rule PanelPaper applies, repeated here because this panel
			    is mounted on a configuration page and not inside one.
			    tabIndex keeps a scrollable region with no focusable content of
			    its own reachable from the keyboard. */}
			<Box tabIndex={0} sx={{overflowX: 'auto'}}>
			<Table size="small">
				<TableHead>
					<TableRow>
						<TableCell>{t('Profile')}</TableCell>
						<TableCell>{t('Keyset')}</TableCell>
						<TableCell align="right">{t('Keys')}</TableCell>
						<TableCell align="right">{t('Last success')}</TableCell>
						<TableCell align="right">{t('Refresh ok')}</TableCell>
						<TableCell align="right">{t('Refresh failing')}</TableCell>
					</TableRow>
				</TableHead>
				<TableBody>
					{report.byProfile.map(health => {
						const verdict = verdictOf(health, t);
						return (
							<TableRow key={health.profile}>
								<TableCell sx={{fontFamily: 'monospace'}}>{health.profile}</TableCell>
								<TableCell>
									<Box display="flex" alignItems="center" gap={1}>
										<Chip size="small" color={verdict.color} variant="outlined" label={verdict.label} />
									</Box>
									<Typography variant="caption" color="text.secondary" component="p" sx={{mt: 0.5, maxWidth: 520}}>
										{verdict.detail}
									</Typography>
								</TableCell>
								{/* Zero keys is real data and reads as 0; no series at all is
								    not a count, so it must never render as one. */}
								<TableCell align="right">{health.keys ?? t('N/A')}</TableCell>
								<TableCell align="right">
									<LastSuccessText health={health} />
								</TableCell>
								<TableCell align="right">{formatRate(health.refreshSuccess, t)}</TableCell>
								<TableCell align="right">{formatRate(health.refreshFailure, t)}</TableCell>
							</TableRow>
						);
					})}
				</TableBody>
			</Table>
			</Box>
		</Stack>
	);
}
