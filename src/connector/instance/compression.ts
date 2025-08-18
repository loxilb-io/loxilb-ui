//---------------------------------------------------------
// Compression Management API Connector Functions
//---------------------------------------------------------
import {
	IRunCompressionRequest,
	ICompressionResponse,
	ICompressionStatsResponse,
	ICompressionCandidatesResponse,
	ICompressionEstimateResponse,
} from 'types/compression';
import {IInstance} from 'types/oam';
import {GET_INST, POST_INST} from '../fetcher/fetcher_inst';

//---------------------------------------------------------
// Compression Management Functions
//---------------------------------------------------------

/**
 * Run data compression
 * @param instance - LoxiLB instance
 * @param request - Compression operation parameters (optional - defaults to normal mode)
 */
export async function query_run_compression(instance: IInstance, request?: IRunCompressionRequest): Promise<ICompressionResponse> {
	const resp = await POST_INST(instance, `/api/v1/compression/run`, request);
	return (resp.data as ICompressionResponse) ?? {};
}

/**
 * Get compression system statistics
 * @param instance - LoxiLB instance
 */
export async function query_compression_stats(instance: IInstance): Promise<ICompressionStatsResponse> {
	const resp = await GET_INST(instance, `/api/v1/compression/stats`);
	return (resp.data as ICompressionStatsResponse) ?? {};
}

/**
 * Get compression candidates analysis
 * @param instance - LoxiLB instance
 */
export async function query_compression_candidates(instance: IInstance): Promise<ICompressionCandidatesResponse> {
	const resp = await GET_INST(instance, `/api/v1/compression/candidates`);
	return (resp.data as ICompressionCandidatesResponse) ?? {};
}

/**
 * Get compression savings estimate
 * @param instance - LoxiLB instance
 */
export async function query_compression_estimate(instance: IInstance): Promise<ICompressionEstimateResponse> {
	const resp = await GET_INST(instance, `/api/v1/compression/estimate`);
	return (resp.data as ICompressionEstimateResponse) ?? {};
}
