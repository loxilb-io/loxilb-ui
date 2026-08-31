//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, Card, CardContent, Divider, Stack, Typography} from '@mui/material';
import {get_date} from 'common';
import FlavorBadge from 'components/element/FlavorBadge';
import IDBadge from 'components/element/IDBadge';
import SimpleButton from 'components/element/SimpleButton';
import InstanceInputForm from 'components/input/InstanceInputForm';
import {describe_instance_error, TInstanceFormData} from 'components/input/instanceFormLogic';
import {request_delete_instance, request_update_instance} from 'connector/oam/oam';
import {usePopUp} from 'hooks/popupHook';
import {useInstances, useRole} from 'hooks/query/oamHooks';
import {useTranslation} from 'react-i18next';
import {useRef, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {IVipAttribute} from 'types/ha';
import {IInstance} from 'types/oam';
import {IInstanceHealth} from 'hooks/query/healthHook';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function InstanceCard(props: {instance_info: IInstance; ha: IVipAttribute; health?: IInstanceHealth | null; onHealthRefresh?: () => void}) {
	const {instance_info, ha, health, onHealthRefresh} = props;
	const {t} = useTranslation();

	const navigate = useNavigate();
	const [elevation, set_elevation] = useState(3);
	const {openPopUp, enableYes} = usePopUp();
	const {instance_list, refetch} = useInstances();
	// Instance CRUD is admin-only (OAM ActInstanceWrite). Hiding the actions
	// for everyone else is UX only — the server enforces it independently.
	const {can_manage_instances} = useRole();

	const instanceRef = useRef<TInstanceFormData | null>(null);
	const instanceListRef = useRef(instance_list);
	instanceListRef.current = instance_list;

	const default_instance_url = `/instance/dashboard?name=${instance_info.name}`;
	
	// Determine if instance is healthy, active, and clickable
	const isHealthy = health?.isHealthy !== false; // Default to healthy if health is not available yet
	const isActive = instance_info.is_active; // Use the is_active field from the instance
	const isDisabled = !isHealthy || !isActive;

	const handleModify = () => {
		// Extract current instance data to pre-fill the form.
		// `protocol` MUST be included: the form falls back to 'https' for any
		// field it is not given, so omitting it silently flipped an http
		// instance to https on save — and OAM re-derives api_endpoint from
		// protocol, which pointed the proxy at a port that does not speak TLS.
		const currentInstanceData = {
			name: instance_info.name,
			cimage: instance_info.cimage,
			ctag: instance_info.ctag,
			host: instance_info.host,
			port: instance_info.port.toString(),
			protocol: instance_info.protocol,
			version: instance_info.version,
			description: instance_info.description || '',
			is_active: instance_info.is_active
		};

		const content = (
			<InstanceInputForm
				initialValues={currentInstanceData}
				existing={instanceListRef.current}
				editing_id={instance_info.id}
				onChange={data => {
					instanceRef.current = data;
					// Gate Apply on validity — otherwise an invalid edit (bad port,
					// empty host) would be submitted against the live instance
					// (F-INSTANCE-1). enableYes is idempotent, so this is loop-safe.
					enableYes(data.isValid);
				}}
			/>
		);

		openPopUp(t('Modify Instance'), content, t('Apply'), t('Cancel'), async () => {
			if (instanceRef.current) {
				if (!instanceRef.current.isValid) {
					openPopUp(t('Error'), t('Please correct the highlighted fields.'), t('OK'));
					return;
				}
				const {isValid, errors, ...payload} = instanceRef.current;
				const res = await request_update_instance(instance_info.id, payload);
				if (res.status === 'success') {
					openPopUp(t('Success'), t('Updated successfully.'), t('OK'), '', () => {
						refetch();
						// Trigger health check after successful update
						if (onHealthRefresh) {
							onHealthRefresh();
						}
					});
				} else openPopUp(t('Error'), t('Failed to update. {{error}}', {error: describe_instance_error(res.error)}), t('OK'));
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
				const error_message = res.error ? describe_instance_error(res.error) : t('Failed to delete instance');
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
				height: '500px', 
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

						{can_manage_instances && <SimpleButton type="modify" onClick={handleModify} />}
					</Box>

					<Box width="100%" display="flex" alignItems="center" justifyContent="space-between">
						<IDBadge id={instance_info.id} />
						{can_manage_instances && <SimpleButton type="delete_strong" onClick={handleDelete} />}
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

					<Box display="flex" justifyContent="space-between" alignItems="center">
						<Typography variant="caption" color="text.secondary">
							{t('Type')}
						</Typography>
						<FlavorBadge instance={instance_info} />
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
