//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {IBFDAttribureInfo} from 'types/bfd';

//---------------------------------------------------------
// Dummy Data
//---------------------------------------------------------
export const dummyData: IBFDAttribureInfo = {
	Attr: [
		{
			instance: 'server-01',
			remoteIp: '192.168.1.100',
			sourceIP: '10.0.0.1',
			port: 8080,
			interval: 1000,
			retryCount: 3,
			state: 'active',
		},
		{
			instance: 'server-02',
			remoteIp: '192.168.1.101',
			sourceIP: '10.0.0.2',
			port: 3000,
			interval: 2000,
			retryCount: 5,
			state: 'inactive',
		},
		{
			instance: 'server-03',
			remoteIp: '192.168.1.102',
			sourceIP: '10.0.0.3',
			port: 4000,
			interval: 1500,
			retryCount: 2,
			state: 'active',
		},
		{
			instance: 'server-04',
			remoteIp: '192.168.1.103',
			sourceIP: '10.0.0.4',
			port: 5000,
			interval: 3000,
			retryCount: 4,
			state: 'pending',
		},
		{
			instance: 'server-05',
			remoteIp: '192.168.1.104',
			sourceIP: '10.0.0.5',
			port: 6000,
			interval: 2500,
			retryCount: 1,
			state: 'active',
		},
		{
			instance: 'server-06',
			remoteIp: '192.168.1.105',
			sourceIP: '10.0.0.6',
			port: 7000,
			interval: 1800,
			retryCount: 6,
			state: 'inactive',
		},
		{
			instance: 'server-07',
			remoteIp: '192.168.1.106',
			sourceIP: '10.0.0.7',
			port: 8000,
			interval: 2200,
			retryCount: 3,
			state: 'active',
		},
		{
			instance: 'server-08',
			remoteIp: '192.168.1.107',
			sourceIP: '10.0.0.8',
			port: 9000,
			interval: 1700,
			retryCount: 4,
			state: 'pending',
		},
		{
			instance: 'server-09',
			remoteIp: '192.168.1.108',
			sourceIP: '10.0.0.9',
			port: 10000,
			interval: 2800,
			retryCount: 2,
			state: 'active',
		},
		{
			instance: 'server-10',
			remoteIp: '192.168.1.109',
			sourceIP: '10.0.0.10',
			port: 11000,
			interval: 1900,
			retryCount: 5,
			state: 'inactive',
		},
	],
};
