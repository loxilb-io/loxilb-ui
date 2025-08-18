//---------------------------------------------------------
// Compression Management API Types
//---------------------------------------------------------

/**
 * Common Response Structure for LoxiLB API
 */
export interface ILoxiLBAPIResponse {
	success: boolean;
	message: string;
	timestamp: number;
	data?: any;
}

/**
 * Error Response
 */
export interface IErrorResponse {
	success: boolean;
	message: string;
	timestamp: number;
	error: string;
	details?: string;
}

/**
 * Run Compression Request
 */
export interface IRunCompressionRequest {
	force?: boolean;
	target_tables?: string[];
	compression_level?: 1 | 2 | 3 | 4 | 5; // 1=fastest, 5=best compression
	dry_run?: boolean;
}

/**
 * Compression Stats
 */
export interface ICompressionStats {
	compression_runs: number;
	successful_runs: number;
	failed_runs: number;
	total_space_saved_bytes: number;
	total_space_saved_formatted: string;
	average_compression_ratio: number;
	last_run: {
		started_at: number;
		completed_at: number;
		duration_seconds: number;
		status: 'completed' | 'failed' | 'in_progress';
		space_saved_bytes: number;
		compression_ratio: number;
	};
	performance_metrics: {
		avg_processing_speed_mb_per_sec: number;
		avg_cpu_usage_percent: number;
		avg_memory_usage_mb: number;
	};
}

/**
 * Compression Response
 */
export interface ICompressionResponse extends ILoxiLBAPIResponse {
	data: {
		operation_id: string;
		started_at: number;
		completed_at?: number;
		status: 'completed' | 'failed' | 'in_progress';
		tables_processed: string[];
		original_size_bytes: number;
		compressed_size_bytes: number;
		space_saved_bytes: number;
		compression_ratio: number;
		duration_seconds: number;
		processing_speed_mb_per_sec: number;
	};
	stats: ICompressionStats;
}

/**
 * Compression Stats Response
 */
export interface ICompressionStatsResponse extends ILoxiLBAPIResponse {
	data: ICompressionStats;
}

/**
 * Compression Candidate
 */
export interface ICompressionCandidate {
	table_name: string;
	current_size_bytes: number;
	current_size_formatted: string;
	estimated_compressed_size_bytes: number;
	estimated_compressed_size_formatted: string;
	potential_savings_bytes: number;
	potential_savings_formatted: string;
	potential_savings_percentage: number;
	last_modified: number;
	compression_priority: 'high' | 'medium' | 'low';
	recommended_action: 'compress_now' | 'schedule_compression' | 'monitor';
}

/**
 * Compression Candidates Response
 */
export interface ICompressionCandidatesResponse extends ILoxiLBAPIResponse {
	data: {
		total_candidates: number;
		high_priority_candidates: number;
		total_potential_savings_bytes: number;
		total_potential_savings_formatted: string;
		candidates: ICompressionCandidate[];
		recommendations: {
			immediate_action_required: boolean;
			suggested_compression_schedule: string;
			storage_threshold_warning: boolean;
		};
	};
}

/**
 * Compression Estimate Response
 */
export interface ICompressionEstimateResponse extends ILoxiLBAPIResponse {
	data: {
		detailed_records: {
			table_name: string;
			original_size_bytes: number;
			estimated_compressed_size_bytes: number;
			compression_ratio: number;
			space_saved_bytes: number;
			space_saved_percentage: number;
			estimated_processing_time_seconds: number;
		}[];
		summary: {
			total_original_size_bytes: number;
			total_original_size_formatted: string;
			total_estimated_compressed_size_bytes: number;
			total_estimated_compressed_size_formatted: string;
			total_estimated_savings_bytes: number;
			total_estimated_savings_formatted: string;
			average_compression_ratio: number;
			total_estimated_processing_time_seconds: number;
		};
		system_impact: {
			estimated_cpu_usage_percent: number;
			estimated_memory_usage_mb: number;
			estimated_io_impact: 'low' | 'medium' | 'high';
			recommended_execution_time: string;
		};
	};
}
