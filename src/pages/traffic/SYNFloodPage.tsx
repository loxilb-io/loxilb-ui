//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Stack, Grid2} from '@mui/material';
import {formatNumberForAxis} from 'common';
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
import {Fragment, useRef, useState} from 'react';
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
	const {data, refetch} = useSYNFlood(inst);
	const entries: ISYNFloodEntry[] = data ?? [];

	const [selected_rows, set_selected_rows] = useState<number[]>([]);
	const {openPopUp, enableYes} = usePopUp();
	const formRef = useRef<ISYNFloodConfigMod | null>(null);

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

	const selected_index = selected_rows.length === 1 ? selected_rows[0] : -1;

	return (
		<Fragment>
			<SYNFloodTable
				data={entries}
				selected_rows={selected_rows}
				onChangeSelectedRows={set_selected_rows}
				onEdit={handleEdit}
				onRefresh={refetch}
			/>
			{selected_index !== -1 && entries[selected_index] && (
				<LowerSection>
					<DetailPanel entry={entries[selected_index]} />
				</LowerSection>
			)}
		</Fragment>
	);
}
