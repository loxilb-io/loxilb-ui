//---------------------------------------------------------
// Backup Management API Types
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
 * Create Backup Request
 */
export interface ICreateBackupRequest {
	type?: 'full' | 'incremental' | 'selective';
	description?: string;
	include_tables?: string[];
	exclude_tables?: string[];
}

/**
 * Restore Backup Request
 */
export interface IRestoreBackupRequest {
	backup_path: string;
	force?: boolean;
	verify_integrity?: boolean;
}

/**
 * Backup Info (matches actual API response)
 */
export interface IBackupInfo {
	path: string;
	size_bytes: number;
	created: string; // ISO string from API
	type: 'full' | 'incremental' | 'selective';
	is_compressed: boolean;
	checksum_valid: boolean;
	priority: 'critical' | 'operational' | 'historical';
	
	// Legacy fields for backward compatibility
	id?: string;
	filename?: string;
	size_formatted?: string;
	created_at?: number;
	duration_seconds?: number;
	status?: 'completed' | 'failed' | 'in_progress';
	description?: string;
	checksum?: string;
	tables_included?: string[];
	compression_ratio?: number;
}

/**
 * Backup Response
 */
export interface IBackupResponse extends ILoxiLBAPIResponse {
	data: {
		backup_id: string;
		backup_path: string;
		created_at: number;
		size_bytes: number;
		duration_seconds: number;
		status: 'completed' | 'failed' | 'in_progress';
		checksum?: string;
	};
}

/**
 * Backup List Response (matches actual API response)
 */
export interface IBackupListResponse extends ILoxiLBAPIResponse {
	count: number;
	data: IBackupInfo[];
}

/**
 * Restore Response
 */
export interface IRestoreResponse extends ILoxiLBAPIResponse {
	data: {
		backup_path: string;
		restored_at: number;
		duration_seconds: number;
		tables_restored: string[];
		records_restored: number;
		verification_status: 'passed' | 'failed' | 'skipped';
	};
}

/**
 * Backup Stats Response
 */
export interface IBackupStatsResponse extends ILoxiLBAPIResponse {
	data: {
		total_backups: number;
		successful_backups: number;
		failed_backups: number;
		total_storage_used_bytes: number;
		total_storage_used_formatted: string;
		average_backup_size_bytes: number;
		average_backup_duration_seconds: number;
		last_backup: {
			created_at: number;
			status: string;
			size_bytes: number;
			duration_seconds: number;
		};
		backup_frequency: {
			daily: number;
			weekly: number;
			monthly: number;
		};
		storage_efficiency: {
			compression_ratio: number;
			space_saved_bytes: number;
			space_saved_formatted: string;
		};
		retention_policy: {
			max_backups: number;
			max_age_days: number;
			cleanup_schedule: string;
		};
	};
}
