//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import SaveAltIcon from '@mui/icons-material/SaveAlt';
import {Box, Paper, Typography} from '@mui/material';
import {SimpleTable} from 'components/table/SimpleTable';
import {t} from 'i18next';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function ArchivedLogCard(props: {log_file_list: {id: number; filename: string}[]; onRowClick: (row: any) => void}) {
	const {log_file_list, onRowClick} = props;

	return (
		<Paper>
			<Box width="400px" padding="20px">
				{!log_file_list || log_file_list.length === 0 ? (
					<Typography variant="body2">{t('No archived logs available.')}</Typography>
				) : (
					<SimpleTable
						columns={[
							{
								field: 'filename',
								headerName: 'Archived Logs',
								flex: 1,
							},
							{
								field: 'download_url',
								headerName: 'Download',
								renderCell: () => <SaveAltIcon color="action" />,
							},
						]}
						rows={log_file_list}
						onRowClick={onRowClick}
					/>
				)}
			</Box>
		</Paper>
	);
}
