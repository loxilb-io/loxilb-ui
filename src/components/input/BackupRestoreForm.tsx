//---------------------------------------------------------
// Backup Restore Form Component
//---------------------------------------------------------
import {
	Stack,
	TextField,
	FormControl,
	InputLabel,
	Select,
	MenuItem,
	Typography,
	FormHelperText,
	Switch,
	FormControlLabel,
	Box,
} from '@mui/material';
import { t } from 'i18next';
import { useEffect, useState, useCallback } from 'react';
import { IRestoreBackupRequest, IBackupInfo } from 'types/backup';

//---------------------------------------------------------
// Component Props Interface
//---------------------------------------------------------
interface IBackupRestoreFormProps {
	availableBackups: IBackupInfo[];
	onChange: (data: { request: IRestoreBackupRequest | null; isValid: boolean }) => void;
}

//---------------------------------------------------------
// Component Implementation
//---------------------------------------------------------
export default function BackupRestoreForm({ availableBackups, onChange }: IBackupRestoreFormProps) {
	const [formData, setFormData] = useState<IRestoreBackupRequest>({
		backup_path: '',
		force: false,
		verify_integrity: true,
	});

	const [errors, setErrors] = useState<Record<string, string>>({});
	const [selectedBackup, setSelectedBackup] = useState<IBackupInfo | null>(null);

	// Validation function
	const validateForm = useCallback(() => {
		const newErrors: Record<string, string> = {};

		if (!formData.backup_path.trim()) {
			newErrors.backup_path = t('Backup path is required');
		}

		// Check if selected backup exists in available backups
		if (formData.backup_path.trim()) {
			const backup = availableBackups.find(b => b.path === formData.backup_path);
			if (!backup) {
				newErrors.backup_path = t('Selected backup does not exist');
			} else {
				// Check if backup is valid
				if (!backup.checksum_valid) {
					newErrors.backup_integrity = t('Warning: Selected backup has invalid checksum');
				}
			}
		}

		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	}, [formData.backup_path, availableBackups]);

	// Update parent component when form changes
	useEffect(() => {
		const isValid = validateForm();
		
		const requestData: IRestoreBackupRequest = {
			...formData,
		};

		onChange({
			request: isValid ? requestData : null,
			isValid,
		});
	}, [formData, onChange, validateForm]);

	// Handle form field changes
	const handleChange = (field: keyof IRestoreBackupRequest, value: any) => {
		setFormData(prev => ({
			...prev,
			[field]: value,
		}));
	};

	// Handle backup selection
	const handleBackupSelection = (backupPath: string) => {
		handleChange('backup_path', backupPath);
		const backup = availableBackups.find(b => b.path === backupPath);
		setSelectedBackup(backup || null);
	};

	// Format file size
	const formatFileSize = (bytes: number): string => {
		if (bytes === 0) return '0 Bytes';
		const k = 1024;
		const sizes = ['Bytes', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	};

	return (
		<Stack width="100%" maxHeight="400px" spacing={2}>
			<Typography variant="h6">
				{t('Restore Backup')}
			</Typography>

			<Stack width="100%" height="100%" padding="15px 5px" spacing={2} sx={{overflowY: 'auto'}}>
				<FormControl size="small" required error={!!errors.backup_path}>
					<InputLabel>{t('Select Backup')}</InputLabel>
					<Select
						value={formData.backup_path || ''}
						label={t('Select Backup')}
						onChange={(e) => handleBackupSelection(e.target.value)}
					>
						{availableBackups.map((backup, index) => (
							<MenuItem key={index} value={backup.path}>
								<Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
									<Typography variant="body2" sx={{ fontWeight: 'bold' }}>
										{backup.path.split('/').pop() || backup.path}
									</Typography>
									<Typography variant="caption" color="text.secondary">
										{t('Type: {{type}}, Size: {{size}}, Created: {{date}}', {
											type: backup.type,
											size: formatFileSize(backup.size_bytes),
											date: new Date(backup.created).toLocaleDateString()
										})}
									</Typography>
									{!backup.checksum_valid && (
										<Typography variant="caption" color="error">
											{t('⚠️ Checksum invalid')}
										</Typography>
									)}
								</Box>
							</MenuItem>
						))}
						{availableBackups.length === 0 && (
							<MenuItem disabled value="">
								{t('No backups available')}
							</MenuItem>
						)}
					</Select>
					<FormHelperText>
						{errors.backup_path || t('Select a backup file to restore from')}
					</FormHelperText>
				</FormControl>

				{selectedBackup && (
					<Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
						<Typography variant="subtitle2" gutterBottom>
							{t('Backup Details')}
						</Typography>
						<Stack spacing={1}>
							<Typography variant="body2">
								<strong>{t('Path:')} </strong>{selectedBackup.path}
							</Typography>
							<Typography variant="body2">
								<strong>{t('Type:')} </strong>{selectedBackup.type}
							</Typography>
							<Typography variant="body2">
								<strong>{t('Size:')} </strong>{formatFileSize(selectedBackup.size_bytes)}
							</Typography>
							<Typography variant="body2">
								<strong>{t('Created:')} </strong>{new Date(selectedBackup.created).toLocaleString()}
							</Typography>
							<Typography variant="body2">
								<strong>{t('Compressed:')} </strong>{selectedBackup.is_compressed ? t('Yes') : t('No')}
							</Typography>
							<Typography variant="body2">
								<strong>{t('Checksum Valid:')} </strong>
								<span style={{ color: selectedBackup.checksum_valid ? 'green' : 'red' }}>
									{selectedBackup.checksum_valid ? t('Yes') : t('No')}
								</span>
							</Typography>
							<Typography variant="body2">
								<strong>{t('Priority:')} </strong>{selectedBackup.priority}
							</Typography>
						</Stack>
					</Box>
				)}

				{errors.backup_integrity && (
					<Box sx={{ p: 1, bgcolor: 'warning.light', borderRadius: 1 }}>
						<Typography variant="body2" color="warning.dark">
							{errors.backup_integrity}
						</Typography>
					</Box>
				)}

				<FormControlLabel
					control={
						<Switch
							checked={formData.verify_integrity || false}
							onChange={(e) => handleChange('verify_integrity', e.target.checked)}
							size="small"
						/>
					}
					label={t('Verify Integrity')}
				/>
				<Typography variant="caption" color="text.secondary" sx={{ mt: -1 }}>
					{t('Perform integrity check before restoring (recommended)')}
				</Typography>

				<FormControlLabel
					control={
						<Switch
							checked={formData.force || false}
							onChange={(e) => handleChange('force', e.target.checked)}
							size="small"
						/>
					}
					label={t('Force Restore')}
				/>
				<Typography variant="caption" color="text.secondary" sx={{ mt: -1 }}>
					{t('Force restore even if integrity check fails (use with caution)')}
				</Typography>

				{formData.force && (
					<Box sx={{ p: 1, bgcolor: 'error.light', borderRadius: 1 }}>
						<Typography variant="body2" color="error.dark">
							⚠️ {t('Warning: Force restore will overwrite existing data even if the backup is corrupted. Use with extreme caution.')}
						</Typography>
					</Box>
				)}
			</Stack>
		</Stack>
	);
}