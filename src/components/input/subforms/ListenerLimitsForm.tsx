import {TextField} from '@mui/material';
import {useState} from 'react';
import {t} from 'i18next';
import HorizontalStack from 'components/layout/HorizontalStack';
import type {IServiceArguments} from 'types/load_balancer';
import {LISTENER_LIMIT_FIELDS} from 'types/listener_limits';
import {evaluateNumericField} from '../numericField';

export default function ListenerLimitsForm({value, onChange, params}: {value: IServiceArguments; onChange: (delta: Partial<IServiceArguments>) => void; params?: any}) {
	const [raw, setRaw] = useState(() => ({connectionLimit: String(value.connectionLimit ?? ''), timeoutTcpInspect: String(value.timeoutTcpInspect ?? '')}));
	const labels = {connectionLimit: 'Concurrent Connection Limit', timeoutTcpInspect: 'Header Deadline (ms)'};
	const help = {
		connectionLimit: 'Blank or 0: unlimited TCP connections. HTTP/2 streams share a connection.',
		timeoutTcpInspect: 'Blank or 0: 10000 ms to accumulate L7 headers.',
	};
	return <HorizontalStack>{LISTENER_LIMIT_FIELDS.filter(field => params?.[field] !== undefined).map(field => {
		const state = evaluateNumericField(raw[field], {required: false, min: 0, max: 4294967295});
		const invalid = !state.valid;
		return <TextField key={field} fullWidth size="small" label={t(labels[field])} value={raw[field]}
			disabled={value.mode !== 4} error={invalid} helperText={t(invalid ? 'Enter an integer from 0 to 4294967295, or leave blank.' : help[field])}
			onChange={event => {
				const text = event.target.value;
				setRaw(previous => ({...previous, [field]: text}));
				const next = evaluateNumericField(text, {required: false, min: 0, max: 4294967295});
				// Invalid raw input blocks both the parent form and the connector.
				onChange({[field]: next.valid ? next.parsed : NaN});
			}} />;
	})}</HorizontalStack>;
}
