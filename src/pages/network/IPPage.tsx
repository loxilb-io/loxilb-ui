//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {getStableHash, isValidIPAddressCidr} from 'common';
import ChipField from 'components/element/ChipField';
import IpInputForm from 'components/input/IPInputForm';
import LowerSection from 'components/layout/LowerSection';
import ErrorPopUp from 'components/modal/ErrorPopUp';
import SubTitlePannel from 'components/layout/SubTitlePannel';
import IPTable from 'components/table/networks/IPTable';
import IPAddressView from 'components/view/IPAddressView';
import {request_create_ipv4, request_create_ipv6, request_delete_ipv4, request_delete_ipv6} from 'connector/instance/ip';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {usePopUp} from 'hooks/popupHook';
import {useErrorPopup} from 'hooks/useErrorPopup';
import {useIPAttr} from 'hooks/query/queryHooks';
import {t} from 'i18next';
import {Fragment, useRef, useState, useMemo} from 'react';
import {IIpAttribute, IIpAttributeInput, IIpData} from 'types/ip';
import {toPageState} from 'components/state/pageState';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
function AddressPannel(props: {name: string; data: IIpAttribute}) {
	const {name, data} = props;

	return (
		<SubTitlePannel title={name} sub_title={t('IP Addresses')}>
			<ChipField label={t('Values')} item_list={data.ipAddress} />
		</SubTitlePannel>
	);
}

export default function IPPage(props: {family?: 'ipv4' | 'ipv6'}) {
	const family = props.family ?? 'ipv4';
	const request_create_ip = family === 'ipv6' ? request_create_ipv6 : request_create_ipv4;
	const request_delete_ip = family === 'ipv6' ? request_delete_ipv6 : request_delete_ipv4;
	const inst = useInstanceFromURL();

	const ip_query = useIPAttr(inst, family);
	const {data, refetch} = ip_query; // IIpAttribute[]
	
	// Transform data: split entries with multiple IPs into separate entries
	const ip_info: IIpData = useMemo(() => {
		if (!data) return {ipAttr: []};
		
		const expandedAttr: IIpAttribute[] = [];
		
		data.forEach(attr => {
			if (attr.ipAddress && attr.ipAddress.length > 0) {
				// Create one entry for each IP address
				attr.ipAddress.forEach(ip => {
					expandedAttr.push({
						...attr,
						ipAddress: [ip]
					});
				});
			} else {
				// If no IP addresses, keep the entry as is
				expandedAttr.push(attr);
			}
		});
		
		return {ipAttr: expandedAttr};
	}, [data]);
	
	const instanceRef = useRef<IIpAttributeInput | null>(null);

	const [selected_rows, set_selected_rows] = useState<number[]>([]); // holds hash ids
	const {openPopUp, enableYes} = usePopUp();
	const {errorPopup, showAddError, showDeleteError, closeErrorPopup} = useErrorPopup();

	// Hash function for IP entry
	 const getHashKey = (item: any) => {
		   const str = `${item.dev || ''}_${item.ipAddress.join(', ') || ''}`;
		   return getStableHash(str);
	   };

	// Resolve selected items by matching the stable hash
	const selectedItems = useMemo(
		() => selected_rows.map(h => ip_info.ipAttr.find(a => getHashKey(a) === h)).filter((x): x is IIpAttribute => x != null),
		[selected_rows, ip_info.ipAttr],
	);
	const selectedItem: IIpAttribute | null = selectedItems.length === 1 ? selectedItems[0] : null;

	// Selection handler: page holds hash ids directly
	const handleSelectionChange = (hashes: number[]) => set_selected_rows(hashes);

	const handleDelete = async () => {
		if (!inst || selectedItems.length === 0) return;

		const targets = selectedItems.filter(item => item && item.ipAddress && item.ipAddress[0]);
		if (targets.length === 0) return;

		const results = await Promise.all(
			targets.map(item => {
				const [ip, maskStr] = item.ipAddress[0].split('/');
				return request_delete_ip(inst, ip, parseInt(maskStr, 10), item.dev);
			}),
		);
		const failures = results.filter(res => res.status !== 'confirmed');

		if (failures.length === 0) {
			openPopUp(t('Success'), t('Deleted {{count}} item(s) successfully.', {count: results.length}), t('OK'));
		} else if (failures.length < results.length) {
			showDeleteError('IP address', t('{{succeeded}} succeeded, {{failed}} failed. {{error}}', {succeeded: results.length - failures.length, failed: failures.length, error: t(failures[0].localeKey)}));
		} else {
			showDeleteError('IP address', t(failures[0].localeKey));
			return;
		}
		set_selected_rows([]);
		setTimeout(() => {
			refetch();
		}, 1000);
	};

	// eslint-disable-next-line @typescript-eslint/no-unused-vars -- parked feature code kept for re-enablement; remove the disable when it is wired back up or deleted
	const handleAdd = () => {
		if (!inst) return;
		const input_form = (
			<IpInputForm
				onChange={data => {
					instanceRef.current = data;
					enableYes(!!data.dev && isValidIPAddressCidr(data.ipAddress));
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
				const res = await request_create_ip(inst, instanceRef.current);
				if (res.status === 'confirmed') {
					openPopUp(t('Success'), t('Added successfully.'), t('OK'));
					setTimeout(() => {
						refetch();
					}, 1000);
				} else showAddError('IP address', t(res.localeKey));
			},
			true,
		);
	};

	const updateFormRef = useRef<IIpAttributeInput | null>(null);
	const handleUpdate = () => {
		if (!inst || !selectedItem) return;

		const selectedIP = selectedItem;

		// Convert selected IP to format expected by IpInputForm
		const formData: Partial<IIpAttributeInput> = {
			dev: selectedIP.dev,
			ipAddress: selectedIP.ipAddress[0] || '', // Use first IP address
		};
		
		const update_form = (
			<IpInputForm
				initialData={formData}
				isEdit={true}
				onChange={data => {
					updateFormRef.current = data;
					enableYes(isValidIPAddressCidr(data.ipAddress));
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
				
				// Ensure device name is included
				const updateData: IIpAttributeInput = {
					dev: formData.dev!,
					ipAddress: updateFormRef.current.ipAddress
				};
				
				// Use same API as create
				const res = await request_create_ip(inst, updateData);
				if (res.status === 'confirmed') {
					openPopUp(t('Success'), t('IP address updated successfully.'), t('OK'));
					setTimeout(() => {
						refetch();
					}, 1000);
				} else {
					showAddError('IP address', t(res.localeKey));
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
			<IPTable
				title={family === 'ipv6' ? t('IPv6 Address') : undefined}
				data={ip_info}
				selected_rows={selected_rows}
				onChangeSelectedRows={handleSelectionChange}
				onDelete={handleDelete}
				onUpdate={handleUpdate}
				onRefresh={handleRefresh}
				state={toPageState(ip_query, {op: 'ip_address.list'})}
			/>

			{selectedItem && (
				<LowerSection>
					{false && <AddressPannel name={selectedItem!.dev} data={selectedItem!} />}
					<IPAddressView device_name={selectedItem.dev} />
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
