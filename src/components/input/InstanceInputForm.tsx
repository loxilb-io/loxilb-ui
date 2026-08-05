//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Alert, Stack, Typography} from '@mui/material';
import React from 'react';
import ParamBox from 'components/element/ParamBox';
import DropDownSelectBox from 'components/element/DropDownSelectBox';
import HorizontalStack from 'components/layout/HorizontalStack';
import {t} from 'i18next';
import {IInstance, IInstanceInput} from 'types/oam';
import {build_api_endpoint, has_errors, TInstanceFormData, validate_instance_form} from './instanceFormLogic';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function InstanceInputForm(props: {
	onChange: (data: TInstanceFormData) => void;
	initialValues?: Partial<IInstanceInput>;
	/** Registered instances — powers the name/endpoint uniqueness checks. */
	existing?: IInstance[];
	/** Set when editing, so the edited instance is not its own duplicate. */
	editing_id?: number;
}) {
	const {onChange, initialValues, existing, editing_id} = props;

	// Initialize form with initial values or defaults
	const [form, setForm] = React.useState<IInstanceInput>({
		name: initialValues?.name || '',
		cimage: initialValues?.cimage || 'ghcr.io/loxilb-io/loxilb',
		ctag: initialValues?.ctag || 'latest',
		host: initialValues?.host || '',
		port: initialValues?.port || '8091',
		protocol: initialValues?.protocol || 'https',
		version: initialValues?.version || 'v1',
		description: initialValues?.description || '',
		is_active: initialValues?.is_active ?? true,
	});

	// Fields the operator has actually visited. Errors stay hidden until then
	// so a freshly-opened Add dialog is not a wall of red — but validity
	// itself is computed from the first render, so Create/Apply is gated
	// correctly regardless of what has been touched.
	const [touched, setTouched] = React.useState<Partial<Record<keyof IInstanceInput, boolean>>>({});

	// Every rule lives in instanceFormLogic (unit-tested there); this
	// component only decides when to *show* what it reports.
	const errors = React.useMemo(() => validate_instance_form(form, {existing, editing_id}), [form, existing, editing_id]);
	const isValid = !has_errors(errors);

	// Notify parent when form or validation changes
	React.useEffect(() => {
		onChange({...form, isValid, errors});
	}, [form, isValid, errors, onChange]);

	const handleChange = (field: keyof IInstanceInput) => (value: string | number) => {
		setTouched(prev => (prev[field] ? prev : {...prev, [field]: true}));
		// Ensure all values are stored as strings to match IInstanceInput interface
		setForm(prev => ({...prev, [field]: String(value ?? '')}));
	};

	const handleBooleanChange = (field: keyof IInstanceInput) => (value: boolean) => {
		setForm(prev => ({...prev, [field]: value}));
	};

	// A field pre-filled from an existing instance counts as visited: its
	// value is already "the operator's", so a bad stored value must show up
	// immediately rather than only after a keystroke.
	const shows = (field: keyof IInstanceInput) => touched[field] || initialValues?.[field] !== undefined;
	const error_of = (field: keyof IInstanceInput) => (shows(field) ? errors[field] : undefined);
	const field_props = (field: keyof IInstanceInput) => {
		const message = error_of(field);
		// 'Required' is ParamBox's own empty-field helper — don't duplicate it.
		return message === undefined ? {} : {error: true, helperText: message === 'Required' ? undefined : t(message)};
	};

	const endpoint_preview = build_api_endpoint(form);

	return (
		<Stack spacing={2}>
			<Typography variant="body1" color="text.secondary">
				{t('Please enter the instance information')}
			</Typography>

			<ParamBox
				label={t('Name')}
				value={form.name}
				onChange={handleChange('name')}
				param_desc={{type: 'string', required: true}}
				{...field_props('name')}
			/>

			<HorizontalStack>
				<ParamBox
					label={t('Container Image')}
					value={form.cimage}
					onChange={handleChange('cimage')}
					param_desc={{type: 'string', required: true}}
					{...field_props('cimage')}
				/>
				<ParamBox
					label={t('Tag')}
					value={form.ctag}
					onChange={handleChange('ctag')}
					param_desc={{type: 'string', required: true}}
					{...field_props('ctag')}
				/>
			</HorizontalStack>

			<HorizontalStack>
				<ParamBox
					label={t('Host')}
					value={form.host}
					onChange={handleChange('host')}
					param_desc={{type: 'string', required: true}}
					{...field_props('host')}
				/>
				<ParamBox
					label={t('Port')}
					value={form.port}
					onChange={handleChange('port')}
					param_desc={{type: 'port', required: true}}
					{...field_props('port')}
				/>
				<DropDownSelectBox
					label={t('Protocol')}
					value={form.protocol}
					onChange={handleChange('protocol')}
					item_list={[
						{id: 1, name: 'HTTP', send_value: 'http'},
						{id: 2, name: 'HTTPS', send_value: 'https'},
					]}
				/>
			</HorizontalStack>

			<ParamBox
				label={t('Version')}
				value={form.version}
				onChange={handleChange('version')}
				param_desc={{type: 'string', required: true}}
				{...field_props('version')}
			/>

			{/* The endpoint is what OAM actually proxies to, and it is derived —
			    never entered — so showing it is the only way the operator can
			    confirm the four fields above combine into the intended target. */}
			<Typography variant="caption" color="text.secondary" sx={{wordBreak: 'break-all'}}>
				{t('API endpoint')}: {endpoint_preview}
			</Typography>

			{errors.form && (shows('host') || shows('port') || shows('protocol') || shows('version')) && (
				<Alert severity="error" sx={{py: 0}}>
					{t(errors.form)}
				</Alert>
			)}

			<ParamBox
				label={t('Description')}
				value={form.description}
				onChange={handleChange('description')}
				param_desc={{type: 'string', required: false}}
				multiline
				minRows={3}
				{...field_props('description')}
			/>
			<ParamBox
				label={t('Active')}
				value={form.is_active}
				onChange={handleBooleanChange('is_active')}
				param_desc={{type: 'boolean', required: false}}
			/>
		</Stack>
	);
}
