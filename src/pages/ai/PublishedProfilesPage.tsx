//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {getStableHash} from 'common';
import {Alert, Chip, Stack, Typography} from '@mui/material';
import SingleTextField from 'components/element/SingleTextField';
import ValueBunch from 'components/element/ValueBunch';
import LowerSection from 'components/layout/LowerSection';
import SubTitlePannel from 'components/layout/SubTitlePannel';
import ModelProfileTable from 'components/table/ai/ModelProfileTable';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {useModelProfiles} from 'hooks/query/queryHooks';
import {t} from 'i18next';
import React, {Fragment, useState} from 'react';
import {IModelProfileEntry} from 'types/ai_gateway';
import {toPageState} from 'components/state/pageState';

//---------------------------------------------------------
// Published Model Profiles — READ ONLY inventory
//
// The registry is operator-published on the gateway. This page reads it;
// the only action anywhere on it is Refresh. Add/Edit/Delete/Upload/
// Activate controls (and any mutation HTTP) are a requirements violation
// (AC-12). Publication is all-or-nothing: every row shown has already
// passed artifact digest verification and tokenizer load — there is no
// partial/invalid state to render.
//---------------------------------------------------------

function DetailPanel(props: {data: IModelProfileEntry}) {
	const {data} = props;

	return (
		<SubTitlePannel title={data.profileId} sub_title={t('Profile Details')}>
			<Stack spacing={2}>
				<ValueBunch name={t('Identity')}>
					<SingleTextField label={t('Profile ID')} value={data.profileId} />
					<SingleTextField label={t('Registry Generation')} value={String(data.gen ?? '')} />
					<SingleTextField label={t('Base Model')} value={data.baseModel} />
					<SingleTextField label={t('Alias Policy')} value={data.aliasPolicy === 'list' ? t('Base model + allowed aliases') : t('Base model only')} />
					{data.aliasPolicy === 'list' && (
						<SingleTextField label={t('Allowed Aliases')} value={(data.allowedAliases ?? []).join(', ') || t('None')} />
					)}
				</ValueBunch>
				<ValueBunch name={t('Served Surfaces')}>
					<SingleTextField label={t('Supported APIs')} value={(data.supportedApis ?? []).join(', ')} />
					<SingleTextField label={t('Supported Features')} value={(data.supportedFeatures ?? []).join(', ') || t('None declared')} />
					<SingleTextField label={t('Excluded Features')} value={(data.excludedFeatures ?? []).join(', ') || t('None declared')} />
				</ValueBunch>
				<ValueBunch name={t('Pinned Artifacts')}>
					<SingleTextField label={t('Tokenizer SHA-256')} value={data.tokenizerSha256} />
					<SingleTextField label={t('Tokenizer Revision')} value={data.tokenizerRevision || t('Not recorded')} />
					<SingleTextField label={t('Chat Template SHA-256')} value={data.templateSha256 || t('No chat template bound')} />
					{data.templateSha256 && (
						<SingleTextField label={t('Template Content Format')} value={data.templateContentFormat || t('Not declared')} />
					)}
				</ValueBunch>
				<ValueBunch name={t('Render / Parity Provenance')}>
					<SingleTextField label={t('Renderer')} value={data.rendererEngine ? `${data.rendererEngine} ${data.rendererVersion ?? ''}`.trim() : t('Not declared')} />
					<SingleTextField label={t('Parity Oracle')} value={data.oracleEngine ? `${data.oracleEngine} ${data.oracleVersion ?? ''}`.trim() : t('Not declared')} />
				</ValueBunch>
			</Stack>
		</SubTitlePannel>
	);
}

export default function PublishedProfilesPage() {
	const inst = useInstanceFromURL();

	const profiles_query = useModelProfiles(inst);
	const {data, refetch} = profiles_query;

	const registry = data;
	const profiles = React.useMemo(() => registry?.profiles ?? [], [registry]);

	const [selected_rows, set_selected_rows] = useState<number[]>([]);
	const selectedProfile = selected_rows.length === 1
		? profiles.find(profile => getStableHash(profile.profileId ?? '') === selected_rows[0]) ?? null
		: null;

	const handleRefresh = () => {
		set_selected_rows([]);
		refetch();
	};

	// registryGeneration 0 + empty set is the documented no-registry-published
	// state — a NORMAL condition, never an error route (AC-03, GW-02).
	const isLegacyEmpty = registry !== undefined && (registry.registryGeneration ?? 0) === 0 && profiles.length === 0;

	return (
		<Fragment>
			<Stack direction="row" spacing={1} alignItems="center" sx={{mb: 1, flexWrap: 'wrap'}}>
				<Typography variant="body2" color="text.secondary">{t('Registry')}</Typography>
				<Chip size="small" variant="outlined" label={`${t('Generation')} ${registry?.registryGeneration ?? '—'}`} />
				{registry?.setDigest && (
					<Chip size="small" variant="outlined" sx={{fontFamily: 'monospace'}} label={`${t('Set Digest')} ${registry.setDigest}`} />
				)}
			</Stack>

			{isLegacyEmpty && (
				<Alert severity="info" sx={{mb: 1}}>
					{t('No profiles are currently published. Legacy profile-less routing remains available.')}
				</Alert>
			)}

			<ModelProfileTable
				data={profiles}
				selected_rows={selected_rows}
				onChangeSelectedRows={set_selected_rows}
				onRefresh={handleRefresh}
				state={toPageState(profiles_query, {op: 'ai_model_profiles.list', isEmpty: () => profiles.length === 0})}
			/>

			{selectedProfile && (
				<LowerSection>
					<DetailPanel data={selectedProfile} />
				</LowerSection>
			)}
		</Fragment>
	);
}
