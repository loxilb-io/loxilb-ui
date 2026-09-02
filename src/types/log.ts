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

export interface ILogResponse {
	logs: string[];
	next_cursor?: string;
	has_more: boolean;
	count?: number;
}
// Per-archive metadata from /log-archives. Every field is optional because the
// gateway only started returning archive_info recently and older builds omit it
// entirely — and because size_bytes is currently dropped for zero-byte files
// (it lacks `required` in the gateway spec, so go-swagger applies omitempty).
// "absent" therefore cannot be read as "empty".
export interface ILogArchiveInfo {
	name?: string;
	size_bytes?: number;
	modified?: string;
}

export interface ILogArchiveList {
	archives: string[];
	archive_info?: ILogArchiveInfo[];
}

export type LevelType = 'debug' | 'info' | 'error' | 'warning' ;
export const LevelTypeList: LevelType[] = ['debug', 'info', 'error', 'warning'];
