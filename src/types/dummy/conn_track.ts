//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {ICtData} from 'types/conn_track';

//---------------------------------------------------------
// Dummy Data
//---------------------------------------------------------
export const dummyData: ICtData = {
	ctAttr: [
		{
			destinationIP: '192.168.1.100',
			sourceIP: '10.0.0.50',
			destinationPort: 80,
			sourcePort: 45123,
			protocol: 'TCP',
			conntrackState: 'ESTABLISHED',
			ident: 'web_service_1',
			conntrackAct: 'ACTIVE',
			packets: 1250,
			bytes: 128500,
			servName: 'http',
		},
		{
			destinationIP: '192.168.1.101',
			sourceIP: '10.0.0.51',
			destinationPort: 443,
			sourcePort: 52364,
			protocol: 'TCP',
			conntrackState: 'ESTABLISHED',
			ident: 'secure_web',
			conntrackAct: 'ACTIVE',
			packets: 2340,
			bytes: 256780,
			servName: 'https',
		},
		{
			destinationIP: '192.168.1.102',
			sourceIP: '10.0.0.52',
			destinationPort: 22,
			sourcePort: 58769,
			protocol: 'TCP',
			conntrackState: 'ESTABLISHED',
			ident: 'ssh_conn',
			conntrackAct: 'ACTIVE',
			packets: 850,
			bytes: 75600,
			servName: 'ssh',
		},
		{
			destinationIP: '192.168.1.103',
			sourceIP: '10.0.0.53',
			destinationPort: 3306,
			sourcePort: 49152,
			protocol: 'TCP',
			conntrackState: 'ESTABLISHED',
			ident: 'db_conn',
			conntrackAct: 'ACTIVE',
			packets: 4560,
			bytes: 512300,
			servName: 'mysql',
		},
		{
			destinationIP: '192.168.1.104',
			sourceIP: '10.0.0.54',
			destinationPort: 53,
			sourcePort: 62345,
			protocol: 'UDP',
			conntrackState: 'NEW',
			ident: 'dns_query',
			conntrackAct: 'ACTIVE',
			packets: 120,
			bytes: 8640,
			servName: 'dns',
		},
	],
};
