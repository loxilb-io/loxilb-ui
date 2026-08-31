//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Stack, Grid2, Box, Chip} from '@mui/material';
import {getStableHash} from 'common';
import SingleTextBox from 'components/element/SingleTextBox';
import ValueBunch from 'components/element/ValueBunch';
import IPFilterInputForm from 'components/input/IPFilterInputForm';
import HorizontalStack from 'components/layout/HorizontalStack';
import LowerSection from 'components/layout/LowerSection';
import SubTitlePannel from 'components/layout/SubTitlePannel';
import IPFilterTable from 'components/table/traffic/IPFilterTable';
import {request_create_ipfilter_rule, request_delete_ipfilter_rule} from 'connector/instance/ipfilter';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {usePopUp} from 'hooks/popupHook';
import {useIPFilterRules} from 'hooks/query/queryHooks';
import {t} from 'i18next';
import {Fragment, useRef, useState, useMemo} from 'react';
import React from 'react';
import {IIPFilterEntry} from 'types/security';

//---------------------------------------------------------
// Detail Panel Component
//---------------------------------------------------------
function DetailPanel(props: {entry: IIPFilterEntry}) {
	const {entry} = props;

	return (
		<SubTitlePannel title={t('IP Filter Rule Details')}>
			<Box display="flex" gap={1} alignItems="center" mb={2}>
				<Chip
					label={entry.filterType.toUpperCase()}
					size="small"
					color={entry.filterType === 'whitelist' ? 'success' : 'error'}
					sx={{fontWeight: 'bold'}}
				/>
				<Chip
					label={entry.action.toUpperCase()}
					size="small"
					color={entry.action === 'allow' ? 'info' : 'warning'}
				/>
			</Box>
			<HorizontalStack align="flex-start">
				<Stack spacing={2} flex={1}>
					<ValueBunch name={t('Rule Configuration')}>
						<Grid2 container spacing={2}>
							<SingleTextBox label={t('CIDR')} value={entry.cidr} tooltip="IP address in CIDR notation" />
							<SingleTextBox label={t('Priority')} value={entry.priority?.toString() ?? '100'} tooltip="Higher value = more important" />
							<SingleTextBox label={t('Security Zone')} value={entry.zone?.toString() ?? '0'} tooltip="0 = all zones" />
						</Grid2>
					</ValueBunch>
				</Stack>
			</HorizontalStack>
		</SubTitlePannel>
	);
}

//---------------------------------------------------------
// Main Page Component
//---------------------------------------------------------
export default function IPFilterPage() {
	const inst = useInstanceFromURL();
	const {data, isError, refetch} = useIPFilterRules(inst);
	// eslint-disable-next-line react-hooks/exhaustive-deps -- deps intentionally frozen: widening this list changes refetch/render behavior; verify at runtime before changing
	const entries: IIPFilterEntry[] = data ?? [];

	const [selected_rows, set_selected_rows] = useState<number[]>([]); // holds hash ids
	const {openPopUp, enableYes} = usePopUp();
	const formRef = useRef<IIPFilterEntry | null>(null);

	// Hash function for IP filter rule
	const getHashKey = (item: IIPFilterEntry) => {
		const str = `${item.filterType}_${item.cidr}_${item.zone ?? 0}_${item.priority ?? 100}`;
		return getStableHash(str);
	};

	// Resolve selected entries by matching stable hash ids
	const selectedItems = useMemo(
		() =>
			selected_rows
				.map(h => entries.find(a => getHashKey(a) === h))
				.filter((x): x is IIPFilterEntry => x != null),
		[selected_rows, entries],
	);
	const selectedItem: IIPFilterEntry | null = selectedItems.length === 1 ? selectedItems[0] : null;

	const handleSelectionChange = (hashes: number[]) => set_selected_rows(hashes);

	const handleDelete = async () => {
		if (!inst || selectedItems.length === 0) return;

		// Delete multiple selected IP filter rules
		const deletePromises = selectedItems.map(async (item) => {
			return request_delete_ipfilter_rule(inst, {
				filterType: item.filterType,
				cidr: item.cidr,
				zone: item.zone,
			});
		});

		const results = await Promise.all(deletePromises);
		const failures = results.filter(res => res.status !== 'confirmed');

		if (failures.length === 0) {
			openPopUp(t('Success'), t('Deleted {{count}} rule(s) successfully.', {count: selectedItems.length}), t('OK'));
			set_selected_rows([]);
			setTimeout(() => refetch(), 1000);
		} else if (failures.length < results.length) {
			// Partial success
			openPopUp(t('Warning'), t('{{success}} succeeded, {{failed}} failed.', {success: results.length - failures.length, failed: failures.length}), t('OK'));
			set_selected_rows([]);
			setTimeout(() => refetch(), 1000);
		} else {
			// All failed
			openPopUp(t('Error'), t('Failed to delete. {{error}}', {error: t(failures[0].localeKey)}), t('OK'));
		}
	};

	const handleAdd = () => {
		if (!inst) return;

		const input_form = (
			<IPFilterInputForm
				key={Date.now()}
				onChange={data => {
					formRef.current = data;
					enableYes(data.isValid || false);
				}}
			/>
		);

		openPopUp(
			'',
			input_form,
			t('Add'),
			t('Cancel'),
			async () => {
				if (!formRef.current) return;

				const res = await request_create_ipfilter_rule(inst, formRef.current);
				if (res.status === 'confirmed') {
					openPopUp(t('Success'), t('IP filter rule added successfully.'), t('OK'));
					setTimeout(() => refetch(), 1000);
				} else {
					openPopUp(t('Error'), t('Failed to add. {{error}}', {error: t(res.localeKey)}), t('OK'));
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
			<IPFilterTable
				data={entries}
				selected_rows={selected_rows}
				onChangeSelectedRows={handleSelectionChange}
				onAdd={handleAdd}
				onDelete={selected_rows.length > 0 ? handleDelete : undefined}
				onRefresh={handleRefresh}
				error={isError}
			/>
			{selectedItem && (
				<LowerSection>
					<DetailPanel entry={selectedItem} />
				</LowerSection>
			)}
		</Fragment>
	);
}
