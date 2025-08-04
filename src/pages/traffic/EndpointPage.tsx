//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Stack} from '@mui/material';
import SingleTextBox from 'components/element/SingleTextBox';
import EndpointInputForm from 'components/input/EndpointInputForm';
import HorizontalStack from 'components/layout/HorizontalStack';
import LowerSection from 'components/layout/LowerSection';
import SubTitlePannel from 'components/layout/SubTitlePannel';
import EndpointTable from 'components/table/traffic/EndpointTable';
import {request_create_endpoint, request_delete_endpoint_by_ip} from 'connector/instance/endpoint';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {usePopUp} from 'hooks/popupHook';
import {useEndpoints} from 'hooks/query/queryHooks';
import {t} from 'i18next';
import {Fragment, useRef, useState} from 'react';
import {IEndpointAttr, IEndpointInput, IEndpointItem} from 'types/endpoint';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
function ProbeInfoPanel(props: {name: string; data: IEndpointItem}) {
	const {name, data} = props;

	return (
		<SubTitlePannel title={name} sub_title={t('Probe Information')}>
			<Stack spacing={2}>
				<HorizontalStack align="flex-start">
					<SingleTextBox label={t('Port')} value={data.probePort} />
					<SingleTextBox label={t('Type')} value={data.probeType} />
				</HorizontalStack>

				<HorizontalStack align="flex-start">
					<SingleTextBox label={t('Request')} value={data.probeReq} />
					<SingleTextBox label={t('Response')} value={data.probeResp} />
				</HorizontalStack>

				<SingleTextBox label={t('Duration')} value={data.probeDuration && data.probeDuration.toLocaleString() + 'ms'} />

				<HorizontalStack align="flex-start">
					<SingleTextBox label={t('Min Delay')} value={data.minDelay} />
					<SingleTextBox label={t('Avg Delay')} value={data.avgDelay} />
					<SingleTextBox label={t('Max Delay')} value={data.maxDelay} />
				</HorizontalStack>
			</Stack>
		</SubTitlePannel>
	);
}

export default function EndpointPage() {
	const inst = useInstanceFromURL();

	const {data, refetch} = useEndpoints(inst);
	const ep_info: IEndpointAttr = {Attr: data ?? []};

	const [selected_rows, set_selected_rows] = useState<number[]>([]);
	const {openPopUp, enableYes} = usePopUp();

	const handleSelectionChange = (selection: any) => set_selected_rows(selection);

	const handleDelete = async () => {
		if (!inst) return;

		const item = ep_info.Attr[selected_rows[0]];
		const res = await request_delete_endpoint_by_ip(inst, item);
		if (res.status === 'success') {
			openPopUp(t('Success'), t('Deleted successfully.'), t('OK'));
			set_selected_rows([]);
			refetch();
		} else openPopUp(t('Error'), t('Failed to delete. {{error}}', {error: res.error}), t('OK'));
	};

	const instanceRef = useRef<IEndpointInput | null>(null);
	const handleAdd = () => {
		if (!inst) return;

		const input_form = (
			<EndpointInputForm
				key={Date.now()}
				onChange={data => {
					instanceRef.current = data;
					enableYes(!!data && data.hostName !== '');
				}}
			/>
		);

		openPopUp(
			'',
			input_form,
			t('Add'),
			t('Cancel'),
			async () => {
				if (!instanceRef.current) return;

				const res = await request_create_endpoint(inst, instanceRef.current);
				if (res.status === 'success') {
					openPopUp(t('Success'), t('Added successfully.'), t('OK'));
					refetch();
				} else openPopUp(t('Error'), t('Failed to add. {{error}}', {error: res.error}), t('OK'));
			},
			true,
		);
	};

	return (
		<Fragment>
			<EndpointTable data={ep_info} selected_rows={selected_rows} onChangeSelectedRows={handleSelectionChange} onAdd={handleAdd} onDelete={handleDelete} />

			{selected_rows.length === 1 && (
				<LowerSection>
					<ProbeInfoPanel name={ep_info.Attr[selected_rows[0]].name} data={ep_info.Attr[selected_rows[0]]} />
				</LowerSection>
			)}
		</Fragment>
	);
}
