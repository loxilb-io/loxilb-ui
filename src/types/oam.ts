//---------------------------------------------------------
// Interfaces for Instance
//---------------------------------------------------------
export interface IUser {
	created_at?: string;
	email: string;
	id: number;
	role?: string;
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
	is_active: boolean;
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
	is_active: boolean;
	name: string;
	port: string;
	protocol: string;
	version: string;
}
