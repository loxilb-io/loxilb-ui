//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Stack} from '@mui/material';
import SubTabs from 'components/element/SubTabs';
import SessionInputForm from 'components/input/UESessionInputForm';
import UlclInputForm from 'components/input/UlclInputForm';
import UESessionTable from 'components/table/traffic/UESessionTable';
import ULCLTable from 'components/table/traffic/ULCLTable';
import {request_create_session, request_delete_session} from 'connector/instance/session';
import {request_create_ulcl, request_delete_ulcl} from 'connector/instance/session_ulcl';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {usePopUp} from 'hooks/popupHook';
import {useSessionAttr, useULCLAttr} from 'hooks/query/queryHooks';
import {t} from 'i18next';
import {useRef, useState} from 'react';
import {ISessionAttribute, ISessionConfiguration} from 'types/session';
import {IUlclAttribute, IUlclConfiguration} from 'types/session_ulcl';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function TelecomPage() {
	const inst = useInstanceFromURL();

	const {data: ulcl_data, refetch: refetch_ulcl} = useULCLAttr(inst); // IUlclAttribute[]
	const {data: session_data, refetch: refetch_session} = useSessionAttr(inst); // ISessionAttribute[]

	const ulcl_info: IUlclConfiguration = {ulclAttr: ulcl_data ?? []};
	const session_info: ISessionConfiguration = {sessionAttr: session_data ?? []};

	const [selected_rows, set_selected_rows] = useState<number[]>([]);
	const [cur_tab_idx, set_cur_tab_idx] = useState(0);

	const tabs = ['User Equipment Session', 'Uplink Classifier'];

	const {openPopUp, enableYes} = usePopUp();

	const handleDeleteULCL = async () => {
		if (!inst) return;

		const item = ulcl_info.ulclAttr[selected_rows[0]];

		const res = await request_delete_ulcl(inst, item.ulclIdent, item.ulclArgument.ulclIP);
		if (res.status === 'success') {
			openPopUp(t('Success'), t('Deleted successfully.'), t('OK'));
			set_selected_rows([]);
			refetch_ulcl();
		} else openPopUp(t('Error'), t('Failed to delete. {{error}}', {error: res.error}), t('OK'));
	};

	const ulcl_inst = useRef<IUlclAttribute | null>(null);
	const handleAddUlcl = () => {
		if (!inst) return;

		const input_form = (
			<UlclInputForm
				key={Date.now()}
				onChange={(data: IUlclAttribute) => {
					ulcl_inst.current = data;
					enableYes(!!data && data.ulclIdent !== '');
				}}
			/>
		);

		openPopUp(
			'',
			input_form,
			t('Add'),
			t('Cancel'),
			async () => {
				if (!ulcl_inst.current) return;

				const res = await request_create_ulcl(inst, ulcl_inst.current);
				if (res.status === 'success') {
					openPopUp(t('Success'), t('Added successfully.'), t('OK'));
					refetch_ulcl();
				} else openPopUp(t('Error'), t('Failed to add. {{error}}', {error: res.error}), t('OK'));
			},
			true,
		);
	};

	const handleDeleteSession = async () => {
		if (!inst) return;

		const item = session_info.sessionAttr[selected_rows[0]];

		const res = await request_delete_session(inst, item.ident);
		if (res.status === 'success') {
			openPopUp(t('Success'), t('Deleted successfully.'), t('OK'));
			set_selected_rows([]);
			refetch_session();
		} else openPopUp(t('Error'), t('Failed to delete. {{error}}', {error: res.error}), t('OK'));
	};

	const session_inst = useRef<ISessionAttribute | null>(null);
	const handleAddSession = () => {
		if (!inst) return;

		const input_form = (
			<SessionInputForm
				key={Date.now()}
				onChange={(data: ISessionAttribute) => {
					session_inst.current = data;
					enableYes(!!data && data.ident !== '');
				}}
			/>
		);

		openPopUp(
			'',
			input_form,
			t('Add'),
			t('Cancel'),
			async () => {
				if (!session_inst.current) return;

				const res = await request_create_session(inst, session_inst.current);
				if (res.status === 'success') {
					openPopUp(t('Success'), t('Added successfully.'), t('OK'));
					refetch_session();
				} else openPopUp(t('Error'), t('Failed to add. {{error}}', {error: res.error}), t('OK'));
			},
			true,
		);
	};

	return (
		<Stack spacing={2}>
			<SubTabs tabs={tabs} onChange={(index: number) => set_cur_tab_idx(index)} />

			{cur_tab_idx === 0 && (
				<UESessionTable
					data={session_info}
					selected_rows={selected_rows}
					onChangeSelectedRows={set_selected_rows}
					onAdd={handleAddSession}
					onDelete={handleDeleteSession}
				/>
			)}
			{cur_tab_idx === 1 && (
				<ULCLTable data={ulcl_info} selected_rows={selected_rows} onChangeSelectedRows={set_selected_rows} onAdd={handleAddUlcl} onDelete={handleDeleteULCL} />
			)}
		</Stack>
	);
}
