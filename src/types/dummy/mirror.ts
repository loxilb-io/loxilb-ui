//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {IMirrorConfiguration} from 'types/mirror';

//---------------------------------------------------------
// Dummy Data
//---------------------------------------------------------
export const dummyData: IMirrorConfiguration = {
	mirrAttr: [
		{
			mirrorIdent: 'mirror-001',
			mirrorInfo: {
				type: 1,
				port: 'eth0',
				vlan: 100,
				remoteIP: '192.168.1.10',
				sourceIP: '192.168.1.1',
				tunnelID: 1001,
			},
			targetObject: {
				attachment: 1,
				mirrObjName: 'http',
			},
			sync: 1,
		},
		{
			mirrorIdent: 'mirror-002',
			mirrorInfo: {
				type: 2,
				port: 'eth1',
				vlan: 200,
				remoteIP: '192.168.2.10',
				sourceIP: '192.168.2.1',
				tunnelID: 1002,
			},
			targetObject: {
				attachment: 2,
				mirrObjName: 'http',
			},
			sync: 1,
		},
		{
			mirrorIdent: 'mirror-003',
			mirrorInfo: {
				type: 1,
				port: 'eth2',
				vlan: 300,
				remoteIP: '192.168.3.10',
				sourceIP: '192.168.3.1',
				tunnelID: 1003,
			},
			targetObject: {
				attachment: 1,
				mirrObjName: 'app-server-1',
			},
			sync: 0,
		},
		{
			mirrorIdent: 'mirror-004',
			mirrorInfo: {
				type: 3,
				port: 'eth3',
				vlan: 400,
				remoteIP: '192.168.4.10',
				sourceIP: '192.168.4.1',
				tunnelID: 1004,
			},
			targetObject: {
				attachment: 3,
				mirrObjName: 'storage-1',
			},
			sync: 1,
		},
		{
			mirrorIdent: 'mirror-005',
			mirrorInfo: {
				type: 2,
				port: 'eth4',
				vlan: 500,
				remoteIP: '192.168.5.10',
				sourceIP: '192.168.5.1',
				tunnelID: 1005,
			},
			targetObject: {
				attachment: 2,
				mirrObjName: 'backup-server-1',
			},
			sync: 1,
		},
		{
			mirrorIdent: 'mirror-006',
			mirrorInfo: {
				type: 1,
				port: 'test-device-1', // Test device name
				vlan: 600,
				remoteIP: '192.168.6.10',
				sourceIP: '192.168.6.1',
				tunnelID: 1006,
			},
			targetObject: {
				attachment: 1,
				mirrObjName: 'api-server-1',
			},
			sync: 1,
		},
		{
			mirrorIdent: 'mirror-007',
			mirrorInfo: {
				type: 2,
				port: 'test-device-1', // Same test device name
				vlan: 700,
				remoteIP: '192.168.7.10',
				sourceIP: '192.168.7.1',
				tunnelID: 1007,
			},
			targetObject: {
				attachment: 2,
				mirrObjName: 'log-server-1',
			},
			sync: 1,
		},
		{
			mirrorIdent: 'mirror-008',
			mirrorInfo: {
				type: 3,
				port: 'test-device-2', // Another test device
				vlan: 800,
				remoteIP: '192.168.8.10',
				sourceIP: '192.168.8.1',
				tunnelID: 1008,
			},
			targetObject: {
				attachment: 1,
				mirrObjName: 'cache-server-1',
			},
			sync: 1,
		},
	],
};
