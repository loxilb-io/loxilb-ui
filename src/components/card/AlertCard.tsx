//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import CircleIcon from '@mui/icons-material/Circle';
import {Box, capitalize, Stack, Typography} from '@mui/material';
import IDBadge from 'components/element/IDBadge';
import SimpleButton from 'components/element/SimpleButton';
import {useInstances} from 'hooks/query/oamHooks';
import {IAlert} from 'types/alert';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
function LogTag(props: {level: string}) {
	const {level} = props;

	const color = ((): 'info' | 'warning' | 'error' => {
		switch (level) {
			case 'INFO':
				return 'info';
			case 'WARNING':
				return 'warning';
			case 'CRITICAL':
				return 'error';
			default:
				return 'info';
		}
	})();

	return (
		<Box display="flex" gap="5px" alignItems="center">
			<CircleIcon color={color} sx={{fontSize: '16px'}} />
			<Typography variant="body2" color={color}>
				{capitalize(level)}
			</Typography>
		</Box>
	);
}

function TypeTag(props: {type: string; color: string}) {
	const {type, color} = props;

	return (
		<Box bgcolor="grey.300" borderRadius="4px" paddingLeft="6px" paddingRight="6px">
			<Typography variant="body2" color={color}>
				{capitalize(type)}
			</Typography>
		</Box>
	);
}

export default function AlertCard(props: {data: IAlert; handleResolve: any; handleDelete: any}) {
	const {data, handleDelete, handleResolve} = props;

	const {get_instance_name} = useInstances();

	const instance_name = get_instance_name(data.instance_id);
	const is_resolved = !!data.resolved_at;
	const text_color = is_resolved ? 'text.disabled' : 'text.primary';
	const date_str = new Date(data.created_at).toLocaleString();

	const handleClickResolve = (e: React.MouseEvent<HTMLElement>) => {
		e.stopPropagation();
		handleResolve(data.id);
	};

	return (
		<Stack direction="row" width="300px" gap="6px" padding="16px" border="1px solid #EEEEEE" borderRadius="4px" bgcolor="grey.50" alignItems="center" justifyContent="center">
			<Stack sx={{opacity: is_resolved ? 0.5 : 1}} onClick={handleClickResolve} spacing={1}>
				<Typography variant="caption" color="text.secondary">
					{date_str}
				</Typography>

				<Box display="flex" gap="6px" alignItems="center">
					<IDBadge id={data.instance_id} />

					<Typography variant="body1" color={text_color}>
						{`${instance_name}`}
					</Typography>
				</Box>

				<Box display="flex" gap="10px" alignItems="center">
					<LogTag level={data.severity} />
					<TypeTag type={data.type} color={text_color} />
				</Box>

				<Typography variant="body2" color={text_color} whiteSpace="normal">
					{data.message}
				</Typography>
			</Stack>

			<SimpleButton type="delete" onClick={() => handleDelete(data.id)} />
		</Stack>
	);
}
