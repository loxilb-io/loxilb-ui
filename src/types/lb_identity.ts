import {IServiceArguments, IServiceConfiguration} from './load_balancer';

/**
 * Canonical identity shared by LB tables, selection, edit and delete.
 *
 * The Gateway can legitimately return rules that share VIP/port/protocol and
 * differ only by host, path, range or model. Keeping the readable canonical
 * value separate from presentation makes the identity contract explicit.
 */
export function canonicalLBRuleIdentity(configuration: IServiceConfiguration): string {
	const args = configuration.serviceArguments;
	return JSON.stringify([
		args.externalIP ?? '',
		args.port ?? '',
		args.portMax ?? '',
		(args.protocol ?? '').toLowerCase(),
		args.host ?? '',
		args.path_prefix ?? '',
		args.path_match_mode ?? '',
		args.model_name ?? '',
		args.name ?? '',
	]);
}

export function lbRuleRowId(configuration: IServiceConfiguration): string {
	const opaqueID = configuration.serviceArguments.id?.trim();
	return opaqueID ? `id:${opaqueID}` : `key:${canonicalLBRuleIdentity(configuration)}`;
}

export interface LBDeleteKey {
	externalIP: string;
	port: number;
	portMax?: number;
	protocol: string;
	host?: string;
	pathPrefix?: string;
	pathMatchMode?: IServiceArguments['path_match_mode'];
	modelName?: string;
}

export function buildLBDeleteKey(configuration: IServiceConfiguration): LBDeleteKey {
	const args = configuration.serviceArguments;
	return {
		externalIP: args.externalIP,
		port: args.port,
		...(args.portMax !== undefined && args.portMax > args.port ? {portMax: args.portMax} : {}),
		protocol: args.protocol,
		...(args.host ? {host: args.host} : {}),
		...(args.path_prefix ? {pathPrefix: args.path_prefix} : {}),
		...(args.path_match_mode ? {pathMatchMode: args.path_match_mode} : {}),
		...(args.model_name ? {modelName: args.model_name} : {}),
	};
}

const segment = (value: string | number): string => encodeURIComponent(String(value));

export function buildLBDeletePath(key: LBDeleteKey): string {
	const hostPrefix = key.host ? `/hosturl/${segment(key.host)}` : '';
	const range = key.portMax === undefined ? '' : `/portmax/${segment(key.portMax)}`;
	const path = `/config/loadbalancer${hostPrefix}/externalipaddress/${segment(key.externalIP)}`
		+ `/port/${segment(key.port)}${range}/protocol/${segment(key.protocol)}`;

	const query = new URLSearchParams();
	// Path qualifiers are accepted only by the hosturl routes. Model name is a
	// key component on all four tuple-delete routes.
	if (key.host) {
		if (key.pathPrefix) query.set('path_prefix', key.pathPrefix);
		if (key.pathMatchMode) query.set('path_match_mode', key.pathMatchMode);
	}
	if (key.modelName) query.set('model_name', key.modelName);
	const suffix = query.toString();
	return suffix ? `${path}?${suffix}` : path;
}
