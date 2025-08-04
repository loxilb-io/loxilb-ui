//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import PolicyInputForm from 'components/input/PolicyInputForm';
import QoSTable from 'components/table/traffic/QoSTable';
import {request_create_qos_policy, request_delete_qos_policy} from 'connector/instance/qos';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {usePopUp} from 'hooks/popupHook';
import {useQOSPolicies} from 'hooks/query/queryHooks';
import {t} from 'i18next';
import {useRef, useState} from 'react';
import {IPolicyAttribute, IPolicyConfiguration} from 'types/qos';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function QoSPage() {
	const inst = useInstanceFromURL();

	const {data, refetch} = useQOSPolicies(inst);
	const qos_info: IPolicyConfiguration = {polAttr: data ?? []};

	const [selected_rows, set_selected_rows] = useState<number[]>([]);
	const {openPopUp, enableYes} = usePopUp();

	const handleSelectionChange = (selection: any) => set_selected_rows(selection);
	const handleDelete = async () => {
		if (!inst) return;

		const item = qos_info.polAttr[selected_rows[0]];

		const res = await request_delete_qos_policy(inst, item.policyIdent);
		if (res.status === 'success') {
			openPopUp(t('Success'), t('Deleted successfully.'), t('OK'));
			set_selected_rows([]);
			refetch();
		} else openPopUp(t('Error'), t('Failed to delete. {{error}}', {error: res.error}), t('OK'));
	};

	const instanceRef = useRef<IPolicyAttribute | null>(null);
	const handleAdd = () => {
		if (!inst) return;

		const input_form = (
			<PolicyInputForm
				key={Date.now()}
				onChange={data => {
					instanceRef.current = data;
					enableYes(!!data && data.policyIdent !== '');
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

				const res = await request_create_qos_policy(inst, instanceRef.current);
				if (res.status === 'success') {
					openPopUp(t('Success'), t('Added successfully.'), t('OK'));
					refetch();
				} else openPopUp(t('Error'), t('Failed to add. {{error}}', {error: res.error}), t('OK'));
			},
			true,
		);
	};

	return <QoSTable data={qos_info} selected_rows={selected_rows} onChangeSelectedRows={handleSelectionChange} onAdd={handleAdd} onDelete={handleDelete} />;
}
