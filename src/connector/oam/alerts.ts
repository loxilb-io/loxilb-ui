//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {IAlert, IAlertsResponse} from 'types/alert';
import {ApiResult} from '../fetcher/fetcher_base';
import {GET_OAM, PUT_OAM} from '../fetcher/fetcher_oam';

//---------------------------------------------------------
// API Caller Functions
//---------------------------------------------------------
export async function query_get_alerts(page: number, limit: number): Promise<IAlertsResponse> {
	const resp = await GET_OAM(`/alerts`, {page, limit});

	return (
		(resp.data as IAlertsResponse) ?? {
			data: [],
			pagination: {
				has_next: false,
				has_prev: false,
				limit: 0,
				page: 0,
				total_count: 0,
				total_pages: 0,
			},
		}
	);
}

export async function query_get_alerts_history() {
	const resp = await GET_OAM(`/alerts/history`);
	return (resp.data as IAlert[]) ?? [];
}

export async function request_acknowledge_alert(user_id: number, alert_id: number): Promise<ApiResult> {
	const resp = await PUT_OAM(`/alerts/${alert_id}/acknowledge`, {user_id});
	if (resp.code !== 200) return {status: 'error', error: `Failed to acknowledge alert ${alert_id}: ${resp.message}`};
	else return {status: 'success'};
}
