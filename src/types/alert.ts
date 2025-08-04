//---------------------------------------------------------
// Interface
//---------------------------------------------------------
export interface IAlert {
	created_at: string;
	id: number;
	instance_id: number;
	message: string;
	severity: string;
	type: string;
	resolved_at?: string;
}

export interface IPagination {
	has_next: boolean;
	has_prev: boolean;
	limit: number;
	page: number;
	total_count: number;
	total_pages: number;
}

export interface IAlertsResponse {
	data: IAlert[];
	pagination: IPagination;
}
