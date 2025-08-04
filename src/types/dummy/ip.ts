//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {IIpData} from 'types/ip';

//---------------------------------------------------------
// Dummy Data
//---------------------------------------------------------
export const dummyData: IIpData = {
	ipAttr: [
		{
			dev: 'eth0',
			ipAddress: ['192.168.1.1', '10.0.0.1'],
			sync: 1,
		},
		{
			dev: 'eth1',
			ipAddress: ['192.168.1.2'],
			sync: 0,
		},
		{
			dev: 'wlan0',
			ipAddress: ['172.16.0.1', '172.16.0.2', '172.16.0.3'],
			sync: 1,
		},
		{
			dev: 'eth2',
			ipAddress: ['10.0.1.1'],
			sync: 0,
		},
		{
			dev: 'wlan1',
			ipAddress: ['192.168.2.1'],
			sync: 1,
		},
		{
			dev: 'eth3',
			ipAddress: ['172.16.1.1', '172.16.1.2'],
			sync: 0,
		},
		{
			dev: 'br0',
			ipAddress: ['192.168.3.1'],
			sync: 1,
		},
		{
			dev: 'eth4',
			ipAddress: ['10.0.2.1', '10.0.2.2'],
			sync: 0,
		},
		{
			dev: 'wlan2',
			ipAddress: ['192.168.4.1', '192.168.4.2'],
			sync: 1,
		},
		{
			dev: 'eth5',
			ipAddress: ['172.16.2.1'],
			sync: 0,
		},
	],
};
