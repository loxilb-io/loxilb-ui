//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {ISessionConfiguration} from 'types/session';

//---------------------------------------------------------
// Dummy Data
//---------------------------------------------------------
export const dummyData: ISessionConfiguration = {
	sessionAttr: [
		{
			ident: 'session-001',
			sessionIP: '10.0.1.100',
			accessNetworkTunnel: {
				TeID: 1001,
				tunnelIP: '172.16.1.1',
			},
			coreNetworkTunnel: {
				teID: 2001,
				tunnelIP: '192.168.1.1',
			},
		},
		{
			ident: 'session-002',
			sessionIP: '10.0.1.101',
			accessNetworkTunnel: {
				TeID: 1002,
				tunnelIP: '172.16.1.2',
			},
			coreNetworkTunnel: {
				teID: 2002,
				tunnelIP: '192.168.1.2',
			},
		},
		{
			ident: 'session-003',
			sessionIP: '10.0.1.102',
			accessNetworkTunnel: {
				TeID: 1003,
				tunnelIP: '172.16.1.3',
			},
			coreNetworkTunnel: {
				teID: 2003,
				tunnelIP: '192.168.1.3',
			},
		},
		{
			ident: 'session-004',
			sessionIP: '10.0.1.103',
			accessNetworkTunnel: {
				TeID: 1004,
				tunnelIP: '172.16.1.4',
			},
			coreNetworkTunnel: {
				teID: 2004,
				tunnelIP: '192.168.1.4',
			},
		},
		{
			ident: 'session-005',
			sessionIP: '10.0.1.104',
			accessNetworkTunnel: {
				TeID: 1005,
				tunnelIP: '172.16.1.5',
			},
			coreNetworkTunnel: {
				teID: 2005,
				tunnelIP: '192.168.1.5',
			},
		},
	],
};
