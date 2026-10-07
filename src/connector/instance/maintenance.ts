//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import type {GwGetResp, GwPutBody} from 'api';
import {IInstance} from 'types/oam';
import {assertOk} from '../fetcher/fetcher_base';
import {GET_INST, PUT_INST} from '../fetcher/fetcher_inst';
import {OpResult} from '../fetcher/opResult';
import {runOp} from '../fetcher/opResultAdapter';
import {ITimedRead} from './gatewayTelemetry';

//---------------------------------------------------------
// Operator maintenance (/maintenance)
//---------------------------------------------------------
// One episode at a time, entered and left by an operator and by nobody else:
// the gateway never leaves maintenance on its own, not even past a declared
// drain window. Both directions are idempotent — a repeat enter keeps the
// episode's operation_id and its original window, so the window is sent only
// on the enter that starts an episode.
//
// The read stamps its own receive time: the counters are a moment's
// observation, and a page showing them must be able to say how old it is.

// Partial on purpose: the contract marks most members required, but that is
// the contract of the release that declares them. A gateway from before
// inference refusal was reported answers without those members, and a reader
// typed to expect them would treat a missing answer as a false one.
export type IMaintenanceStatus = Partial<GwGetResp<'/maintenance'>>;
export type IMaintenanceRequest = GwPutBody<'/maintenance'>;

export async function query_get_maintenance(instance: IInstance): Promise<ITimedRead<IMaintenanceStatus>> {
	const resp = await GET_INST<IMaintenanceStatus>(instance, `/maintenance`);
	assertOk(resp, 'Get Maintenance');
	return {data: (resp.data ?? {}) as IMaintenanceStatus, receivedAtMs: Date.now()};
}

/** Enter maintenance. A window of 0 or none declares no deadline. */
export async function request_enter_maintenance(instance: IInstance, drainTimeoutSeconds?: number): Promise<OpResult<IMaintenanceStatus>> {
	const body: IMaintenanceRequest = {enabled: true, ...(drainTimeoutSeconds ? {drain_timeout_seconds: drainTimeoutSeconds} : {})};
	return runOp('maintenance.enter', () => PUT_INST<IMaintenanceStatus>(instance, `/maintenance`, body));
}

/** Leave maintenance. The answer carries the operation_id of the episode it ended. */
export async function request_leave_maintenance(instance: IInstance): Promise<OpResult<IMaintenanceStatus>> {
	const body: IMaintenanceRequest = {enabled: false};
	return runOp('maintenance.leave', () => PUT_INST<IMaintenanceStatus>(instance, `/maintenance`, body));
}
