//---------------------------------------------------------
// Request priority on an identity: class cap, default objective, allowed
// objectives. Shared by the API key (create and edit), tenant and JWT forms.
//
// Collapsed on create, open on an edit that already declares something. The
// class offers "unset" first and never preselects one: unset is the default
// and means something different per owner (see types/ai_priority.ts).
// Warnings never block a write — the gateway decides what is valid.
//---------------------------------------------------------
import {ExpandLess, ExpandMore} from '@mui/icons-material';
import {Alert, Button, Collapse, Grid2, MenuItem, Stack, TextField, Typography} from '@mui/material';
import ParamBox from 'components/element/ParamBox';
import {t} from 'i18next';
import React from 'react';
import {IAIObjectiveEntry, IPriorityDraft, objectiveClass, PRIORITY_CLASSES, priorityWarnings, PriorityScope, validatePriorityDraft} from 'types/ai_priority';

const UNSET_LABEL: Record<PriorityScope, string> = {
	key: 'Unset (no cap from this key)',
	jwt: 'Unset (no cap from this profile)',
	tenant: 'Unset (held at standard)',
};

const CLASS_HELP: Record<PriorityScope, string> = {
	key: 'The highest class a request with this key may have. It can only lower what the key\'s tenant allows; a tenant with no class allows standard.',
	jwt: 'The highest class a request admitted by this profile\'s tokens may have. It can only lower what the tenant allows.',
	tenant: 'The highest class a request of this tenant may have. A tenant with no class is held at standard.',
};

const ALLOWED_HELP: Record<'key' | 'tenant', string> = {
	key: 'Objectives a request with this key may ask for, out of the ones its tenant allows; at most 64. Empty narrows nothing. Only raises need an entry.',
	tenant: 'Objectives (and tier:priority, tier:fast, tier:flex) a request of this tenant may raise itself to; at most 64. Empty authorizes no raises. Only raises need an entry.',
};

const DEFAULT_HELP: Record<'key' | 'tenant', string> = {
	key: 'The objective a request with this key gets when it names none. It counts only when the tenant\'s allowed objectives hold it.',
	tenant: 'The objective a request of this tenant gets when it names none, or one it may not use.',
};

export interface PriorityClassFieldsProps {
	scope: PriorityScope;
	value: IPriorityDraft;
	onChange: (next: IPriorityDraft) => void;
	/** The objectives as read, or undefined when the list could not be read. */
	objectives?: readonly IAIObjectiveEntry[];
	/** Open on first render (an edit that already declares a priority setting). */
	defaultOpen?: boolean;
	/** On an edit, emptying a field clears the stored value; say so. */
	isEdit?: boolean;
}

export default function PriorityClassFields({scope, value, onChange, objectives, defaultOpen = false, isEdit = false}: PriorityClassFieldsProps) {
	const [open, setOpen] = React.useState(defaultOpen);
	const errors = validatePriorityDraft(value, scope);
	const warnings = priorityWarnings(value, scope, objectives);
	const set = (field: keyof IPriorityDraft) => (next: unknown) => onChange({...value, [field]: String(next ?? '')});
	const known = objectives?.map(objective => `${objective.name} (${t(objectiveClass(objective.priority))})`).join(', ');

	return (
		<Stack spacing={1}>
			<Button
				variant="text"
				onClick={() => setOpen(previous => !previous)}
				endIcon={open ? <ExpandLess /> : <ExpandMore />}
				aria-expanded={open}
				sx={{alignSelf: 'flex-start'}}
			>
				{t('Request Priority')}
			</Button>
			<Collapse in={open} unmountOnExit>
				<Stack spacing={2}>
					<Grid2 container spacing={2}>
						<TextField
							select
							label={t('Priority Class')}
							value={value.priority_class}
							onChange={event => set('priority_class')(event.target.value)}
							helperText={t(CLASS_HELP[scope])}
							sx={{minWidth: 260}}
							// Unset is a value ('') and must be shown as one, not as a blank.
							slotProps={{select: {displayEmpty: true}, inputLabel: {shrink: true}}}
						>
							<MenuItem value="">{t(UNSET_LABEL[scope])}</MenuItem>
							{PRIORITY_CLASSES.map(option => (
								<MenuItem key={option} value={option}>{t(option)}</MenuItem>
							))}
						</TextField>
					</Grid2>
					{scope !== 'jwt' && (
						<>
							<ParamBox
								label={t('Default Objective')}
								value={value.default_objective}
								onChange={set('default_objective')}
								param_desc={{type: 'string', description: t(DEFAULT_HELP[scope])}}
							/>
							<ParamBox
								label={t('Allowed Objectives (comma-separated)')}
								value={value.allowed_objectives}
								onChange={set('allowed_objectives')}
								param_desc={{type: 'string', description: t(ALLOWED_HELP[scope])}}
							/>
							{known !== undefined && (
								<Typography variant="caption" color="text.secondary">
									{known.length > 0 ? t('Objectives now: {{list}}', {list: known}) : t('No objectives are defined yet.')}
								</Typography>
							)}
						</>
					)}
					{isEdit && (
						<Typography variant="caption" color="text.secondary">
							{t('Only changed priority fields are sent. Emptying one clears it; leaving it as it is keeps the stored value.')}
						</Typography>
					)}
					{warnings.map(warning => (
						<Alert key={warning.key} severity="warning">{t(warning.key, warning.values)}</Alert>
					))}
					{errors.length > 0 && <Alert severity="error">{errors.join(' ')}</Alert>}
				</Stack>
			</Collapse>
		</Stack>
	);
}
