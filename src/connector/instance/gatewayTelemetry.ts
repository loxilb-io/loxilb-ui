//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import type {GwGetResp} from 'api';
import {IInstance} from 'types/oam';
import {assertOk} from '../fetcher/fetcher_base';
import {GET_INST} from '../fetcher/fetcher_inst';

//---------------------------------------------------------
// Gateway telemetry REST reads (UI-MON-009, persistence UI-MON-014 input)
//---------------------------------------------------------
// Worker/GPU telemetry has NO Prometheus families — engine-side inputs are
// parsed into gateway state and never re-exported — so the Workers surface
// is REST-first on these generated-spec paths. Each read stamps its own
// `receivedAtMs`: these queries are independent of the Prometheus snapshot
// and of each other, and nothing may present them as one atomic
// observation.
//
// Contract facts the types below encode:
// - `/config/gpu/status`.enabled is the AUTHORITATIVE enabled-state source.
//   The GET worker-metrics handler never populates
//   `WorkerMetricsResponse.monitoring_enabled` (omitempty boolean), so that
//   field is deliberately not surfaced here — absence must not read as
//   disabled (tracked as a gateway handoff).
// - The worker-metrics POST side rejects ingestion older than 10 s, so
//   `timestamp`/`last_metrics_update` lag is a server-backed freshness
//   signal worth displaying.

export type IGpuStatus = GwGetResp<'/config/gpu/status'>;
export type IWorkerMetricsEntry = NonNullable<GwGetResp<'/config/worker/metrics'>['workers']>[number];
export type IDiagnosticsStatus = GwGetResp<'/diagnostics'>;

export interface ITimedRead<T> {
	data: T;
	// Client fetch-completion time of THIS read — independent per source.
	receivedAtMs: number;
}

export async function query_get_gpu_status(instance: IInstance): Promise<ITimedRead<IGpuStatus>> {
	const resp = await GET_INST<IGpuStatus>(instance, `/config/gpu/status`);
	assertOk(resp, 'Get GPU Status');
	return {data: resp.data ?? {}, receivedAtMs: Date.now()};
}

export async function query_get_worker_metrics(instance: IInstance): Promise<ITimedRead<IWorkerMetricsEntry[]>> {
	const resp = await GET_INST<GwGetResp<'/config/worker/metrics'>>(instance, `/config/worker/metrics`);
	assertOk(resp, 'Get Worker Metrics');
	// monitoring_enabled is intentionally dropped — see the module comment.
	return {data: resp.data?.workers ?? [], receivedAtMs: Date.now()};
}

export async function query_get_diagnostics(instance: IInstance): Promise<ITimedRead<IDiagnosticsStatus>> {
	const resp = await GET_INST<IDiagnosticsStatus>(instance, `/diagnostics`);
	assertOk(resp, 'Get Diagnostics');
	return {data: (resp.data ?? {}) as IDiagnosticsStatus, receivedAtMs: Date.now()};
}
