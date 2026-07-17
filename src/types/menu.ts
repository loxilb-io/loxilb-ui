//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import CloudIcon from '@mui/icons-material/Cloud';
import MonitorIcon from '@mui/icons-material/Monitor';
import RouteIcon from '@mui/icons-material/Route';
import WysiwygIcon from '@mui/icons-material/Wysiwyg';
import SecurityIcon from '@mui/icons-material/Security';
import {SvgIconTypeMap} from '@mui/material';
import {OverridableComponent} from '@mui/material/OverridableComponent';

//---------------------------------------------------------
// Menu Structure
//---------------------------------------------------------
export interface IMenuItem {
	name: string;
	path: string;
	icon?: OverridableComponent<SvgIconTypeMap<{}, 'svg'>> & {muiName: string};
	items?: readonly IMenuItem[];
	// RBAC Phase 3: when set, the item is shown only to these roles
	// ('admin' | 'operator' | 'viewer'); unset = visible to every role.
	roles?: readonly string[];
}

export const MENU_LIST: IMenuItem[] = [
	{
		name: 'Traffic',
		icon: RouteIcon,
		path: 'traffic',
		items: [
			{
				name: 'LB Rule',
				path: 'lb',
			},
			{
				name: 'Endpoint',
				path: 'endpoint',
			},
			{
				name: 'Conntrack',
				path: 'ct',
			},
			{
				name: 'Firewall',
				path: 'fw',
			},
			{
				name: 'QoS',
				path: 'qos',
			},
			{
				name: 'Mirror',
				path: 'mirror',
			},			
			{
				name: 'SNI Certificates',
				path: 'sni-certs',
			},
		],
	},
	{
		name: 'Security',
		icon: SecurityIcon,
		path: 'security',
		items: [
			{
				name: 'IP Filter(XDP)',
				path: 'ipfilter',
			},
			{
				name: 'SYN Flood Protection(XDP)',
				path: 'synflood',
			},
			{
				name: 'Security Rate Limiting(XDP)',
				path: 'securityrate',
			},
		],
	},
	{
		name: 'Networks',
		icon: CloudIcon,
		path: 'network',
		items: [			
			{
				name: 'Port',
				path: 'port',
			},			
			// {
			// 	name: 'VLAN',
			// 	path: 'vlan',
			// },
			// {
			// 	name: 'VxLAN',
			// 	path: 'vxlan',
			// },
			// {
			// 	name: 'FDB(MAC Address Table)',
			// 	path: 'fdb',
			// },
			{
				name: 'IP Address',
				path: 'ip',
			},
			{
				name: 'IP Neighbor(ARP/NDP)',
				path: 'neighbor',
			},
			{
				name: 'IP Route',
				path: 'route',
			},
			{
				name: 'BFD',
				path: 'bfd',
			},
			// {
			// 	name: 'BGP',
			// 	path: 'bgp',
			// 	items: [
			// 		{
			// 			name: 'Defined Sets',
			// 			path: 'set',
			// 		},
			// 		{
			// 			name: 'Definition',
			// 			path: 'def',
			// 		},
			// 		{
			// 			name: 'Apply',
			// 			path: 'apply',
			// 		},
			// 		{
			// 			name: 'Neighbors',
			// 			path: 'neighbor',
			// 		},
			// 	],
			// },
		],
	},	
	{
		name: 'Status',
		icon: MonitorIcon,
		path: 'status',
		items: [
			{
				name: 'Device Details',
				path: 'device',
			},
			{
				name: 'File System',
				path: 'fs',
			},
			{
				name: 'High Availability',
				path: 'ha',
			},
			{
				name: 'Process',
				path: 'process',
			},
			{
				name: 'Logs',
				path: 'logs',
			},
		],
	},
	{
		name: 'Log Settings',
		icon: WysiwygIcon,
		path: 'settings',
	},
];
