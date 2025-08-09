//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box} from '@mui/material';
import {SimpleTable} from 'components/table/SimpleTable';
import {useOAMLogs} from 'hooks/query/oamHooks';
import {t} from 'i18next';
import CardBase from './CardBase';
import { useInstanceFromURL } from 'hooks/instanceHook';
import { useInstanceLogs } from 'hooks/query/instanceHook';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function SystemLogCard() {
	const inst = useInstanceFromURL();
	const {data: log_list} = useInstanceLogs(inst);
	// const {data: log_list} = useOAMLogs(); // ILog[]

	const table_col = [
		{
			field: 'created_at',
			headerName: 'Timestamp',
			width: 140,
		},
		{
			field: 'level',
			headerName: 'Log Level',
			renderCell: (params: any) => {
				const level = params.value.toLowerCase();
				const color = level === 'error' ? 'red' : level === 'warning' ? 'orange' : 'green';
				return (
					<Box display="flex" alignItems="center">
						<Box width="10px" height="10px" borderRadius="50%" marginRight="5px" bgcolor={color} />
						<Box sx={{color: color}}>{level.toUpperCase()}</Box>
					</Box>
				);
			},
			width: 100,
		},
		{
			field: 'message',
			headerName: 'Message',
			flex: 1,
		},
	];

	return (
		<CardBase title={t('System Log')}>
			<Box display="flex" width="100%" justifyContent="space-between">
				<Box width="100%" padding="5px" border="1px solid #E0E0E0" borderRadius="4px">
					<SimpleTable columns={table_col} rows={log_list ?? []} />
				</Box>
			</Box>
		</CardBase>
	);
}
