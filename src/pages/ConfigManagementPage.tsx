//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/Upload';
import FolderIcon from '@mui/icons-material/Folder';
import BackupIcon from '@mui/icons-material/Backup';
import {Box, Stack, Typography, Tabs, Tab, Button, Paper} from '@mui/material';
import ScrollableBox from 'components/layout/ScrollableBox';
import ErrorPopUp from 'components/modal/ErrorPopUp';
import {useState, useCallback} from 'react';
import React from 'react';
import {usePopUp} from 'hooks/popupHook';
import {useErrorPopup} from 'hooks/useErrorPopup';
import ConfigExportForm from 'components/input/ConfigExportForm';
import ConfigFileUploader from 'components/input/ConfigFileUploader';
import {ExportRequest, OperationProgress, ValidationResult} from 'types/config';
import {request_export_config, request_validate_import_config, request_import_config, query_get_config_files, request_download_config_file, request_delete_config_export} from 'connector/oam/configApi';
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
	const [files, setFiles] = useState<any[]>([]);
	const [loading, setLoading] = useState(false);
	const {openPopUp} = usePopUp();
	const {showDeleteError} = useErrorPopup();
	
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
	
	const handleDownload = useCallback(async (exportId: string, fallbackFilename: string) => {
		try {
			const result = await request_download_config_file(exportId);
			if (result) {
				const { blob, filename } = result;
				
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
				openPopUp(
					t('Download Error'),
					t('Failed to download configuration file. Please check if the file exists and you have proper permissions.'),
					t('OK')
				);
			}
		} catch (error) {
			console.error('Download error:', error);
			openPopUp(
				t('Download Error'),
				t('An error occurred while downloading the file: {{error}}', {error: String(error)}),
				t('OK')
			);
		}
	}, [openPopUp]);
	
	const handleDelete = useCallback(async (exportId: string) => {
		const result = await request_delete_config_export(exportId);
		if (result.status === 'success') {
			openPopUp(t('Success'), t('File deleted successfully.'), t('OK'));
			fetchFiles();
		} else {
			showDeleteError('config file', result.error);
		}
	}, [openPopUp, showDeleteError, fetchFiles]);
	
	return (
		<Box>
			<Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
				<Box>
					<Typography variant="h6" gutterBottom>
						Configuration Files
					</Typography>
					<Typography variant="body2" color="text.secondary">
						Manage exported configuration files.
					</Typography>
				</Box>
				<Button variant="outlined" onClick={fetchFiles} disabled={loading}>
					Refresh
				</Button>
			</Stack>
			
			{loading ? (
				<Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
					<Typography>Loading files...</Typography>
				</Box>
			) : files.length === 0 ? (
				<Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
					No configuration files found.
				</Typography>
			) : (
				<Stack spacing={1}>
					{files.map((file: any) => (
						<Paper key={file.id} sx={{ p: 2 }}>
							<Stack direction="row" justifyContent="space-between" alignItems="center">
								<Box>
									<Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
										{file.filename || `config-${file.id}.json`}
									</Typography>
									<Typography variant="body2" color="text.secondary">
										Exported: {new Date(file.exported_at).toLocaleString()}
									</Typography>
									{file.description && (
										<Typography variant="body2" color="text.secondary">
											{file.description}
										</Typography>
									)}
								</Box>
								<Stack direction="row" spacing={1}>
									<Button
										size="small"
										variant="outlined"
										onClick={() => handleDownload(file.id, file.filename || `config-${file.id}.json`)}
									>
										Download
									</Button>
									{/* Delete button temporarily disabled - API endpoint not available */}
									<Button
										size="small"
										variant="outlined"
										color="error"
										onClick={() => handleDelete(file.id)}
										disabled
										title="Delete functionality not yet available in API"
									>
										Delete
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

function BackupHistoryTab() {
	return (
		<Box>
			<Typography variant="h6" gutterBottom>
				Backup History
			</Typography>
			<Typography variant="body2" color="text.secondary">
				View and manage configuration backups.
			</Typography>
			{/* Backup history will be implemented later */}
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
	const {errorPopup, showAddError, closeErrorPopup} = useErrorPopup();

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
			// For now, create a basic validation result - will be enhanced in Phase 2
			const validationResult: ValidationResult = {
				isValid: true,
				errors: [],
				warnings: [],
				summary: {
					total_records: 1,
					valid_records: 1,
					invalid_records: 0
				}
			};
			
			setValidationResult(validationResult);
			setValidationProgress({ 
				status: 'success', 
				progress: 100, 
				message: 'Validation completed' 
			});
			
			openPopUp(t('Success'), t('Configuration file validated successfully.'), t('OK'));
		} else {
			setValidationProgress({ 
				status: 'error', 
				progress: 0, 
				message: 'Failed to validate configuration file' 
			});
			showAddError('configuration validation', result.error);
		}
	}, [openPopUp, showAddError]);

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
							<Tab 
								icon={<BackupIcon fontSize="small" />}
								iconPosition="start"
								label="Backup History" 
								{...a11yProps(3)} 
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
					<TabPanel value={tabValue} index={3}>
						<BackupHistoryTab />
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