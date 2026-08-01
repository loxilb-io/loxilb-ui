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

	const {processAttr, psError, refetch} = useStatus(inst);
	const process_info: IProcessInfo = {processAttr: processAttr ?? []};

	// Selection is keyed by a stable content hash (the row id assigned by
	// ProcessTable), not by array position. Deriving the selected item purely
	// (no setState in render) also sidesteps the old "Too many re-renders"
	// crash that a state-syncing useMemo caused here (F-STATUS-4).
	const [selected_rows, set_selected_rows] = useState<number[]>([]);

	// Hash function for Process entry — must match ProcessTable's row id.
	const getHashKey = (item: any) => {
		const str = `${item.pid || ''}_${item.command || ''}`;
		return getStableHash(str);
	};

	// Resolve the selected hashes back to their process entries.
	const selectedItems = useMemo(
		() => selected_rows.map(hash => process_info.processAttr.find(attr => getHashKey(attr) === hash)).filter((item): item is IProcessAttribute => item != null),
		[selected_rows, process_info.processAttr],
	);
	const selectedItem: IProcessAttribute | null = selectedItems.length === 1 ? selectedItems[0] : null;

	const handleSelectionChange = (hashes: number[]) => set_selected_rows(hashes);

	const handleRefresh = () => {
		set_selected_rows([]);
		refetch();
	};

	return (
		<Fragment>
			<ProcessTable
				data={process_info}
				selected_rows={selected_rows}
				onChangeSelectedRows={handleSelectionChange}
				onRefresh={handleRefresh}
				error={!!psError}
			/>

			{selectedItem && (
				<LowerSection>
					<ProcessPanel data={selectedItem} />
				</LowerSection>
			)}
		</Fragment>
	);
}
