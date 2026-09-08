//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {getStableHash} from 'common';
import SearchIcon from '@mui/icons-material/Search';
import {Alert, Chip, InputAdornment, Stack, TextField, Tooltip, Typography} from '@mui/material';
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

	// Client-side search over the fields an operator knows a model by: the
	// profile ID, the base model path, and any served alias. The registry is
	// fetched whole (no server-side query surface, AC-12 read-only), so
	// substring matching here is the entire search implementation.
	const [search, set_search] = useState('');
	const needle = search.trim().toLowerCase();
	const visibleProfiles = React.useMemo(() => {
		if (!needle) return profiles;
		return profiles.filter(profile =>
			[profile.profileId ?? '', profile.baseModel ?? '', ...(profile.allowedAliases ?? [])]
				.some(field => field.toLowerCase().includes(needle)),
		);
	}, [profiles, needle]);

	const [selected_rows, set_selected_rows] = useState<number[]>([]);
	// Resolved against the FILTERED list: a selection whose row the search just
	// hid must not keep a detail panel on screen that matches nothing visible.
	const selectedProfile = selected_rows.length === 1
		? visibleProfiles.find(profile => getStableHash(profile.profileId ?? '') === selected_rows[0]) ?? null
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
					/* Truncated by CSS only — the full digest must stay in the DOM:
					   it is the registry's provenance identity, and E2E (MP-E2E,
					   live-P7) locates it by its full text. */
					<Tooltip title={<span style={{fontFamily: 'monospace'}}>{registry.setDigest}</span>}>
						<Chip size="small" variant="outlined" sx={{fontFamily: 'monospace', maxWidth: 420}} label={`${t('Set Digest')} ${registry.setDigest}`} />
					</Tooltip>
				)}
				<TextField
					size="small"
					value={search}
					onChange={event => set_search(event.target.value)}
					placeholder={t('Search profile, model, or alias')}
					inputProps={{'aria-label': t('Search profile, model, or alias')}}
					InputProps={{startAdornment: (
						<InputAdornment position="start">
							<SearchIcon fontSize="small" />
						</InputAdornment>
					)}}
					sx={{ml: 'auto', width: 280}}
				/>
			</Stack>

			{isLegacyEmpty && (
				<Alert severity="info" sx={{mb: 1}}>
					{t('No profiles are currently published. Legacy profile-less routing remains available.')}
				</Alert>
			)}

			<ModelProfileTable
				data={visibleProfiles}
				selected_rows={selected_rows}
				onChangeSelectedRows={set_selected_rows}
				onRefresh={handleRefresh}
				// isEmpty stays on the UNFILTERED list: a search that matches
				// nothing is not an empty registry, and must not route the page
				// into the empty state.
				state={toPageState(profiles_query, {op: 'ai_model_profiles.list', isEmpty: () => profiles.length === 0})}
				emptyLabel={needle && profiles.length > 0 ? t('No profiles match the search') : undefined}
			/>

			{selectedProfile && (
				<LowerSection>
					<DetailPanel data={selectedProfile} />
				</LowerSection>
			)}
		</Fragment>
	);
}
