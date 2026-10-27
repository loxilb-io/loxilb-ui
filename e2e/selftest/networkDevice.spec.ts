//---------------------------------------------------------
// Self-tests for the network spec device choice (e2e/helpers/networkDevice.ts)
//---------------------------------------------------------
// On a host-network gateway a network spec writes to the host. These pin that
// the shared picker never hands a spec a Docker bridge or a loxilb-owned
// interface, and that ip.spec's edit target is an address of that device only.
// Pure: no page, no testbed.
import {expect, test} from '@playwright/test';
import {IpAttr, pickPrimaryNetworkDevice, PortAttr, uniqueAddressOf} from '../helpers/networkDevice';

const isDocAddr = (cidr: string) => /^(203\.0\.113\.|198\.51\.100\.)/.test(cidr);

const port = (portName: string, portNo: number, portActive = true, portType = 1): PortAttr =>
	({portName, portNo, portSoftwareInformation: {portActive, portType}});

test('N-01 container bridges, loopback and loxilb interfaces are never picked, whatever their order', () => {
	const ports = [port('lo', 1), port('docker0', 2), port('br-0a1b2c3d4e5f', 3), port('llb0', 4), port('vlan3801', 5), port('enp0s4', 9)];
	expect(pickPrimaryNetworkDevice(ports)).toBe('enp0s4');
	expect(pickPrimaryNetworkDevice([...ports].reverse())).toBe('enp0s4');
});

test('N-02 a host with only bridges and loopback offers no device at all', () => {
	expect(pickPrimaryNetworkDevice([port('lo', 1), port('docker0', 2), port('br-0123456789ab', 3)])).toBeUndefined();
});

test('N-03 active before inactive, physical before virtual, then the lowest port number', () => {
	expect(pickPrimaryNetworkDevice([port('eth0', 1, false), port('eth1', 2, true)])).toBe('eth1');
	expect(pickPrimaryNetworkDevice([port('veth1', 1, true, 2), port('eth1', 2, true, 1)])).toBe('eth1');
	expect(pickPrimaryNetworkDevice([port('eth2', 3), port('eth1', 2)])).toBe('eth1');
});

test('N-04 the edit target is an address of the picked device, never of another one', () => {
	const attrs: IpAttr[] = [
		{dev: 'lo', ipAddress: ['127.0.0.1/8']},
		{dev: 'br-0a1b2c3d4e5f', ipAddress: ['172.18.0.1/16']},
		{dev: 'enp0s4', ipAddress: ['203.0.113.30/32', '10.1.0.2/24']},
	];
	expect(uniqueAddressOf(attrs, 'enp0s4', isDocAddr)).toBe('10.1.0.2');
});

test('N-05 an address another device also holds is not a usable row', () => {
	const attrs: IpAttr[] = [
		{dev: 'eth0', ipAddress: ['172.22.0.1/16']},
		{dev: 'br-1', ipAddress: ['172.22.0.1/16']},
	];
	expect(uniqueAddressOf(attrs, 'eth0', isDocAddr)).toBeUndefined();
	expect(uniqueAddressOf(attrs, 'missing', isDocAddr)).toBeUndefined();
});
