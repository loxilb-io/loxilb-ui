//---------------------------------------------------------
// AI objectives page (gateway 9f5017e2)
//---------------------------------------------------------
// Named request priorities: create, replace and delete. Three facts shape it:
//   - POST is create-or-replace by name; there is no PATCH. An edit keeps the
//     name and sends the whole objective.
//   - The list is the gateway's APPLIED list. During a key-store outage it is
//     the list read earlier (source store) or the last-known-good file it
//     started from (source lkg); writes are refused meanwhile. Where it came
//     from and whether the store answered are shown apart.
//   - A route 404 means this gateway does not serve objectives at all. It is
//     named as such and never drawn as an empty list; there is nothing to add.
//
// Delete: a tenant or key that still names the objective keeps the name, and
// a request asking for it is then treated as asking for an unknown objective.

import {Alert, Stack, Typography} from '@mui/material';
import {getStableHash} from 'common';
import SingleTextField from 'components/element/SingleTextField';
import ValueBunch from 'components/element/ValueBunch';
import ObjectiveInputForm from 'components/input/ObjectiveInputForm';
import LowerSection from 'components/layout/LowerSection';
import SubTitlePannel from 'components/layout/SubTitlePannel';
import ErrorPopUp from 'components/modal/ErrorPopUp';
import {PageDataState, toPageState} from 'components/state/pageState';
import ObjectiveTable from 'components/table/ai/ObjectiveTable';
import {IObjectiveList, OBJECTIVE_ROUTE_MISSING, request_delete_objective, request_upsert_objective} from 'connector/instance/ai_objective';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {usePopUp} from 'hooks/popupHook';
import {objectiveApplied, objectiveGone} from 'hooks/query/confirmPredicates';
import {useAIObjectives, useApiKeys} from 'hooks/query/queryHooks';
import {useReconcileReporter} from 'hooks/query/reconcileReport';
import {useErrorPopup} from 'hooks/useErrorPopup';
import {t} from 'i18next';
import React, {Fragment, useRef, useState} from 'react';
import {IAIObjectiveEntry, objectiveClass} from 'types/ai_priority';

/** The read state, with a route 404 named for what it is. */
export function objectivePageState(state: PageDataState<IObjectiveList>): PageDataState<IObjectiveList> {
	if (state.kind === 'failed' && state.result.httpStatus === 404) {
		return {...state, result: {...state.result, localeKey: OBJECTIVE_ROUTE_MISSING, retryable: false}};
	}
	return state;
}

const SOURCES: Record<string, string> = {store: 'Key store', lkg: 'Last-known-good file'};

function ProvenanceNote({list}: {list: IObjectiveList}) {
	const source = list.source;
	const time = (value?: string) => (value ? new Date(value).toLocaleString() : '–');
	return (
		<Stack spacing={1} sx={{mb: 2}}>
			{source === 'lkg' && (
				<Alert severity="warning">
					{t('The key store has not answered since this gateway started. This is the last-known-good file it applies; changes are refused until the store answers.')}
				</Alert>
			)}
			{list.storeReachable === false && source !== 'lkg' && (
				<Alert severity="warning">
					{t('The key store did not answer this read. This is the list the gateway applied when it last answered ({{time}}); changes are refused until it answers.', {time: time(list.sourceTimestamp)})}
				</Alert>
			)}
			<Typography variant="caption" color="text.secondary">
				{t('Source: {{source}} · list as of {{asOf}} · key store reachable: {{reachable}} · last store read: {{lastRead}}', {
					source: source ? (SOURCES[source] ? t(SOURCES[source]) : t('Unknown ({{value}})', {value: source})) : '–',
					asOf: time(list.sourceTimestamp),
					reachable: list.storeReachable === undefined ? '–' : list.storeReachable ? t('Yes') : t('No'),
					lastRead: time(list.storeLastRead),
				})}
			</Typography>
		</Stack>
	);
}

function DetailPanel({objective, namedBy}: {objective: IAIObjectiveEntry; namedBy: string[]}) {
	return (
		<SubTitlePannel title={objective.name ?? ''} sub_title={t('Details')}>
			<ValueBunch name={t('Objective')}>
				<SingleTextField label={t('Priority')} value={String(objective.priority ?? 0)} />
				<SingleTextField label={t('Class')} value={t(objectiveClass(objective.priority))} />
				<SingleTextField label={t('Services')} value={(objective.services ?? []).length > 0 ? (objective.services ?? []).join(', ') : t('All services')} />
				<SingleTextField label={t('Named by API keys')} value={namedBy.length > 0 ? namedBy.join(', ') : t('None listed')} />
			</ValueBunch>
		</SubTitlePannel>
	);
}

/** API keys that name the objective as their default or in their allowance. Tenants cannot be listed. */
function keysNaming(keys: readonly {key_id?: string; name?: string; default_objective?: string | null; allowed_objectives?: string[] | null}[], name: string): string[] {
	return keys.filter(key => key.default_objective === name || (key.allowed_objectives ?? []).includes(name)).map(key => key.name || key.key_id || '');
}

export default function AIObjectivesPage() {
	const inst = useInstanceFromURL();
	const objective_query = useAIObjectives(inst);
	const {data, refetch} = objective_query;
	const {data: keyData, refetch: refetchKeys} = useApiKeys(inst);
	const keys = React.useMemo(() => (Array.isArray(keyData) ? keyData : []), [keyData]);

	const objectives = React.useMemo(() => data?.objectives ?? [], [data]);
	const state = objectivePageState(toPageState(objective_query, {op: 'ai_objective.list', isEmpty: list => list.objectives.length === 0}));
	const routeMissing = state.kind === 'failed' && state.result.httpStatus === 404;

	const [selected_rows, set_selected_rows] = useState<number[]>([]);
	const {openPopUp, enableYes} = usePopUp();
	const {errorPopup, showAddError, showDeleteError, closeErrorPopup} = useErrorPopup();
	const {report} = useReconcileReporter();
	const selected = selected_rows.length === 1 ? objectives.find(o => getStableHash(o.name ?? '') === selected_rows[0]) ?? null : null;

	const formRef = useRef<IAIObjectiveEntry | null>(null);
	const listObjectives = async () => (await refetch()).data?.objectives ?? [];

	const openForm = (initial?: IAIObjectiveEntry) => {
		if (!inst) return;
		formRef.current = null;
		openPopUp(
			'',
			<ObjectiveInputForm
				key={initial?.name ?? Date.now()}
				initial={initial}
				existingNames={objectives.map(o => o.name ?? '')}
				onChange={value => {
					const {isValid, ...entry} = value;
					formRef.current = entry;
					enableYes(isValid ?? false);
				}}
			/>,
			initial ? t('Save') : t('Add'),
			t('Cancel'),
			async () => {
				if (!formRef.current) return;
				const entry = formRef.current;
				formRef.current = null;
				const res = await request_upsert_objective(inst, entry);
				if (res.status === 'confirmed') {
					set_selected_rows([]);
					await report({refetch: listObjectives, confirm: objectiveApplied(entry)}, t('Saved successfully.'));
					return;
				}
				showAddError('Objective', t(res.localeKey));
				// Not known whether it landed: read the list again rather than assume.
				if (res.status === 'unknown') void refetch();
			},
			true,
		);
	};

	const handleDelete = async () => {
		if (!inst || !selected?.name) return;
		const name = selected.name;
		const res = await request_delete_objective(inst, name);
		if (res.status === 'confirmed') {
			set_selected_rows([]);
			await report({refetch: listObjectives, confirm: objectiveGone(name)}, t('Deleted {{count}} item(s) successfully.', {count: 1}));
			return;
		}
		// A 404 here is the named object already gone, not a missing route.
		if (res.httpStatus === 404) {
			showDeleteError('Objective', t('{{name}} is not listed any more. The list has been read again.', {name}));
			void refetch();
			return;
		}
		showDeleteError('Objective', t(res.localeKey));
		if (res.status === 'unknown') void refetch();
	};

	const deleteMessage = React.useMemo(() => {
		if (!selected?.name) return undefined;
		const named = keysNaming(keys, selected.name);
		const base = t('Delete {{name}}? A tenant or key that still names it keeps the name, and a request asking for it is then treated as asking for an unknown objective.', {name: selected.name});
		return named.length > 0 ? `${base} ${t('Named by API keys: {{keys}}. Tenants are not listed here.', {keys: named.join(', ')})}` : base;
	}, [selected, keys]);

	const handleRefresh = () => {
		set_selected_rows([]);
		refetch();
		refetchKeys();
	};

	return (
		<Fragment>
			<Alert severity="info" sx={{mb: 2}}>
				{t('An objective is a named priority a request asks for with the x-llm-d-inference-objective header, or gets as its tenant\'s or key\'s default. Positive is critical, zero standard, negative sheddable.')}
			</Alert>
			{data && state.kind !== 'loading' && <ProvenanceNote list={data} />}
			<ObjectiveTable
				data={objectives}
				selected_rows={selected_rows}
				onChangeSelectedRows={set_selected_rows}
				// Nothing to add to on a gateway that does not serve objectives.
				onAdd={routeMissing ? undefined : () => openForm()}
				onEdit={() => selected && openForm(selected)}
				onDelete={handleDelete}
				onRefresh={handleRefresh}
				state={state}
				deleteMessage={deleteMessage}
			/>
			{selected && (
				<LowerSection>
					<DetailPanel objective={selected} namedBy={keysNaming(keys, selected.name ?? '')} />
				</LowerSection>
			)}
			<ErrorPopUp isOpen={errorPopup.isOpen} onClose={closeErrorPopup} title={errorPopup.title} mainMessage={errorPopup.mainMessage} errorData={errorPopup.errorData} buttonText={t('OK')} />
		</Fragment>
	);
}
