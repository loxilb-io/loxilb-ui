//---------------------------------------------------------
// Backup Management API Connector Functions
//---------------------------------------------------------
import {
	ICreateBackupRequest,
	IBackupResponse,
	IBackupListResponse,
	IRestoreBackupRequest,
	IRestoreResponse,
	IBackupStatsResponse,
} from 'types/backup';
import {IInstance} from 'types/oam';
import {GET_INST, POST_INST} from '../fetcher/fetcher_inst';

//---------------------------------------------------------
// Backup Management Functions
//---------------------------------------------------------

/**
 * Create a new backup
 * @param instance - LoxiLB instance
 * @param request - Backup creation parameters (optional - defaults to full backup)
 */
export async function query_create_backup(instance: IInstance, request?: ICreateBackupRequest): Promise<IBackupResponse> {
	const resp = await POST_INST(instance, `/api/v1/backup/create`, request);
	return (resp.data as IBackupResponse) ?? {};
}

/**
 * List all available backups
 * @param instance - LoxiLB instance
 */
export async function query_list_backups(instance: IInstance): Promise<IBackupListResponse> {
	const resp = await GET_INST(instance, `/api/v1/backup/list`);
	return (resp.data as IBackupListResponse) ?? {};
}

/**
 * Restore from backup
 * @param instance - LoxiLB instance
 * @param request - Backup restoration parameters
 */
export async function query_restore_backup(instance: IInstance, request: IRestoreBackupRequest): Promise<IRestoreResponse> {
	const resp = await POST_INST(instance, `/api/v1/backup/restore`, request);
	return (resp.data as IRestoreResponse) ?? {};
}

/**
 * Get backup system statistics
 * @param instance - LoxiLB instance
 */
export async function query_backup_stats(instance: IInstance): Promise<IBackupStatsResponse> {
	const resp = await GET_INST(instance, `/api/v1/backup/stats`);
	return (resp.data as IBackupStatsResponse) ?? {};
}
