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
import {useSecurityRate} from 'hooks/query/queryHooks';
import {t} from 'i18next';
import {Fragment, useRef, useState, useMemo} from 'react';
import {ISecurityRateConfigMod, ISecurityRateEntry} from 'types/security';

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
						<SingleTextBox label={t('Cookie Threshold')} value={formatNumberForAxis(entry.cookieThreshold ?? 0)} tooltip="SYN cookie activation threshold" />
						<SingleTextBox label={t('SYN Blocked')} value={formatNumberForAxis(entry.synBlocked ?? 0)} />
						<SingleTextBox label={t('SYN Passed')} value={formatNumberForAxis(entry.synPassed ?? 0)} />
						<SingleTextBox label={t('SYN Cookies Activated')} value={formatNumberForAxis(entry.synCookies ?? 0)} />
					</Grid2>
				</ValueBunch>

				<ValueBunch name={t('Connection Rate Limiting')}>
					<Grid2 container spacing={2}>
						<SingleTextBox label={t('Enabled')} value={entry.connRateEnabled ? 'Yes' : 'No'} />
						<SingleTextBox label={t('Rate Per Second')} value={formatNumberForAxis(entry.ratePerSec ?? 0)} tooltip="Maximum new connections per second per IP" />
						<SingleTextBox label={t('Concurrent Limit')} value={formatNumberForAxis(entry.concurrentLimit ?? 0)} tooltip="Maximum concurrent connections per IP" />
						<SingleTextBox label={t('Conn Blocked (Rate)')} value={formatNumberForAxis(entry.connBlocked ?? 0)} />
						<SingleTextBox label={t('Conn Passed')} value={formatNumberForAxis(entry.connPassed ?? 0)} />
						<SingleTextBox label={t('Conn Blocked (Concurrent)')} value={formatNumberForAxis(entry.concurrentBlocked ?? 0)} />
					</Grid2>
				</ValueBunch>

				<ValueBunch name={t('UDP Flood Protection')}>
					<Grid2 container spacing={2}>
						<SingleTextBox label={t('Enabled')} value={entry.udpEnabled ? 'Yes' : 'No'} />
						<SingleTextBox label={t('UDP Packet Threshold')} value={formatNumberForAxis(entry.udpPktThreshold ?? 0)} tooltip="Maximum UDP packets per second per IP" />
						<SingleTextBox label={t('UDP Bandwidth (MB/s)')} value={formatNumberForAxis(entry.udpBandwidthMB ?? 0)} tooltip="Maximum UDP bandwidth in MB per second per IP" />
						<SingleTextBox label={t('UDP Blocked')} value={formatNumberForAxis(entry.udpBlocked ?? 0)} />
						<SingleTextBox label={t('UDP Passed')} value={formatNumberForAxis(entry.udpPassed ?? 0)} />
						<SingleTextBox label={t('UDP Bytes Blocked')} value={formatBytes(entry.udpBytesBlocked ?? 0)} />
						<SingleTextBox label={t('UDP Bytes Passed')} value={formatBytes(entry.udpBytesPassed ?? 0)} />
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
	const {data, isError, refetch} = useSecurityRate(inst);
	const entries: ISecurityRateEntry[] = data ?? [];

	const [selected_rows, set_selected_rows] = useState<number[]>([]);
	const {openPopUp, enableYes} = usePopUp();
	const formRef = useRef<ISecurityRateConfigMod | null>(null);

	// Hash function for security rate entry
	const getHashKey = (item: ISecurityRateEntry) => {
		const str = `${item.synEnabled}_${item.connRateEnabled}_${item.udpEnabled}`;
		return getStableHash(str);
	};

	// Sorted entries
	const sortedEntries = useMemo(() => 
		[...entries].sort((a, b) => getHashKey(a) - getHashKey(b)),
		[entries]
	);

	// Map selected original indices to sorted indices for display
	const selectedSortedIndices = useMemo(() => {
		if (entries.length === 0 || selected_rows.length === 0) return [];
		
		return selected_rows
			.map(originalIdx => {
				const original = entries[originalIdx];
				return sortedEntries.findIndex(entry => getHashKey(entry) === getHashKey(original));
			})
			.filter(idx => idx !== -1);
	}, [selected_rows, entries, sortedEntries]);

	// Find single selected index for detail panel
	const selected_index = selectedSortedIndices.length === 1 ? selectedSortedIndices[0] : -1;

	// Selection handler: map sorted indices back to original indices
	const handleSelectionChange = (indices: number[]) => {
		if (entries.length === 0) {
			set_selected_rows([]);
			return;
		}

		if (indices.length === 0) {
			set_selected_rows([]);
			return;
		}

		// Map each sorted index back to original index
		const originalIndices = indices
			.map(sortedIdx => {
				const sortedItem = sortedEntries[sortedIdx];
				return entries.findIndex(entry => getHashKey(entry) === getHashKey(sortedItem));
			})
			.filter(idx => idx !== -1);

		set_selected_rows(originalIndices);
	};

	const handleEdit = () => {
		if (!inst) return;

		// Get current configuration if available
		const currentConfig = entries.length > 0 ? entries[0] : undefined;
		const initialValue: ISecurityRateConfigMod | undefined = currentConfig ? {
			synEnabled: currentConfig.synEnabled,
			synThreshold: currentConfig.synThreshold,
			cookieThreshold: currentConfig.cookieThreshold,
			connRateEnabled: currentConfig.connRateEnabled,
			ratePerSec: currentConfig.ratePerSec,
			concurrentLimit: currentConfig.concurrentLimit,
			udpEnabled: currentConfig.udpEnabled,
			udpPktThreshold: currentConfig.udpPktThreshold,
			udpBandwidthMB: currentConfig.udpBandwidthMB,
			whitelistIps: currentConfig.whitelistIps,
		} : undefined;

		const input_form = (
			<SecurityRateInputForm
				key={Date.now()}
				value={initialValue}
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
				if (res.status === 'success') {
					openPopUp(t('Success'), t('Configured successfully.'), t('OK'));
					setTimeout(() => refetch(), 1000);
				} else {
					openPopUp(t('Error'), t('Failed to configure. {{error}}', {error: res.error}), t('OK'));
				}
			},
			true,
		);
	};

	const handleReset = async () => {
		if (!inst) return;

		openPopUp(
			t('Confirm Reset'),
			t('Are you sure you want to reset all security rate limiting statistics?'),
			t('Reset'),
			t('Cancel'),
			async () => {
				const res = await request_reset_securityrate_stats(inst);
				if (res.status === 'success') {
					openPopUp(t('Success'), t('Statistics reset successfully.'), t('OK'));
					setTimeout(() => refetch(), 1000);
				} else {
					openPopUp(t('Error'), t('Failed to reset statistics. {{error}}', {error: res.error}), t('OK'));
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
				data={sortedEntries}
				selected_rows={selectedSortedIndices}
				onChangeSelectedRows={handleSelectionChange}
				onEdit={handleEdit}
				onRefresh={handleRefresh}
				error={isError}
			/>
			{selected_index !== -1 && sortedEntries[selected_index] && (
				<LowerSection>
					<DetailPanel entry={sortedEntries[selected_index]} />
				</LowerSection>
			)}
		</Fragment>
	);
}
