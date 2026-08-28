import {describe, expect, it} from 'vitest';
import {
	buildQoSRuleTarget,
	IPolicyAttribute,
	parseQoSRuleTarget,
	qosAttachmentLabel,
	qosPoliciesForRule,
	qosTargetUrl,
} from './qos';

const policy = (attachment: 0 | 1 | 2, target: string): IPolicyAttribute => ({
	policyIdent: `policy-${attachment}`,
	policyInfo: {
		type: 0,
		colorAware: false,
		committedInfoRate: 10,
		peakInfoRate: 10,
		committedBlkSize: 125000,
		excessBlkSize: 0,
	},
	targetObject: {attachment, polObjName: target},
});

describe('QoS target contract', () => {
	it('builds the Gateway VIP:PORT:PROTO rule key', () => {
		expect(buildQoSRuleTarget({externalIP: '20.20.20.1', port: 2020, protocol: 'TCP'})).toBe('20.20.20.1:2020:tcp');
	});

	it('brackets IPv6 rule keys without double-bracketing existing literals', () => {
		expect(buildQoSRuleTarget({externalIP: '2001:db8::20', port: 443, protocol: 'TCP'})).toBe('[2001:db8::20]:443:tcp');
		expect(buildQoSRuleTarget({externalIP: '[2001:db8::20]', port: 443, protocol: 'UDP'})).toBe('[2001:db8::20]:443:udp');
	});

	it('parses legacy IPv4 and bracketed IPv6 attachment keys', () => {
		expect(parseQoSRuleTarget('20.20.20.1:2020:TCP')).toEqual({externalIP: '20.20.20.1', port: 2020, protocol: 'tcp'});
		expect(parseQoSRuleTarget('[2001:db8::20]:443:sctp')).toEqual({externalIP: '2001:db8::20', port: 443, protocol: 'sctp'});
	});

	it.each([
		'2001:db8::20:443:tcp',
		'[2001:db8::20:443:tcp',
		'[2001:db8::20]:0:tcp',
		'[2001:db8::20]:65536:tcp',
		'[2001:db8::20]:443:icmp',
		'[20.20.20.1]:443:tcp',
	])('rejects malformed or ambiguous attachment key %s', target => {
		expect(parseQoSRuleTarget(target)).toBeNull();
	});

	it('filters LB details by attachment zero and composite key', () => {
		const target = '20.20.20.1:2020:tcp';
		const policies = [policy(0, target), policy(0, '20.20.20.2:2020:tcp'), policy(2, target)];
		expect(qosPoliciesForRule(policies, target)).toEqual([policies[0]]);
	});

	it('routes both port attachments to port details and rule attachment to LB details', () => {
		expect(qosTargetUrl('gw one', {attachment: 0, polObjName: '20.20.20.1:2020:tcp'})).toBe(
			'/instance/traffic/lb?name=gw%20one&qosTarget=20.20.20.1%3A2020%3Atcp',
		);
		expect(qosTargetUrl('gw one', {attachment: 1, polObjName: 'eth 1'})).toBe(
			'/instance/network/port?name=gw%20one&port=eth%201',
		);
		expect(qosTargetUrl('gw one', {attachment: 2, polObjName: 'eth 1'})).toBe(
			'/instance/network/port?name=gw%20one&port=eth%201',
		);
	});

	it('uses operator-facing attachment labels', () => {
		expect(qosAttachmentLabel(0)).toBe('Load-balancer rule');
		expect(qosAttachmentLabel(1)).toBe('Port ingress');
		expect(qosAttachmentLabel(2)).toBe('Port egress (host-originated)');
	});
});
