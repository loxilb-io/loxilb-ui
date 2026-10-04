//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Stack} from '@mui/material';
import SingleTextField from 'components/element/SingleTextField';
import ValueBunch from 'components/element/ValueBunch';
import MirrorInputForm from 'components/input/MirrorInputForm';
import LowerSection from 'components/layout/LowerSection';
import ErrorPopUp from 'components/modal/ErrorPopUp';
import SubTitlePannel from 'components/layout/SubTitlePannel';
import MirrorTable from 'components/table/traffic/MirrorTable';
import {request_create_mirror, request_delete_mirror_by_ident} from 'connector/instance/mirror';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {usePopUp} from 'hooks/popupHook';
import {useErrorPopup} from 'hooks/useErrorPopup';
import {useMirrors} from 'hooks/query/queryHooks';
import {t} from 'i18next';
import {Fragment, useMemo, useRef, useState} from 'react';
import {IMirrorAttribute, IMirrorConfiguration} from 'types/mirror';
import {toPageState} from 'components/state/pageState';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
function DetailPanel(props: {name: string; data: IMirrorAttribute}) {
	const {name, data} = props;

	// 0(SPAN), 1(RSPAN), 2(ERSPAN)
	const type = data.mirrorInfo.type || 0;

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

	const mirror_query = useMirrors(inst);
	const {data, refetch} = mirror_query;
	const mirror_info: IMirrorConfiguration = {mirrAttr: data ?? []};

   // Holds STABLE content-hash row ids (not array indices)
   const [selected_rows, set_selected_rows] = useState<number[]>([]);
   const {openPopUp, enableYes} = usePopUp();
   const {errorPopup, showAddError, showDeleteError, closeErrorPopup} = useErrorPopup();
   // Hash function for mirror — MUST match MirrorTable.getHashKey
   const getHashKey = (item: IMirrorAttribute) => {
	   const str = `${item.mirrorIdent || ''}_${item.targetObject.attachment || ''}_${item.targetObject.mirrObjName || ''}`;
	   let hash = 0;
	   for (let i = 0; i < str.length; i++) {
		   hash = ((hash << 5) - hash) + str.charCodeAt(i);
		   hash |= 0;
	   }
	   return hash >>> 0;
   };

   // Resolve selected items by matching stable hash ids against the raw data
   const selectedItems = useMemo(
	   () => selected_rows.map(h => mirror_info.mirrAttr.find(a => getHashKey(a) === h)).filter((x): x is IMirrorAttribute => x != null),
	   [selected_rows, mirror_info.mirrAttr],
   );
   const selectedItem: IMirrorAttribute | null = selectedItems.length === 1 ? selectedItems[0] : null;

   const handleSelectionChange = (hashes: number[]) => set_selected_rows(hashes);

	const handleDelete = async () => {
		if (!inst || selectedItems.length === 0) return;

		const results = await Promise.all(selectedItems.map(item => request_delete_mirror_by_ident(inst, item.mirrorIdent)));
		const failures = results.filter(res => res.status !== 'confirmed');

		if (failures.length === 0) {
			openPopUp(t('Success'), t('Deleted {{count}} item(s) successfully.', {count: results.length}), t('OK'));
		} else if (failures.length < results.length) {
			showDeleteError('mirror', t('{{succeeded}} succeeded, {{failed}} failed. {{error}}', {succeeded: results.length - failures.length, failed: failures.length, error: t(failures[0].localeKey)}));
		} else {
			showDeleteError('mirror', t(failures[0].localeKey));
			return;
		}
		set_selected_rows([]);
		setTimeout(() => {
			refetch();
		}, 1000);
	};

	const instanceRef = useRef<IMirrorAttribute | null>(null);
	const handleAdd = () => {
		if (!inst) return;

		const input_form = (
			<MirrorInputForm
				key={Date.now()}
				onChange={data => {
					const {isValid, errors, ...cleanData} = data;
					instanceRef.current = cleanData;
					enableYes(isValid);
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
				if (res.status === 'confirmed') {
					openPopUp(t('Success'), t('Added successfully.'), t('OK'));
					setTimeout(() => {
						refetch();
					}, 1000);
				} else showAddError('mirror', t(res.localeKey));
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
		   <MirrorTable
			   data={mirror_info}
			   selected_rows={selected_rows}
			   onChangeSelectedRows={handleSelectionChange}
			   onAdd={handleAdd}
			   onDelete={handleDelete}
			   onRefresh={handleRefresh}
			   state={toPageState(mirror_query, {op: 'mirror.list'})}
		   />
		   {selectedItem && (
			   <LowerSection>
				   <DetailPanel name={selectedItem.mirrorIdent} data={selectedItem} />
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
