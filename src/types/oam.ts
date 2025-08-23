//---------------------------------------------------------
// Interfaces for Instance
//---------------------------------------------------------
export interface IUser {
	created_at?: string;
	email: string;
	id: number;
	license?: string;
	oauth_id: string;
	oauth_provider: string;
	oauth_token: string;
	password: string;
	username: string;
}

export interface IInstanceInput {
	cimage: string;
	ctag: string;
	description: string;
	host: string;
	name: string;
	port: string;
	protocol: string;
	version: string;
}

export interface IInstance {
	api_endpoint: string;
	ci_name?: string;
	cimage: string;
	created_at: string;
	ctag: string;
	description: string;
	host: string;
	id: number;
	name: string;
	port: string;
	protocol: string;
	version: string;
}
