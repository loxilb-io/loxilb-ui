//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import { getStableHash, isValidIPAddressCidr } from 'common';
import RouteInputForm from 'components/input/RouteInputForm';
import ErrorPopUp from 'components/modal/ErrorPopUp';
import RouteTable from 'components/table/networks/RouteTable';
import { request_create_route, request_delete_route } from 'connector/instance/route_attr';
import { useInstanceFromURL } from 'hooks/instanceHook';
import { usePopUp } from 'hooks/popupHook';
import { useErrorPopup } from 'hooks/useErrorPopup';
import { useRouteAttr } from 'hooks/query/queryHooks';
import { t } from 'i18next';
import { useRef, useState } from 'react';
import React from 'react';
import { IRouteAttrInput, IRouteData } from 'types/route_attr';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function RoutePage() {
	const inst = useInstanceFromURL();

	const { data, refetch } = useRouteAttr(inst); // IRouteAttribute[]
	const route_info: IRouteData = { routeAttr: data ?? [] };

	const [selected_rows, set_selected_rows] = useState<number[]>([]);
	// Track selected destinationIPNet for synchronization
	const [selected_key, set_selected_key] = useState<string | null>(null);
	const { openPopUp, enableYes } = usePopUp();
	const { errorPopup, showAddError, showDeleteError, closeErrorPopup } = useErrorPopup();

	// Hash function for Route entry
	const getHashKey = (item: any) => {
		const str = `${item?.destinationIPNet || ''}`;
		return getStableHash(str);
	};

	// Sorted route entries
	const sortedAttr = route_info.routeAttr ? [...route_info.routeAttr].sort((a, b) => getHashKey(a) - getHashKey(b)) : [];

	// Map selected original indices to sorted indices for display
	const selectedSortedIndices = React.useMemo(() => {
		if (!route_info.routeAttr || selected_rows.length === 0) return [];

		return selected_rows
			.map(originalIdx => {
				const original = route_info.routeAttr[originalIdx];
				return sortedAttr.findIndex(attr => getHashKey(attr) === getHashKey(original));
			})
			.filter(idx => idx !== -1);
	}, [selected_rows, route_info.routeAttr, sortedAttr]);

	// Find single selected index for detail panel
	const selected_index = selectedSortedIndices.length === 1 ? selectedSortedIndices[0] :
		(selected_key ? sortedAttr.findIndex(attr => `${attr.destinationIPNet}` === selected_key) : -1);

	// Selection handler: map sorted indices back to original indices
	const handleSelectionChange = (indices: number[]) => {
		if (!route_info.routeAttr) {
			set_selected_rows([]);
			return;
		}

		if (indices.length === 0) {
			set_selected_rows([]);
			return;
		}

		// Map each sorted index back to original index
		const originalIndices = indices
			.map(sortedIdx => {
				const sortedItem = sortedAttr[sortedIdx];
				return route_info.routeAttr.findIndex(attr => getHashKey(attr) === getHashKey(sortedItem));
			})
			.filter(idx => idx !== -1);

		set_selected_rows(originalIndices);
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
		} else showDeleteError('route', res.error);
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

				try {
					console.log('Creating route with data:', instanceRef.current);
					const res = await request_create_route(inst, instanceRef.current);
					console.log('Route creation response:', res);
					
					if (res.status === 'success') {
						openPopUp(t('Success'), t('Added successfully.'), t('OK'));
						setTimeout(() => {
							refetch();
						}, 1000);
					} else {
						showAddError('route', res.error);
					}
				} catch (error) {
					console.error('Route creation error:', error);
					showAddError('route', error instanceof Error ? error.message : 'Unknown error occurred');
				}
			},
			true,
		);
	};

	const handleRefresh = () => {
		set_selected_rows([]);
		set_selected_key(null);
		refetch();
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

	return (
		<>
			<RouteTable
				data={{ routeAttr: sortedAttr }}
				selected_rows={selectedSortedIndices}
				onChangeSelectedRows={handleSelectionChange}
				onAdd={handleAdd}
				onDelete={handleDelete}
				onRefresh={handleRefresh}
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
