//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, Stack, Typography, Button, Tooltip, CircularProgress} from '@mui/material';
import BG from 'assets/image/instance_bg.svg';
import InstanceCardAdd from 'components/card/InstanceAddCard';
import InstanceCard from 'components/card/InstanceCard';
import {useInstanceWithHA} from 'hooks/query/oamHooks';
import {useInstancesHealthRefresh, useInstanceHealth} from 'hooks/query/healthHook';
import {useUserLicenses} from 'hooks/query/licenseHooks';
import {usePopUp} from 'hooks/popupHook';
import {t} from 'i18next';
import RefreshIcon from '@mui/icons-material/Refresh';
import {useMemo, memo, useState, useEffect} from 'react';
import {IInstance} from 'types/oam';

//---------------------------------------------------------
// Individual Instance Card Wrapper with Health Hook
//---------------------------------------------------------
const InstanceCardWithHealth = memo(({ item, licenseValid, onHealthRefresh }: { item: any; licenseValid: boolean; onHealthRefresh?: () => void }) => {
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
	
	// Create modified instance info with forced inactive state if license is invalid
	const modifiedInstanceInfo = licenseValid ? item.instance : {
		...item.instance,
		is_active: false
	};
	
	return (
		<InstanceCard
			key={item.instance.id}
			instance_info={modifiedInstanceInfo}
			ha={item.ha}
			health={health}
			onHealthRefresh={onHealthRefresh}
		/>
	);
});

InstanceCardWithHealth.displayName = 'InstanceCardWithHealth';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function InstancePage() {
	const {instance_set} = useInstanceWithHA();
	const {userLicenses} = useUserLicenses();
	const {openPopUp} = usePopUp();
	const [licenseValid, setLicenseValid] = useState(true);
	const [licenseWarningShown, setLicenseWarningShown] = useState(false);
	
	// Extract instances for health refresh functionality
	const instances = useMemo(() => {
		if (!Array.isArray(instance_set)) return [];
		return instance_set.map(item => item.instance);
	}, [instance_set]);
	
	// License validation logic
	useEffect(() => {
		if (userLicenses && instances.length > 0) {
			const validCount = userLicenses.valid_count || 0;
			const instanceCount = instances.length;
			const isValid = validCount >= instanceCount;
			
			setLicenseValid(isValid);
			
			// Show warning dialog only once when license becomes invalid
			if (!isValid && !licenseWarningShown) {
				setLicenseWarningShown(true);
				openPopUp(
					t('License Warning'),
					t('Your current license allows {{validCount}} instances, but you have {{instanceCount}} instances. Please upgrade your license or deactivate some instances.', {
						validCount,
						instanceCount
					}),
					t('OK')
				);
			}
		}
	}, [userLicenses, instances.length, licenseWarningShown]); // Removed openPopUp from dependencies
	
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
					<InstanceCardWithHealth key={item.instance.id} item={item} licenseValid={licenseValid} onHealthRefresh={refreshAllHealth} />
				))}
				<InstanceCardAdd />
			</Box>

			<Box position="absolute" right="32px" bottom="16px" component="img" src={BG} zIndex={1} width="250px" />
		</Stack>
	);
}
