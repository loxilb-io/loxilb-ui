//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {IBgpNeighborState} from 'types/bgp_neighbor';

//---------------------------------------------------------
// Dummy Data
//---------------------------------------------------------
export const dummyData: IBgpNeighborState = {
	bgpNeiAttr: [
		{
			ipAddress: '192.168.1.1',
			remoteAs: 65001,
			state: 'Idle',
			updowntime: '10:05:30',
		},
		{
			ipAddress: '192.168.1.2',
			remoteAs: 65002,
			state: 'Active',
			updowntime: '15:03:45',
		},
		{
			ipAddress: '10.0.0.1',
			remoteAs: 65003,
			state: 'Established',
			updowntime: '25:12:00',
		},
		{
			ipAddress: '10.0.0.2',
			remoteAs: 65004,
			state: 'Idle',
			updowntime: '05:01:20',
		},
		{
			ipAddress: '172.16.0.1',
			remoteAs: 65005,
			state: 'Idle',
			updowntime: '15:03:45',
		},
		{
			ipAddress: '172.16.0.2',
			remoteAs: 65006,
			state: 'Idle',
			updowntime: '15:03:45',
		},
		{
			ipAddress: '192.168.2.1',
			remoteAs: 65007,
			state: 'Established',
			updowntime: '15:03:45',
		},
		{
			ipAddress: '192.168.2.2',
			remoteAs: 65008,
			state: 'Active',
			updowntime: '15:03:45',
		},
		{
			ipAddress: '10.0.1.1',
			remoteAs: 65009,
			state: 'Established',
			updowntime: '15:03:45',
		},
		{
			ipAddress: '10.0.1.2',
			remoteAs: 65010,
			state: 'OpenSent',
			updowntime: '15:03:45',
		},
	],
};
