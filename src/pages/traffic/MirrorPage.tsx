//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Stack} from '@mui/material';
import SingleTextField from 'components/element/SingleTextField';
import ValueBunch from 'components/element/ValueBunch';
import MirrorInputForm from 'components/input/MirrorInputForm';
import LowerSection from 'components/layout/LowerSection';
import SubTitlePannel from 'components/layout/SubTitlePannel';
import MirrorTable from 'components/table/traffic/MirrorTable';
import {request_create_mirror, request_delete_mirror_by_ident} from 'connector/instance/mirror';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {usePopUp} from 'hooks/popupHook';
import {useMirrors} from 'hooks/query/queryHooks';
import {t} from 'i18next';
import {Fragment, useRef, useState} from 'react';
import {IMirrorAttribute, IMirrorConfiguration} from 'types/mirror';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
function DetailPanel(props: {name: string; data: IMirrorAttribute}) {
	const {name, data} = props;

	// 0(SPAN), 1(RSPAN), 2(ERSPAN)
	const type = data.mirrorInfo.type;

	return (
		<SubTitlePannel title={name} sub_title={t('Details')}>
			<Stack spacing={2}>
				{type === 0 && (
					<ValueBunch name={t('Span')}>
						<SingleTextField label={t('Port Name')} value={data.mirrorInfo.port} />
					</ValueBunch>
				)}

				{type === 1 && (
					<ValueBunch name={t('RSpan')}>
						<SingleTextField label={t('VLan')} value={data.mirrorInfo.vlan?.toString()} />
					</ValueBunch>
				)}

				{type === 2 && (
					<ValueBunch name={t('ERSpan')}>
						<SingleTextField label={t('Tunnel')} value={data.mirrorInfo.tunnelID?.toString()} />
						<SingleTextField label={t('Source IP')} value={data.mirrorInfo.sourceIP} tooltip={'Source IP address used in NAT or filtering rules.'} />
						<SingleTextField
							label={t('Remote IP')}
							value={data.mirrorInfo.remoteIP}
							tooltip={'Target IP address used for the endpoint or destination in load balancing.'}
						/>
					</ValueBunch>
				)}
			</Stack>
		</SubTitlePannel>
	);
}

export default function MirrorPage() {
	const inst = useInstanceFromURL();

	const {data, refetch} = useMirrors(inst);
	const mirror_info: IMirrorConfiguration = {mirrAttr: data ?? []};

	const [selected_rows, set_selected_rows] = useState<number[]>([]);
	const {openPopUp, enableYes} = usePopUp();

	const handleSelectionChange = (selection: any) => set_selected_rows(selection);

	const handleDelete = async () => {
		if (!inst) return;

		const item = mirror_info.mirrAttr[selected_rows[0]];
		const res = await request_delete_mirror_by_ident(inst, item.mirrorIdent);
		if (res.status === 'success') {
			openPopUp(t('Success'), t('Deleted successfully.'), t('OK'));
			set_selected_rows([]);
			refetch();
		} else openPopUp(t('Error'), t('Failed to delete. {{error}}', {error: res.error}), t('OK'));
	};

	const instanceRef = useRef<IMirrorAttribute | null>(null);
	const handleAdd = () => {
		if (!inst) return;

		const input_form = (
			<MirrorInputForm
				key={Date.now()}
				onChange={data => {
					instanceRef.current = data;
					enableYes(!!data && data.mirrorIdent !== '');
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

				const res = await request_create_mirror(inst, instanceRef.current);
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
			<MirrorTable data={mirror_info} selected_rows={selected_rows} onChangeSelectedRows={handleSelectionChange} onAdd={handleAdd} onDelete={handleDelete} />

			{selected_rows.length === 1 && (
				<LowerSection>
					<DetailPanel name={mirror_info.mirrAttr[selected_rows[0]].mirrorIdent} data={mirror_info.mirrAttr[selected_rows[0]]} />
				</LowerSection>
			)}
		</Fragment>
	);
}
