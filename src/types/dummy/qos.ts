//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {IPolicyConfiguration} from 'types/qos';

//---------------------------------------------------------
// Dummy Data
//---------------------------------------------------------
export const dummyData: IPolicyConfiguration = {
	polAttr: [
		{
			policyIdent: 'policy-001',
			policyInfo: {
				type: 1,
				colorAware: true,
				committedInfoRate: 1000000,
				peakInfoRate: 2000000,
				committedBlkSize: 1500,
				excessBlkSize: 2000,
			},
			targetObject: {
				attachment: 1,
				polObjName: 'eth1',
			},
		},
		{
			policyIdent: 'policy-002',
			policyInfo: {
				type: 2,
				colorAware: false,
				committedInfoRate: 500000,
				peakInfoRate: 1000000,
				committedBlkSize: 1000,
				excessBlkSize: 1500,
			},
			targetObject: {
				attachment: 2,
				polObjName: 'backup-traffic',
			},
		},
		{
			policyIdent: 'policy-003',
			policyInfo: {
				type: 1,
				colorAware: true,
				committedInfoRate: 2000000,
				peakInfoRate: 3000000,
				committedBlkSize: 2000,
				excessBlkSize: 2500,
			},
			targetObject: {
				attachment: 3,
				polObjName: 'streaming-traffic',
			},
		},
		{
			policyIdent: 'policy-004',
			policyInfo: {
				type: 3,
				colorAware: true,
				committedInfoRate: 3000000,
				peakInfoRate: 4000000,
				committedBlkSize: 2500,
				excessBlkSize: 3000,
			},
			targetObject: {
				attachment: 1,
				polObjName: 'database-traffic',
			},
		},
		{
			policyIdent: 'policy-005',
			policyInfo: {
				type: 2,
				colorAware: false,
				committedInfoRate: 1500000,
				peakInfoRate: 2500000,
				committedBlkSize: 1800,
				excessBlkSize: 2200,
			},
			targetObject: {
				attachment: 2,
				polObjName: 'api-traffic',
			},
		},
		{
			policyIdent: 'policy-006',
			policyInfo: {
				type: 1,
				colorAware: true,
				committedInfoRate: 2500000,
				peakInfoRate: 3500000,
				committedBlkSize: 2200,
				excessBlkSize: 2800,
			},
			targetObject: {
				attachment: 1, // Attachment is 1
				polObjName: 'test-device-1', // Test device name
			},
		},
		{
			policyIdent: 'policy-007',
			policyInfo: {
				type: 2,
				colorAware: false,
				committedInfoRate: 1800000,
				peakInfoRate: 2800000,
				committedBlkSize: 2000,
				excessBlkSize: 2400,
			},
			targetObject: {
				attachment: 1, // Attachment is 1
				polObjName: 'test-device-1', // Same test device name
			},
		},
		{
			policyIdent: 'policy-008',
			policyInfo: {
				type: 3,
				colorAware: true,
				committedInfoRate: 3200000,
				peakInfoRate: 4200000,
				committedBlkSize: 2400,
				excessBlkSize: 3000,
			},
			targetObject: {
				attachment: 1, // Attachment is 1
				polObjName: 'test-device-2', // Another test device
			},
		},
		{
			policyIdent: 'policy-009',
			policyInfo: {
				type: 1,
				colorAware: false,
				committedInfoRate: 2200000,
				peakInfoRate: 3200000,
				committedBlkSize: 2100,
				excessBlkSize: 2600,
			},
			targetObject: {
				attachment: 0, // Attachment is NOT 1, should be filtered out
				polObjName: 'test-device-1',
			},
		},
	],
};
