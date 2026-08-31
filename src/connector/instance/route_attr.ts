//---------------------------------------------------------
// Imports
//----------------------------------------------------
import {IInstance} from 'types/oam';
import {IRouteAttribute, IRouteAttrInput} from 'types/route_attr';
import {assertOk} from '../fetcher/fetcher_base';
import {DELETE_INST, GET_INST, POST_INST} from '../fetcher/fetcher_inst';
import {OpResult} from '../fetcher/opResult';
import {runOp} from '../fetcher/opResultAdapter';
import type {GwGetResp} from 'api';

//---------------------------------------------------------
// API Caller Functions
//---------------------------------------------------------
export async function query_get_route_all(instance: IInstance): Promise<IRouteAttribute[]> {
	const resp = await GET_INST<GwGetResp<'/config/route/all'>>(instance, `/config/route/all`);
	assertOk(resp, 'Get Route');
	return (resp.data?.routeAttr ?? []) as IRouteAttribute[];
}

export async function request_create_route(instance: IInstance, data: IRouteAttrInput): Promise<OpResult> {
	// Clean up the data: remove empty protocol field
	const cleanData: any = {
		destinationIPNet: data.destinationIPNet,
		gateway: data.gateway,
	};
	
	// Only include protocol if it has a non-empty value
	if (data.protocol && data.protocol.trim() !== '') {
		cleanData.protocol = data.protocol;
	}
	
	return runOp('route_attr.create_route', () => POST_INST(instance, `/config/route`, cleanData));
}

export async function request_delete_route(instance: IInstance, ip: string, mask: number): Promise<OpResult> {
	return runOp('route_attr.delete_route', () => DELETE_INST(instance, `/config/route/destinationIPNet/${ip}/${mask}`));
}
