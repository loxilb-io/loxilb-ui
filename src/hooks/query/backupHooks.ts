//---------------------------------------------------------
// Backup Management Hooks
//---------------------------------------------------------
import {formatBytes} from 'common';
import {useQueryInstanceData} from 'hooks/query/common';
import {
	query_create_backup,
	query_list_backups,
	query_restore_backup,
	query_backup_stats,
} from 'connector/instance/backup';
import {
	ICreateBackupRequest,
	IBackupResponse,
	IBackupListResponse,
	IRestoreBackupRequest,
	IRestoreResponse,
	IBackupStatsResponse,
} from 'types/backup';
import {IInstance} from 'types/oam';

//---------------------------------------------------------
// Backup Management Hooks
//---------------------------------------------------------

/**
 * Hook for listing all available backups
 */
export const useBackupList = (instance: IInstance | null) => {
	return useQueryInstanceData(['backup-list'], query_list_backups, instance);
};

/**
 * Hook for backup system statistics
 */
export const useBackupStats = (instance: IInstance | null) => {
	return useQueryInstanceData(['backup-stats'], query_backup_stats, instance);
};

//---------------------------------------------------------
// Backup Management Action Functions
//---------------------------------------------------------

/**
 * Action function to create a backup
 * @param instance - LoxiLB instance
 * @param request - Backup creation parameters (optional - defaults to full backup)
 */
export const createBackup = async (instance: IInstance, request?: ICreateBackupRequest): Promise<IBackupResponse> => {
	return query_create_backup(instance, request);
};

/**
 * Action function to create a full backup
 * @param instance - LoxiLB instance
 * @param description - Optional description for the backup
 */
export const createFullBackup = async (instance: IInstance, description?: string): Promise<IBackupResponse> => {
	return query_create_backup(instance, { type: 'full', description });
};

/**
 * Action function to create an incremental backup
 * @param instance - LoxiLB instance
 * @param description - Optional description for the backup
 */
export const createIncrementalBackup = async (instance: IInstance, description?: string): Promise<IBackupResponse> => {
	return query_create_backup(instance, { type: 'incremental', description });
};

/**
 * Action function to create a selective backup
 * @param instance - LoxiLB instance
 * @param includeTables - Tables to include in the backup
 * @param description - Optional description for the backup
 */
export const createSelectiveBackup = async (
	instance: IInstance, 
	includeTables: string[], 
	description?: string
): Promise<IBackupResponse> => {
	return query_create_backup(instance, { 
		type: 'selective', 
		include_tables: includeTables, 
		description 
	});
};

/**
 * Action function to restore from backup
 * @param instance - LoxiLB instance
 * @param request - Backup restoration parameters
 */
export const restoreBackup = async (instance: IInstance, request: IRestoreBackupRequest): Promise<IRestoreResponse> => {
	return query_restore_backup(instance, request);
};

/**
 * Action function to restore from backup with verification
 * @param instance - LoxiLB instance
 * @param backupPath - Path to the backup file
 * @param force - Force restoration even if there are warnings
 */
export const restoreBackupWithVerification = async (
	instance: IInstance, 
	backupPath: string, 
	force: boolean = false
): Promise<IRestoreResponse> => {
	return query_restore_backup(instance, { 
		backup_path: backupPath, 
		force, 
		verify_integrity: true 
	});
};

//---------------------------------------------------------
// Convenience Hooks and Functions
//---------------------------------------------------------

/**
 * Hook to get the latest backup information
 */
export const useLatestBackup = (instance: IInstance | null) => {
	const { data: backupList, isLoading, error } = useBackupList(instance);
	
	const latestBackup = backupList?.data?.[0] || null;
	
	return {
		data: latestBackup,
		isLoading,
		error,
	};
};

/**
 * Hook to get backup summary information
 */
export const useBackupSummary = (instance: IInstance | null) => {
	const { data: backupList, isLoading: listLoading, error: listError } = useBackupList(instance);
	const { data: backupStats, isLoading: statsLoading, error: statsError } = useBackupStats(instance);
	
	const summary = {
		totalBackups: backupList?.count || 0,
		totalSize: backupList?.data ? 
			formatBytes(backupList.data.reduce((total, backup) => total + (backup.size_bytes || 0), 0)) :
			'0 B',
		latestBackup: backupList?.data?.[0] || null,
		successRate: backupStats?.data ? 
			((backupStats.data.successful_backups / backupStats.data.total_backups) * 100).toFixed(1) + '%' : 
			'N/A',
		averageSize: backupStats?.data?.average_backup_size_bytes || 0,
		storageEfficiency: backupStats?.data?.storage_efficiency || null,
	};
	
	return {
		data: summary,
		isLoading: listLoading || statsLoading,
		error: listError || statsError,
	};
};

/**
 * Get backups filtered by type
 */
export const useBackupsByType = (instance: IInstance | null, type: 'full' | 'incremental' | 'selective') => {
	const { data: backupList, isLoading, error } = useBackupList(instance);
	
	const filteredBackups = backupList?.data?.filter(backup => backup.type === type) || [];
	
	return {
		data: filteredBackups,
		isLoading,
		error,
	};
};

/**
 * Get successful backups only
 */
export const useSuccessfulBackups = (instance: IInstance | null) => {
	const { data: backupList, isLoading, error } = useBackupList(instance);
	
	const successfulBackups = backupList?.data?.filter(backup => backup.status === 'completed') || [];
	
	return {
		data: successfulBackups,
		isLoading,
		error,
	};
};
