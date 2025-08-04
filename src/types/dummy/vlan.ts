//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {IVlanData} from 'types/vlan';

//---------------------------------------------------------
// Dummy Data
//---------------------------------------------------------
export const dummyData: IVlanData = {
	vlanAttr: [
		{
			vid: 10,
			dev: 'eth0',
			member: [
				{
					dev: 'eth1',
					tagged: true,
				},
				{
					dev: 'eth2',
					tagged: false,
				},
			],
			vlanStatistic: {
				inBytes: 15240,
				inPackets: 125,
				outBytes: 18960,
				outPackets: 158,
			},
		},
		{
			vid: 20,
			dev: 'eth3',
			member: [
				{
					dev: 'eth4',
					tagged: true,
				},
				{
					dev: 'eth5',
					tagged: true,
				},
			],
			vlanStatistic: {
				inBytes: 28560,
				inPackets: 238,
				outBytes: 31440,
				outPackets: 262,
			},
		},
		{
			vid: 30,
			dev: 'eth6',
			member: [
				{
					dev: 'eth7',
					tagged: false,
				},
			],
			vlanStatistic: {
				inBytes: 42680,
				inPackets: 356,
				outBytes: 52840,
				outPackets: 440,
			},
		},
		{
			vid: 40,
			dev: 'eth8',
			member: [
				{
					dev: 'eth9',
					tagged: true,
				},
				{
					dev: 'eth10',
					tagged: false,
				},
			],
			vlanStatistic: {
				inBytes: 8460,
				inPackets: 72,
				outBytes: 12480,
				outPackets: 104,
			},
		},
		{
			vid: 50,
			dev: 'eth11',
			member: [
				{
					dev: 'eth12',
					tagged: true,
				},
			],
			vlanStatistic: {
				inBytes: 35680,
				inPackets: 298,
				outBytes: 25320,
				outPackets: 211,
			},
		},
	],
};
