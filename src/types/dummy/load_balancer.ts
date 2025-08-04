//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {ILBData} from 'types/load_balancer';

//---------------------------------------------------------
// Dummy Data
//---------------------------------------------------------
export const dummyData: ILBData = {
	lbAttr: [
		{
			serviceArguments: {
				externalIP: '203.0.113.10',
				privateIP: '10.0.1.10',
				port: 443,
				portMax: 443, // Added portMax with the same value as port
				protocol: 'tcp',
				sel: 1,
				bgp: true,
				monitor: true,
				probetype: 'http',
				probeport: 80,
				probereq: 'GET /health',
				proberesp: '200 OK',
				managed: true,
				mode: 2,
				security: 1,
				block: 0,
				inactiveTimeOut: 300,
				probeTimeout: 5,
				probeRetries: 3,
				name: 'http',
				snat: true,
				oper: 1,
				host: 'example.com',
				proxyprotocolv2: true,
				egress: false, // Added egress property with default value of false
			},
			endpoints: [
				{
					endpointIP: '10.0.2.10',
					weight: 100,
					targetPort: 8443,
					state: 'active',
					counter: 'endpoint-1',
				},
				{
					endpointIP: '10.0.2.11',
					weight: 100,
					targetPort: 8443,
					state: 'active',
					counter: 'endpoint-2',
				},
				{
					endpointIP: '10.0.2.12',
					weight: 50,
					targetPort: 8443,
					state: 'standby',
					counter: 'endpoint-3',
				},
			],
			secondaryIPs: [
				{
					secondaryIP: '203.0.113.11',
				},
				{
					secondaryIP: '203.0.113.12',
				},
			],
			allowedSources: [
				{
					prefix: '192.168.0.0/16',
				},
				{
					prefix: '172.16.0.0/12',
				},
				{
					prefix: '10.0.0.0/8',
				},
			],
		},
	],
};
