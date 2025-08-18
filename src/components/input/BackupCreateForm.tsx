//---------------------------------------------------------
// Backup Creation Form Component
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
	Chip,
	Box,
} from '@mui/material';
import { t } from 'i18next';
import { useEffect, useState, useCallback } from 'react';
import { ICreateBackupRequest } from 'types/backup';

//---------------------------------------------------------
// Component Props Interface
//---------------------------------------------------------
interface IBackupCreateFormProps {
	onChange: (data: { request: ICreateBackupRequest | null; isValid: boolean }) => void;
}

//---------------------------------------------------------
// Component Implementation
//---------------------------------------------------------
export default function BackupCreateForm({ onChange }: IBackupCreateFormProps) {
	const [formData, setFormData] = useState<ICreateBackupRequest>({
		type: 'full',
		description: '',
		include_tables: [],
		exclude_tables: [],
	});

	const [errors, setErrors] = useState<Record<string, string>>({});
	const [includeTablesInput, setIncludeTablesInput] = useState<string>('');
	const [excludeTablesInput, setExcludeTablesInput] = useState<string>('');

	// Validation function
	const validateForm = useCallback(() => {
		const newErrors: Record<string, string> = {};

		// Validate include_tables if provided
		if (includeTablesInput.trim()) {
			const tables = includeTablesInput.split(',').map(t => t.trim()).filter(t => t);
			if (tables.some(table => !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table))) {
				newErrors.include_tables = t('Table names must be valid identifiers (alphanumeric and underscore only)');
			}
		}

		// Validate exclude_tables if provided
		if (excludeTablesInput.trim()) {
			const tables = excludeTablesInput.split(',').map(t => t.trim()).filter(t => t);
			if (tables.some(table => !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table))) {
				newErrors.exclude_tables = t('Table names must be valid identifiers (alphanumeric and underscore only)');
			}
		}

		// Check for conflicts
		if (includeTablesInput.trim() && excludeTablesInput.trim()) {
			const includeTables = includeTablesInput.split(',').map(t => t.trim()).filter(t => t);
			const excludeTables = excludeTablesInput.split(',').map(t => t.trim()).filter(t => t);
			const conflicts = includeTables.filter(table => excludeTables.includes(table));
			if (conflicts.length > 0) {
				newErrors.table_conflict = t('Tables cannot be both included and excluded: {{tables}}', { tables: conflicts.join(', ') });
			}
		}

		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	}, [includeTablesInput, excludeTablesInput]);

	// Update parent component when form changes
	useEffect(() => {
		const isValid = validateForm();
		
		// Parse table lists
		const include_tables = includeTablesInput.trim() 
			? includeTablesInput.split(',').map(t => t.trim()).filter(t => t)
			: [];
		const exclude_tables = excludeTablesInput.trim() 
			? excludeTablesInput.split(',').map(t => t.trim()).filter(t => t)
			: [];

		const requestData: ICreateBackupRequest = {
			...formData,
			include_tables: include_tables.length > 0 ? include_tables : undefined,
			exclude_tables: exclude_tables.length > 0 ? exclude_tables : undefined,
			description: formData.description?.trim() || undefined,
		};

		onChange({
			request: isValid ? requestData : null,
			isValid,
		});
	}, [formData, includeTablesInput, excludeTablesInput, onChange, validateForm]);

	// Handle form field changes
	const handleChange = (field: keyof ICreateBackupRequest, value: any) => {
		setFormData(prev => ({
			...prev,
			[field]: value,
		}));
	};

	return (
		<Stack width="100%" maxHeight="400px" spacing={2}>
			<Typography variant="h6">
				{t('Create Backup')}
			</Typography>

			<Stack width="100%" height="100%" padding="15px 5px" spacing={2} sx={{overflowY: 'auto'}}>
				<FormControl size="small" required>
					<InputLabel>{t('Backup Type')}</InputLabel>
					<Select
						value={formData.type || 'full'}
						label={t('Backup Type')}
						onChange={(e) => handleChange('type', e.target.value)}
					>
						<MenuItem value="full">{t('Full Backup')}</MenuItem>
						<MenuItem value="incremental">{t('Incremental Backup')}</MenuItem>
						<MenuItem value="selective">{t('Selective Backup')}</MenuItem>
					</Select>
					<FormHelperText>
						{formData.type === 'full' && t('Complete database backup (recommended)')}
						{formData.type === 'incremental' && t('Only changes since last backup')}
						{formData.type === 'selective' && t('Backup specific tables or data ranges')}
					</FormHelperText>
				</FormControl>

				<TextField
					label={t('Description (Optional)')}
					value={formData.description || ''}
					onChange={(e) => handleChange('description', e.target.value)}
					size="small"
					multiline
					rows={2}
					helperText={t('Optional description for this backup')}
					placeholder={t('e.g., Weekly backup before maintenance')}
				/>

				{formData.type === 'selective' && (
					<>
						<TextField
							label={t('Include Tables (Optional)')}
							value={includeTablesInput}
							onChange={(e) => setIncludeTablesInput(e.target.value)}
							size="small"
							error={!!errors.include_tables}
							helperText={errors.include_tables || t('Comma-separated list of table names to include')}
							placeholder={t('table1, table2, table3')}
						/>

						<TextField
							label={t('Exclude Tables (Optional)')}
							value={excludeTablesInput}
							onChange={(e) => setExcludeTablesInput(e.target.value)}
							size="small"
							error={!!errors.exclude_tables}
							helperText={errors.exclude_tables || t('Comma-separated list of table names to exclude')}
							placeholder={t('temp_table1, cache_table2')}
						/>

						{errors.table_conflict && (
							<Box sx={{ p: 1, bgcolor: 'error.light', borderRadius: 1 }}>
								<Typography variant="body2" color="error.dark">
									{errors.table_conflict}
								</Typography>
							</Box>
						)}

						{(includeTablesInput.trim() || excludeTablesInput.trim()) && (
							<Box>
								{includeTablesInput.trim() && (
									<Box sx={{ mb: 1 }}>
										<Typography variant="body2" gutterBottom>{t('Tables to include:')}</Typography>
										<Stack direction="row" spacing={1} flexWrap="wrap">
											{includeTablesInput.split(',').map(table => table.trim()).filter(t => t).map((table, index) => (
												<Chip key={index} label={table} size="small" color="primary" />
											))}
										</Stack>
									</Box>
								)}
								{excludeTablesInput.trim() && (
									<Box>
										<Typography variant="body2" gutterBottom>{t('Tables to exclude:')}</Typography>
										<Stack direction="row" spacing={1} flexWrap="wrap">
											{excludeTablesInput.split(',').map(table => table.trim()).filter(t => t).map((table, index) => (
												<Chip key={index} label={table} size="small" color="secondary" />
											))}
										</Stack>
									</Box>
								)}
							</Box>
						)}
					</>
				)}
			</Stack>
		</Stack>
	);
}