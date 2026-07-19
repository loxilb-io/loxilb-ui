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
import {Fragment, useRef, useState, useEffect, useMemo} from 'react';
import {IIpAttribute, IIpAttributeInput, IIpData} from 'types/ip';

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

	const {data, isError, refetch} = useIPAttr(inst, family); // IIpAttribute[]
	
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

	const [selected_rows, set_selected_rows] = useState<number[]>([]);
	const [selected_key, set_selected_key] = useState<string | null>(null);
	const {openPopUp, enableYes} = usePopUp();
	const {errorPopup, showAddError, showDeleteError, closeErrorPopup} = useErrorPopup();

	// Hash function for IP entry
	 const getHashKey = (item: any) => {
		   const str = `${item.dev || ''}_${item.ipAddress.join(', ') || ''}`;
		   return getStableHash(str);
	   };

	// Sorted IP entries - sort by device name alphabetically for natural order
	const sortedAttr = ip_info.ipAttr ? [...ip_info.ipAttr].sort((a, b) => {
		const devCompare = (a.dev || '').localeCompare(b.dev || '');
		if (devCompare !== 0) return devCompare;
		// If same device, sort by first IP address
		const ipA = a.ipAddress?.[0] || '';
		const ipB = b.ipAddress?.[0] || '';
		return ipA.localeCompare(ipB);
	}) : [];

	// Map selected original indices to sorted indices for display
	const selectedSortedIndices = useMemo(() => {
		if (!ip_info.ipAttr || selected_rows.length === 0) return [];
		
		return selected_rows
			.map(originalIdx => {
				const original = ip_info.ipAttr[originalIdx];
				return sortedAttr.findIndex(attr => String(getHashKey(attr)) === String(getHashKey(original)));
			})
			.filter(idx => idx !== -1);
	}, [selected_rows, ip_info.ipAttr, sortedAttr]);

	// Find single selected index for detail panel
	const selected_index = selectedSortedIndices.length === 1 ? selectedSortedIndices[0] : 
		(selected_key ? sortedAttr.findIndex(attr => String(getHashKey(attr)) === selected_key) : -1);

	// Selection handler: map sorted indices back to original indices
	const handleSelectionChange = (indices: number[]) => {
		if (!ip_info.ipAttr) {
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
				return ip_info.ipAttr.findIndex(attr => String(getHashKey(attr)) === String(getHashKey(sortedItem)));
			})
			.filter(idx => idx !== -1);

		set_selected_rows(originalIndices);
	};

	const handleDelete = async () => {
		if (!inst || selected_rows.length === 0) return;

		const targets = selected_rows
			.map(rowIndex => ip_info.ipAttr[rowIndex])
			.filter(item => item && item.ipAddress && item.ipAddress[0]);
		if (targets.length === 0) return;

		const results = await Promise.all(
			targets.map(item => {
				const [ip, maskStr] = item.ipAddress[0].split('/');
				return request_delete_ip(inst, ip, parseInt(maskStr, 10), item.dev);
			}),
		);
		const failures = results.filter(res => res.status === 'error');

		if (failures.length === 0) {
			openPopUp(t('Success'), t('Deleted {{count}} item(s) successfully.', {count: results.length}), t('OK'));
		} else if (failures.length < results.length) {
			showDeleteError('IP address', `${results.length - failures.length} succeeded, ${failures.length} failed: ${failures[0].error}`);
		} else {
			showDeleteError('IP address', failures[0].error);
			return;
		}
		set_selected_rows([]);
		setTimeout(() => {
			refetch();
		}, 1000);
	};

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
				if (res.status === 'success') {
					openPopUp(t('Success'), t('Added successfully.'), t('OK'));
					setTimeout(() => {
						refetch();
					}, 1000);
				} else showAddError('IP address', res.error);
			},
			true,
		);
	};

	const updateFormRef = useRef<IIpAttributeInput | null>(null);
	const handleUpdate = () => {
		if (!inst || selected_rows.length !== 1) return;

		const selectedIP = ip_info.ipAttr[selected_rows[0]];
		
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
				if (res.status === 'success') {
					openPopUp(t('Success'), t('IP address updated successfully.'), t('OK'));
					setTimeout(() => {
						refetch();
					}, 1000);
				} else {
					showAddError('IP address', res.error);
				}
			},
			true,
		);
	};

	const handleRefresh = () => {
		set_selected_rows([]);
		set_selected_key(null);
		refetch();
	};

	// Clear selection when data changes (after refresh)
	useEffect(() => {
		if (!ip_info.ipAttr || ip_info.ipAttr.length === 0) {
			set_selected_rows([]);
			set_selected_key(null);
			return;
		}
		
		// Validate that selected indices still point to the same items
		if (selected_rows.length > 0) {
			const validIndices = selected_rows.filter(idx => {
				return idx >= 0 && idx < ip_info.ipAttr.length;
			});
			
			if (validIndices.length !== selected_rows.length) {
				// Some indices are invalid, clear selection
				set_selected_rows([]);
				set_selected_key(null);
			}
		}
	}, [ip_info.ipAttr]);

	// Synchronize selected_key with selected_rows
	useEffect(() => {
		if (!ip_info.ipAttr || ip_info.ipAttr.length === 0) return;
		if (selected_rows.length === 1) {
			const item = ip_info.ipAttr[selected_rows[0]];
			set_selected_key(String(getHashKey(item)));
		} else if (selected_key !== null) {
			set_selected_key(null);
		}
	}, [ip_info, selected_rows, selected_key]);

	return (
		<Fragment>
			<IPTable
				title={family === 'ipv6' ? t('IPv6 Address') : undefined}
				data={{ipAttr: sortedAttr}}
				selected_rows={selectedSortedIndices}
				onChangeSelectedRows={handleSelectionChange}
				onDelete={handleDelete}
				onUpdate={handleUpdate}
				onRefresh={handleRefresh}
				error={isError}
			/>

			{selected_index !== -1 && (
				<LowerSection>
					{false && <AddressPannel name={sortedAttr[selected_index].dev} data={sortedAttr[selected_index]} />}
					<IPAddressView device_name={sortedAttr[selected_index].dev} />
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
