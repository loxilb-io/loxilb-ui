//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {IVxlanData} from 'types/vxlan';

//---------------------------------------------------------
// Dummy Data
//---------------------------------------------------------
export const dummyData: IVxlanData = {
	vxlanAttr: [
		{
			vxlanName: 'vxlan0',
			epIntf: 'eth0',
			vxlanID: 10000,
			peerIP: ['192.168.1.100'],
		},
		{
			vxlanName: 'vxlan1',
			epIntf: 'eth1',
			vxlanID: 10001,
			peerIP: ['192.168.1.101'],
		},
		{
			vxlanName: 'vxlan2',
			epIntf: 'eth2',
			vxlanID: 10002,
			peerIP: ['192.168.1.102'],
		},
		{
			vxlanName: 'vxlan3',
			epIntf: 'eth3',
			vxlanID: 10003,
			peerIP: ['192.168.1.103'],
		},
		{
			vxlanName: 'vxlan4',
			epIntf: 'eth4',
			vxlanID: 10004,
			peerIP: ['192.168.1.104'],
		},
	],
};
