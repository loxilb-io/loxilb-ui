import {Alert, Stack, Typography} from '@mui/material';
import {t} from 'i18next';
import {SnapshotScope} from 'types/snapshot_scope';

export default function SnapshotScopePanel({scope}: {scope: SnapshotScope}) {
	return <Stack spacing={2}>
		<Typography>{t('Schema')}: {scope.schema}</Typography>
		<Typography>{t('Included domains')}: {scope.included === null ? t('Not reported') : scope.included.join(', ') || t('none')}</Typography>
		<Typography>{t('Excluded domains')}: {scope.excluded === null ? t('Not reported') : scope.excluded.join(', ') || t('none')}</Typography>
		<Typography>{t('External dependencies')}</Typography>
		{scope.dependencies === null ? <Typography>{t('Not reported')}</Typography> : scope.dependencies.length === 0 ? <Typography>{t('none')}</Typography> : scope.dependencies.map((d, i) =>
			<Typography key={i}>{d.type}: {d.required ? t('Required') : t('Optional')}</Typography>)}
		<Alert severity="info">{t('This reads the stored document. It does not test external stores or confirm a backup of them.')}</Alert>
		<Alert severity="warning">{t('API key hashes, key policies, quotas and users require a separate database backup. Raw API keys cannot be recovered from hashes. Restoring an old database can reactivate revoked credentials.')}</Alert>
	</Stack>;
}
