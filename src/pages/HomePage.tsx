//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, Stack, Typography} from '@mui/material';
import BGAnim from 'assets/animation/bg.svg';
import {request_health_check} from 'connector/oam/oam';
import {useEffect, useState} from 'react';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function HomePage() {
	const [is_online, set_is_online] = useState<boolean>(false);

	const get_status = async () => {
		const is_online = await request_health_check();
		set_is_online(is_online);
	};

	useEffect(() => {
		get_status();
	}, []);

	return (
		<Box width="100%" height="100%" display="flex" justifyContent="center" alignItems="center">
			<Stack spacing={2} alignItems="center">
				<Box component="img" src={BGAnim} alt="404" width="200px" />
				<Typography variant="h4">Loxi LB Control System</Typography>
				<Typography variant="h6" color={is_online ? 'success' : 'error'}>
					System Status: {is_online ? 'Online' : 'Offline'}
				</Typography>
			</Stack>
		</Box>
	);
}
