//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Stack, Grid2} from '@mui/material';
import {formatNumberForAxis, getStableHash} from 'common';
import SingleTextBox from 'components/element/SingleTextBox';
import ValueBunch from 'components/element/ValueBunch';
import SYNFloodInputForm from 'components/input/SYNFloodInputForm';
import LowerSection from 'components/layout/LowerSection';
import SubTitlePannel from 'components/layout/SubTitlePannel';
import SYNFloodTable from 'components/table/traffic/SYNFloodTable';
import {request_configure_synflood, request_disable_synflood} from 'connector/instance/synflood';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {usePopUp} from 'hooks/popupHook';
import {useSYNFlood} from 'hooks/query/queryHooks';
import {t} from 'i18next';
import {Fragment, useRef, useState, useMemo} from 'react';
import {ISYNFloodConfigMod, ISYNFloodEntry} from 'types/security';

//---------------------------------------------------------
// Detail Panel Component
//---------------------------------------------------------
function DetailPanel(props: {entry: ISYNFloodEntry}) {
	const {entry} = props;

	return (
		<SubTitlePannel title={t('SYN Flood Protection Details')} sub_title={''}>
			<Stack spacing={2}>
				<ValueBunch name={t('Configuration')}>
					<Grid2 container spacing={2}>
						<SingleTextBox label={t('Enabled')} value={entry.enabled ? 'Yes' : 'No'} />
						<SingleTextBox label={t('SYN Threshold')} value={formatNumberForAxis(entry.synThreshold ?? 0)} tooltip="Maximum SYNs per second per IP" />
						<SingleTextBox label={t('Cookie Threshold')} value={formatNumberForAxis(entry.cookieThreshold ?? 0)} tooltip="SYN cookie activation threshold" />
						<SingleTextBox label={t('Whitelist IPs')} value={(entry.whitelistIps ?? []).join(', ') || 'None'} />
					</Grid2>
				</ValueBunch>

				<ValueBunch name={t('Statistics')}>
					<Grid2 container spacing={2}>
						<SingleTextBox label={t('Total SYNs Processed')} value={formatNumberForAxis(entry.totalSyns ?? 0)} />
						<SingleTextBox label={t('SYNs Blocked')} value={formatNumberForAxis(entry.blockedSyns ?? 0)} />
						<SingleTextBox label={t('SYNs Passed')} value={formatNumberForAxis(entry.passedSyns ?? 0)} />
						<SingleTextBox label={t('Cookie Activations')} value={formatNumberForAxis(entry.cookieActivations ?? 0)} />
						<SingleTextBox label={t('Unique IPs Tracked')} value={formatNumberForAxis(entry.uniqueIps ?? 0)} />
					</Grid2>
				</ValueBunch>
			</Stack>
		</SubTitlePannel>
	);
}

//---------------------------------------------------------
// Main Page Component
//---------------------------------------------------------
export default function SYNFloodPage() {
	const inst = useInstanceFromURL();
	const {data, isError, refetch} = useSYNFlood(inst);
	const entries: ISYNFloodEntry[] = data ?? [];

	const [selected_rows, set_selected_rows] = useState<number[]>([]);
	const {openPopUp, enableYes} = usePopUp();
	const formRef = useRef<ISYNFloodConfigMod | null>(null);

	// Hash function for SYN flood entry
	const getHashKey = (item: ISYNFloodEntry) => {
		const str = `${item.enabled}_${item.synThreshold}_${item.cookieThreshold}`;
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
		const initialValue: ISYNFloodConfigMod | undefined = currentConfig ? {
			enabled: currentConfig.enabled,
			synThreshold: currentConfig.synThreshold,
			cookieThreshold: currentConfig.cookieThreshold,
			whitelistIps: currentConfig.whitelistIps,
		} : undefined;

		const input_form = (
			<SYNFloodInputForm
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

				const res = await request_configure_synflood(inst, formRef.current);
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

	const handleRefresh = () => {
		set_selected_rows([]);
		refetch();
	};

	return (
		<Fragment>
			<SYNFloodTable
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
