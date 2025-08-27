//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Stack} from '@mui/material';
import SingleTextBox from 'components/element/SingleTextBox';
import SubTitleBar from 'components/element/SubTitleBar';
import ValueBunch from 'components/element/ValueBunch';
import LowerSection from 'components/layout/LowerSection';
import ProcessTable from 'components/table/status/ProcessTable';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {useStatus} from 'hooks/query/statusHook';
import {t} from 'i18next';
import {Fragment, useState} from 'react';
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

	const {processAttr} = useStatus(inst);
	const process_info: IProcessInfo = {processAttr: processAttr ?? []};

	const [selected_rows, set_selected_rows] = useState<number[]>([]);

	// Since useStatus currently uses real API data for process, create a simple refresh function
	const handleRefresh = () => {
		// For now, this will just trigger a re-render
		// When the real API refetch is available, this should call the actual refetch function
		console.log('Refreshing process data...');
	};

	return (
		<Fragment>
			<ProcessTable data={process_info} selected_rows={selected_rows} onChangeSelectedRows={set_selected_rows} onRefresh={handleRefresh} />

			{selected_rows.length === 1 && (
				<LowerSection>
					<ProcessPanel data={process_info.processAttr[selected_rows[0]]} />
				</LowerSection>
			)}
		</Fragment>
	);
}
