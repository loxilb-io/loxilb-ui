//---------------------------------------------------------
// QoS observability page (UI-MON-013)
//---------------------------------------------------------
// One urgent question: is every configured policer programmed in the
// datapath, or is one shaping nothing? The per-service shaper internals
// (bytes passed and delayed, parks, CIR/CBS, tokens) are in Grafana's
// "L7 byte shaper" row.

import {Box, Typography} from '@mui/material';
import FreshnessBadge from 'components/observability/FreshnessBadge';
import ObservabilityStateFrame from 'components/observability/ObservabilityStateFrame';
import PolicerAttachmentPanel from 'components/observability/PolicerAttachmentPanel';
import {classifyViewState} from 'components/observability/observabilityState';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {useMetricsSnapshot} from 'hooks/query/observabilityHooks';
import {useQOSPolicies} from 'hooks/query/queryHooks';
import {policerAttachment} from 'observability/policerAttachment';
import {useCallback, useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {CadenceSelector, PanelPaper, useAbsenceExplanation, useObservabilityApplicable} from './common';

export default function QosPage() {
	const {t} = useTranslation();
	const instance = useInstanceFromURL();
	const applicable = useObservabilityApplicable('page.qos');
	const {snapshot, isLoading, cadenceMs, refetch} = useMetricsSnapshot(applicable ? instance : null);
	// Stage 3.5: let the no-data state say WHY, from the manifest contract.
	const absence = useAbsenceExplanation('page.qos', snapshot);

	// Stage 3.3. The policy list is the other half of the attachment answer:
	// it is what makes an empty gauge readable as "no policer configured"
	// (correct) rather than "the metric is broken". `undefined` deliberately
	// reaches the derivation as "configuration unknown" instead of "none".
	const {data: policyData, refetch: refetchPolicies} = useQOSPolicies(applicable ? instance : null);
	const policies = useMemo(() => (Array.isArray(policyData) ? policyData : undefined), [policyData]);
	const attachment = useMemo(() => policerAttachment(snapshot, policies), [snapshot, policies]);

	// ⚠️ Refresh must refetch EVERY query the page reads, not just the
	// metrics one — the §4.0 half-refresh defect, avoided up front rather
	// than shipped again.
	const refetchAll = useCallback(() => {
		refetch();
		refetchPolicies();
	}, [refetch, refetchPolicies]);

	// The attachment answer can be carried entirely by REST, so a gateway that
	// exports no attachment series but DOES list policers still has something
	// true to show — including the useful "policers configured, metric not
	// exported" gap. A report that knows nothing (no rows and no policy list)
	// correctly leaves the frame in its no-data state.
	const hasData = attachment.kind === 'ok' && (attachment.rows.length > 0 || attachment.configured !== undefined);
	const state = classifyViewState({
		applicable,
		isLoading,
		snapshot,
		hasData,
		nowMs: Date.now(),
		cadenceMs,
	});

	return (
		<Box sx={{p: 2}}>
			<Box display="flex" alignItems="center" gap={2} sx={{mb: 2}}>
				<Typography variant="h5" component="h2">{t('QoS')}</Typography>
				{snapshot && !snapshot.failure && <FreshnessBadge receivedAtMs={snapshot.receivedAtMs} cadenceMs={cadenceMs} />}
				<CadenceSelector />
			</Box>

			<ObservabilityStateFrame state={state} absence={absence} name={t('QoS')} onRetry={refetchAll}>
				<PanelPaper title={t('Policer attachment')}>
					<PolicerAttachmentPanel report={attachment} />
				</PanelPaper>
			</ObservabilityStateFrame>
		</Box>
	);
}
