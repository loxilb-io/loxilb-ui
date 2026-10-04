//---------------------------------------------------------
// P/D admission pressure (Stage 3.4, on the P/D & KV page)
//---------------------------------------------------------
// What the gateway does when every healthy prefill endpoint is at its
// in-flight cap: hold the request on a FIFO, or drop it with a 429.
//
// ⭐⭐ This panel replaces a row that was actively misleading. The page used
// to show "Admission shed" from `loxilb_pd_admission_shed_total` alone, but
// that counter is structurally pinned at zero whenever queueing is enabled —
// the branch cannot be reached — so the page reported "0/s" while the
// overflow valve dropped traffic and clients received 429s. The fix is not a
// third row beside the first two: it is reporting DROPS as one quantity
// across both valves, and naming which valve is even armed.
//
// ⭐ Parking is hold-don't-drop. A parked request is still going to be served,
// so `absorbing` is rendered as success and never as a fault — the whole
// point of the FIFO is to absorb a burst the pool cannot take yet.
//
// Compact by design: the verdict, plus the two alerts that report a defect
// rather than traffic (a drop counter the gateway does not export, and both
// valves firing, which the datapath forbids). The per-valve rates and
// lifetimes are in Grafana ("P/D robustness events").

import {Alert, Stack} from '@mui/material';
import {PdAdmissionReport} from 'observability/pdAdmission';
import {useTranslation} from 'react-i18next';

type OkReport = Extract<PdAdmissionReport, {kind: 'ok'}>;

// ⚠️ Only the two defect readings. The mode descriptions (queueing armed,
// shedding armed, not yet exercised) explained a per-valve table that is no
// longer here, so they would be commentary on nothing.
function DefectAlert({report}: {report: OkReport}) {
	const {t} = useTranslation();

	// ⚠️⚠️ Checked first: a proven-armed queueing gateway that does not
	// export the overflow counter is dropping requests that nothing can see.
	if (report.blindSpot) {
		return (
			<Alert severity="warning">
				{t('This gateway queues admission overflow but does not export the overflow-shed counter, which is the only drop counter its configuration can reach. Requests may be being dropped with no metric recording it. Upgrade the gateway to observe admission drops.')}
			</Alert>
		);
	}

	// A data-trust caveat: the datapath forbids it, so it is a metrics
	// problem, not an operator's problem.
	if (report.mode === 'contradictory') {
		return (
			<Alert severity="warning">
				{t('Both admission valves report drops, which the datapath does not allow — the queue depth is fixed for the life of the gateway process, so only one valve can ever fire. One of the two counters is wrong; report it. The drop total above is still every request that was dropped.')}
			</Alert>
		);
	}

	return null;
}

function VerdictAlert({report}: {report: OkReport}) {
	const {t} = useTranslation();
	switch (report.verdict) {
		case 'dropping':
			// ⭐⭐ The one actionable state, so the only verdict warning.
			return (
				<Alert severity="warning">
					{t('{{n}} requests have been dropped by the admission layer since this gateway started, each answered with a retriable 429. The prefill pool is running out of capacity — add prefill endpoints, raise the per-endpoint in-flight cap, or enable queueing to absorb bursts.', {n: report.dropTotal ?? 0})}
				</Alert>
			);
		case 'absorbing':
			// ⭐ Success, not a fault. Parking is hold-don't-drop.
			return (
				<Alert severity="success">
					{t('The admission layer has held {{n}} requests on a queue and dropped none. Bursts beyond the per-endpoint cap are being absorbed rather than rejected, which is what queueing is for.', {n: report.queuedTotal ?? 0})}
				</Alert>
			);
		case 'no-pressure':
			return (
				<Alert severity="success">
					{t('The admission layer has neither queued nor dropped a request: no prefill endpoint has reached its in-flight cap.')}
				</Alert>
			);
	}
}

export interface PDAdmissionPanelProps {
	report: PdAdmissionReport;
}

export default function PDAdmissionPanel({report}: PDAdmissionPanelProps) {
	const {t} = useTranslation();

	if (report.kind === 'unavailable') {
		return (
			<Alert severity="info">
				{t('Admission pressure is unavailable: the metrics scrape did not answer. This says nothing about whether requests are being dropped.')}
			</Alert>
		);
	}

	if (report.kind === 'not-exported') {
		return (
			<Alert severity="info">
				{t('This gateway does not export the per-endpoint admission counters, so queueing and drops cannot be reported here.')}
			</Alert>
		);
	}

	return (
		<Stack spacing={1.5}>
			<VerdictAlert report={report} />
			<DefectAlert report={report} />
		</Stack>
	);
}
