import {Add, DeleteOutline} from '@mui/icons-material';
import {Alert, Button, Grid2, IconButton, Stack, Typography} from '@mui/material';
import ParamBox from 'components/element/ParamBox';
import NewBox from 'components/layout/NewBox';
import {t} from 'i18next';
import React from 'react';
import {ITenantModelRateLimit, ITenantRateLimitMod, reconcileTenantModelLimits, validateTenantRateLimit} from 'types/ai';

interface ModelLimitDraft {
	model: string;
	tokens_per_min: string;
}

interface TenantRateLimitDraft {
	tenant_id: string;
	rps: string;
	tokens_per_min: string;
	burst_pct: string;
	model_limits: ModelLimitDraft[];
}

interface TenantRateLimitInputFormProps {
	value?: ITenantRateLimitMod;
	onChange: (data: ITenantRateLimitMod & {isValid?: boolean; errors?: string[]}) => void;
}

function draftFromValue(value?: ITenantRateLimitMod): TenantRateLimitDraft {
	return {
		tenant_id: value?.tenant_id ?? '',
		rps: String(value?.rps ?? 0),
		tokens_per_min: String(value?.tokens_per_min ?? 0),
		burst_pct: String(value?.burst_pct ?? 0),
		model_limits: (value?.model_limits ?? []).map(limit => ({
			model: limit.model ?? '',
			tokens_per_min: limit.tokens_per_min === undefined ? '' : String(limit.tokens_per_min),
		})),
	};
}

export function parseTenantLimitIntegerDraft(raw: string): number | undefined {
	if (!/^\d+$/.test(raw)) return undefined;
	const value = Number(raw);
	return Number.isSafeInteger(value) ? value : undefined;
}

function draftToWire(draft: TenantRateLimitDraft, persistedModelLimits: ITenantModelRateLimit[]): ITenantRateLimitMod {
	const currentModelLimits = draft.model_limits.map(limit => ({
		model: limit.model.trim(),
		tokens_per_min: parseTenantLimitIntegerDraft(limit.tokens_per_min),
	}));
	return {
		tenant_id: draft.tenant_id.trim(),
		rps: parseTenantLimitIntegerDraft(draft.rps),
		tokens_per_min: parseTenantLimitIntegerDraft(draft.tokens_per_min),
		burst_pct: parseTenantLimitIntegerDraft(draft.burst_pct),
		model_limits: reconcileTenantModelLimits(currentModelLimits, persistedModelLimits),
	};
}

function validateDraft(draft: TenantRateLimitDraft, wire: ITenantRateLimitMod): string[] {
	const errors = validateTenantRateLimit(wire);
	if (parseTenantLimitIntegerDraft(draft.rps) === undefined) errors.push('Tenant RPS must contain digits only.');
	if (parseTenantLimitIntegerDraft(draft.tokens_per_min) === undefined) errors.push('Tenant tokens per minute must contain digits only.');
	if (parseTenantLimitIntegerDraft(draft.burst_pct) === undefined) errors.push('Tenant burst percentage must contain digits only.');
	draft.model_limits.forEach((limit, index) => {
		if (parseTenantLimitIntegerDraft(limit.tokens_per_min) === undefined) {
			errors.push(`Model quota row ${index + 1} tokens per minute must contain digits only.`);
		}
	});
	return Array.from(new Set(errors));
}

export default function TenantRateLimitInputForm({onChange, value}: TenantRateLimitInputFormProps) {
	const [draft, setDraft] = React.useState<TenantRateLimitDraft>(() => draftFromValue(value));
	// Keep the persisted snapshot from the moment this edit form opened. The
	// gateway needs explicit zero-valued rows for names removed from that set.
	const persistedModelLimits = React.useRef<ITenantModelRateLimit[]>(value?.model_limits ?? []);
	const wire = React.useMemo(() => draftToWire(draft, persistedModelLimits.current), [draft]);
	const errors = React.useMemo(() => validateDraft(draft, wire), [draft, wire]);
	const onChangeRef = React.useRef(onChange);
	onChangeRef.current = onChange;

	React.useEffect(() => {
		onChangeRef.current({...wire, isValid: errors.length === 0, errors});
	}, [wire, errors]);

	const updateField = (field: 'tenant_id' | 'rps' | 'tokens_per_min' | 'burst_pct') => (newValue: unknown) => {
		setDraft(previous => ({...previous, [field]: String(newValue)}));
	};

	const updateModel = (index: number, field: keyof ModelLimitDraft, newValue: unknown) => {
		setDraft(previous => ({
			...previous,
			model_limits: previous.model_limits.map((limit, current) =>
				current === index ? {...limit, [field]: String(newValue)} : limit,
			),
		}));
	};

	const addModel = () => {
		setDraft(previous => ({
			...previous,
			model_limits: [...previous.model_limits, {model: '', tokens_per_min: ''}],
		}));
	};

	const deleteModel = (index: number) => {
		setDraft(previous => ({
			...previous,
			model_limits: previous.model_limits.filter((_, current) => current !== index),
		}));
	};

	return (
		<NewBox item_name={t('AI Tenant Rate Limit')}>
			<Stack spacing={3}>
				<ParamBox
					label={t('Tenant ID')}
					value={draft.tenant_id}
					onChange={updateField('tenant_id')}
					disabled={!!value}
					param_desc={{type: 'string', description: t('Tenant identifier'), required: true}}
				/>
				<Grid2 container spacing={2}>
					<ParamBox
						label={t('Rate Limit (req/s)')}
						value={draft.rps}
						onChange={updateField('rps')}
						// Keep the raw draft: the shared integer control clamps negatives to
						// zero, which would silently turn invalid operator input into
						// "unlimited" before this form can reject it.
						param_desc={{type: 'string', description: t('Maximum requests per second for the tenant. Enter digits only; 0 means unlimited.')}}
					/>
					<ParamBox
						label={t('Tokens / Minute')}
						value={draft.tokens_per_min}
						onChange={updateField('tokens_per_min')}
						param_desc={{type: 'string', description: t('Maximum tokens per minute for the tenant. Enter digits only; 0 means unlimited.')}}
					/>
					<ParamBox
						label={t('Burst Percentage')}
						value={draft.burst_pct}
						onChange={updateField('burst_pct')}
						param_desc={{type: 'string', description: t('Enter 0 for the Gateway/process default, or an integer from 1 to 1000 percent of the token-per-minute limit.')}}
					/>
				</Grid2>

				<Stack spacing={1}>
					<Typography variant="subtitle2">{t('Per-model token quotas')}</Typography>
					<Typography variant="caption" color="text.secondary">
						{t('Model names must be unique. A model value of 0 removes that model-specific quota.')}
					</Typography>
					{draft.model_limits.map((limit, index) => (
						<Stack key={index} direction="row" spacing={1} alignItems="flex-start">
							<ParamBox
								label={t('Model')}
								value={limit.model}
								onChange={newValue => updateModel(index, 'model', newValue)}
								param_desc={{type: 'string', required: true, description: t('Exact model name used by requests.')}}
							/>
							<ParamBox
								label={t('Model Tokens / Minute')}
								value={limit.tokens_per_min}
								onChange={newValue => updateModel(index, 'tokens_per_min', newValue)}
								param_desc={{type: 'string', required: true, description: t('Enter digits only; 0 removes this model-specific quota.')}}
							/>
							<IconButton aria-label={t('Delete model quota')} onClick={() => deleteModel(index)}>
								<DeleteOutline />
							</IconButton>
						</Stack>
					))}
					<Button variant="outlined" size="small" startIcon={<Add />} onClick={addModel} sx={{alignSelf: 'flex-start'}}>
						{t('Add model quota')}
					</Button>
				</Stack>

				{errors.length > 0 && <Alert severity="error">{errors.join(' ')}</Alert>}
			</Stack>
		</NewBox>
	);
}
