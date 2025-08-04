//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {ISyslogMessage} from 'types/syslog';

//---------------------------------------------------------
// Dummy Data
//---------------------------------------------------------
export const dummySyslogMessages: ISyslogMessage[] = [
	{
		created_at: '2025-02-03T10:15:30Z',
		facility: 1,
		host: 'web-server-01',
		id: 1001,
		level: 'ERROR',
		message: 'Failed to establish database connection: Connection timeout',
		programname: 'web-app',
		severity: 3,
		timestamp: '2025-02-03T10:15:30.123Z',
	},
	{
		created_at: '2025-02-03T10:15:31Z',
		facility: 0,
		host: 'auth-server-01',
		id: 1002,
		level: 'INFO',
		message: 'User authentication successful for user: john.doe',
		programname: 'auth-service',
		severity: 6,
		timestamp: '2025-02-03T10:15:31.456Z',
	},
	{
		created_at: '2025-02-03T10:15:32Z',
		facility: 4,
		host: 'mail-server-01',
		id: 1003,
		level: 'WARNING',
		message: 'Disk usage exceeded 80% threshold on /var/spool',
		programname: 'disk-monitor',
		severity: 4,
		timestamp: '2025-02-03T10:15:32.789Z',
	},
	{
		created_at: '2025-02-03T10:15:33Z',
		facility: 2,
		host: 'backup-server-01',
		id: 1004,
		level: 'INFO',
		message: 'Scheduled backup completed successfully',
		programname: 'backup-service',
		severity: 6,
		timestamp: '2025-02-03T10:15:33.012Z',
	},
	{
		created_at: '2025-02-03T10:15:34Z',
		facility: 3,
		host: 'firewall-01',
		id: 1005,
		level: 'CRITICAL',
		message: 'Multiple failed login attempts detected from IP: 192.168.1.100',
		programname: 'security-monitor',
		severity: 2,
		timestamp: '2025-02-03T10:15:34.345Z',
	},
	{
		created_at: '2025-02-03T10:15:35Z',
		facility: 1,
		host: 'app-server-01',
		id: 1006,
		level: 'DEBUG',
		message: 'Cache refresh completed in 1.23 seconds',
		programname: 'cache-service',
		severity: 7,
		timestamp: '2025-02-03T10:15:35.678Z',
	},
	{
		created_at: '2025-02-03T10:15:36Z',
		facility: 5,
		host: 'load-balancer-01',
		id: 1007,
		level: 'ERROR',
		message: 'Backend server web-server-02 is not responding',
		programname: 'haproxy',
		severity: 3,
		timestamp: '2025-02-03T10:15:36.901Z',
	},
];
