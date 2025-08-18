//---------------------------------------------------------
// Compression Management Hooks
//---------------------------------------------------------
import {useQueryInstanceData} from 'hooks/query/common';
import {
	query_run_compression,
	query_compression_stats,
	query_compression_candidates,
	query_compression_estimate,
} from 'connector/instance/compression';
import {
	IRunCompressionRequest,
	ICompressionResponse,
	ICompressionStatsResponse,
	ICompressionCandidatesResponse,
	ICompressionEstimateResponse,
} from 'types/compression';
import {IInstance} from 'types/oam';

//---------------------------------------------------------
// Compression Management Hooks
//---------------------------------------------------------

/**
 * Hook for compression system statistics
 */
export const useCompressionStats = (instance: IInstance | null) => {
	return useQueryInstanceData(['compression-stats'], query_compression_stats, instance);
};

/**
 * Hook for compression candidates analysis
 */
export const useCompressionCandidates = (instance: IInstance | null) => {
	return useQueryInstanceData(['compression-candidates'], query_compression_candidates, instance);
};

/**
 * Hook for compression savings estimate
 */
export const useCompressionEstimate = (instance: IInstance | null) => {
	return useQueryInstanceData(['compression-estimate'], query_compression_estimate, instance);
};

//---------------------------------------------------------
// Compression Management Action Functions
//---------------------------------------------------------

/**
 * Action function to run compression
 * @param instance - LoxiLB instance
 * @param request - Compression operation parameters (optional - defaults to normal mode)
 */
export const runCompression = async (instance: IInstance, request?: IRunCompressionRequest): Promise<ICompressionResponse> => {
	return query_run_compression(instance, request);
};

/**
 * Action function to run forced compression
 * @param instance - LoxiLB instance
 * @param targetTables - Optional specific tables to compress
 */
export const runForcedCompression = async (instance: IInstance, targetTables?: string[]): Promise<ICompressionResponse> => {
	return query_run_compression(instance, { 
		force: true, 
		target_tables: targetTables 
	});
};

/**
 * Action function to run compression with specific level
 * @param instance - LoxiLB instance
 * @param compressionLevel - Compression level (1=fastest, 5=best compression)
 * @param targetTables - Optional specific tables to compress
 */
export const runCompressionWithLevel = async (
	instance: IInstance, 
	compressionLevel: 1 | 2 | 3 | 4 | 5,
	targetTables?: string[]
): Promise<ICompressionResponse> => {
	return query_run_compression(instance, { 
		compression_level: compressionLevel, 
		target_tables: targetTables 
	});
};

/**
 * Action function to run dry-run compression
 * @param instance - LoxiLB instance
 * @param targetTables - Optional specific tables to analyze
 */
export const runCompressionDryRun = async (instance: IInstance, targetTables?: string[]): Promise<ICompressionResponse> => {
	return query_run_compression(instance, { 
		dry_run: true, 
		target_tables: targetTables 
	});
};

//---------------------------------------------------------
// Convenience Hooks and Functions
//---------------------------------------------------------

/**
 * Hook to get high priority compression candidates
 */
export const useHighPriorityCompressionCandidates = (instance: IInstance | null) => {
	const { data: candidates, isLoading, error } = useCompressionCandidates(instance);
	
	const highPriorityCandidates = candidates?.data?.candidates?.filter(
		candidate => candidate.compression_priority === 'high'
	) || [];
	
	return {
		data: highPriorityCandidates,
		totalCount: candidates?.data?.high_priority_candidates || 0,
		totalSavings: candidates?.data?.total_potential_savings_formatted || '0 B',
		isLoading,
		error,
	};
};

/**
 * Hook to get compression summary
 */
export const useCompressionSummary = (instance: IInstance | null) => {
	const { data: stats, isLoading: statsLoading, error: statsError } = useCompressionStats(instance);
	const { data: candidates, isLoading: candidatesLoading, error: candidatesError } = useCompressionCandidates(instance);
	const { data: estimate, isLoading: estimateLoading, error: estimateError } = useCompressionEstimate(instance);
	
	const summary = {
		totalRuns: stats?.data?.compression_runs || 0,
		successRate: stats?.data ? 
			((stats.data.successful_runs / stats.data.compression_runs) * 100).toFixed(1) + '%' : 
			'N/A',
		totalSpaceSaved: stats?.data?.total_space_saved_formatted || '0 B',
		averageCompressionRatio: stats?.data?.average_compression_ratio || 0,
		lastRunStatus: stats?.data?.last_run?.status || 'unknown',
		candidatesCount: candidates?.data?.total_candidates || 0,
		potentialSavings: candidates?.data?.total_potential_savings_formatted || '0 B',
		estimatedTotalSavings: estimate?.data?.summary?.total_estimated_savings_formatted || '0 B',
		recommendedAction: candidates?.data?.recommendations?.immediate_action_required ? 'compress_now' : 'monitor',
	};
	
	return {
		data: summary,
		isLoading: statsLoading || candidatesLoading || estimateLoading,
		error: statsError || candidatesError || estimateError,
	};
};

/**
 * Hook to get compression performance metrics
 */
export const useCompressionPerformance = (instance: IInstance | null) => {
	const { data: stats, isLoading, error } = useCompressionStats(instance);
	
	const performance = {
		avgProcessingSpeed: stats?.data?.performance_metrics?.avg_processing_speed_mb_per_sec || 0,
		avgCpuUsage: stats?.data?.performance_metrics?.avg_cpu_usage_percent || 0,
		avgMemoryUsage: stats?.data?.performance_metrics?.avg_memory_usage_mb || 0,
		lastRunDuration: stats?.data?.last_run?.duration_seconds || 0,
		lastRunRatio: stats?.data?.last_run?.compression_ratio || 0,
	};
	
	return {
		data: performance,
		isLoading,
		error,
	};
};

/**
 * Hook to get tables that need immediate compression
 */
export const useTablesNeedingCompression = (instance: IInstance | null) => {
	const { data: candidates, isLoading, error } = useCompressionCandidates(instance);
	
	const urgentTables = candidates?.data?.candidates?.filter(
		candidate => candidate.recommended_action === 'compress_now'
	) || [];
	
	return {
		data: urgentTables,
		isLoading,
		error,
	};
};

/**
 * Hook to check if compression is recommended
 */
export const useCompressionRecommendation = (instance: IInstance | null) => {
	const { data: candidates, isLoading, error } = useCompressionCandidates(instance);
	
	const recommendation = {
		immediateActionRequired: candidates?.data?.recommendations?.immediate_action_required || false,
		suggestedSchedule: candidates?.data?.recommendations?.suggested_compression_schedule || '',
		storageWarning: candidates?.data?.recommendations?.storage_threshold_warning || false,
		highPriorityCandidates: candidates?.data?.high_priority_candidates || 0,
		totalPotentialSavings: candidates?.data?.total_potential_savings_formatted || '0 B',
	};
	
	return {
		data: recommendation,
		isLoading,
		error,
	};
};
