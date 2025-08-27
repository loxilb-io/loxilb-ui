//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {getStableHash, isValidIPAddressCidr} from 'common';
import ChipField from 'components/element/ChipField';
import IpInputForm from 'components/input/IPInputForm';
import LowerSection from 'components/layout/LowerSection';
import SubTitlePannel from 'components/layout/SubTitlePannel';
import IPTable from 'components/table/networks/IPTable';
import IPAddressView from 'components/view/IPAddressView';
import {request_create_ipv4, request_delete_ipv4} from 'connector/instance/ip';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {usePopUp} from 'hooks/popupHook';
import {useIPAttr} from 'hooks/query/queryHooks';
import {t} from 'i18next';
import {Fragment, useRef, useState, useEffect} from 'react';
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

export default function IPPage() {
	const inst = useInstanceFromURL();

	const {data, refetch} = useIPAttr(inst); // IIpAttribute[]
	const ip_info: IIpData = {ipAttr: data ?? []};
	const instanceRef = useRef<IIpAttributeInput | null>(null);

	const [selected_rows, set_selected_rows] = useState<number[]>([]);
	const [selected_key, set_selected_key] = useState<string | null>(null);
	const {openPopUp, enableYes} = usePopUp();

	// Hash function for IP entry
	 const getHashKey = (item: any) => {
		   const str = `${item.dev || ''}_${item.ipAddress.join(', ') || ''}`;
		   return getStableHash(str);
	   };

	// Sorted IP entries
	const sortedAttr = ip_info.ipAttr ? [...ip_info.ipAttr].sort((a, b) => getHashKey(a) - getHashKey(b)) : [];

	// Find selected index in sortedAttr
	let selected_index = -1;
	if (selected_rows.length === 1 && ip_info.ipAttr) {
		const original = ip_info.ipAttr[selected_rows[0]];
		selected_index = sortedAttr.findIndex(attr => String(getHashKey(attr)) === String(getHashKey(original)));
	} else if (selected_key) {
		selected_index = sortedAttr.findIndex(attr => String(getHashKey(attr)) === selected_key);
	}

	// Selection handler: map sorted index back to original
	const handleSelectionChange = (indices: number[]) => {
		if (indices.length === 1 && ip_info.ipAttr) {
			const sortedItem = sortedAttr[indices[0]];
			const originalIndex = ip_info.ipAttr.findIndex(attr => String(getHashKey(attr)) === String(getHashKey(sortedItem)));
			set_selected_rows(originalIndex !== -1 ? [originalIndex] : []);
		} else {
			set_selected_rows([]);
		}
	};

	const handleDelete = async () => {
		if (!inst || selected_rows.length !== 1) return;
		const item = ip_info.ipAttr[selected_rows[0]];
		if (!item || !item.ipAddress || !item.ipAddress[0]) return;
		const cidr = item.ipAddress[0];
		const [ip, maskStr] = cidr.split('/');
		const mask = parseInt(maskStr, 10);
		const res = await request_delete_ipv4(inst, ip, mask, item.dev);
		if (res.status === 'success') {
			openPopUp(t('Success'), t('Deleted successfully.'), t('OK'));
			set_selected_rows([]);
			setTimeout(() => {
				refetch();
			}, 1000);
		} else openPopUp(t('Error'), t('Failed to delete. {{error}}', {error: res.error}), t('OK'));
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
				const res = await request_create_ipv4(inst, instanceRef.current);
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
				data={{ipAttr: sortedAttr}}
				selected_rows={selected_index !== -1 ? [selected_index] : []}
				onChangeSelectedRows={handleSelectionChange}
				onAdd={handleAdd}
				onDelete={handleDelete}
				onRefresh={refetch}
			/>

			{selected_index !== -1 && (
				<LowerSection>
					{false && <AddressPannel name={sortedAttr[selected_index].dev} data={sortedAttr[selected_index]} />}
					<IPAddressView device_name={sortedAttr[selected_index].dev} />
				</LowerSection>
			)}
		</Fragment>
	);
}
