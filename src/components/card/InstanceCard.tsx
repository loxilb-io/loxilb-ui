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
import {t} from 'i18next';
import {useRef, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {IVipAttribute} from 'types/ha';
import {IInstance, IInstanceInput} from 'types/oam';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function InstanceCard(props: {instance_info: IInstance; ha: IVipAttribute}) {
	const {instance_info, ha} = props;

	const navigate = useNavigate();
	const [elevation, set_elevation] = useState(3);
	const {openPopUp} = usePopUp();
	const {refetch} = useInstances();

	const instanceRef = useRef<IInstanceInput | null>(null);

	const default_instance_url = `/instance/dashboard?name=${instance_info.name}`;

	const handleModify = () => {
		const content = (
			<InstanceInputForm
				onChange={data => {
					instanceRef.current = data;
				}}
			/>
		);

		openPopUp(t('Modify Instance'), content, t('Apply'), t('Cancel'), async () => {
			if (instanceRef.current) {
				const res = await request_update_instance(instance_info.id, instanceRef.current);
				if (res.status === 'success') {
					openPopUp(t('Success'), t('Updated successfully.'), t('OK'));
					refetch();
				} else openPopUp(t('Error'), t('Failed to update. {{error}}', {error: res.error}), t('OK'));
			}
		});
	};

	const handleDelete = () => {
		openPopUp(t('WARNING!! Delete Instance'), t('Are you sure you want to delete this instance? This action cannot be undone.'), t('Delete'), t('Cancel'), async () => {
			const res = await request_delete_instance(instance_info.id);
			if (res.status === 'success') {
				openPopUp(t('Success'), t('Instance deleted successfully.'), t('OK'));
				refetch();
			} else {
				const error_message = res.error || t('Failed to delete instance');
				openPopUp(t('Error'), error_message, t('OK'));
			}
		});
	};

	return (
		<Card
			sx={{width: '260px', height: '400px', cursor: 'pointer'}}
			elevation={elevation}
			onMouseOver={() => set_elevation(5)}
			onMouseOut={() => set_elevation(3)}
			onClick={() => navigate(default_instance_url)}
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
