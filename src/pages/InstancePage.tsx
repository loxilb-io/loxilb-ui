//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, Stack, Typography, Button, Tooltip, CircularProgress} from '@mui/material';
import BG from 'assets/image/instance_bg.svg';
import InstanceCardAdd from 'components/card/InstanceAddCard';
import InstanceCard from 'components/card/InstanceCard';
import {useInstanceWithHA} from 'hooks/query/oamHooks';
import {useInstancesHealthRefresh, useInstanceHealth} from 'hooks/query/healthHook';
import {t} from 'i18next';
import RefreshIcon from '@mui/icons-material/Refresh';
import {useMemo, memo, useState, useEffect} from 'react';
import {IInstance} from 'types/oam';

//---------------------------------------------------------
// Individual Instance Card Wrapper with Health Hook
//---------------------------------------------------------
const InstanceCardWithHealth = memo(({ item }: { item: any }) => {
	// Add delay to stagger health checks and prevent thundering herd
	const delay = item.instance.id * 100; // 100ms delay per instance
	const [enableHealthCheck, setEnableHealthCheck] = useState(false);
	
	useEffect(() => {
		const timer = setTimeout(() => {
			setEnableHealthCheck(true);
		}, delay);
		
		return () => clearTimeout(timer);
	}, [delay]);
	
	const { health } = useInstanceHealth(item.instance, enableHealthCheck);
	
	return (
		<InstanceCard 
			key={item.instance.id} 
			instance_info={item.instance} 
			ha={item.ha}
			health={health}
		/>
	);
});

InstanceCardWithHealth.displayName = 'InstanceCardWithHealth';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function InstancePage() {
	const {instance_set} = useInstanceWithHA();
	
	// Extract instances for health refresh functionality
	const instances = useMemo(() => {
		if (!Array.isArray(instance_set)) return [];
		return instance_set.map(item => item.instance);
	}, [instance_set]);
	
	// Use bulk refresh hook for the refresh all button
	const {refreshAllHealth, isLoading} = useInstancesHealthRefresh(instances);

	return (
		<Stack position="relative" id="fixed-container" width="100%" height="100%" padding="16px 0px 16px 16px">
			<Box display="flex" alignItems="center" gap="16px" marginBottom="20px">
				<Typography id="title" variant="h5">
					{t('Instances')}
				</Typography>
				<Tooltip title={t('Refresh instance health status')}>
					<Button
						variant="contained"
						size="small"
						onClick={refreshAllHealth}
						disabled={isLoading}
						startIcon={isLoading ? <CircularProgress size={16} /> : <RefreshIcon />}
					>
						{isLoading ? t('Checking...') : t('Check Health')}
					</Button>
				</Tooltip>
			</Box>

			<Box
				zIndex={10}
				id="scrollable-box"
				padding="5px"
				width="100%"
				height="1px"
				minHeight={0}
				display="flex"
				flexGrow={1}
				flexShrink={1}
				flexBasis="auto"
				overflow="auto"
				flexWrap="wrap"
				gap="24px"
				alignItems="space-between"
			>
				{Array.isArray(instance_set) && instance_set.map((item: any) => (
					<InstanceCardWithHealth key={item.instance.id} item={item} />
				))}
				<InstanceCardAdd />
			</Box>

			<Box position="absolute" right="32px" bottom="16px" component="img" src={BG} zIndex={1} width="250px" />
		</Stack>
	);
}
