//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {IDefinedSetsInfo} from 'types/bgp_defined_set';

//---------------------------------------------------------
// Dummy Data
//---------------------------------------------------------
export const dummyData: IDefinedSetsInfo = {
	definedsetsAttr: [
		// PRIMARY SET - all 6 types
		{
			name: 'primary',
			definedType: 'prefix',
			prefixList: [
				{
					ipPrefix: '10.0.0.0/8',
					masklengthRange: '16..24',
				},
				{
					ipPrefix: '172.16.0.0/12',
					masklengthRange: '16..24',
				},
			],
			list: ['allow-primary'],
		},
		{
			name: 'primary',
			definedType: 'neighbor',
			prefixList: [],
			list: ['192.0.2.1', '192.0.2.2'],
		},
		{
			name: 'primary',
			definedType: 'community',
			prefixList: [],
			list: ['65001:100', '65001:101'],
		},
		{
			name: 'primary',
			definedType: 'extcommunity',
			prefixList: [],
			list: ['rt:65001:100', 'rt:65001:101'],
		},
		{
			name: 'primary',
			definedType: 'aspath',
			prefixList: [],
			list: ['^65001_', '^65101_'],
		},
		{
			name: 'primary',
			definedType: 'largecommunity',
			prefixList: [],
			list: ['65001:100:1', '65001:100:2'],
		},

		// SECONDARY SET - all 6 types
		{
			name: 'secondary',
			definedType: 'prefix',
			prefixList: [
				{
					ipPrefix: '192.168.0.0/16',
					masklengthRange: '24..32',
				},
			],
			list: ['allow-secondary'],
		},
		{
			name: 'secondary',
			definedType: 'neighbor',
			prefixList: [],
			list: ['203.0.113.1', '203.0.113.2'],
		},
		{
			name: 'secondary',
			definedType: 'community',
			prefixList: [],
			list: ['65001:200', '65001:201'],
		},
		{
			name: 'secondary',
			definedType: 'extcommunity',
			prefixList: [],
			list: ['ro:65001:200', 'ro:65001:201'],
		},
		{
			name: 'secondary',
			definedType: 'aspath',
			prefixList: [],
			list: ['_65002$', '_65102$'],
		},
		{
			name: 'secondary',
			definedType: 'largecommunity',
			prefixList: [],
			list: ['65001:200:1', '65001:200:2'],
		},

		// TERTIARY SET - all 6 types
		{
			name: 'tertiary',
			definedType: 'prefix',
			prefixList: [
				{
					ipPrefix: '198.51.100.0/24',
					masklengthRange: '24..32',
				},
				{
					ipPrefix: '203.0.113.0/24',
					masklengthRange: '24..32',
				},
			],
			list: ['allow-tertiary'],
		},
		{
			name: 'tertiary',
			definedType: 'neighbor',
			prefixList: [],
			list: ['198.51.100.1', '198.51.100.2'],
		},
		{
			name: 'tertiary',
			definedType: 'community',
			prefixList: [],
			list: ['65001:300', '65001:301'],
		},
		{
			name: 'tertiary',
			definedType: 'extcommunity',
			prefixList: [],
			list: ['bw:65001:1000', 'bw:65001:2000'],
		},
		{
			name: 'tertiary',
			definedType: 'aspath',
			prefixList: [],
			list: ['_65003_', '_65103_'],
		},
		{
			name: 'tertiary',
			definedType: 'largecommunity',
			prefixList: [],
			list: ['65001:300:1', '65001:300:2'],
		},

		// QUATERNARY SET - all 6 types
		{
			name: 'quaternary',
			definedType: 'prefix',
			prefixList: [
				{
					ipPrefix: '8.8.8.0/24',
					masklengthRange: '24..32',
				},
				{
					ipPrefix: '1.1.1.0/24',
					masklengthRange: '24..32',
				},
			],
			list: ['allow-quaternary'],
		},
		{
			name: 'quaternary',
			definedType: 'neighbor',
			prefixList: [],
			list: ['192.0.2.3', '192.0.2.4'],
		},
		{
			name: 'quaternary',
			definedType: 'community',
			prefixList: [],
			list: ['65001:400', '65001:401'],
		},
		{
			name: 'quaternary',
			definedType: 'extcommunity',
			prefixList: [],
			list: ['soo:65001:300', 'soo:65001:301'],
		},
		{
			name: 'quaternary',
			definedType: 'aspath',
			prefixList: [],
			list: ['_65666_', '_65999_'],
		},
		{
			name: 'quaternary',
			definedType: 'largecommunity',
			prefixList: [],
			list: ['65001:400:1', '65001:400:2'],
		},
	],
};
