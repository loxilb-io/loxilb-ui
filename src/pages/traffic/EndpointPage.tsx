//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Stack} from '@mui/material';
import { getStableHash } from 'common';
import SingleTextBox from 'components/element/SingleTextBox';
import EndpointInputForm from 'components/input/EndpointInputForm';
import HorizontalStack from 'components/layout/HorizontalStack';
import LowerSection from 'components/layout/LowerSection';
import ErrorPopUp from 'components/modal/ErrorPopUp';
import SubTitlePannel from 'components/layout/SubTitlePannel';
import EndpointTable from 'components/table/traffic/EndpointTable';
import {request_create_endpoint, request_delete_endpoint_by_ip} from 'connector/instance/endpoint';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {usePopUp} from 'hooks/popupHook';
import {useErrorPopup} from 'hooks/useErrorPopup';
import {useEndpoints} from 'hooks/query/queryHooks';
import {t} from 'i18next';
import {Fragment, useEffect, useRef, useState, useMemo} from 'react';
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
	const {errorPopup, showAddError, showUpdateError, showDeleteError, closeErrorPopup} = useErrorPopup();

	// Hash function for endpoint
	const getHashKey = (item: any) => {
		const str = `${item.name || ''}_${item.hostName || ''}_${item.probePort || ''}_${item.probeType || ''}`;
		return getStableHash(str);
	};

	// Sorted endpoints
	const sortedAttr = ep_info.Attr ? [...ep_info.Attr].sort((a, b) => getHashKey(a) - getHashKey(b)) : [];

	// Map selected original indices to sorted indices for display
	const selectedSortedIndices = useMemo(() => {
		if (!ep_info.Attr || selected_rows.length === 0) return [];
		
		return selected_rows
			.map(originalIdx => {
				const original = ep_info.Attr[originalIdx];
				return sortedAttr.findIndex(attr => getHashKey(attr) === getHashKey(original));
			})
			.filter(idx => idx !== -1);
	}, [selected_rows, ep_info.Attr, sortedAttr]);

	// Find single selected index for detail panel
	const selected_index = selectedSortedIndices.length === 1 ? selectedSortedIndices[0] : 
		(selected_key ? sortedAttr.findIndex(attr => getHashKey(attr).toString() === selected_key) : -1);

	// Selection handler: map sorted indices back to original indices
	const handleSelectionChange = (indices: number[]) => {
		if (!ep_info.Attr) {
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
				return ep_info.Attr.findIndex(attr => getHashKey(attr) === getHashKey(sortedItem));
			})
			.filter(idx => idx !== -1);

		set_selected_rows(originalIndices);
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
		if (!inst || selected_rows.length === 0) return;

		const results = await Promise.all(selected_rows.map(rowIndex => request_delete_endpoint_by_ip(inst, ep_info.Attr[rowIndex])));
		const failures = results.filter(res => res.status === 'error');

		if (failures.length === 0) {
			openPopUp(t('Success'), t('Deleted {{count}} item(s) successfully.', {count: results.length}), t('OK'));
		} else if (failures.length < results.length) {
			showDeleteError('endpoint', `${results.length - failures.length} succeeded, ${failures.length} failed: ${failures[0].error}`);
		} else {
			showDeleteError('endpoint', failures[0].error);
			return;
		}
		set_selected_rows([]);
		setTimeout(() => {
			refetch();
		}, 1000);
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
				} else showAddError('endpoint', res.error);
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
					showUpdateError('endpoint', res.error);
				}
			},
			true,
		);
	};

	const handleRefresh = () => {
		set_selected_rows([]);
		set_selected_key(null);
		setSelectedItem(null);
		refetch();
	};

	return (
		<Fragment>
			<EndpointTable
				data={{Attr: sortedAttr}}
				selected_rows={selectedSortedIndices}
				onChangeSelectedRows={handleSelectionChange}
				onAdd={handleAdd}
				onDelete={handleDelete}
				onUpdate={handleUpdate}
				onRefresh={handleRefresh}
			/>

			{selected_index !== -1 && selectedItem && (
				<LowerSection>
					<ProbeInfoPanel name={sortedAttr[selected_index].name} data={sortedAttr[selected_index]} />
				</LowerSection>
			)}

			{/* Error Popup */}
			<ErrorPopUp
				isOpen={errorPopup.isOpen}
				onClose={closeErrorPopup}
				title={errorPopup.title}
				mainMessage={errorPopup.mainMessage}
				errorData={errorPopup.errorData}
				buttonText={t('OK')}
			/>
		</Fragment>
	);
}
