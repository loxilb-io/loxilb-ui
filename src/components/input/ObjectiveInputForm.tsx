//---------------------------------------------------------
// Create or replace an AI objective (gateway 9f5017e2)
//---------------------------------------------------------
// POST is create-or-replace by name and there is no PATCH, so an edit sends
// the whole objective and its name cannot change (a new name would be a new
// objective, leaving the old one in place).
//
// The priority is a signed whole number: positive is the critical class,
// zero standard, negative sheddable. Order inside one class is not kept by
// the gateway, so the class is what an operator should read.

import {Alert, Stack, Typography} from '@mui/material';
import ParamBox from 'components/element/ParamBox';
import NewBox from 'components/layout/NewBox';
import {validateObjective} from 'connector/instance/ai_objective';
import {t} from 'i18next';
import React from 'react';
import {IAIObjectiveEntry, objectiveClass, parseObjectiveList} from 'types/ai_priority';

export interface IObjectiveFormState {
	name: string;
	priority: string; // raw text: a half-typed sign must never become 0
	services: string; // comma-separated VIP:port
}

export function objectiveToForm(entry?: IAIObjectiveEntry): IObjectiveFormState {
	return {
		name: entry?.name ?? '',
		priority: entry?.priority === undefined ? '0' : String(entry.priority),
		services: (entry?.services ?? []).join(', '),
	};
}

/** The signed whole number typed, or undefined while it is not one. */
export function parsePriority(raw: string): number | undefined {
	const text = raw.trim();
	if (!/^-?\d+$/.test(text)) return undefined;
	const value = Number(text);
	return Number.isSafeInteger(value) ? value : undefined;
}

export function objectiveFormToEntry(form: IObjectiveFormState): IAIObjectiveEntry {
	const services = parseObjectiveList(form.services);
	return {
		name: form.name.trim(),
		priority: parsePriority(form.priority) as number,
		...(services.length > 0 ? {services} : {}),
	};
}

export function objectiveFormErrors(form: IObjectiveFormState): string[] {
	if (parsePriority(form.priority) === undefined) return ['Priority must be a whole number from -2147483648 to 2147483647.'];
	return validateObjective(objectiveFormToEntry(form));
}

interface Props {
	initial?: IAIObjectiveEntry;
	/** Names already listed, so a create that would replace one says so. */
	existingNames: readonly string[];
	onChange: (data: IAIObjectiveEntry & {isValid?: boolean}) => void;
}

export default function ObjectiveInputForm({initial, existingNames, onChange}: Props) {
	const isEdit = initial !== undefined;
	const [form, setForm] = React.useState<IObjectiveFormState>(() => objectiveToForm(initial));
	const onChangeRef = React.useRef(onChange);
	onChangeRef.current = onChange;

	const errors = objectiveFormErrors(form);
	React.useEffect(() => {
		onChangeRef.current({...objectiveFormToEntry(form), isValid: errors.length === 0});
	}, [form, errors.length]);

	const set = (field: keyof IObjectiveFormState) => (value: unknown) => setForm(previous => ({...previous, [field]: String(value ?? '')}));
	const priority = parsePriority(form.priority);
	const replacing = !isEdit && existingNames.includes(form.name.trim());

	return (
		<NewBox item_name={t('Objective')} isEdit={isEdit}>
			<Stack spacing={2}>
				<ParamBox
					label={t('Name')}
					value={form.name}
					onChange={set('name')}
					disabled={isEdit}
					param_desc={{type: 'string', required: true, description: t('As a request names it in the x-llm-d-inference-objective header. 1 to 63 letters, digits, -, _ or ., case-sensitive, not beginning with tier:.')}}
				/>
				{replacing && <Alert severity="warning">{t('An objective with this name exists. Adding replaces it.')}</Alert>}
				<ParamBox
					label={t('Priority')}
					value={form.priority}
					onChange={set('priority')}
					param_desc={{type: 'string', required: true, description: t('A signed whole number. Positive is critical, zero standard, negative sheddable. The order between two objectives of one class is not kept.')}}
				/>
				{priority !== undefined && (
					<Typography variant="caption" color="text.secondary">
						{t('Class: {{class}}', {class: t(objectiveClass(priority))})}
					</Typography>
				)}
				<ParamBox
					label={t('Services (comma-separated VIP:port)')}
					value={form.services}
					onChange={set('services')}
					param_desc={{type: 'string', description: t('Limits the objective to these services. Empty means every service. At most 256.')}}
				/>
				<Alert severity="info">
					{t('Objectives live in the AI key store: every gateway sharing it applies a change within one refresh interval. Without a key store, or while it does not answer, the write is refused and nothing changes.')}
				</Alert>
				{errors.length > 0 && <Alert severity="error">{errors.join(' ')}</Alert>}
			</Stack>
		</NewBox>
	);
}
