//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {isValidIPAddress} from 'common';
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
import {Fragment, useRef, useState} from 'react';
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

	const [selected_rows, set_selected_rows] = useState<any[]>([]);
	const {openPopUp, enableYes} = usePopUp();

	const handleSelectionChange = (selection: any) => set_selected_rows(selection);
	const handleDelete = async () => {
		if (!inst) return;
		const item = ip_info.ipAttr[selected_rows[0]];

		// "192.168.223.1/24" → ip: "192.168.223.1", mask: 24
		const cidr = item.ipAddress[0];
		const [ip, maskStr] = cidr.split('/');
		const mask = parseInt(maskStr, 10);

		const res = await request_delete_ipv4(inst, ip, mask, item.dev);
		if (res.status === 'success') {
			openPopUp(t('Success'), t('Deleted successfully.'), t('OK'));
			set_selected_rows([]);
			refetch();
		} else openPopUp(t('Error'), t('Failed to delete. {{error}}', {error: res.error}), t('OK'));
	};

	const handleAdd = () => {
		if (!inst) return;

		const input_form = (
			<IpInputForm
				onChange={data => {
					instanceRef.current = data;
					enableYes(!data.dev && isValidIPAddress(data.ipAddress));
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
					refetch();
				} else openPopUp(t('Error'), t('Failed to add. {{error}}', {error: res.error}), t('OK'));
			},
			true,
		);
	};

	return (
		<Fragment>
			<IPTable data={ip_info} selected_rows={selected_rows} onChangeSelectedRows={handleSelectionChange} onAdd={handleAdd} onDelete={handleDelete} />

			{selected_rows.length === 1 && (
				<LowerSection>
					{false && <AddressPannel name={ip_info.ipAttr[selected_rows[0]].dev} data={ip_info.ipAttr[selected_rows[0]]} />}
					<IPAddressView device_name={ip_info.ipAttr[selected_rows[0]].dev} />
				</LowerSection>
			)}
		</Fragment>
	);
}
