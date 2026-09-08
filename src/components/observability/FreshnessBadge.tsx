//---------------------------------------------------------
// FreshnessBadge — client receive time vs the source's own cadence
//---------------------------------------------------------
// Every data view distinguishes browser receive time from source/sample time
// (recorded at contract freeze), and freshness is classified against the
// SOURCE's own cadence (fresh < 1.5×, aging 1.5–3×, stale ≥ 3×) — a worker-metrics
// panel on a 5-second REST poll and a Prometheus panel on the shared
// 10-second snapshot each judge their own age, never one global constant.
//
// The badge re-renders on a 1-second tick so the age reads naturally; that
// tick is presentation only — it cannot and does not claim fresher DATA than
// the network cadence delivers.

import {Chip, Tooltip} from '@mui/material';
import {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {classifyFreshness} from 'types/observability';

export interface FreshnessBadgeProps {
	/** Client fetch-completion time of the observation this panel renders. */
	receivedAtMs: number;
	/** The source's own network cadence — thresholds derive from it. */
	cadenceMs: number;
	/** Optional server-reported source time, shown as secondary detail. */
	sourceTimestampMs?: number;
}

export default function FreshnessBadge({receivedAtMs, cadenceMs, sourceTimestampMs}: FreshnessBadgeProps) {
	const {t} = useTranslation();
	const [nowMs, setNowMs] = useState(() => Date.now());

	useEffect(() => {
		const id = setInterval(() => setNowMs(Date.now()), 1000);
		return () => clearInterval(id);
	}, []);

	const freshness = classifyFreshness(receivedAtMs, nowMs, cadenceMs);
	const ageSeconds = Math.max(0, Math.round((nowMs - receivedAtMs) / 1000));

	const label =
		freshness === 'stale'
			? t('Stale — received {{seconds}}s ago', {seconds: ageSeconds})
			: t('Received {{seconds}}s ago', {seconds: ageSeconds});

	const chip = (
		<Chip
			role="status"
			size="small"
			variant={freshness === 'fresh' ? 'outlined' : 'filled'}
			color={freshness === 'stale' ? 'warning' : 'default'}
			label={label}
		/>
	);

	if (sourceTimestampMs === undefined) return chip;
	return (
		<Tooltip title={t('Source time: {{time}}', {time: new Date(sourceTimestampMs).toLocaleTimeString()})}>
			{chip}
		</Tooltip>
	);
}
