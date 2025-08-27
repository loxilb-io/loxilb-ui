//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Stack} from '@mui/material';
import { getStableHash } from 'common';
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
import {Fragment, useEffect, useRef, useState} from 'react';
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
	const [selected_key, set_selected_key] = useState<string | null>(null);
	const {openPopUp, enableYes} = usePopUp();

	// Hash function for endpoint
	const getHashKey = (item: any) => {
		const str = `${item.name || ''}_${item.hostName || ''}_${item.probePort || ''}_${item.probeType || ''}`;
		return getStableHash(str);
	};

	// Sorted endpoints
	const sortedAttr = ep_info.Attr ? [...ep_info.Attr].sort((a, b) => getHashKey(a) - getHashKey(b)) : [];

	// Find selected index in sortedAttr
	let selected_index = -1;
	if (selected_rows.length === 1 && ep_info.Attr) {
		const original = ep_info.Attr[selected_rows[0]];
		selected_index = sortedAttr.findIndex(attr => getHashKey(attr) === getHashKey(original));
	} else if (selected_key) {
		selected_index = sortedAttr.findIndex(attr => getHashKey(attr).toString() === selected_key);
	}

	// Selection handler: map sorted index back to original
	const handleSelectionChange = (indices: number[]) => {
		if (indices.length === 1 && ep_info.Attr) {
			const sortedItem = sortedAttr[indices[0]];
			const originalIndex = ep_info.Attr.findIndex(attr => getHashKey(attr) === getHashKey(sortedItem));
			set_selected_rows(originalIndex !== -1 ? [originalIndex] : []);
		} else {
			set_selected_rows([]);
		}
	};

	const [selectedItem, setSelectedItem] = useState<IEndpointItem | null>(null);
	useEffect(() => {
		if (!ep_info || ep_info.Attr.length === 0) return;
		if (selected_rows.length === 1) {
			const item = ep_info.Attr[selected_rows[0]];
			set_selected_key(getHashKey(item).toString());
			setSelectedItem(item ?? null);
		} else if (selected_key !== null) {
			set_selected_key(null);
			setSelectedItem(null);
		}
	}, [ep_info, selected_rows, selected_key]);

	const handleDelete = async () => {
		if (!inst || !selectedItem) return;

		const res = await request_delete_endpoint_by_ip(inst, selectedItem);
		if (res.status === 'success') {
			openPopUp(t('Success'), t('Deleted successfully.'), t('OK'));
			set_selected_rows([]);
			setTimeout(() => {
				refetch();
			}, 1000);
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
					// enableYes(!!data && data.hostName !== '');
					enableYes(data.isValid)
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
					setTimeout(() => {
						refetch();
					}, 1000);
				} else openPopUp(t('Error'), t('Failed to add. {{error}}', {error: res.error}), t('OK'));
			},
			true,
		);
	};

	// Update handler for endpoints
	const updateFormRef = useRef<IEndpointInput | null>(null);
	const handleUpdate = () => {
		if (!inst || !selectedItem) return;

		// Convert IEndpointItem to format expected by EndpointInputForm
		const formData: Partial<IEndpointInput> = {
			hostName: selectedItem.hostName,
			name: selectedItem.name,
			inactiveReTries: selectedItem.inactiveReTries,
			probeType: selectedItem.probeType,
			probeDuration: selectedItem.probeDuration,
			probePort: selectedItem.probePort,
			probeReq: selectedItem.probeReq,
			probeResp: selectedItem.probeResp,
		};

		const update_form = (
			<EndpointInputForm
				key={Date.now()}
				initialData={formData}
				isEdit={true}
				onChange={data => {
					updateFormRef.current = data;
					enableYes(data.isValid);
				}}
			/>
		);

		openPopUp(
			'',
			update_form,
			t('Update'),
			t('Cancel'),
			async () => {
				if (!updateFormRef.current) return;

				// Use POST API with same function as create (as requested by user)
				const res = await request_create_endpoint(inst, updateFormRef.current);
				if (res.status === 'success') {
					openPopUp(t('Success'), t('Endpoint updated successfully.'), t('OK'));
					setTimeout(() => {
						refetch();
					}, 1000);
				} else {
					openPopUp(t('Error'), t('Failed to update endpoint. {{error}}', {error: res.error}), t('OK'));
				}
			},
			true,
		);
	};

	return (
		<Fragment>
			<EndpointTable
				data={{Attr: sortedAttr}}
				selected_rows={selected_index !== -1 ? [selected_index] : []}
				onChangeSelectedRows={handleSelectionChange}
				onAdd={handleAdd}
				onDelete={handleDelete}
				onUpdate={handleUpdate}
				onRefresh={refetch}
			/>

			{selected_index !== -1 && selectedItem && (
				<LowerSection>
					<ProbeInfoPanel name={sortedAttr[selected_index].name} data={sortedAttr[selected_index]} />
				</LowerSection>
			)}
		</Fragment>
	);
}
