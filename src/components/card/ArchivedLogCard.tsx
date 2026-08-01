//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import SaveAltIcon from '@mui/icons-material/SaveAlt';
import {Alert, Box, CircularProgress, LinearProgress, Paper, Snackbar, Typography} from '@mui/material';
import {formatBytes} from 'common';
import {SimpleTable} from 'components/table/SimpleTable';
import {DownloadProgress} from 'connector/fetcher/fetcher_base';
import {t} from 'i18next';
import {useState} from 'react';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
// Archive files can be hundreds of MB, so the download streams with live
// progress; the card owns the download UX (progress bar, done/error toast)
// while the caller supplies the transport via onDownload.
export default function ArchivedLogCard(props: {
	log_file_list: {id: number; filename: string}[];
	onDownload: (filename: string, onProgress: (p: DownloadProgress) => void) => Promise<void>;
}) {
	const {log_file_list, onDownload} = props;

	const [active, setActive] = useState<{filename: string; receivedBytes: number; totalBytes: number | null} | null>(null);
	const [toast, setToast] = useState<{severity: 'success' | 'error'; message: string} | null>(null);

	const handleRowClick = async (row: {filename: string}) => {
		if (active) return; // one download at a time
		setActive({filename: row.filename, receivedBytes: 0, totalBytes: null});
		try {
			await onDownload(row.filename, p => setActive({filename: row.filename, receivedBytes: p.receivedBytes, totalBytes: p.totalBytes}));
			setToast({severity: 'success', message: t('Download completed: {{filename}}', {filename: row.filename})});
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			setToast({severity: 'error', message: t('Download failed. {{error}}', {error: message})});
		} finally {
			setActive(null);
		}
	};

	const percent = active?.totalBytes ? Math.round((active.receivedBytes / active.totalBytes) * 100) : null;

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
								renderCell: (params: {row: {filename: string}}) =>
									active?.filename === params.row.filename ? <CircularProgress size={16} /> : <SaveAltIcon color={active ? 'disabled' : 'action'} />,
							},
						]}
						rows={log_file_list}
						onRowClick={handleRowClick}
					/>
				)}

				{active && (
					<Box marginTop="12px">
						<Typography variant="caption" display="block" gutterBottom>
							{t('Downloading {{filename}}…', {filename: active.filename})}{' '}
							{active.totalBytes
								? `${formatBytes(active.receivedBytes)} / ${formatBytes(active.totalBytes)} (${percent}%)`
								: formatBytes(active.receivedBytes)}
						</Typography>
						<LinearProgress variant={percent === null ? 'indeterminate' : 'determinate'} value={percent ?? 0} />
					</Box>
				)}

				<Snackbar
					open={toast !== null}
					autoHideDuration={6000}
					onClose={() => setToast(null)}
					anchorOrigin={{vertical: 'bottom', horizontal: 'center'}}>
					<Alert severity={toast?.severity} variant="filled" onClose={() => setToast(null)}>
						{toast?.message}
					</Alert>
				</Snackbar>
			</Box>
		</Paper>
	);
}
