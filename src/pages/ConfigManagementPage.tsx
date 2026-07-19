//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/Upload';
import FolderIcon from '@mui/icons-material/Folder';
import {Box, Stack, Typography, Tabs, Tab, Button, Paper, Chip, Tooltip} from '@mui/material';
import ScrollableBox from 'components/layout/ScrollableBox';
import ErrorPopUp from 'components/modal/ErrorPopUp';
import {useState, useCallback} from 'react';
import React from 'react';
import {usePopUp} from 'hooks/popupHook';
import {useErrorPopup} from 'hooks/useErrorPopup';
import ConfigExportForm from 'components/input/ConfigExportForm';
import ConfigFileUploader from 'components/input/ConfigFileUploader';
import {ConfigFileInfo, ExportRequest, OperationProgress, ValidationResult} from 'types/config';
import {request_export_config, request_validate_import_config, request_import_config, query_get_config_files, request_download_config_file, request_delete_config_file} from 'connector/oam/configApi';
import {t} from 'i18next';

//---------------------------------------------------------
// Tab Panel Component
//---------------------------------------------------------
interface TabPanelProps {
	children?: React.ReactNode;
	index: number;
	value: number;
}

function TabPanel(props: TabPanelProps) {
	const {children, value, index, ...other} = props;

	return (
		<div
			role="tabpanel"
			hidden={value !== index}
			id={`config-tabpanel-${index}`}
			aria-labelledby={`config-tab-${index}`}
			{...other}
		>
			{value === index && (
				<Box sx={{pt: 3}}>
					{children}
				</Box>
			)}
		</div>
	);
}


//---------------------------------------------------------
// Tab Content Components
//---------------------------------------------------------
function ExportTab({ 
	onExport, 
	exportProgress 
}: { 
	onExport: (request: ExportRequest) => Promise<void>; 
	exportProgress: OperationProgress;
}) {
	return (
		<ConfigExportForm
			onExport={onExport}
			exportProgress={exportProgress}
		/>
	);
}

function ImportTab({ 
	onFileSelect, 
	onImport,
	validationResult, 
	validationProgress,
	importProgress
}: { 
	onFileSelect: (file: File) => Promise<void>; 
	onImport?: (file: File) => Promise<void>;
	validationResult?: ValidationResult;
	validationProgress: OperationProgress;
	importProgress?: OperationProgress;
}) {
	return (
		<ConfigFileUploader
			onFileSelect={onFileSelect}
			onImport={onImport}
			validationResult={validationResult}
			validationProgress={validationProgress}
			importProgress={importProgress}
		/>
	);
}

function FileManagementTab() {
	const [files, setFiles] = useState<ConfigFileInfo[]>([]);
	const [loading, setLoading] = useState(false);
	const {openPopUp} = usePopUp();

	const fetchFiles = useCallback(async () => {
		setLoading(true);
		try {
			const result = await query_get_config_files();
			if (result) {
				setFiles(result.files || []);
			}
		} catch (error) {
			console.error('Error fetching config files:', error);
		} finally {
			setLoading(false);
		}
	}, []);

	React.useEffect(() => {
		fetchFiles();
	}, [fetchFiles]);

	const handleDownload = useCallback(async (file: ConfigFileInfo) => {
		const fallbackFilename = file.filename || `config-${file.id}.json`;
		try {
			const result = await request_download_config_file(file.id);
			if (result) {
				const {blob, filename} = result;

				// Check if blob contains HTML (indicating an error response)
				const text = await blob.slice(0, 100).text();
				if (text.includes('<!DOCTYPE html>') || text.includes('<html')) {
					openPopUp(
						t('Download Error'),
						t('Unable to download file. This may be due to authentication issues or the file not being available on the server.'),
						t('OK')
					);
					return;
				}

				const url = window.URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = filename || fallbackFilename; // Use filename from Content-Disposition or fallback
				document.body.appendChild(a);
				a.click();
				window.URL.revokeObjectURL(url);
				document.body.removeChild(a);

				openPopUp(t('Success'), t('Configuration file "{{filename}}" downloaded successfully.', {filename: filename || fallbackFilename}), t('OK'));
			} else {
				// The record exists but the backing file couldn't be fetched (removed
				// from the server or expired). Say so plainly and refresh the list so
				// the state reflects reality instead of leaving a dead row that looks
				// downloadable.
				openPopUp(
					t('Download Error'),
					t('"{{filename}}" could not be downloaded. The file may have been removed from the server or has expired. You can delete this entry.', {filename: fallbackFilename}),
					t('OK')
				);
				fetchFiles();
			}
		} catch (error) {
			console.error('Download error:', error);
			openPopUp(
				t('Download Error'),
				t('An error occurred while downloading the file: {{error}}', {error: String(error)}),
				t('OK')
			);
		}
	}, [openPopUp, fetchFiles]);

	const handleDelete = useCallback((file: ConfigFileInfo) => {
		const filename = file.filename || `config-${file.id}.json`;
		openPopUp(
			t('Delete Configuration File'),
			t('Are you sure you want to delete "{{filename}}"? This action cannot be undone.', {filename}),
			t('Delete'),
			t('Cancel'),
			async () => {
				const result = await request_delete_config_file(file.id);
				if (result.status === 'success') {
					openPopUp(t('Success'), t('Configuration file deleted successfully.'), t('OK'));
					fetchFiles();
				} else {
					openPopUp(t('Delete Error'), result.error || t('Failed to delete the configuration file.'), t('OK'));
				}
			},
		);
	}, [openPopUp, fetchFiles]);

	// One compact metadata line: size · exported by · exported when · expiry.
	const metaLine = (file: ConfigFileInfo): string => {
		const parts: string[] = [];
		if (file.file_size_human) parts.push(file.file_size_human);
		if (file.exported_by) parts.push(t('by {{user}}', {user: file.exported_by}));
		if (file.exported_at) parts.push(new Date(file.exported_at).toLocaleString());
		if (!file.is_expired && file.expires_in) parts.push(t('expires in {{when}}', {when: file.expires_in}));
		return parts.join('  ·  ');
	};

	return (
		<Box>
			<Stack direction="row" justifyContent="space-between" alignItems="center" sx={{mb: 2}}>
				<Box>
					<Typography variant="h6" gutterBottom>
						{t('Configuration Files')}
					</Typography>
					<Typography variant="body2" color="text.secondary">
						{t('Manage exported configuration files.')}
					</Typography>
				</Box>
				<Button variant="outlined" onClick={fetchFiles} disabled={loading}>
					{t('Refresh')}
				</Button>
			</Stack>

			{loading ? (
				<Box sx={{display: 'flex', justifyContent: 'center', py: 4}}>
					<Typography>{t('Loading files...')}</Typography>
				</Box>
			) : files.length === 0 ? (
				<Typography variant="body2" color="text.secondary" sx={{textAlign: 'center', py: 4}}>
					{t('No configuration files found.')}
				</Typography>
			) : (
				<Stack spacing={1}>
					{files.map(file => (
						<Paper key={file.id} sx={{p: 2}}>
							<Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
								<Box sx={{minWidth: 0}}>
									<Stack direction="row" alignItems="center" spacing={1} sx={{mb: 0.5}}>
										<Typography variant="subtitle1" sx={{fontWeight: 'bold', wordBreak: 'break-all'}}>
											{file.filename || `config-${file.id}.json`}
										</Typography>
										{file.is_expired ? (
											<Chip size="small" color="error" variant="outlined" label={t('Expired')} />
										) : (
											<Chip size="small" color="success" variant="outlined" label={t('Available')} />
										)}
										{file.download_count > 0 && (
											<Chip size="small" variant="outlined" label={t('{{count}} downloads', {count: file.download_count})} />
										)}
									</Stack>
									<Typography variant="body2" color="text.secondary">
										{metaLine(file)}
									</Typography>
									{file.description && (
										<Typography variant="body2" color="text.secondary" sx={{fontStyle: 'italic'}}>
											{file.description}
										</Typography>
									)}
								</Box>
								<Stack direction="row" spacing={1} sx={{flexShrink: 0}}>
									<Tooltip title={file.is_expired ? t('This export has expired and can no longer be downloaded.') : ''}>
										<span>
											<Button
												size="small"
												variant="outlined"
												disabled={file.is_expired}
												onClick={() => handleDownload(file)}
											>
												{t('Download')}
											</Button>
										</span>
									</Tooltip>
									<Button
										size="small"
										variant="outlined"
										color="error"
										onClick={() => handleDelete(file)}
									>
										{t('Delete')}
									</Button>
								</Stack>
							</Stack>
						</Paper>
					))}
				</Stack>
			)}
		</Box>
	);
}

//---------------------------------------------------------
// Main Component
//---------------------------------------------------------
export default function ConfigManagementPage() {
	const [tabValue, setTabValue] = useState(0);
	const [exportProgress, setExportProgress] = useState<OperationProgress>({
		status: 'idle',
		progress: 0
	});
	const [validationProgress, setValidationProgress] = useState<OperationProgress>({
		status: 'idle',
		progress: 0
	});
	const [validationResult, setValidationResult] = useState<ValidationResult>();
	const [importProgress, setImportProgress] = useState<OperationProgress>({
		status: 'idle',
		progress: 0
	});

	// Following DeviceNeighborPage pattern
	const {openPopUp} = usePopUp();
	const {errorPopup, showAddError, showErrorPopup, closeErrorPopup} = useErrorPopup();

	const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
		setTabValue(newValue);
	};

	const handleExport = useCallback(async (request: ExportRequest) => {
		setExportProgress({ status: 'processing', progress: 0, message: 'Starting export...' });
		
		const result = await request_export_config(request);
		if (result.status === 'success') {
			setExportProgress({ 
				status: 'success', 
				progress: 100, 
				message: 'Configuration exported successfully!' 
			});
			// Following DeviceNeighborPage success pattern
			openPopUp(t('Success'), t('Configuration exported successfully.'), t('OK'));
		} else {
			setExportProgress({ 
				status: 'error', 
				progress: 0, 
				message: 'Failed to export configuration' 
			});
			showAddError('configuration export', result.error);
		}
	}, [openPopUp, showAddError]);

	const handleFileSelect = useCallback(async (file: File) => {
		setValidationProgress({ status: 'processing', progress: 0, message: 'Validating configuration...' });
		setValidationResult(undefined);
		
		const result = await request_validate_import_config(file);
		if (result.status === 'success') {
			// Build the validation result from the server's dry-run response
			const dryRun = result.result;
			const errors = (dryRun?.errors ?? []).map(e => ({
				type: 'error' as const,
				field: e.field,
				message: e.message,
				line: e.record_index,
			}));
			const summary = dryRun?.import_summary;
			const imported =
				(summary?.instances_imported ?? 0) +
				(summary?.users_imported ?? 0) +
				(summary?.settings_updated ?? 0);
			const skipped =
				(summary?.instances_skipped ?? 0) +
				(summary?.users_skipped ?? 0);
			const isValid = (dryRun?.success ?? false) && errors.length === 0;

			const validationResult: ValidationResult = {
				isValid,
				errors,
				warnings: [],
				summary: {
					total_records: imported + skipped + errors.length,
					valid_records: imported,
					invalid_records: errors.length,
				},
			};

			setValidationResult(validationResult);
			setValidationProgress({
				status: isValid ? 'success' : 'error',
				progress: 100,
				message: isValid ? 'Validation completed' : 'Validation found problems',
			});

			if (isValid) {
				openPopUp(t('Success'), t('Configuration file validated successfully.'), t('OK'));
			} else {
				showErrorPopup(t('Failed to validate the configuration file.'), dryRun?.message || t('The configuration file failed validation. Review the reported errors before importing.'));
			}
		} else {
			setValidationProgress({ 
				status: 'error', 
				progress: 0, 
				message: 'Failed to validate configuration file' 
			});
			showErrorPopup(t('Failed to validate the configuration file.'), result.error);
		}
	}, [openPopUp, showErrorPopup]);

	const handleImport = useCallback(async (file: File) => {
		setImportProgress({ status: 'processing', progress: 0, message: 'Importing configuration...' });
		
		const result = await request_import_config(file);
		if (result.status === 'success') {
			setImportProgress({ 
				status: 'success', 
				progress: 100, 
				message: 'Configuration imported successfully!' 
			});
			openPopUp(t('Success'), t('Configuration imported successfully.'), t('OK'));
		} else {
			setImportProgress({ 
				status: 'error', 
				progress: 0, 
				message: 'Failed to import configuration' 
			});
			showAddError('configuration import', result.error);
		}
	}, [openPopUp, showAddError]);

	const a11yProps = (index: number) => {
		return {
			id: `config-tab-${index}`,
			'aria-controls': `config-tabpanel-${index}`,
		};
	};

	return (
		<>
			<ScrollableBox>
				<Stack position="relative" id="fixed-container" width="100%" height="100%" spacing={3} padding="16px">
					<Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
						<Tabs 
							value={tabValue} 
							onChange={handleTabChange} 
							aria-label="configuration management tabs"
							sx={{
								'& .MuiTab-root': {
									textTransform: 'none',
									minWidth: 120,
									fontSize: '14px',
								},
							}}
						>
							<Tab 
								icon={<DownloadIcon fontSize="small" />}
								iconPosition="start"
								label="Export" 
								{...a11yProps(0)} 
							/>
							<Tab 
								icon={<UploadIcon fontSize="small" />}
								iconPosition="start"
								label="Import" 
								{...a11yProps(1)} 
							/>
							<Tab
								icon={<FolderIcon fontSize="small" />}
								iconPosition="start"
								label="File Management"
								{...a11yProps(2)}
							/>
						</Tabs>
					</Box>

					<TabPanel value={tabValue} index={0}>
						<ExportTab 
							onExport={handleExport}
							exportProgress={exportProgress}
						/>
					</TabPanel>
					<TabPanel value={tabValue} index={1}>
						<ImportTab 
							onFileSelect={handleFileSelect}
							onImport={handleImport}
							validationResult={validationResult}
							validationProgress={validationProgress}
							importProgress={importProgress}
						/>
					</TabPanel>
					<TabPanel value={tabValue} index={2}>
						<FileManagementTab />
					</TabPanel>
				</Stack>
			</ScrollableBox>

			{/* Error Popup - Following DeviceNeighborPage pattern */}
			<ErrorPopUp
				isOpen={errorPopup.isOpen}
				onClose={closeErrorPopup}
				title={errorPopup.title}
				mainMessage={errorPopup.mainMessage}
				errorData={errorPopup.errorData}
				buttonText={t('OK')}
			/>
		</>
	);
}