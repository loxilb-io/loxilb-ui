//---------------------------------------------------------
// Audit Trail page: the two edit dialogs
//---------------------------------------------------------
// A dialog holds what was typed until the change is known to have gone
// through: a refusal (the gateway's 400 names no field) or a change with no
// answer leaves it open with the input as it was.
import {Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, FormGroup, MenuItem, Stack, TextField, Typography} from '@mui/material';
import {t} from 'i18next';
import {ReactNode, useState} from 'react';
import {
	AUDIT_FILTER_OUTCOMES,
	AUDIT_FILTER_STREAMS,
	AUDIT_POLICY_FIELDS,
	AuditComplianceSinkWrite,
	AuditInputError,
	AuditNamedSinkWrite,
	AuditPolicyForm,
	AuditPolicyValues,
	IAuditNamedSinkForm,
	parseNamedSinkForm,
	parsePolicyForm,
	parseSinkForm,
} from 'types/audit_config';
import {auditFieldHelp, auditFieldLabel, auditInputErrorText} from './auditText';

/** Resolves to true when the dialog should stay open with its input. */
type Save<T> = (value: T) => Promise<boolean>;

function Frame(props: {title: string; note?: ReactNode; busy: boolean; onCancel: () => void; onSave: () => void; children: ReactNode}) {
	return (
		<Dialog open fullWidth maxWidth="sm" onClose={props.busy ? undefined : props.onCancel}>
			<DialogTitle>{props.title}</DialogTitle>
			<DialogContent>
				<Stack spacing={2} sx={{pt: 1}}>
					{props.note && (
						<Typography variant="body2" color="text.secondary">
							{props.note}
						</Typography>
					)}
					{props.children}
				</Stack>
			</DialogContent>
			<DialogActions>
				<Button onClick={props.onCancel} disabled={props.busy}>
					{t('Cancel')}
				</Button>
				<Button variant="contained" onClick={props.onSave} disabled={props.busy}>
					{t('Save')}
				</Button>
			</DialogActions>
		</Dialog>
	);
}

function Field(props: {field: string; value: string; error?: AuditInputError | 'taken'; disabled?: boolean; numeric?: boolean; onChange: (value: string) => void}) {
	const {field, error} = props;
	const errorText = error === 'taken' ? t('A sink of this name already exists. Edit that one instead.') : error ? auditInputErrorText(field, error, t) : undefined;
	return (
		<TextField
			size="small"
			fullWidth
			label={auditFieldLabel(field, t)}
			value={props.value}
			disabled={props.disabled}
			error={!!error}
			helperText={errorText ?? auditFieldHelp(field, t)}
			onChange={e => props.onChange(e.target.value)}
			slotProps={{htmlInput: {inputMode: props.numeric ? 'numeric' : undefined, 'data-testid': `audit-field-${field}`}}}
		/>
	);
}

export function AuditPolicyDialog(props: {initial: AuditPolicyForm; onCancel: () => void; onSave: Save<AuditPolicyValues>}) {
	const [form, setForm] = useState(props.initial);
	const [errors, setErrors] = useState<Partial<Record<string, AuditInputError>>>({});
	const [busy, setBusy] = useState(false);

	const save = async () => {
		const parsed = parsePolicyForm(form);
		setErrors(parsed.errors);
		if (!parsed.values) return;
		setBusy(true);
		const keep = await props.onSave(parsed.values);
		if (keep) setBusy(false);
	};

	return (
		<Frame
			title={t('Change the audit policy')}
			note={t('All six values are sent together and replace the whole policy. Lowering a retention limit never deletes segments that are already sealed.')}
			busy={busy}
			onCancel={props.onCancel}
			onSave={save}
		>
			{AUDIT_POLICY_FIELDS.map(field => (
				<Field key={field} field={field} numeric value={form[field]} error={errors[field]} onChange={value => setForm({...form, [field]: value})} />
			))}
		</Frame>
	);
}

const SHARED_FIELDS = ['address', 'ca_bundle_path', 'server_name', 'client_cert_path', 'client_key_path', 'facility', 'max_frame_bytes'] as const;
const NUMERIC = new Set(['facility', 'max_frame_bytes', 'enterprise_number', 'data_sample']);

type SinkDialogProps = {
	title: string;
	initial: IAuditNamedSinkForm;
	onCancel: () => void;
} & (
	| {kind: 'compliance'; onSave: Save<AuditComplianceSinkWrite>}
	// `takenNames` is set for a new sink: a PUT to a name in use replaces that sink.
	| {kind: 'named'; takenNames?: readonly string[]; onSave: (name: string, body: AuditNamedSinkWrite) => Promise<boolean>}
);

export function AuditSinkDialog(props: SinkDialogProps) {
	const [form, setForm] = useState(props.initial);
	const [errors, setErrors] = useState<Partial<Record<string, AuditInputError | 'taken'>>>({});
	const [busy, setBusy] = useState(false);
	const named = props.kind === 'named';
	const isNew = named && props.takenNames !== undefined;
	const set = (field: keyof IAuditNamedSinkForm) => (value: string) => setForm({...form, [field]: value});

	const save = async () => {
		let keep: Promise<boolean>;
		if (props.kind === 'compliance') {
			const parsed = parseSinkForm(form);
			setErrors(parsed.errors);
			if (!parsed.body) return;
			setBusy(true);
			keep = props.onSave(parsed.body);
		} else {
			const parsed = parseNamedSinkForm(form);
			if (!parsed.errors.name && props.takenNames?.includes(form.name)) {
				setErrors({...parsed.errors, name: 'taken'});
				return;
			}
			setErrors(parsed.errors);
			if (!parsed.body || parsed.name === undefined) return;
			setBusy(true);
			keep = props.onSave(parsed.name, parsed.body);
		}
		if (await keep) setBusy(false);
	};

	return (
		<Frame
			title={props.title}
			note={t('Saving stops the sink and starts it again with these settings; its counters start again from zero. A connection test is not available: save, then watch the state.')}
			busy={busy}
			onCancel={props.onCancel}
			onSave={save}
		>
			{named && <Field field="name" value={form.name} error={errors.name} disabled={!isNew} onChange={set('name')} />}
			{SHARED_FIELDS.map(field => (
				<Field key={field} field={field} numeric={NUMERIC.has(field)} value={form[field]} error={errors[field]} onChange={set(field)} />
			))}
			{named && (
				<>
					<Field field="enterprise_number" numeric value={form.enterprise_number} error={errors.enterprise_number} onChange={set('enterprise_number')} />
					<Typography variant="subtitle2">{t('Filter')}</Typography>
					<Typography variant="body2" color="text.secondary">
						{t('A named sink receives every record unless a filter keeps some out. With no stream ticked it receives all three.')}
					</Typography>
					<FormGroup row>
						{AUDIT_FILTER_STREAMS.map(stream => (
							<FormControlLabel
								key={stream}
								label={stream}
								control={
									<Checkbox
										size="small"
										checked={form.streams.includes(stream)}
										onChange={e => setForm({...form, streams: AUDIT_FILTER_STREAMS.filter(s => (s === stream ? e.target.checked : form.streams.includes(s)))})}
									/>
								}
							/>
						))}
					</FormGroup>
					<Field field="services" value={form.services} error={errors.services} onChange={set('services')} />
					<TextField select size="small" fullWidth label={auditFieldLabel('outcome', t)} value={form.outcome} onChange={e => set('outcome')(e.target.value)}>
						<MenuItem value="">{t('Both')}</MenuItem>
						{AUDIT_FILTER_OUTCOMES.map(outcome => (
							<MenuItem key={outcome} value={outcome}>
								{outcome}
							</MenuItem>
						))}
					</TextField>
					<Field field="data_sample" numeric value={form.data_sample} error={errors.data_sample} onChange={set('data_sample')} />
				</>
			)}
		</Frame>
	);
}
