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
import {Fragment, useRef, useState, useMemo} from 'react';
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

	const {data, isError, refetch} = useEndpoints(inst);
	const ep_info: IEndpointAttr = {Attr: data ?? []};

	// Selection is keyed by a stable content hash (the same id the table assigns
	// to each row), not by array position — so a background refetch or re-sort
	// can't shift the selection onto a different endpoint or silently drop it.
	const [selected_rows, set_selected_rows] = useState<number[]>([]);
	const {openPopUp, enableYes} = usePopUp();
	const {errorPopup, showAddError, showUpdateError, showDeleteError, closeErrorPopup} = useErrorPopup();

	// Hash function for endpoint — must match EndpointTable's row id.
	const getHashKey = (item: any) => {
		const str = `${item.name || ''}_${item.hostName || ''}_${item.probePort || ''}_${item.probeType || ''}`;
		return getStableHash(str);
	};

	// Resolve the selected hashes back to their endpoint items.
	const selectedItems = useMemo(
		() => selected_rows.map(hash => ep_info.Attr.find(attr => getHashKey(attr) === hash)).filter((item): item is IEndpointItem => item != null),
		[selected_rows, ep_info.Attr],
	);
	const selectedItem: IEndpointItem | null = selectedItems.length === 1 ? selectedItems[0] : null;

	const handleSelectionChange = (hashes: number[]) => set_selected_rows(hashes);

	const handleDelete = async () => {
		if (!inst || selectedItems.length === 0) return;

		const results = await Promise.all(selectedItems.map(item => request_delete_endpoint_by_ip(inst, item)));
		// A rule-referenced endpoint's rejected delete now maps to failed on
		// every transport (body sniff, not reason-phrase sniff — UI-P6-1 D7).
		const failures = results.filter(res => res.status !== 'confirmed');

		if (failures.length === 0) {
			openPopUp(t('Success'), t('Deleted {{count}} item(s) successfully.', {count: results.length}), t('OK'));
		} else if (failures.length < results.length) {
			showDeleteError('endpoint', t('{{succeeded}} succeeded, {{failed}} failed. {{error}}', {succeeded: results.length - failures.length, failed: failures.length, error: t(failures[0].localeKey)}));
		} else {
			showDeleteError('endpoint', t(failures[0].localeKey));
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
				if (res.status === 'confirmed') {
					openPopUp(t('Success'), t('Added successfully.'), t('OK'));
					setTimeout(() => {
						refetch();
					}, 1000);
				} else showAddError('endpoint', t(res.localeKey));
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
				if (res.status === 'confirmed') {
					openPopUp(t('Success'), t('Endpoint updated successfully.'), t('OK'));
					setTimeout(() => {
						refetch();
					}, 1000);
				} else {
					showUpdateError('endpoint', t(res.localeKey));
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
			<EndpointTable
				data={ep_info}
				selected_rows={selected_rows}
				onChangeSelectedRows={handleSelectionChange}
				onAdd={handleAdd}
				onDelete={handleDelete}
				onUpdate={handleUpdate}
				onRefresh={handleRefresh}
				error={isError}
			/>

			{selectedItem && (
				<LowerSection>
					<ProbeInfoPanel name={selectedItem.name} data={selectedItem} />
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
