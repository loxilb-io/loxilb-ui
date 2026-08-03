//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import { getStableHash, isValidIPAddress, isValidIPAddressCidr } from 'common';
import RouteInputForm from 'components/input/RouteInputForm';
import ErrorPopUp from 'components/modal/ErrorPopUp';
import RouteTable from 'components/table/networks/RouteTable';
import { request_create_route, request_delete_route } from 'connector/instance/route_attr';
import { useInstanceFromURL } from 'hooks/instanceHook';
import { usePopUp } from 'hooks/popupHook';
import { useErrorPopup } from 'hooks/useErrorPopup';
import { useRouteAttr } from 'hooks/query/queryHooks';
import { t } from 'i18next';
import { useMemo, useRef, useState } from 'react';
import { IRouteAttribute, IRouteAttrInput, IRouteData } from 'types/route_attr';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function RoutePage() {
	const inst = useInstanceFromURL();

	const { data, isError, refetch } = useRouteAttr(inst); // IRouteAttribute[]
	const route_info: IRouteData = { routeAttr: data ?? [] };

	const [selected_rows, set_selected_rows] = useState<number[]>([]); // holds stable hash ids
	const { openPopUp, enableYes } = usePopUp();
	const { errorPopup, showAddError, showDeleteError, closeErrorPopup } = useErrorPopup();

	// Hash function for Route entry (must match RouteTable's getHashKey)
	const getHashKey = (item: any) => getStableHash(`${item?.destinationIPNet || ''}`);

	// Resolve selected items by matching the stable hash
	const selectedItems = useMemo(
		() =>
			selected_rows
				.map(h => route_info.routeAttr.find(a => getHashKey(a) === h))
				.filter((x): x is IRouteAttribute => x != null),
		[selected_rows, route_info.routeAttr],
	);
	const selectedItem: IRouteAttribute | null = selectedItems.length === 1 ? selectedItems[0] : null;

	const handleSelectionChange = (hashes: number[]) => set_selected_rows(hashes);
	const handleDelete = async () => {
		if (!inst || selectedItems.length === 0) return;

		const results = await Promise.all(
			selectedItems.map(item => {
				const [ip, maskStr] = item.destinationIPNet.split('/');
				return request_delete_route(inst, ip, parseInt(maskStr, 10));
			}),
		);
		const failures = results.filter(res => res.status === 'error');

		if (failures.length === 0) {
			openPopUp(t('Success'), t('Deleted {{count}} item(s) successfully.', {count: results.length}), t('OK'));
		} else if (failures.length < results.length) {
			showDeleteError('route', `${results.length - failures.length} succeeded, ${failures.length} failed: ${failures[0].error}`);
		} else {
			showDeleteError('route', failures[0].error);
			return;
		}
		set_selected_rows([]);
		setTimeout(() => {
			refetch();
		}, 1000);
	};

	const instanceRef = useRef<IRouteAttrInput | null>(null);
	const handleAdd = () => {
		if (!inst) return;

		const input_form = (
			<RouteInputForm
				key={Date.now()}
				onChange={data => {
					instanceRef.current = data;
					// The gateway (nexthop) was once gated on presence only — a
					// malformed nexthop must be rejected, not just a blank one.
					enableYes(isValidIPAddressCidr(data.destinationIPNet ?? '')
						&& isValidIPAddress(data.gateway ?? ''));
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
		refetch();
	};

	return (
		<>
			<RouteTable
				data={route_info}
				selected_rows={selected_rows}
				onChangeSelectedRows={handleSelectionChange}
				onAdd={handleAdd}
				onDelete={handleDelete}
				onRefresh={handleRefresh}
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
