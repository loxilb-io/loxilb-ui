//---------------------------------------------------------
// Network Topology Page - Simple and Concise
//---------------------------------------------------------
import {Box, Grid, Paper} from '@mui/material';
import SimpleNetworkTopologyCard from 'components/card/SimpleNetworkTopologyCard';
import HorizontalStack from 'components/layout/HorizontalStack';
import SubTitlePannel from 'components/layout/SubTitlePannel';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {t} from 'i18next';

//---------------------------------------------------------
// Main Component
//---------------------------------------------------------
export default function NetworkTopologyPage() {
	const instance = useInstanceFromURL();

	return (
		<SubTitlePannel title="Network Topology" sub_title="Real-time traffic flow visualization">
			<HorizontalStack>
				{/* Empty for consistency with other pages */}
			</HorizontalStack>
			
			<Grid container spacing={2}>
				<Grid item xs={12}>
					<Paper>
						<SimpleNetworkTopologyCard instance={instance} />
					</Paper>
				</Grid>
			</Grid>
		</SubTitlePannel>
	);
}