import {Alert, Button, Collapse, Stack, Typography} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DropDownSelectBox from 'components/element/DropDownSelectBox';
import ParamBox from 'components/element/ParamBox';
import HorizontalStack from 'components/layout/HorizontalStack';
import {evaluateNumericField} from 'components/input/numericField';
import {t} from 'i18next';
import {useCallback, useState} from 'react';
import {FC_FIELDS, FC_NUMERIC_MAX, FcNumericField} from 'types/ai_gateway';
import {IEnumItem} from 'types/global';
import {IServiceArguments} from 'types/load_balancer';

//---------------------------------------------------------
// Capacity admission gate (fc_*) — the rule's own declaration
//---------------------------------------------------------
// ⚠️ BLANK IS OMITTED, NEVER 0. On these fields an explicit 0 resets the pool to
// the gateway's process default and null is refused, so the legacy number box
// (which turns a cleared field into 0 and clamps what it cannot parse) must not
// be used. Each field keeps the operator's verbatim text here and hands the form
// only what it means: the integer, undefined for blank, or — when the text is
// not a whole number in range — the text itself, which the AI validator refuses
// so the submit stays blocked instead of the value being dropped.

const MODE_ITEMS: IEnumItem[] = [
	{id: 0, name: 'Gateway default', send_value: ''},
	{id: 1, name: 'enforce', send_value: 'enforce'},
	{id: 2, name: 'observe', send_value: 'observe'},
	{id: 3, name: 'off', send_value: 'off'},
];

const ADAPTIVE_ITEMS: IEnumItem[] = [
	{id: 0, name: 'Gateway default', send_value: ''},
	{id: 1, name: 'on', send_value: 'on'},
	{id: 2, name: 'off', send_value: 'off'},
];

// The gateway's words (enforce, observe, on, off) are shown as the API spells
// them; only the "not declared" choice is ours to name.
function localizeDefault(items: IEnumItem[]): IEnumItem[] {
	return items.map(item => (item.send_value === '' ? {...item, name: t('Gateway default')} : item));
}

function initialText(value: IServiceArguments): Record<FcNumericField, string> {
	const text = {} as Record<FcNumericField, string>;
	for (const field of Object.keys(FC_NUMERIC_MAX) as FcNumericField[]) {
		const v = value[field];
		text[field] = v === undefined || v === null ? '' : String(v);
	}
	return text;
}

export default function AdmissionControlForm(props: {
	value: IServiceArguments;
	onChange: (delta: Partial<IServiceArguments>) => void;
	pdTopology: boolean;
	isEdit: boolean;
	/** The fields this instance's gateway declares (declaredFcFields); the rest are not offered. */
	declared: ReadonlySet<keyof IServiceArguments>;
}) {
	const {value, onChange, pdTopology, isEdit, declared} = props;
	const [text, setText] = useState(() => initialText(value));
	// Open when the rule already declares something, so an edit shows it.
	const [open, setOpen] = useState(() => FC_FIELDS.some(field => value[field] !== undefined && value[field] !== ''));

	const numeric = useCallback(
		(field: FcNumericField) => (raw: string) => {
			setText(prev => ({...prev, [field]: raw}));
			const state = evaluateNumericField(raw, {required: false, min: 0, max: FC_NUMERIC_MAX[field]});
			const next = raw.trim() === '' ? undefined : state.valid ? state.parsed : raw;
			onChange({[field]: next} as Partial<IServiceArguments>);
		},
		[onChange],
	);

	const box = (field: FcNumericField, label: string, description: string) => {
		if (!declared.has(field)) return null;
		const state = evaluateNumericField(text[field], {required: false, min: 0, max: FC_NUMERIC_MAX[field]});
		return (
			<ParamBox
				label={label}
				value={text[field]}
				onChange={numeric(field)}
				param_desc={{type: 'integer', description}}
				raw
				error={!state.valid}
				helperText={state.error}
			/>
		);
	};

	return (
		<Stack spacing={1}>
			<Button
				onClick={() => setOpen(prev => !prev)}
				aria-expanded={open}
				endIcon={<ExpandMoreIcon sx={{transform: open ? 'rotate(180deg)' : 'none'}} />}
				sx={{alignSelf: 'flex-start'}}
			>
				{t('Admission Control')}
			</Button>
			<Collapse in={open} unmountOnExit={false}>
				<Stack spacing={2}>
					<Typography variant="caption" color="text.secondary">
						{t('Blank uses the gateway default (its launch environment, else the product default). 0 also resets a field to that default.')}
					</Typography>
					{isEdit && (
						<Typography variant="caption" color="warning.main">
							{t('Admission control on an existing fullproxy rule cannot be changed in place. Create a replacement rule with a different VIP, port, or protocol.')}
						</Typography>
					)}
					<HorizontalStack>
						{declared.has('fc_mode') && <DropDownSelectBox
							label={t('Admission Mode')}
							value={value.fc_mode ?? ''}
							onChange={newValue => onChange({fc_mode: (newValue || undefined) as IServiceArguments['fc_mode']})}
							item_list={localizeDefault(MODE_ITEMS)}
						/>}
						{box('fc_max_outstanding', t('Max Outstanding'), t('Pool-wide ceiling on executing inference requests.'))}
					</HorizontalStack>
					<HorizontalStack>
						{box('fc_ep_max_inflight', t('Per-endpoint Max Inflight'), t('Ceiling per endpoint for the normal role.'))}
						{box('fc_tenant_max_share_pct', t('Tenant Max Share (%)'), t('The most of the ceiling and of the queue one tenant may hold. 100 is no share.'))}
					</HorizontalStack>
					{pdTopology && (
						<HorizontalStack>
							{box('fc_prefill_max_inflight', t('Prefill Max Inflight'), t('Ceiling per endpoint for prefill legs.'))}
							{box('fc_decode_max_inflight', t('Decode Max Inflight'), t('Ceiling per endpoint for decode legs.'))}
						</HorizontalStack>
					)}
					<HorizontalStack>
						{box('fc_max_queue_depth', t('Queue Depth'), t('Requests that may wait for capacity instead of being refused. Each waiting request holds about 1 MiB.'))}
						{box('fc_max_queue_wait_ms', t('Queue Wait (ms)'), t('How long a queued request may wait. Required when a queue depth is set.'))}
					</HorizontalStack>
					<HorizontalStack>
						{declared.has('fc_adaptive') && <DropDownSelectBox
							label={t('Adaptive Ceiling')}
							value={value.fc_adaptive ?? ''}
							onChange={newValue => onChange({fc_adaptive: (newValue || undefined) as IServiceArguments['fc_adaptive']})}
							item_list={localizeDefault(ADAPTIVE_ITEMS)}
						/>}
						{box('fc_ttft_target_ms', t('TTFT Target (ms)'), t('Time-to-first-token target the adaptive ceiling steers by.'))}
					</HorizontalStack>
					{value.fc_adaptive === 'off' && text.fc_ttft_target_ms.trim() !== '' && (
						<Alert severity="info">{t('A TTFT target has no effect while the adaptive ceiling is off.')}</Alert>
					)}
					<HorizontalStack>
						{box('fc_warmup_ms', t('Endpoint Warm-up (ms)'), t('Window during which a new endpoint is admitted gradually.'))}
						{pdTopology && box('fc_telemetry_stale_ms', t('Telemetry Stale (ms)'), t('How long the P/D scorers trust a scraped queue depth.'))}
					</HorizontalStack>
				</Stack>
			</Collapse>
		</Stack>
	);
}
