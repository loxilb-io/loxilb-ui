//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Stack, Box, Typography} from '@mui/material';
import {getStableHash, formatBytes} from 'common';
import SubTabs from 'components/element/SubTabs';
import LowerSection from 'components/layout/LowerSection';
import BackupTable from 'components/table/managers/BackupTable';
import {query_create_backup, query_list_backups, query_restore_backup} from 'connector/instance/backup';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {usePopUp} from 'hooks/popupHook';
import {useBackupList} from 'hooks/query/backupHooks';
import {t} from 'i18next';
import {Fragment, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {IBackupInfo, ICreateBackupRequest, IRestoreBackupRequest} from 'types/backup';
import BackupCreateForm from 'components/input/BackupCreateForm';
import BackupRestoreForm from 'components/input/BackupRestoreForm';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function BackupManagerPage() {
	const inst = useInstanceFromURL();

	const [searchParams] = useSearchParams();
	const backupId = searchParams.get('backupId');

	const {data: backup_data, refetch} = useBackupList(inst);
	const backup_info = useMemo(() => ({
		backups: backup_data?.data ?? []
	}), [backup_data]);

	const [selected_rows, set_selected_rows] = useState<number[]>([]);
	const [selected_key, set_selected_key] = useState<string | null>(null);
	const [backup_name, set_backup_name] = useState<string | null>(null);
	const [cur_tab_idx, set_cur_tab_idx] = useState(0);

	const tabs = ['Settings', 'Schedule', 'History', 'Restore'];

	// Hash function for backup
	const getHashKey = (item: any) => {
		const str = `${item.path || ''}_${item.created || ''}_${item.size_bytes || ''}`;
		return getStableHash(str);
	};

	// Sorted backups
	const sortedAttr = backup_info.backups ? [...backup_info.backups].sort((a, b) => getHashKey(a) - getHashKey(b)) : [];

	// Find selected index in sortedAttr
	let selected_index = -1;
	if (selected_rows.length === 1 && backup_info.backups) {
		const original = backup_info.backups[selected_rows[0]];
		selected_index = sortedAttr.findIndex(attr => getHashKey(attr) === getHashKey(original));
	} else if (selected_key) {
		selected_index = sortedAttr.findIndex(attr => getHashKey(attr).toString() === selected_key);
	}

	// Selection handler: map sorted index back to original
	const handleSelectionChange = (indices: number[]) => {
		if (indices.length === 1 && backup_info.backups) {
			const sortedItem = sortedAttr[indices[0]];
			const originalIndex = backup_info.backups.findIndex(attr => getHashKey(attr) === getHashKey(sortedItem));
			set_selected_rows(originalIndex !== -1 ? [originalIndex] : []);
		} else {
			set_selected_rows([]);
		}
	};

	useEffect(() => {
		if (!backup_info || backup_info.backups.length === 0) return;
		if (selected_rows.length === 1) {
			const item = backup_info.backups[selected_rows[0]];
			set_selected_key(getHashKey(item).toString());
			// Extract filename from path for display
			const filename = item.path ? item.path.split('/').pop() || 'Unknown Backup' : 'Unknown Backup';
			set_backup_name(filename);
			set_cur_tab_idx(0);
		} else if (selected_key !== null) {
			set_selected_key(null);
			set_backup_name(null);
			set_cur_tab_idx(0);
		}
	}, [backup_info, selected_rows, selected_key]);

	const {openPopUp, enableYes} = usePopUp();

	// Restore functionality
	const restoreFormRef = useRef<IRestoreBackupRequest | null>(null);
	const handleRestore = useCallback(() => {
		if (!inst) return;

		const restore_form = (
			<BackupRestoreForm
				key={Date.now()}
				availableBackups={backup_info.backups}
				onChange={(data: { request: IRestoreBackupRequest | null; isValid: boolean }) => {
					restoreFormRef.current = data.request;
					enableYes(data.isValid);
				}}
			/>
		);

		openPopUp(
			'',
			restore_form,
			t('Restore'),
			t('Cancel'),
			async () => {
				if (!restoreFormRef.current) return;

				// Show loading dialog
				const loadingContent = (
					<Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 3 }}>
						<Box sx={{ 
							width: 40, 
							height: 40, 
							border: '4px solid #f3f3f3',
							borderTop: '4px solid #1976d2',
							borderRadius: '50%',
							animation: 'spin 1s linear infinite',
							mb: 2,
							'@keyframes spin': {
								'0%': { transform: 'rotate(0deg)' },
								'100%': { transform: 'rotate(360deg)' }
							}
						}} />
						<Typography variant="h6" gutterBottom>
							{t('Restoring Backup...')}
						</Typography>
						<Typography variant="body2" color="text.secondary" align="center">
							{t('Please wait while the backup is being restored. This may take several minutes.')}
						</Typography>
						<Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 1 }}>
							{t('Backup: {{path}}', { path: restoreFormRef.current.backup_path.split('/').pop() || restoreFormRef.current.backup_path })}
						</Typography>
						{restoreFormRef.current.verify_integrity && (
							<Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 0.5 }}>
								{t('✓ Integrity verification enabled')}
							</Typography>
						)}
					</Box>
				);

				openPopUp(
					t('Restore in Progress'),
					loadingContent,
					'', // No confirm button
					'', // No cancel button
					() => {}, // No action
					false // Not closable
				);

				try {
					const res = await query_restore_backup(inst, restoreFormRef.current);
					if (res.success) {
						openPopUp(t('Success'), t('Backup restored successfully.'), t('OK'));
						setTimeout(() => {
							refetch();
						}, 1000);
					} else {
						openPopUp(t('Error'), t('Failed to restore backup. {{error}}', {error: res.message}), t('OK'));
					}
				} catch (error) {
					openPopUp(t('Error'), t('Failed to restore backup. Please try again.'), t('OK'));
				}
			},
			true,
		);
	}, [inst, backup_info.backups, openPopUp, refetch, enableYes]);

	const handleDelete = useCallback(async () => {
		if (!inst || selected_rows.length !== 1) return;

		const selectedBackup = backup_info.backups[selected_rows[0]];
		const backupName = selectedBackup.path.split('/').pop() || 'Unknown Backup';

		// Show API limitation message immediately
		const warningContent = (
			<Box sx={{ p: 2 }}>
				<Typography variant="h6" color="warning.main" gutterBottom>
					⚠️ {t('Feature Not Available')}
				</Typography>
				<Typography variant="body1" gutterBottom>
					{t('Backup deletion is not currently supported by the LoxiLB API.')}
				</Typography>
				<Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
					{t('Selected backup: "{{name}}"', { name: backupName })}
				</Typography>
				<Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
					{t('Available operations:')}
				</Typography>
				<Box component="ul" sx={{ mt: 1, pl: 2 }}>
					<Typography component="li" variant="body2">✓ {t('Create new backups')}</Typography>
					<Typography component="li" variant="body2">✓ {t('List existing backups')}</Typography>
					<Typography component="li" variant="body2">✓ {t('Restore from backups')}</Typography>
					<Typography component="li" variant="body2">✓ {t('View backup statistics')}</Typography>
					<Typography component="li" variant="body2" color="error">✗ {t('Delete backups (not supported)')}</Typography>
				</Box>
				<Typography variant="body2" color="text.secondary" sx={{ mt: 2, fontStyle: 'italic' }}>
					{t('Note: You may need to manually remove backup files from the server filesystem if necessary.')}
				</Typography>
			</Box>
		);

		openPopUp(
			t('Backup Deletion'),
			warningContent,
			t('OK'),
			'',
			() => {
				set_selected_rows([]); // Clear selection
			},
			false,
		);
	}, [inst, selected_rows, backup_info, openPopUp]);

	const instanceRef = useRef<ICreateBackupRequest | null>(null);
	const handleAdd = useCallback(() => {
		if (!inst) return;

		const input_form = (
			<BackupCreateForm
				key={Date.now()}
				onChange={(data: { request: ICreateBackupRequest | null; isValid: boolean }) => {
					instanceRef.current = data.request;
					enableYes(data.isValid);
				}}
			/>
		);

		openPopUp(
			'',
			input_form,
			t('Create'),
			t('Cancel'),
			async () => {
				if (!instanceRef.current) return;

				// Show loading dialog
				const loadingContent = (
					<Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 3 }}>
						<Box sx={{ 
							width: 40, 
							height: 40, 
							border: '4px solid #f3f3f3',
							borderTop: '4px solid #1976d2',
							borderRadius: '50%',
							animation: 'spin 1s linear infinite',
							mb: 2,
							'@keyframes spin': {
								'0%': { transform: 'rotate(0deg)' },
								'100%': { transform: 'rotate(360deg)' }
							}
						}} />
						<Typography variant="h6" gutterBottom>
							{t('Creating Backup...')}
						</Typography>
						<Typography variant="body2" color="text.secondary" align="center">
							{t('Please wait while the backup is being created. This may take several minutes depending on the data size.')}
						</Typography>
						<Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 1 }}>
							{t('Type: {{type}}', { type: instanceRef.current.type || 'full' })}
						</Typography>
					</Box>
				);

				openPopUp(
					t('Backup in Progress'),
					loadingContent,
					'', // No confirm button
					'', // No cancel button
					() => {}, // No action
					false // Not closable
				);

				try {
					const res = await query_create_backup(inst, instanceRef.current);
					if (res.success) {
						openPopUp(t('Success'), t('Backup created successfully.'), t('OK'));
						setTimeout(() => {
							refetch();
						}, 1000);
					} else {
						openPopUp(t('Error'), t('Failed to create backup. {{error}}', {error: res.message}), t('OK'));
					}
				} catch (error) {
					openPopUp(t('Error'), t('Failed to create backup. Please try again.'), t('OK'));
				}
			},
			true,
		);
	}, [inst, openPopUp, refetch, enableYes]);

	useEffect(() => {
		if (!backupId || !backup_info || backup_info.backups.length === 0) return;
		// Since API doesn't have ID field, try to match by path
		const index = backup_info.backups.findIndex(attr => attr.path.includes(backupId));
		if (index !== -1) {
			set_selected_rows([index]);
			set_selected_key(getHashKey(backup_info.backups[index]).toString());
			const filename = backup_info.backups[index].path ? backup_info.backups[index].path.split('/').pop() || 'Unknown Backup' : 'Unknown Backup';
			set_backup_name(filename);
			set_cur_tab_idx(0);
		}
	}, [backupId, backup_info]);

	return backup_info && inst ? (
		<Fragment>
			<BackupTable
				data={{backups: sortedAttr}}
				selected_rows={selected_index !== -1 ? [selected_index] : []}
				onChangeSelectedRows={handleSelectionChange}
				onAdd={handleAdd}
				onDelete={handleDelete}
			/>

			{selected_index !== -1 && backup_name && (
				<LowerSection>
					<Stack spacing={2}>
						<SubTabs tabs={tabs} onChange={(index: number) => set_cur_tab_idx(index)} />

						{cur_tab_idx === 0 && (
							<Box sx={{ p: 2 }}>
								<Typography variant="h6" gutterBottom>{t('Backup Details')}</Typography>
								<Stack spacing={1}>
									<Typography><strong>{t('Name:')} </strong>{backup_name}</Typography>
									<Typography><strong>{t('Path:')} </strong>{sortedAttr[selected_index]?.path}</Typography>
									<Typography><strong>{t('Type:')} </strong>{sortedAttr[selected_index]?.type}</Typography>
									<Typography><strong>{t('Size:')} </strong>{sortedAttr[selected_index]?.size_bytes ? formatBytes(sortedAttr[selected_index].size_bytes) : '-'}</Typography>
									<Typography><strong>{t('Created:')} </strong>{sortedAttr[selected_index]?.created ? new Date(sortedAttr[selected_index].created).toLocaleString() : '-'}</Typography>
									<Typography><strong>{t('Compressed:')} </strong>{sortedAttr[selected_index]?.is_compressed ? t('Yes') : t('No')}</Typography>
									<Typography><strong>{t('Checksum Valid:')} </strong>
										<span style={{ color: sortedAttr[selected_index]?.checksum_valid ? 'green' : 'red' }}>
											{sortedAttr[selected_index]?.checksum_valid ? t('Yes') : t('No')}
										</span>
									</Typography>
									<Typography><strong>{t('Priority:')} </strong>{sortedAttr[selected_index]?.priority}</Typography>
								</Stack>
							</Box>
						)}
						{cur_tab_idx === 1 && (
							<Box sx={{ p: 2 }}>
								<Typography variant="h6" gutterBottom>{t('Schedule Information')}</Typography>
								<Typography>{t('Backup scheduling functionality will be implemented in future versions.')}</Typography>
							</Box>
						)}
						{cur_tab_idx === 2 && (
							<Box sx={{ p: 2 }}>
								<Typography variant="h6" gutterBottom>{t('Backup History')}</Typography>
								<Typography>{t('Backup history and audit logs will be available in future versions.')}</Typography>
							</Box>
						)}
						{cur_tab_idx === 3 && (
							<Box sx={{ p: 2 }}>
								<Typography variant="h6" gutterBottom>{t('Restore Options')}</Typography>
								<Stack spacing={2}>
									<Typography variant="body2">
										{t('Restore from this backup: {{name}}', { name: backup_name })}
									</Typography>
									<Box>
										<button
											onClick={handleRestore}
											style={{
												padding: '8px 16px',
												backgroundColor: '#1976d2',
												color: 'white',
												border: 'none',
												borderRadius: '4px',
												cursor: 'pointer'
											}}
										>
											{t('Restore from Backup')}
										</button>
									</Box>
								</Stack>
							</Box>
						)}
					</Stack>
				</LowerSection>
			)}
		</Fragment>
	) : null;
}