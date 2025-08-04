//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {IVipConfiguration} from 'types/ha';

//---------------------------------------------------------
// Dummy Data
//---------------------------------------------------------
export const dummyData: IVipConfiguration = {
	Attr: [
		{
			instance: 'Instance-01',
			state: 'ACTIVE',
			vip: '192.168.1.100',
			sync: 1,
		},
		{
			instance: 'Instance-02',
			state: 'STANDBY',
			vip: '192.168.1.100',
			sync: 1,
		},
		{
			instance: 'Instance-03',
			state: 'ACTIVE',
			vip: '192.168.1.101',
			sync: 1,
		},
		{
			instance: 'Instance-04',
			state: 'STANDBY',
			vip: '192.168.1.101',
			sync: 1,
		},
		{
			instance: 'Instance-05',
			state: 'ACTIVE',
			vip: '192.168.1.102',
			sync: 0,
		},
		{
			instance: 'Instance-06',
			state: 'STANDBY',
			vip: '192.168.1.102',
			sync: 0,
		},
		{
			instance: 'Instance-07',
			state: 'ACTIVE',
			vip: '192.168.1.103',
			sync: 1,
		},
		{
			instance: 'Instance-08',
			state: 'STANDBY',
			vip: '192.168.1.103',
			sync: 1,
		},
		{
			instance: 'Instance-09',
			state: 'ACTIVE',
			vip: '192.168.1.104',
			sync: 1,
		},
		{
			instance: 'Instance-10',
			state: 'STANDBY',
			vip: '192.168.1.104',
			sync: 1,
		},
	],
};
