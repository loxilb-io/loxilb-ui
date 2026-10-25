//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Stack, Grid2} from '@mui/material';
import {formatNumberForAxis, formatBytes, getStableHash} from 'common';
import SingleTextBox from 'components/element/SingleTextBox';
import ValueBunch from 'components/element/ValueBunch';
import SecurityRateInputForm from 'components/input/SecurityRateInputForm';
import LowerSection from 'components/layout/LowerSection';
import SubTitlePannel from 'components/layout/SubTitlePannel';
import SecurityRateTable from 'components/table/traffic/SecurityRateTable';
import {
	request_configure_securityrate,
	request_disable_securityrate,
	request_reset_securityrate_stats,
} from 'connector/instance/securityrate';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {usePopUp} from 'hooks/popupHook';
import {useSecurityRate, useMetadata} from 'hooks/query/queryHooks';
import {t} from 'i18next';
import {Fragment, useRef, useState, useMemo} from 'react';
import {ISecurityRateConfigMod, ISecurityRateEntry} from 'types/security';
import {toPageState} from 'components/state/pageState';
import {useInstanceCapabilities} from 'hooks/query/flavorHook';
import {useReconcileReporter} from 'hooks/query/reconcileReport';
import {fromQueryRefetch} from 'hooks/query/reconcile';
import {securityRateApplied, securityRateDisabled} from 'hooks/query/securityRateApplied';
import {aggregateRateDeclared} from 'types/security_rate_policy';

//---------------------------------------------------------
// Detail Panel Component
//---------------------------------------------------------
function DetailPanel(props: {entry: ISecurityRateEntry}) {
	const {entry} = props;

	return (
		<SubTitlePannel title={t('Security Rate Limiting Details')} sub_title={''}>
			<Stack spacing={2}>
				<ValueBunch name={t('SYN Flood Protection')}>
					<Grid2 container spacing={2}>
						<SingleTextBox label={t('Enabled')} value={entry.synEnabled ? 'Yes' : 'No'} />
						<SingleTextBox label={t('SYN Threshold')} value={formatNumberForAxis(entry.synThreshold ?? 0)} tooltip="Maximum SYNs per second per IP" />
						<SingleTextBox label={t('Cookie Threshold')} value={formatNumberForAxis(entry.cookieThreshold ?? 0)} tooltip="SYN threshold telemetry, not a SYN-cookie exchange. Stored zero becomes 50 in the datapath." />
						<SingleTextBox label={t('SYN Blocked')} value={formatNumberForAxis(entry.synBlocked ?? 0)} />
						<SingleTextBox label={t('SYN Passed')} value={formatNumberForAxis(entry.synPassed ?? 0)} />
						<SingleTextBox label={t('SYN Threshold Observations')} value={formatNumberForAxis(entry.synCookies ?? 0)} />
					</Grid2>
				</ValueBunch>

				<ValueBunch name={t('Connection Rate Limiting')}>
					<Grid2 container spacing={2}>
						<SingleTextBox label={t('Enabled')} value={entry.connRateEnabled ? 'Yes' : 'No'} />
						<SingleTextBox label={t('Rate Per Second')} value={formatNumberForAxis(entry.ratePerSec ?? 0)} tooltip="Maximum SYN packets per second per source IP, not completed connections." />
						<SingleTextBox label={t('Conn Blocked (Rate)')} value={formatNumberForAxis(entry.connBlocked ?? 0)} />
						<SingleTextBox label={t('Conn Passed')} value={formatNumberForAxis(entry.connPassed ?? 0)} />
						<SingleTextBox label={t('Conn Blocked (Concurrent)')} value={formatNumberForAxis(entry.concurrentBlocked ?? 0)} />
					</Grid2>
				</ValueBunch>

				<ValueBunch name={t('UDP Flood Protection')}>
					<Grid2 container spacing={2}>
						<SingleTextBox label={t('Enabled')} value={entry.udpEnabled ? 'Yes' : 'No'} />
						<SingleTextBox label={t('UDP Packet Threshold')} value={formatNumberForAxis(entry.udpPktThreshold ?? 0)} tooltip="Maximum UDP packets per second per IP" />
						<SingleTextBox label={t('UDP Bandwidth (MiB/s)')} value={formatNumberForAxis(entry.udpBandwidthMB ?? 0)} tooltip="Maximum UDP bandwidth in MiB per second per source IP (1048576 bytes/MiB)" />
						<SingleTextBox label={t('UDP Blocked')} value={formatNumberForAxis(entry.udpBlocked ?? 0)} />
						<SingleTextBox label={t('UDP Passed')} value={formatNumberForAxis(entry.udpPassed ?? 0)} />
						<SingleTextBox label={t('UDP Bytes Blocked')} value={formatBytes(entry.udpBytesBlocked ?? 0)} />
						<SingleTextBox label={t('UDP Bytes Passed')} value={formatBytes(entry.udpBytesPassed ?? 0)} />
					</Grid2>
				</ValueBunch>

				<ValueBunch name={t('Aggregate Budgets and Protection Errors')}>
					<Grid2 container spacing={2}>
						{([
							['aggregateSynThreshold', 'Aggregate SYN Packets/s'],
							['aggregateConnRatePerSec', 'Aggregate Connection SYN Packets/s'],
							['aggregateUdpPktThreshold', 'Aggregate UDP Packets/s'],
							['aggregateUdpBandwidthMB', 'Aggregate UDP Bandwidth (MiB/s)'],
							['aggregateSynBlocked', 'Aggregate SYN Blocked'],
							['aggregateConnBlocked', 'Aggregate Connection SYN Blocked'],
							['aggregateUdpBlocked', 'Aggregate UDP Blocked'],
							['trackingFailures', 'Source Tracking Failures'],
							['unsupportedPacketBlocked', 'Unsupported Packets Blocked'],
						] as const).map(([field, label]) => <SingleTextBox key={field} label={t(label)} value={entry[field] === undefined ? t('Not reported') : formatNumberForAxis(entry[field]!)} />)}
					</Grid2>
				</ValueBunch>
				<ValueBunch name={t('General Statistics')}>
					<Grid2 container spacing={2}>
						<SingleTextBox label={t('Unique IPs Tracked')} value={formatNumberForAxis(entry.uniqueIps ?? 0)} />
						<SingleTextBox label={t('Whitelist IPs')} value={(entry.whitelistIps ?? []).join(', ') || 'None'} />
					</Grid2>
				</ValueBunch>
			</Stack>
		</SubTitlePannel>
	);
}

//---------------------------------------------------------
// Main Page Component
//---------------------------------------------------------
export default function SecurityRatePage() {
	const inst = useInstanceFromURL();
	const caps = useInstanceCapabilities();
	const metadata = useMetadata(inst, '/config/securityrate');
	const canEdit = caps.resolved && metadata.param_fields !== undefined;
	const {report} = useReconcileReporter();
	const secrate_query = useSecurityRate(inst);
	const {data, refetch} = secrate_query;
	// eslint-disable-next-line react-hooks/exhaustive-deps -- deps intentionally frozen: widening this list changes refetch/render behavior; verify at runtime before changing
	const entries: ISecurityRateEntry[] = data ?? [];

	const [selected_rows, set_selected_rows] = useState<number[]>([]); // holds hash ids
	const {openPopUp, enableYes} = usePopUp();
	const formRef = useRef<ISecurityRateConfigMod | null>(null);

	// Hash function for security rate entry
	const getHashKey = (item: ISecurityRateEntry) => {
		const str = `${item.synEnabled}_${item.connRateEnabled}_${item.udpEnabled}`;
		return getStableHash(str);
	};

	// Resolve selected entries by matching stable hash ids
	const selectedItems = useMemo(
		() =>
			selected_rows
				.map(h => entries.find(a => getHashKey(a) === h))
				.filter((x): x is ISecurityRateEntry => x != null),
		[selected_rows, entries],
	);
	const selectedItem: ISecurityRateEntry | null = selectedItems.length === 1 ? selectedItems[0] : null;

	const handleSelectionChange = (hashes: number[]) => set_selected_rows(hashes);

	const handleEdit = () => {
		if (!inst || !canEdit) return;
		formRef.current = null;

		// Get current configuration if available
		const currentConfig = entries.length > 0 ? entries[0] : undefined;
		const initialValue: ISecurityRateConfigMod | undefined = currentConfig ? {
			synEnabled: currentConfig.synEnabled,
			synThreshold: currentConfig.synThreshold,
			cookieThreshold: currentConfig.cookieThreshold,
			connRateEnabled: currentConfig.connRateEnabled,
			ratePerSec: currentConfig.ratePerSec,
			udpEnabled: currentConfig.udpEnabled,
			udpPktThreshold: currentConfig.udpPktThreshold,
			udpBandwidthMB: currentConfig.udpBandwidthMB,
			whitelistIps: currentConfig.whitelistIps,
			aggregateSynThreshold: currentConfig.aggregateSynThreshold,
			aggregateConnRatePerSec: currentConfig.aggregateConnRatePerSec,
			aggregateUdpPktThreshold: currentConfig.aggregateUdpPktThreshold,
			aggregateUdpBandwidthMB: currentConfig.aggregateUdpBandwidthMB,
		} : undefined;

		const input_form = (
			<SecurityRateInputForm
				key={Date.now()}
				value={initialValue}
				supportsAggregate={caps.flavor === 'inference-gateway' && aggregateRateDeclared(metadata.param_fields)}
				onChange={data => {
					formRef.current = data;
					enableYes(data.isValid || false);
				}}
			/>
		);

		openPopUp(
			'',
			input_form,
			t('Configure'),
			t('Cancel'),
			async () => {
				if (!formRef.current) return;

				const res = await request_configure_securityrate(inst, formRef.current);
				if (res.status === 'confirmed') {
					await report({refetch: fromQueryRefetch(refetch), confirm: securityRateApplied(formRef.current)}, t('Configured successfully.'));
				} else {
					openPopUp(t('Error'), t('Failed to configure. {{error}}', {error: t(res.localeKey)}), t('OK'));
				}
			},
			true,
		);
	};

	const handleDisable = async () => {
		if (!inst) return;
		const res = await request_disable_securityrate(inst);
		if (res.status === 'confirmed') {
			await report({refetch: fromQueryRefetch(refetch), confirm: securityRateDisabled}, t('Security rate limiting disabled.'));
		} else {
			openPopUp(t('Error'), t('Failed to disable. {{error}}', {error: t(res.localeKey)}), t('OK'));
		}
	};

	// eslint-disable-next-line @typescript-eslint/no-unused-vars -- parked feature code kept for re-enablement; remove the disable when it is wired back up or deleted
	const handleReset = async () => {
		if (!inst) return;

		openPopUp(
			t('Confirm Reset'),
			t('Are you sure you want to reset all security rate limiting statistics?'),
			t('Reset'),
			t('Cancel'),
			async () => {
				const res = await request_reset_securityrate_stats(inst);
				if (res.status === 'confirmed') {
					openPopUp(t('Success'), t('Statistics reset successfully.'), t('OK'));
					setTimeout(() => refetch(), 1000);
				} else {
					openPopUp(t('Error'), t('Failed to reset statistics. {{error}}', {error: t(res.localeKey)}), t('OK'));
				}
			},
		);
	};

	const handleRefresh = () => {
		set_selected_rows([]);
		refetch();
	};

	return (
		<Fragment>
			<SecurityRateTable
				data={entries}
				selected_rows={selected_rows}
				onChangeSelectedRows={handleSelectionChange}
				onEdit={canEdit ? handleEdit : undefined}
				onDisable={caps.resolved ? handleDisable : undefined}
				onRefresh={handleRefresh}
				state={toPageState(secrate_query, {op: 'security_rate.list'})}
			/>
			{selectedItem && (
				<LowerSection>
					<DetailPanel entry={selectedItem} />
				</LowerSection>
			)}
		</Fragment>
	);
}
