//---------------------------------------------------------
// Config Export Form Component
//---------------------------------------------------------
import {
	Stack,
	TextField,
	Typography,
	Button,
	Box,
	LinearProgress,
	Alert,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
// Note: t function will be used when internationalization is fully implemented
import { useState, useCallback } from 'react';
import { ExportRequest, OperationProgress } from 'types/config';

//---------------------------------------------------------
// Component Props Interface
//---------------------------------------------------------
interface ConfigExportFormProps {
	onExport: (request: ExportRequest) => Promise<void>;
	exportProgress: OperationProgress;
	disabled?: boolean;
}

//---------------------------------------------------------
// Component Implementation
//---------------------------------------------------------
export default function ConfigExportForm({ 
	onExport, 
	exportProgress, 
	disabled = false 
}: ConfigExportFormProps) {
	const [description, setDescription] = useState<string>('');
	const [isSubmitting, setIsSubmitting] = useState(false);

	const handleExport = useCallback(async () => {
		if (isSubmitting) return;
		
		setIsSubmitting(true);
		try {
			const request: ExportRequest = {
				description: description.trim() || undefined
			};
			await onExport(request);
		} finally {
			setIsSubmitting(false);
		}
	}, [description, onExport, isSubmitting]);

	const isExporting = exportProgress.status === 'processing' || isSubmitting;
	const hasError = exportProgress.status === 'error';
	const isSuccess = exportProgress.status === 'success';

	return (
		<Stack spacing={3}>
			{/* Form Title */}
			<Box>
				<Typography variant="h6" gutterBottom>
					Export System Configuration
				</Typography>
				<Typography variant="body2" color="text.secondary">
					Create a backup of the current system configuration including users, instances, and settings.
				</Typography>
			</Box>

			{/* Form Fields */}
			<Stack spacing={2}>
				<TextField
					label="Description (Optional)"
					placeholder="Enter a description for this export..."
					value={description}
					onChange={(e) => setDescription(e.target.value)}
					multiline
					rows={3}
					fullWidth
					disabled={disabled || isExporting}
					helperText="Provide an optional description to help identify this export later."
				/>
			</Stack>

			{/* Progress Indicator */}
			{isExporting && (
				<Box>
					<LinearProgress 
						variant={exportProgress.progress > 0 ? 'determinate' : 'indeterminate'}
						value={exportProgress.progress}
						sx={{ mb: 1 }}
					/>
					<Typography variant="body2" color="text.secondary" align="center">
						{exportProgress.message || 'Exporting configuration...'}
					</Typography>
				</Box>
			)}

			{/* Status Messages */}
			{hasError && (
				<Alert severity="error">
					{exportProgress.message || 'Failed to export configuration'}
				</Alert>
			)}

			{isSuccess && (
				<Alert severity="success">
					{exportProgress.message || 'Configuration exported successfully'}
				</Alert>
			)}

			{/* Export Button */}
			<Box>
				<Button
					variant="contained"
					size="large"
					startIcon={<DownloadIcon />}
					onClick={handleExport}
					disabled={disabled || isExporting}
					fullWidth
				>
					{isExporting ? 'Exporting...' : 'Start Export'}
				</Button>
			</Box>

			{/* Export Information */}
			<Box sx={{ mt: 2 }}>
				<Typography variant="body2" color="text.secondary">
					<strong>What will be exported:</strong>
				</Typography>
				<Typography variant="body2" color="text.secondary" component="ul" sx={{ mt: 1, pl: 2 }}>
					<li>User accounts and roles</li>
					<li>LoxiLB instance configurations</li>
					<li>System settings and preferences</li>
					<li>License information</li>
				</Typography>
			</Box>
		</Stack>
	);
}