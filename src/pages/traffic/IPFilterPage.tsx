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
	const entries: IIPFilterEntry[] = data ?? [];

	const [selected_rows, set_selected_rows] = useState<number[]>([]);
	const {openPopUp, enableYes} = usePopUp();
	const formRef = useRef<IIPFilterEntry | null>(null);

	// Hash function for IP filter rule
	const getHashKey = (item: IIPFilterEntry) => {
		const str = `${item.filterType}_${item.cidr}_${item.zone ?? 0}_${item.priority ?? 100}`;
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

	const handleDelete = async () => {
		if (!inst || selected_rows.length === 0) return;

		// Delete multiple selected IP filter rules
		const deletePromises = selected_rows.map(async (rowIndex) => {
			const item = entries[rowIndex];
			return request_delete_ipfilter_rule(inst, {
				filterType: item.filterType,
				cidr: item.cidr,
				zone: item.zone,
			});
		});

		const results = await Promise.all(deletePromises);
		const failures = results.filter(res => res.status === 'error');

		if (failures.length === 0) {
			openPopUp(t('Success'), t('Deleted {{count}} rule(s) successfully.', {count: selected_rows.length}), t('OK'));
			set_selected_rows([]);
			setTimeout(() => refetch(), 1000);
		} else if (failures.length < results.length) {
			// Partial success
			openPopUp(t('Warning'), t('{{success}} succeeded, {{failed}} failed.', {success: results.length - failures.length, failed: failures.length}), t('OK'));
			set_selected_rows([]);
			setTimeout(() => refetch(), 1000);
		} else {
			// All failed
			openPopUp(t('Error'), t('Failed to delete. {{error}}', {error: failures[0].error}), t('OK'));
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
				if (res.status === 'success') {
					openPopUp(t('Success'), t('IP filter rule added successfully.'), t('OK'));
					setTimeout(() => refetch(), 1000);
				} else {
					openPopUp(t('Error'), t('Failed to add. {{error}}', {error: res.error}), t('OK'));
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
				data={sortedEntries}
				selected_rows={selectedSortedIndices}
				onChangeSelectedRows={handleSelectionChange}
				onAdd={handleAdd}
				onDelete={selected_rows.length > 0 ? handleDelete : undefined}
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
