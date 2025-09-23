//---------------------------------------------------------
// Imports
//----------------------------------------------------
import {IInstance} from 'types/oam';
import {IRouteAttribute, IRouteAttrInput} from 'types/route_attr';
import {ApiResult, createDetailedErrorMessage} from '../fetcher/fetcher_base';
import {DELETE_INST, GET_INST, POST_INST} from '../fetcher/fetcher_inst';

//---------------------------------------------------------
// API Caller Functions
//---------------------------------------------------------
export async function query_get_route_all(instance: IInstance): Promise<IRouteAttribute[]> {
	const resp = await GET_INST(instance, `/config/route/all`);
	return (resp.data?.routeAttr as IRouteAttribute[]) ?? [];
}

export async function request_create_route(instance: IInstance, data: IRouteAttrInput): Promise<ApiResult> {
	const resp = await POST_INST(instance, `/config/route`, data);
	if (resp.code !== 200 && resp.code !== 204) {
		const errorMessage = createDetailedErrorMessage(resp, 'Route Operation');
		return {status: 'error', error: errorMessage};
	} else {
		return {status: 'success'};
	}
}

export async function request_delete_route(instance: IInstance, ip: string, mask: number): Promise<ApiResult> {
	const resp = await DELETE_INST(instance, `/config/route/destinationIPNet/${ip}/${mask}`);
	if (resp.code !== 200 && resp.code !== 204) {
		const errorMessage = createDetailedErrorMessage(resp, 'Route Operation');
		return {status: 'error', error: errorMessage};
	} else {
		return {status: 'success'};
	}
}
