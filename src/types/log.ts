//---------------------------------------------------------
// Interfaces
//---------------------------------------------------------
export interface ILog {
	id: number;
	created_at: string;
	host: string;
	level: string;
	message: string;
	programname: string;
	timestamp: string;
	facility?: number; // Optional, as not all logs may have this field
	severity?: number; // Optional, as not all logs may have this field
}

export interface ILogListResponse {
	logs: ILog[];
}
export interface ILogArchiveList {
	archives: string[];
}

export type LevelType = 'debug' | 'info' | 'error' | 'warning' | 'notice' | 'critical' | 'emergency' | 'alert';
export const LevelTypeList: LevelType[] = ['debug', 'info', 'error', 'warning', 'notice', 'critical', 'emergency', 'alert'];
export interface ApiResult {
	status: 'success' | 'error';
	error?: string;
}
