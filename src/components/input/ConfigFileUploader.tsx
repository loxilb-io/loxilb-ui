//---------------------------------------------------------
// Config File Uploader Component
//---------------------------------------------------------
import {
	Box,
	Paper,
	Typography,
	Button,
	LinearProgress,
	Alert,
	Stack,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
// Note: t function will be used when internationalization is fully implemented
import { useState, useCallback, useRef } from 'react';
import { ValidationResult, OperationProgress } from 'types/config';

//---------------------------------------------------------
// Component Props Interface
//---------------------------------------------------------
interface ConfigFileUploaderProps {
	onFileSelect: (file: File) => Promise<void>;
	onImport?: (file: File) => Promise<void>;
	validationResult?: ValidationResult;
	validationProgress: OperationProgress;
	importProgress?: OperationProgress;
	disabled?: boolean;
	acceptedTypes?: string[];
	maxSize?: number; // in MB
}

//---------------------------------------------------------
// Component Implementation
//---------------------------------------------------------
export default function ConfigFileUploader({
	onFileSelect,
	onImport,
	validationResult,
	validationProgress,
	importProgress,
	disabled = false,
	acceptedTypes = ['.json'],
	maxSize = 50
}: ConfigFileUploaderProps) {
	const [dragActive, setDragActive] = useState(false);
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const handleFileSelection = useCallback(async (file: File) => {
		// Validate file type
		const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
		if (!acceptedTypes.includes(fileExtension)) {
			alert(`Invalid file type. Accepted types: ${acceptedTypes.join(', ')}`);
			return;
		}

		// Validate file size
		if (file.size > maxSize * 1024 * 1024) {
			alert(`File size exceeds maximum limit of ${maxSize}MB`);
			return;
		}

		setSelectedFile(file);
		await onFileSelect(file);
	}, [acceptedTypes, maxSize, onFileSelect]);

	const handleDrag = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		if (e.type === "dragenter" || e.type === "dragover") {
			setDragActive(true);
		} else if (e.type === "dragleave") {
			setDragActive(false);
		}
	}, []);

	const handleDrop = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setDragActive(false);
		
		if (disabled) return;

		if (e.dataTransfer.files && e.dataTransfer.files[0]) {
			handleFileSelection(e.dataTransfer.files[0]);
		}
	}, [disabled, handleFileSelection]);

	const handleClick = useCallback(() => {
		if (disabled) return;
		fileInputRef.current?.click();
	}, [disabled]);

	const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		if (e.target.files && e.target.files[0]) {
			handleFileSelection(e.target.files[0]);
		}
	}, [handleFileSelection]);

	const isValidating = validationProgress.status === 'processing';
	const hasValidationError = validationProgress.status === 'error';
	const hasValidationResult = validationResult !== undefined;
	const isImporting = importProgress?.status === 'processing';
	const hasImportError = importProgress?.status === 'error';
	const isImportSuccess = importProgress?.status === 'success';
	
	const handleImport = useCallback(async () => {
		if (!selectedFile || !onImport) return;
		await onImport(selectedFile);
	}, [selectedFile, onImport]);
	
	const canImport = selectedFile && 
		hasValidationResult && 
		validationResult?.isValid && 
		validationResult?.errors.length === 0 &&
		!isValidating && 
		!isImporting &&
		onImport;

	return (
		<Stack spacing={3}>
			{/* File Upload Area */}
			<Paper
				sx={{
					border: '2px dashed',
					borderColor: dragActive ? 'primary.main' : 'grey.300',
					borderRadius: 2,
					p: 4,
					textAlign: 'center',
					cursor: disabled ? 'not-allowed' : 'pointer',
					backgroundColor: dragActive ? 'action.hover' : 'background.paper',
					transition: 'all 0.2s ease-in-out',
					'&:hover': {
						borderColor: disabled ? 'grey.300' : 'primary.main',
						backgroundColor: disabled ? 'background.paper' : 'action.hover',
					}
				}}
				onDragEnter={handleDrag}
				onDragLeave={handleDrag}
				onDragOver={handleDrag}
				onDrop={handleDrop}
				onClick={handleClick}
			>
				<Stack spacing={2} alignItems="center">
					<UploadFileIcon 
						sx={{ 
							fontSize: 48, 
							color: dragActive ? 'primary.main' : 'text.secondary' 
						}} 
					/>
					<Typography variant="h6">
						{selectedFile ? selectedFile.name : 'Select Configuration File'}
					</Typography>
					<Typography variant="body2" color="text.secondary">
						Drag and drop a configuration file here, or click to select
					</Typography>
					<Typography variant="caption" color="text.secondary">
						Supported formats: {acceptedTypes.join(', ')} • Max size: {maxSize}MB
					</Typography>
				</Stack>
			</Paper>

			{/* Hidden File Input */}
			<input
				ref={fileInputRef}
				type="file"
				accept={acceptedTypes.join(',')}
				onChange={handleFileInput}
				style={{ display: 'none' }}
			/>

			{/* Validation Progress */}
			{isValidating && (
				<Box>
					<LinearProgress 
						variant={validationProgress.progress > 0 ? 'determinate' : 'indeterminate'}
						value={validationProgress.progress}
						sx={{ mb: 1 }}
					/>
					<Typography variant="body2" color="text.secondary" align="center">
						{validationProgress.message || 'Validating configuration...'}
					</Typography>
				</Box>
			)}

			{/* Validation Error */}
			{hasValidationError && (
				<Alert severity="error">
					{validationProgress.message || 'Configuration validation failed'}
				</Alert>
			)}

			{/* Validation Results */}
			{hasValidationResult && validationResult && (
				<Box>
					{validationResult.errors.length > 0 && (
						<Alert severity="error" sx={{ mb: 1 }}>
							<Typography variant="body2" sx={{ fontWeight: 'bold' }}>
								{validationResult.errors.length} error(s) found:
							</Typography>
							{validationResult.errors.slice(0, 3).map((error, index) => (
								<Typography key={index} variant="body2" sx={{ ml: 1 }}>
									• {error.message}
								</Typography>
							))}
							{validationResult.errors.length > 3 && (
								<Typography variant="body2" sx={{ ml: 1 }}>
									... and {validationResult.errors.length - 3} more errors
								</Typography>
							)}
						</Alert>
					)}
					
					{validationResult.warnings.length > 0 && (
						<Alert severity="warning" sx={{ mb: 1 }}>
							<Typography variant="body2" sx={{ fontWeight: 'bold' }}>
								{validationResult.warnings.length} warning(s):
							</Typography>
							{validationResult.warnings.slice(0, 3).map((warning, index) => (
								<Typography key={index} variant="body2" sx={{ ml: 1 }}>
									• {warning.message}
								</Typography>
							))}
							{validationResult.warnings.length > 3 && (
								<Typography variant="body2" sx={{ ml: 1 }}>
									... and {validationResult.warnings.length - 3} more warnings
								</Typography>
							)}
						</Alert>
					)}

					{validationResult.isValid && validationResult.errors.length === 0 && !isImportSuccess && (
						<Alert severity="success">
							Configuration file is valid and ready for import!
						</Alert>
					)}
				</Box>
			)}

			{/* Import Progress */}
			{isImporting && (
				<Box>
					<LinearProgress 
						variant={importProgress?.progress && importProgress.progress > 0 ? 'determinate' : 'indeterminate'}
						value={importProgress?.progress || 0}
						sx={{ mb: 1 }}
					/>
					<Typography variant="body2" color="text.secondary" align="center">
						{importProgress?.message || 'Importing configuration...'}
					</Typography>
				</Box>
			)}

			{/* Import Status Messages */}
			{hasImportError && (
				<Alert severity="error">
					{importProgress?.message || 'Configuration import failed'}
				</Alert>
			)}

			{isImportSuccess && (
				<Alert severity="success">
					{importProgress?.message || 'Configuration imported successfully!'}
				</Alert>
			)}

			{/* File Selection Actions */}
			{selectedFile && (
				<Stack direction="row" spacing={2} justifyContent="center">
					{canImport && (
						<Button
							variant="contained"
							color="primary"
							startIcon={<CloudUploadIcon />}
							onClick={handleImport}
							disabled={disabled || isValidating || isImporting}
						>
							{isImporting ? 'Importing...' : 'Import Configuration'}
						</Button>
					)}
					<Button 
						variant="outlined" 
						onClick={() => {
							setSelectedFile(null);
							if (fileInputRef.current) {
								fileInputRef.current.value = '';
							}
						}}
						disabled={disabled || isValidating || isImporting}
					>
						Clear Selection
					</Button>
				</Stack>
			)}
		</Stack>
	);
}