//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import CloudIcon from '@mui/icons-material/Cloud';
import SettingsBackupRestoreIcon from '@mui/icons-material/SettingsBackupRestore';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import VpnLockIcon from '@mui/icons-material/VpnLock';
import MonitorIcon from '@mui/icons-material/Monitor';
import RouteIcon from '@mui/icons-material/Route';
import WysiwygIcon from '@mui/icons-material/Wysiwyg';
import SecurityIcon from '@mui/icons-material/Security';
import {SvgIconTypeMap} from '@mui/material';
import {OverridableComponent} from '@mui/material/OverridableComponent';
import type {InstanceFeature, InstanceFlavor} from 'api/capabilities';

//---------------------------------------------------------
// Menu Structure
//---------------------------------------------------------
export interface IMenuItem {
	name: string;
	path: string;
	icon?: OverridableComponent<SvgIconTypeMap<{}, 'svg'>> & {muiName: string};
	items?: readonly IMenuItem[];
	// RBAC: when set, the item is shown only to these roles
	// ('admin' | 'operator' | 'viewer'); unset = visible to every role.
	roles?: readonly string[];
	// Flavor gating: shown only when the current instance has the feature
	// family (answered from the generated capability map — upstream loxilb
	// lacks these API families entirely). Unset = every flavor.
	requiresFeature?: InstanceFeature;
	// Direct flavor gate for pages whose endpoints are undeclared in the
	// backend specs and therefore invisible to the capability map (Snapshots).
	requiresFlavor?: InstanceFlavor;
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
				requiresFeature: 'sniCerts',
			},
		],
	},
	{
		name: 'AI Gateway',
		icon: SmartToyIcon,
		path: 'ai',
		requiresFeature: 'ai',
		items: [
			{
				name: 'API Keys',
				path: 'apikey',
			},
			// Tenant Rate Limits hidden (decision 2026-07-17): the gateway's
			// AI quota API is tenant-mandatory and only active when the gateway
			// runs with --userservice; page + route stay at /instance/ai/ratelimit.
			// {
			// 	name: 'Tenant Rate Limits',
			// 	path: 'ratelimit',
			// },
		],
	},
	{
		name: 'IPsec VPN',
		icon: VpnLockIcon,
		path: 'ipsec',
		requiresFeature: 'ipsec',
		items: [
			{
				name: 'Tunnels',
				path: 'tunnels',
			},
			{
				name: 'Certificates',
				path: 'certs',
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
				requiresFeature: 'ipfilter',
			},
			{
				name: 'Security Rate Limiting(XDP)',
				path: 'securityrate',
				requiresFeature: 'securityrate',
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
				// /config/ipv6address is gateway-only — upstream loxilb has no
				// IPv6 address API family at all.
				name: 'IPv6 Address',
				path: 'ip6',
				requiresFeature: 'ipv6',
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
		// Instance lifecycle operations (upgrade runbook); room for future
		// items (upgrade assistant, log bundles) — docs/SNAPSHOT_UI_DESIGN.md §3.
		name: 'Maintenance',
		icon: SettingsBackupRestoreIcon,
		path: 'maintenance',
		items: [
			{
				// OAM snapshot flow needs the gateway's persist/restore side;
				// undeclared in the specs, so gated on flavor directly.
				name: 'Snapshots',
				path: 'snapshots',
				requiresFlavor: 'inference-gateway',
			},
		],
	},
	{
		name: 'Log Settings',
		icon: WysiwygIcon,
		path: 'settings',
	},
];
