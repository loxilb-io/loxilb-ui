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
import React from 'react';
import {IRouteAttrInput, IRouteData} from 'types/route_attr';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function RoutePage() {
	const inst = useInstanceFromURL();

	const {data, refetch} = useRouteAttr(inst); // IRouteAttribute[]
	const route_info: IRouteData = {routeAttr: data ?? []};

   const [selected_rows, set_selected_rows] = useState<number[]>([]);
   // Track selected destinationIPNet for synchronization
   const [selected_key, set_selected_key] = useState<string | null>(null);
   const {openPopUp, enableYes} = usePopUp();
   
   // Hash function for Route entry
   const getHashKey = (item: any) => {
	   const str = `${item?.destinationIPNet || ''}`;
	   return getStableHash(str);
   };
   
   // Sorted route entries
   const sortedAttr = route_info.routeAttr ? [...route_info.routeAttr].sort((a, b) => getHashKey(a) - getHashKey(b)) : [];
   
   // Find selected index in sortedAttr
   let selected_index = -1;
   if (selected_rows.length === 1 && route_info.routeAttr) {
	   const original = route_info.routeAttr[selected_rows[0]];
	   selected_index = sortedAttr.findIndex(attr => getHashKey(attr) === getHashKey(original));
   } else if (selected_key) {
	   selected_index = sortedAttr.findIndex(attr => `${attr.destinationIPNet}` === selected_key);
   }
   
   // Selection handler: map sorted index back to original
   const handleSelectionChange = (indices: number[]) => {
	   if (indices.length === 1 && route_info.routeAttr) {
		   const sortedItem = sortedAttr[indices[0]];
		   const originalIndex = route_info.routeAttr.findIndex(attr => getHashKey(attr) === getHashKey(sortedItem));
		   set_selected_rows(originalIndex !== -1 ? [originalIndex] : []);
	   } else {
		   set_selected_rows([]);
	   }
   };
	const handleDelete = async () => {
		if (!inst) return;

		const item = route_info.routeAttr[selected_rows[0]];
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

   // Synchronize selected_key with selected_rows
   React.useEffect(() => {
	   if (!route_info.routeAttr || route_info.routeAttr.length === 0) return;
	   if (selected_rows.length === 1) {
		   const item = route_info.routeAttr[selected_rows[0]];
		   set_selected_key(`${item.destinationIPNet}`);
	   } else if (selected_key !== null) {
		   set_selected_key(null);
	   }
   }, [route_info, selected_rows, selected_key]);

	return <RouteTable
		data={{routeAttr: sortedAttr}}
		selected_rows={selected_index !== -1 ? [selected_index] : []}
		onChangeSelectedRows={handleSelectionChange}
		onAdd={handleAdd}
		onDelete={handleDelete}
		onRefresh={refetch}
	/>;
}
