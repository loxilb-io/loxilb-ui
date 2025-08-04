//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {IAlert} from 'types/alert';

//---------------------------------------------------------
// Dummy Data
//---------------------------------------------------------
export const dummyData: IAlert[] = [
	{
		created_at: '2025-02-01T09:15:23Z',
		id: 1001,
		instance_id: 5001,
		message: 'High CPU usage detected',
		resolved_at: '',
		severity: 'WARNING',
		type: 'HIGH_CPU',
	},
	{
		created_at: '2025-02-02T14:22:45Z',
		id: 1002,
		instance_id: 5002,
		message: 'Database connection timeout',
		resolved_at: '2025-02-02T15:10:33Z',
		severity: 'CRITICAL',
		type: 'DB_DISCONNECT',
	},
	{
		created_at: '2025-02-03T08:05:11Z',
		id: 1003,
		instance_id: 5001,
		message: 'Memory leak detected in application',
		resolved_at: '2025-02-03T12:30:55Z',
		severity: 'WARNING',
		type: 'MEMORY_LEAK',
	},
	{
		created_at: '2025-02-04T11:37:28Z',
		id: 1004,
		instance_id: 5003,
		message: 'API rate limit exceeded',
		resolved_at: '2025-02-04T11:42:15Z',
		severity: 'WARNING',
		type: 'API_UNREACHABLE',
	},
	{
		created_at: '2025-02-05T16:54:09Z',
		id: 1005,
		instance_id: 5002,
		message: 'Database query failing',
		resolved_at: '2025-02-06T09:12:40Z',
		severity: 'INFO',
		type: 'DB_DISCONNECT',
	},
	{
		created_at: '2025-02-06T03:22:51Z',
		id: 1006,
		instance_id: 5004,
		message: 'CPU utilization above threshold',
		resolved_at: '2025-02-06T05:47:18Z',
		severity: 'WARNING',
		type: 'HIGH_CPU',
	},
	{
		created_at: '2025-02-07T19:08:33Z',
		id: 1007,
		instance_id: 5001,
		message: 'API service unreachable',
		resolved_at: '2025-02-07T21:34:27Z',
		severity: 'CRITICAL',
		type: 'API_UNREACHABLE',
	},
	{
		created_at: '2025-02-08T07:45:22Z',
		id: 1008,
		instance_id: 5005,
		message: 'Memory consumption increasing',
		resolved_at: '2025-02-08T08:15:06Z',
		severity: 'WARNING',
		type: 'MEMORY_LEAK',
	},
	{
		created_at: '2025-02-09T13:12:49Z',
		id: 1009,
		instance_id: 5003,
		message: 'High CPU load on background process',
		resolved_at: '2025-02-09T14:02:38Z',
		severity: 'INFO',
		type: 'HIGH_CPU',
	},
	{
		created_at: '2025-02-10T10:33:57Z',
		id: 1010,
		instance_id: 5002,
		message: 'Database connection dropping intermittently',
		resolved_at: '2025-02-10T11:05:19Z',
		severity: 'INFO',
		type: 'DB_DISCONNECT',
	},
];
