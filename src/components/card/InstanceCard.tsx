//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, Card, CardContent, Divider, Stack, Typography} from '@mui/material';
import {get_date} from 'common';
import IDBadge from 'components/element/IDBadge';
import SimpleButton from 'components/element/SimpleButton';
import InstanceInputForm from 'components/input/InstanceInputForm';
import {request_delete_instance, request_update_instance} from 'connector/oam/oam';
import {usePopUp} from 'hooks/popupHook';
import {useInstances} from 'hooks/query/oamHooks';
import {useTranslation} from 'react-i18next';
import {useRef, useState, useEffect} from 'react';
import {useNavigate} from 'react-router-dom';
import {IVipAttribute} from 'types/ha';
import {IInstance, IInstanceInput} from 'types/oam';
import {IInstanceHealth} from 'hooks/query/healthHook';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function InstanceCard(props: {instance_info: IInstance; ha: IVipAttribute; health?: IInstanceHealth | null; onHealthRefresh?: () => void}) {
	const {instance_info, ha, health, onHealthRefresh} = props;
	const { t, i18n } = useTranslation();

	const navigate = useNavigate();
	const [elevation, set_elevation] = useState(3);
	const {openPopUp} = usePopUp();
	const {refetch} = useInstances();
	const [languageKey, setLanguageKey] = useState(0);

	const instanceRef = useRef<IInstanceInput | null>(null);

	const default_instance_url = `/instance/dashboard?name=${instance_info.name}`;
	
	// Determine if instance is healthy, active, and clickable
	const isHealthy = health?.isHealthy !== false; // Default to healthy if health is not available yet
	const isActive = instance_info.is_active; // Use the is_active field from the instance
	const isDisabled = !isHealthy || !isActive;

	useEffect(() => {
        setLanguageKey(prev => prev + 1);
    }, [i18n.language]);

	const handleModify = () => {
		// Extract current instance data to pre-fill the form
		const currentInstanceData = {
			name: instance_info.name,
			cimage: instance_info.cimage,
			ctag: instance_info.ctag,
			host: instance_info.host,
			port: instance_info.port.toString(),
			version: instance_info.version,
			description: instance_info.description || '',
			is_active: instance_info.is_active
		};

		const content = (
			<InstanceInputForm
				initialValues={currentInstanceData}
				onChange={data => {
					instanceRef.current = data;
				}}
			/>
		);

		openPopUp(t('Modify Instance'), content, t('Apply'), t('Cancel'), async () => {
			if (instanceRef.current) {
				const res = await request_update_instance(instance_info.id, instanceRef.current);
				if (res.status === 'success') {
					openPopUp(t('Success'), t('Updated successfully.'), t('OK'), '', () => {
						refetch();
						// Trigger health check after successful update
						if (onHealthRefresh) {
							onHealthRefresh();
						}
					});
				} else openPopUp(t('Error'), t('Failed to update. {{error}}', {error: res.error}), t('OK'));
			}
		});
	};

	const handleDelete = () => {
		openPopUp(t('WARNING!! Delete Instance'), t('Are you sure you want to delete this instance? This action cannot be undone.'), t('Delete'), t('Cancel'), async () => {
			const res = await request_delete_instance(instance_info.id);
			if (res.status === 'success') {
				// First refresh the instance list
				await refetch();
				// Then show success message and navigate to instances page
				openPopUp(t('Success'), t('Instance deleted successfully.'), t('OK'), '', () => {
					// Ensure we're on the instances page after deletion
					navigate('/instance', { replace: true });
				});
			} else {
				const error_message = res.error || t('Failed to delete instance');
				openPopUp(t('Error'), error_message, t('OK'));
			}
		});
	};

	const handleCardClick = () => {
		if (isDisabled) {
			openPopUp(
				t('Instance Unavailable'),
				t('This instance is currently down or unreachable. Please check the instance status and try again.'),
				t('OK')
			);
		} else {
			navigate(default_instance_url);
		}
	};

	return (
		<Card
			sx={{
				width: '260px', 
				height: '400px', 
				cursor: isDisabled ? 'not-allowed' : 'pointer',
				opacity: isDisabled ? 0.6 : 1,
				backgroundColor: isDisabled ? 'grey.100' : 'background.paper'
			}}
			elevation={isDisabled ? 1 : elevation}
			onMouseOver={() => !isDisabled && set_elevation(5)}
			onMouseOut={() => !isDisabled && set_elevation(3)}
			onClick={handleCardClick}
		>
			<CardContent>
				<Stack gap="8px">
					<Box display="flex" justifyContent="space-between">
						<Typography variant="caption" color="text.secondary">
							{t('Created at')}
						</Typography>

						<Typography variant="caption" color="text.disabled">
							{get_date(instance_info.created_at)}
						</Typography>
					</Box>

					<Divider />

					<Box width="100%" display="flex" alignItems="center" justifyContent="flex-start">
						<Typography variant="subtitle1" color="textSecondary">
							{instance_info.name}
						</Typography>

						<SimpleButton type="modify" onClick={handleModify} />
					</Box>

					<Box width="100%" display="flex" alignItems="center" justifyContent="space-between">
						<IDBadge id={instance_info.id} />
						<SimpleButton type="delete_strong" onClick={handleDelete} />
					</Box>

					<Divider />

					<Box display="flex" justifyContent="space-between">
						<Typography variant="caption" color="text.secondary">
							{t('Host')}
						</Typography>
						<Typography variant="caption" color="text.disabled">
							{`${instance_info.host}:${instance_info.port}`}
						</Typography>
					</Box>

					<Box display="flex" justifyContent="space-between">
						<Typography variant="caption" color="text.secondary">
							{t('Version')}
						</Typography>
						<Typography variant="caption" color="text.disabled">
							{instance_info.version}
						</Typography>
					</Box>

					<Box display="flex" justifyContent="space-between">
						<Typography variant="caption" color="text.secondary">
							{t('HA State')}
						</Typography>

						<Typography variant="caption" color="text.disabled">
							{ha?.state ?? t('Unknown')}
						</Typography>
					</Box>

					<Box display="flex" justifyContent="space-between">
						<Typography variant="caption" color="text.secondary">
							{t('Health Status')}
						</Typography>

						<Typography 
							variant="caption" 
							color={isHealthy ? 'success.main' : 'error.main'}
							sx={{ fontWeight: 'bold' }}
						>
							{health === null ? t('Checking...') : (isHealthy ? t('Healthy') : t('Down'))}
						</Typography>
					</Box>

					<Box display="flex" justifyContent="space-between">
						<Typography variant="caption" color="text.secondary">
							{t('Activation Status')}
						</Typography>

						<Typography 
							variant="caption" 
							color={isActive ? 'success.main' : 'error.main'}
							sx={{ fontWeight: 'bold' }}
						>
							{health === null ? t('Checking...') : (isActive ? t('Active') : t('Inactive'))}
						</Typography>
					</Box>

					<Divider />

					<Box display="flex" justifyContent="space-between">
						<Typography variant="caption" color="text.secondary">
							{t('Tag')}
						</Typography>
						<Typography variant="caption" color="text.disabled">
							{instance_info.ctag}
						</Typography>
					</Box>

					<Box display="flex" justifyContent="space-between">
						<Typography variant="caption" color="text.secondary">
							{t('CImage')}
						</Typography>
						<Typography variant="caption" color="text.disabled">
							{instance_info.cimage}
						</Typography>
					</Box>

					<Box display="flex" justifyContent="space-between">
						<Typography variant="caption" color="text.secondary">
							{t('API Endpoint')}
						</Typography>
					</Box>
					<Box display="flex" justifyContent="space-between">
						<Typography variant="caption" color="text.disabled">
							{instance_info.api_endpoint}
						</Typography>
					</Box>

					<Divider />
					<Box width="100%" overflow="hidden">
						<Typography
							variant="caption"
							color="text.disabled"
							overflow="hidden"
							textOverflow="ellipsis"
							sx={{
								display: '-webkit-box',
								wordBreak: 'break-all',
								WebkitLineClamp: 2,
								WebkitBoxOrient: 'vertical',
							}}
						>
							{instance_info.description}
						</Typography>
					</Box>
				</Stack>
			</CardContent>
		</Card>
	);
}
