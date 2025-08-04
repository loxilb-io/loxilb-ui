//---------------------------------------------------------
// Interfaces
//---------------------------------------------------------
export interface ISyslogMessage {
	created_at: string;
	facility: number;
	host: string;
	id: number;
	level: string;
	message: string;
	programname: string;
	severity: number;
	timestamp: string;
}
