import {IServiceArguments} from './load_balancer';
import {isValidIPAddress, isValidPort} from '../common';

//---------------------------------------------------------
// Interfaces
//---------------------------------------------------------
export interface IPolicyInfo {
	type: number;
	colorAware: boolean;
	committedInfoRate: number;
	peakInfoRate: number;
	committedBlkSize: number;
	excessBlkSize: number;
}

export type QoSAttachment = 0 | 1 | 2;

export interface IQoSTargetObject {
	attachment: QoSAttachment;
	polObjName: string;
}

export interface IPolicyAttribute {
	policyIdent: string;
	policyInfo: IPolicyInfo;
	targetObject: IQoSTargetObject;
}

export interface IPolicyConfiguration {
	polAttr: IPolicyAttribute[];
}

export interface IQoSRuleTarget {
	externalIP: string;
	port: number;
	protocol: 'tcp' | 'udp' | 'sctp';
}

const QOS_RULE_PROTOCOLS = new Set<IQoSRuleTarget['protocol']>(['tcp', 'udp', 'sctp']);

/**
 * Parse the Gateway's QoS LB-rule attachment key.
 *
 * IPv4 keeps the legacy `VIP:PORT:PROTO` representation. IPv6 must use the
 * unambiguous RFC-bracketed `[VIP]:PORT:PROTO` representation.
 */
export function parseQoSRuleTarget(target: string): IQoSRuleTarget | null {
	const bracketed = target.match(/^\[([^\]]+)]:(\d+):([A-Za-z]+)$/);
	const legacyIPv4 = target.match(/^([^:[\]]+):(\d+):([A-Za-z]+)$/);
	const match = bracketed ?? legacyIPv4;
	if (!match) return null;

	const externalIP = match[1];
	const port = Number(match[2]);
	const protocol = match[3].toLowerCase() as IQoSRuleTarget['protocol'];
	const isIPv6 = externalIP.includes(':');
	if (!isValidIPAddress(externalIP) || !isValidPort(port) || port === 0 || !QOS_RULE_PROTOCOLS.has(protocol)) {
		return null;
	}
	if ((bracketed !== null) !== isIPv6) return null;

	return {externalIP, port, protocol};
}

export function buildQoSRuleTarget(args: Pick<IServiceArguments, 'externalIP' | 'port' | 'protocol'>): string {
	const externalIP = args.externalIP.replace(/^\[([^\]]+)]$/, '$1');
	const wireIP = externalIP.includes(':') ? `[${externalIP}]` : externalIP;
	return `${wireIP}:${args.port}:${args.protocol.toLowerCase()}`;
}

export function qosAttachmentLabel(attachment: QoSAttachment): string {
	switch (attachment) {
		case 0: return 'Load-balancer rule';
		case 1: return 'Port ingress';
		case 2: return 'Port egress (host-originated)';
	}
}

export function qosTargetUrl(instanceName: string, target: IQoSTargetObject): string {
	const name = encodeURIComponent(instanceName);
	const object = encodeURIComponent(target.polObjName);
	if (target.attachment === 0) return `/instance/traffic/lb?name=${name}&qosTarget=${object}`;
	return `/instance/network/port?name=${name}&port=${object}`;
}

export function qosPoliciesForRule(policies: readonly IPolicyAttribute[], target: string): IPolicyAttribute[] {
	return policies.filter(policy => policy.targetObject.attachment === 0 && policy.targetObject.polObjName === target);
}
