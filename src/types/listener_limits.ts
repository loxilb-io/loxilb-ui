import type {IServiceArguments} from './load_balancer';

export const LISTENER_LIMIT_FIELDS = ['connectionLimit', 'timeoutTcpInspect'] as const;
export function validateListenerLimits(sa: Partial<IServiceArguments>): string[] {
	return LISTENER_LIMIT_FIELDS.filter(field => sa[field] !== undefined &&
		!(typeof sa[field] === 'number' && Number.isInteger(sa[field]) && sa[field]! >= 0 && sa[field]! <= 4294967295));
}
