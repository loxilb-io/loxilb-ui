import {useEffect, useRef, useState} from 'react';
import ParamBox from 'components/element/ParamBox';
import type {IPostParamFieldDesc} from 'types/global';
import {evaluateNumericField} from './numericField';

/** Invalid text remains visible and cannot become a valid zero on the wire. */
export default function UnsignedIntegerField({label, value, max, onChange, params, rangeError}: {label: string; value?: number; max: number; onChange: (value: number | undefined) => void; params?: IPostParamFieldDesc; rangeError?: string}) {
	const [raw, setRaw] = useState(String(value ?? ''));
	const emitted = useRef(value);
	useEffect(() => {
		if (!Object.is(value, emitted.current)) {
			emitted.current = value;
			setRaw(String(value ?? ''));
		}
	}, [value]);
	const spec = {required: false, min: 0, max};
	const state = evaluateNumericField(raw, spec);
	return <ParamBox label={label} value={raw} raw param_desc={{...params, type: 'integer', required: false}}
		error={!state.valid || !!rangeError} helperText={state.error ?? rangeError} onChange={(text: string) => {
			setRaw(text);
			const next = evaluateNumericField(text, spec);
			emitted.current = next.valid ? next.parsed : NaN;
			onChange(emitted.current);
		}} />;
}
