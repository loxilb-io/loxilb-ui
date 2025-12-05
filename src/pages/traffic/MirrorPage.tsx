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
import {Fragment, useRef, useState} from 'react';
import React from 'react';
import {IMirrorAttribute, IMirrorConfiguration} from 'types/mirror';

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

	const {data, refetch} = useMirrors(inst);
	const mirror_info: IMirrorConfiguration = {mirrAttr: data ?? []};

   const [selected_rows, set_selected_rows] = useState<number[]>([]);
   // Track selected mirrorIdent for synchronization
   const [selected_mirrorIdent, set_selected_mirrorIdent] = useState<string | null>(null);
   const {openPopUp, enableYes} = usePopUp();
   const {errorPopup, showAddError, showDeleteError, closeErrorPopup} = useErrorPopup();
   // Hash function for mirror
   const getHashKey = (item: IMirrorAttribute) => {
	   const str = `${item.mirrorIdent || ''}_${item.targetObject.attachment || ''}_${item.targetObject.mirrObjName || ''}`;
	   let hash = 0;
	   for (let i = 0; i < str.length; i++) {
		   hash = ((hash << 5) - hash) + str.charCodeAt(i);
		   hash |= 0;
	   }
	   return hash >>> 0;
   };
   // Sorted mirrors
   const sortedAttr = mirror_info.mirrAttr ? [...mirror_info.mirrAttr].sort((a, b) => getHashKey(a) - getHashKey(b)) : [];
   // Find selected index in sortedAttr
   let selected_index = -1;
   if (selected_rows.length === 1 && mirror_info.mirrAttr) {
	   const original = mirror_info.mirrAttr[selected_rows[0]];
	   selected_index = sortedAttr.findIndex(attr => getHashKey(attr) === getHashKey(original));
   } else if (selected_mirrorIdent) {
	   selected_index = sortedAttr.findIndex(attr => attr.mirrorIdent === selected_mirrorIdent);
   }
   // Selection handler: map sorted index back to original
   const handleSelectionChange = (indices: number[]) => {
	   if (indices.length === 1 && mirror_info.mirrAttr) {
		   const sortedItem = sortedAttr[indices[0]];
		   const originalIndex = mirror_info.mirrAttr.findIndex(attr => getHashKey(attr) === getHashKey(sortedItem));
		   set_selected_rows(originalIndex !== -1 ? [originalIndex] : []);
	   } else {
		   set_selected_rows([]);
	   }
   };

	const handleDelete = async () => {
		if (!inst) return;

		const item = mirror_info.mirrAttr[selected_rows[0]];
		const res = await request_delete_mirror_by_ident(inst, item.mirrorIdent);
		if (res.status === 'success') {
			openPopUp(t('Success'), t('Deleted successfully.'), t('OK'));
			set_selected_rows([]);
			setTimeout(() => {
				refetch();
			}, 1000);
		} else showDeleteError('mirror', res.error);
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
				if (res.status === 'success') {
					openPopUp(t('Success'), t('Added successfully.'), t('OK'));
					setTimeout(() => {
						refetch();
					}, 1000);
				} else showAddError('mirror', res.error);
			},
			true,
		);
	};

   // Synchronize selected_mirrorIdent with selected_rows
   React.useEffect(() => {
	   if (!mirror_info.mirrAttr || mirror_info.mirrAttr.length === 0) return;
	   if (selected_rows.length === 1) {
		   const mirrorIdent = mirror_info.mirrAttr[selected_rows[0]].mirrorIdent;
		   set_selected_mirrorIdent(mirrorIdent);
	   } else if (selected_mirrorIdent !== null) {
		   set_selected_mirrorIdent(null);
	   }
   }, [mirror_info, selected_rows, selected_mirrorIdent]);

   return (
	   <Fragment>
		   <MirrorTable
			   data={{mirrAttr: sortedAttr}}
			   selected_rows={selected_index !== -1 ? [selected_index] : []}
			   onChangeSelectedRows={handleSelectionChange}
			   onAdd={handleAdd}
			   onDelete={handleDelete}
			   onRefresh={refetch}
		   />
		   {selected_index !== -1 && (
			   <LowerSection>
				   <DetailPanel name={sortedAttr[selected_index].mirrorIdent} data={sortedAttr[selected_index]} />
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
