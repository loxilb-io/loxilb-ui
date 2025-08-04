//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {INeighborData} from 'types/device_neighbor';

//---------------------------------------------------------
// Dummy Data
//---------------------------------------------------------
export const dummyData: INeighborData = {
	neighborAttr: [
		{
			ipAddress: '192.168.1.100',
			dev: 'eth0',
			macAddress: '00:1A:2B:3C:4D:5E',
		},
		{
			ipAddress: '192.168.1.101',
			dev: 'eth0',
			macAddress: '00:2B:3C:4D:5E:6F',
		},
		{
			ipAddress: '10.0.0.50',
			dev: 'eth1',
			macAddress: '00:3C:4D:5E:6F:7G',
		},
		{
			ipAddress: '10.0.0.51',
			dev: 'eth1',
			macAddress: '00:4D:5E:6F:7G:8H',
		},
		{
			ipAddress: '172.16.0.10',
			dev: 'eth2',
			macAddress: '00:5E:6F:7G:8H:9I',
		},
		{
			ipAddress: '172.16.0.11',
			dev: 'eth2',
			macAddress: '00:6F:7G:8H:9I:0J',
		},
		{
			ipAddress: '192.168.2.100',
			dev: 'eth3',
			macAddress: '00:7G:8H:9I:0J:1K',
		},
		{
			ipAddress: '192.168.2.101',
			dev: 'eth3',
			macAddress: '00:8H:9I:0J:1K:2L',
		},
		{
			ipAddress: '10.0.1.50',
			dev: 'eth4',
			macAddress: '00:9I:0J:1K:2L:3M',
		},
		{
			ipAddress: '10.0.1.51',
			dev: 'eth4',
			macAddress: '00:0J:1K:2L:3M:4N',
		},
	],
};
