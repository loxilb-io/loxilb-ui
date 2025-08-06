//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {getStableHash, isValidIPAddressCidr} from 'common';
import RouteInputForm from 'components/input/RouteInputForm';
import RouteTable from 'components/table/networks/RouteTable';
import {request_create_route, request_delete_route} from 'connector/instance/route_attr';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {usePopUp} from 'hooks/popupHook';
import {useRouteAttr} from 'hooks/query/queryHooks';
import {t} from 'i18next';
import {useRef, useState} from 'react';
import {IRouteAttrInput, IRouteData} from 'types/route_attr';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function RoutePage() {
	const inst = useInstanceFromURL();

	const {data, refetch} = useRouteAttr(inst); // IRouteAttribute[]
	const route_info: IRouteData = {routeAttr: data ?? []};

   const [selected_rows, set_selected_rows] = useState<number[]>([]);
	const {openPopUp, enableYes} = usePopUp();

   // Synchronize selection using hash-based indices
   const handleSelectionChange = (selection: number[]) => set_selected_rows(selection);
   const handleDelete = async () => {
	   if (!inst || selected_rows.length === 0) return;
	   // Find the item by hash
	   const selectedHash = selected_rows[0];
	   const item = route_info.routeAttr.find(
		   (row: any) => getStableHash(`${row.destinationIPNet || ''}`) === selectedHash
	   );
	   if (!item) return;
	   const cidr = item.destinationIPNet;
	   const [ip, maskStr] = cidr.split('/');
	   const mask = parseInt(maskStr, 10);
	   const res = await request_delete_route(inst, ip, mask);
	   if (res.status === 'success') {
		   openPopUp(t('Success'), t('Deleted successfully.'), t('OK'));
		   set_selected_rows([]);
		   setTimeout(() => {
				refetch();
			}, 1000);
	   } else openPopUp(t('Error'), t('Failed to delete. {{error}}', {error: res.error}), t('OK'));
   };

	const instanceRef = useRef<IRouteAttrInput | null>(null);
	const handleAdd = () => {
		if (!inst) return;

		const input_form = (
			<RouteInputForm
				key={Date.now()}
				onChange={data => {
					instanceRef.current = data;
					enableYes(isValidIPAddressCidr(data.destinationIPNet ?? '') 
								&& !!data.gateway && data.gateway !== '');
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

				const res = await request_create_route(inst, instanceRef.current);
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

	return <RouteTable data={route_info} selected_rows={selected_rows} onChangeSelectedRows={handleSelectionChange} onAdd={handleAdd} onDelete={handleDelete} />;
}
