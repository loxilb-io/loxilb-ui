//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {IRouteData} from 'types/route_attr';

//---------------------------------------------------------
// Dummy Data
//---------------------------------------------------------
export const dummyData: IRouteData = {
	routeAttr: [
		{
			destinationIPNet: '192.168.1.0/24',
			gateway: '192.168.1.1',
			hardwareMark: 100,
			protocol: 'STATIC',
			flags: 'UP',
			sync: 1,
			statistic: {
				bytes: 15240,
				packets: 125,
			},
		},
		{
			destinationIPNet: '10.0.0.0/8',
			gateway: '10.0.0.1',
			hardwareMark: 200,
			protocol: 'OSPF',
			flags: 'UP,GATEWAY',
			sync: 0,
			statistic: {
				bytes: 28560,
				packets: 238,
			},
		},
		{
			destinationIPNet: '172.16.0.0/16',
			gateway: '172.16.0.1',
			hardwareMark: 300,
			protocol: 'BGP',
			flags: 'UP,DYNAMIC',
			sync: 1,
			statistic: {
				bytes: 42680,
				packets: 356,
			},
		},
		{
			destinationIPNet: '192.168.2.0/24',
			gateway: '192.168.2.1',
			hardwareMark: 400,
			protocol: 'STATIC',
			flags: 'UP',
			sync: 0,
			statistic: {
				bytes: 8460,
				packets: 72,
			},
		},
		{
			destinationIPNet: '10.1.0.0/16',
			gateway: '10.1.0.1',
			hardwareMark: 500,
			protocol: 'RIP',
			flags: 'UP,GATEWAY',
			sync: 1,
			statistic: {
				bytes: 35680,
				packets: 298,
			},
		},
		{
			destinationIPNet: '172.17.0.0/16',
			gateway: '172.17.0.1',
			hardwareMark: 600,
			protocol: 'STATIC',
			flags: 'UP',
			sync: 0,
			statistic: {
				bytes: 12480,
				packets: 104,
			},
		},
		{
			destinationIPNet: '192.168.3.0/24',
			gateway: '192.168.3.1',
			hardwareMark: 700,
			protocol: 'OSPF',
			flags: 'UP,DYNAMIC',
			sync: 1,
			statistic: {
				bytes: 52840,
				packets: 440,
			},
		},
		{
			destinationIPNet: '10.2.0.0/16',
			gateway: '10.2.0.1',
			hardwareMark: 800,
			protocol: 'BGP',
			flags: 'UP,GATEWAY',
			sync: 0,
			statistic: {
				bytes: 18960,
				packets: 158,
			},
		},
		{
			destinationIPNet: '172.18.0.0/16',
			gateway: '172.18.0.1',
			hardwareMark: 900,
			protocol: 'STATIC',
			flags: 'UP',
			sync: 1,
			statistic: {
				bytes: 25320,
				packets: 211,
			},
		},
		{
			destinationIPNet: '192.168.4.0/24',
			gateway: '192.168.4.1',
			hardwareMark: 1000,
			protocol: 'RIP',
			flags: 'UP,DYNAMIC',
			sync: 0,
			statistic: {
				bytes: 31440,
				packets: 262,
			},
		},
	],
};
