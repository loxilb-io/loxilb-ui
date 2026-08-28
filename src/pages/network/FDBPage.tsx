//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {isValidMacAddress} from 'common';
import {GridRowId} from '@mui/x-data-grid';
import FdbInputForm from 'components/input/FDBInputForm';
import ErrorPopUp from 'components/modal/ErrorPopUp';
import FDBTable from 'components/table/networks/FDBTable';
import {request_create_fdb, request_delete_fdb} from 'connector/instance/fdb';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {usePopUp} from 'hooks/popupHook';
import {useErrorPopup} from 'hooks/useErrorPopup';
import {useFDB} from 'hooks/query/queryHooks';
import {t} from 'i18next';
import {useMemo, useRef, useState} from 'react';
import {IFdbAttribute, IFdbData} from 'types/fdb';
import {identifyFdbEntries} from 'types/fdb_identity';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function FDBPage() {
	const inst = useInstanceFromURL();

	const {data, isError, refetch} = useFDB(inst); // IFdbAttribute[]
	const fdb_info: IFdbData = {fdbAttr: data ?? []};

	   const [selected_rows, set_selected_rows] = useState<GridRowId[]>([]);
   const {openPopUp, enableYes} = usePopUp();
   const {errorPopup, showAddError, showDeleteError, closeErrorPopup} = useErrorPopup();
	   // Resolve selected rows through the same duplicate-safe identities used by
	   // the table. Exact duplicate records remain independently selectable.
	   const selectedItems = useMemo(
		   () => {
			   const entriesById = new Map(identifyFdbEntries(fdb_info.fdbAttr).map(item => [item.id, item.entry]));
			   return selected_rows.map(id => entriesById.get(String(id))).filter((x): x is IFdbAttribute => x != null);
		   },
		   [selected_rows, fdb_info.fdbAttr],
	   );
	   const handleSelectionChange = (ids: GridRowId[]) => set_selected_rows(ids);
	const handleDelete = async () => {
		if (!inst || selectedItems.length === 0) return;

		const results = await Promise.all(
			selectedItems.map(item => {
				return request_delete_fdb(inst, item.macAddress, item.dev);
			}),
		);
		const failures = results.filter(res => res.status === 'error');

		if (failures.length === 0) {
			openPopUp(t('Success'), t('Deleted {{count}} item(s) successfully.', {count: results.length}), t('OK'));
		} else if (failures.length < results.length) {
			showDeleteError('FDB entry', `${results.length - failures.length} succeeded, ${failures.length} failed: ${failures[0].error}`);
		} else {
			showDeleteError('FDB entry', failures[0].error);
			return;
		}
		set_selected_rows([]);
		setTimeout(() => {
			refetch();
		}, 1000);
	};

	const instanceRef = useRef<IFdbAttribute | null>(null);
	const handleAdd = () => {
		if (!inst) return;

		const input_form = (
			<FdbInputForm
				key={Date.now()}
				onChange={data => {
					instanceRef.current = data;
					enableYes(isValidMacAddress(data.macAddress));
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

				const res = await request_create_fdb(inst, instanceRef.current);
				if (res.status === 'success') {
					openPopUp(t('Success'), t('Added successfully.'), t('OK'));
					setTimeout(() => {
						refetch();
					}, 1000);
				} else showAddError('FDB entry', res.error);
			},
			true,
		);
	};

   return (
	   <>
		   <FDBTable
			   data={fdb_info}
			   selected_rows={selected_rows}
			   onChangeSelectedRows={handleSelectionChange}
			   onAdd={handleAdd}
			   onDelete={handleDelete}
			   onRefresh={refetch}
			   error={isError}
		   />

		   {/* Error Popup */}
		   <ErrorPopUp
			   isOpen={errorPopup.isOpen}
			   onClose={closeErrorPopup}
			   title={errorPopup.title}
			   mainMessage={errorPopup.mainMessage}
			   errorData={errorPopup.errorData}
			   buttonText={t('OK')}
		   />
	   </>
   );
}
