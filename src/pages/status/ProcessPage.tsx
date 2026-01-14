//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Stack} from '@mui/material';
import {getStableHash} from 'common';
import SingleTextBox from 'components/element/SingleTextBox';
import SubTitleBar from 'components/element/SubTitleBar';
import ValueBunch from 'components/element/ValueBunch';
import LowerSection from 'components/layout/LowerSection';
import ProcessTable from 'components/table/status/ProcessTable';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {useStatus} from 'hooks/query/statusHook';
import {t} from 'i18next';
import {Fragment, useState, useMemo} from 'react';
import {IProcessAttribute, IProcessInfo} from 'types/process';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
function ProcessPanel(props: {data: IProcessAttribute}) {
	const {data} = props;

	return (
		<Stack spacing={2}>
			<SubTitleBar title={data.pid.toString()} sub_title={t('Details')} />

			<Stack spacing={3}>
				<ValueBunch name={t('Resource Usage')}>
					<SingleTextBox label={t('CPU Usage')} value={data.CPUUsage} />
					<SingleTextBox label={t('Runtime')} value={data.time} />
				</ValueBunch>

				<ValueBunch name={t('Memory Status')}>
					<SingleTextBox label={t('Virtual Memory')} value={data.virtMemory} />
					<SingleTextBox label={t('Resident Size')} value={data.residentSize} />
					<SingleTextBox label={t('Shared Memory')} value={data.sharedMemory} />
					<SingleTextBox label={t('Memory Usage')} value={data.MemoryUsage} />
				</ValueBunch>

				<ValueBunch name={t('Process Details')}>
					<SingleTextBox label={t('Command')} value={data.command} />
				</ValueBunch>

				<ValueBunch name={t('Process Priority')}>
					<SingleTextBox label={t('Priority')} value={data.priority} />
					<SingleTextBox label={t('NICE')} value={data.nice} />
				</ValueBunch>
			</Stack>
		</Stack>
	);
}

export default function ProcessPage() {
	const inst = useInstanceFromURL();

	const {processAttr, refetch} = useStatus(inst);
	const process_info: IProcessInfo = {processAttr: processAttr ?? []};

	const [selected_rows, set_selected_rows] = useState<number[]>([]);
	const [selected_key, set_selected_key] = useState<string | null>(null);

	// Hash function for Process entry
	const getHashKey = (item: any) => {
		const str = `${item.pid || ''}_${item.command || ''}`;
		return getStableHash(str);
	};

	// Sorted process entries - sort by PID numerically for natural order
	const sortedAttr = useMemo(() => {
		if (!process_info.processAttr) return [];
		return [...process_info.processAttr].sort((a, b) => {
			const pidA = parseInt(a.pid, 10);
			const pidB = parseInt(b.pid, 10);
			return pidA - pidB;
		});
	}, [process_info.processAttr]);

	// Map selected original indices to sorted indices for display
	const selectedSortedIndices = useMemo(() => {
		if (!process_info.processAttr || selected_rows.length === 0) return [];
		
		return selected_rows
			.map(originalIdx => {
				const original = process_info.processAttr[originalIdx];
				return sortedAttr.findIndex(attr => String(getHashKey(attr)) === String(getHashKey(original)));
			})
			.filter(idx => idx !== -1);
	}, [selected_rows, process_info.processAttr, sortedAttr]);

	// Find single selected index for detail panel
	const selected_index = selectedSortedIndices.length === 1 ? selectedSortedIndices[0] : 
		(selected_key ? sortedAttr.findIndex(attr => String(getHashKey(attr)) === selected_key) : -1);

	// Selection handler: map sorted indices back to original indices
	const handleSelectionChange = (indices: number[]) => {
		if (!process_info.processAttr) {
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
				const sortedItem = sortedAttr[sortedIdx];
				return process_info.processAttr.findIndex(attr => String(getHashKey(attr)) === String(getHashKey(sortedItem)));
			})
			.filter(idx => idx !== -1);

		set_selected_rows(originalIndices);
	};

	const handleRefresh = () => {
		set_selected_rows([]);
		set_selected_key(null);
		refetch();
	};

	// Synchronize selected_key with selected_rows
	useMemo(() => {
		if (!process_info.processAttr || process_info.processAttr.length === 0) return;
		if (selected_rows.length === 1) {
			const item = process_info.processAttr[selected_rows[0]];
			set_selected_key(String(getHashKey(item)));
		} else if (selected_key !== null) {
			set_selected_key(null);
		}
	}, [process_info, selected_rows, selected_key]);

	return (
		<Fragment>
			<ProcessTable 
				data={{processAttr: sortedAttr}} 
				selected_rows={selectedSortedIndices} 
				onChangeSelectedRows={handleSelectionChange} 
				onRefresh={handleRefresh} 
			/>

			{selected_index !== -1 && (
				<LowerSection>
					<ProcessPanel data={sortedAttr[selected_index]} />
				</LowerSection>
			)}
		</Fragment>
	);
}
