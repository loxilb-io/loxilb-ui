//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Grid2, Stack} from '@mui/material';
import {validIPFilterConfig} from 'types/ipfilter_policy';
import {networkPrefixKey} from 'types/network_prefix';
import NewBox from 'components/layout/NewBox';
import ParamBox from 'components/element/ParamBox';
import {t} from 'i18next';
import {IIPFilterEntry} from 'types/security';
import React from 'react';
import {evaluateNumericField} from './numericField';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
interface IPFilterInputFormProps {
	value?: IIPFilterEntry;
	onChange: (data: IIPFilterEntry & {isValid?: boolean}) => void;
}

export default function IPFilterInputForm(props: IPFilterInputFormProps) {
	const {onChange, value} = props;
	const [priorityRaw, setPriorityRaw] = React.useState(String(value?.priority ?? 100));
	const prioritySpec = {required: true, min: 0, max: 65535};

	const [form, setForm] = React.useState<IIPFilterEntry>({
		filterType: 'whitelist',
		cidr: '',
		zone: 0,
		priority: 100,
		action: 'allow',
		...value,
	});
	const invalidCIDR = form.cidr.trim() !== '' && networkPrefixKey(form.cidr) === undefined;

	const handleChange = (field: keyof IIPFilterEntry) => (value: any) => {
		const newForm = {...form, [field]: value};
		// The datapath only acts on whitelist+allow and blacklist+drop; the
		// gateway rejects the other two pairings. Keep action in step with the
		// filter type so the common flow can never build an invalid pairing.
		if (field === 'filterType') {
			newForm.action = value === 'whitelist' ? 'allow' : 'drop';
		}
		setForm(newForm);
		onChange({...newForm, isValid: validateForm(newForm)});
	};

	const validateForm = (data: IIPFilterEntry, raw = priorityRaw): boolean =>
		evaluateNumericField(raw, prioritySpec).valid && validIPFilterConfig(data);

	const handlePriorityChange = (raw: string) => {
		setPriorityRaw(raw);
		const state = evaluateNumericField(raw, prioritySpec);
		const next = state.parsed === undefined ? form : {...form, priority: state.parsed};
		if (state.parsed !== undefined) setForm(next);
		onChange({...next, isValid: validateForm(next, raw)});
	};

	React.useEffect(() => {
		onChange({...form, isValid: validateForm(form)});
	// eslint-disable-next-line react-hooks/exhaustive-deps -- deps intentionally frozen: widening this list changes refetch/render behavior; verify at runtime before changing
	}, []);

	return (
		<NewBox item_name={t('IP Filter Rule Configuration')}>
			<Stack spacing={3}>
				<Grid2 container spacing={2}>
					<ParamBox
						label={t('Filter Type')}
						value={form.filterType}
						onChange={(value: string) => handleChange('filterType')(value as 'whitelist' | 'blacklist')}
						param_desc={{
							type: 'string',
							description: 'Filter type (whitelist or blacklist)',
							required: true,
							enum: ['whitelist', 'blacklist'],
						}}
					/>

					<ParamBox
						label={t('CIDR')}
						value={form.cidr}
						onChange={(value: string) => handleChange('cidr')(value)}
						error={invalidCIDR}
						helperText={invalidCIDR ? t('Invalid IP address format.') : undefined}
						param_desc={{
							type: 'string',
							description: 'IP address in CIDR notation (e.g., 192.168.1.0/24)',
							required: true,
						}}
					/>
				</Grid2>

				<Grid2 container spacing={2}>
					<ParamBox
						label={t('Action')}
						value={form.action}
						onChange={(value: string) => handleChange('action')(value as 'allow' | 'drop')}
						param_desc={{
							type: 'string',
							description: 'Action to take (allow or drop)',
							required: true,
							enum: ['allow', 'drop'],
						}}
					/>

					<ParamBox
						label={t('Priority')}
						value={priorityRaw}
						onChange={handlePriorityChange}
						raw
						error={!evaluateNumericField(priorityRaw, prioritySpec).valid}
						helperText={evaluateNumericField(priorityRaw, prioritySpec).error}
						param_desc={{
							type: 'integer',
							required: true,
							description: 'Integer 0..65535. Explicit zero is preserved; a new form starts at 100. Higher values win, whitelist wins ties.',
						}}
					/>
				</Grid2>

				{/*
				  * Security Zone is intentionally not exposed: the gateway's XDP
				  * ipfilter is zone-less and rejects any nonzero zone with 400
				  * ("zone must be 0 or omitted"). `zone` stays pinned to 0 in form
				  * state so the payload is always accepted; surfacing it as an
				  * editable field only produced guaranteed-to-fail submissions.
				  */}
			</Stack>
		</NewBox>
	);
}
