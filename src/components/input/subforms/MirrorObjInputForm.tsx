//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Stack} from '@mui/material';
import ParamBox from 'components/element/ParamBox';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {useLoadBalancerConfig, usePortAttr} from 'hooks/query/queryHooks';
import {t} from 'i18next';
import {useEffect, useMemo, useRef, useState} from 'react';
import {IEnumItem} from 'types/global';
import {ITargetObject} from 'types/mirror';

const attachments: IEnumItem[] = [
	{id: 0, name: 'Rule', send_value: 0},
	{id: 1, name: 'Port', send_value: 1},
];

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function TargetObjectInputForm(props: {value: ITargetObject; onChange: (data: ITargetObject) => void; params?: any}) {
	const {value, onChange, params} = props;

	const inst = useInstanceFromURL();

	const {data: lbData} = useLoadBalancerConfig(inst);
	// Only NAMED LB rules can be mirror targets (the gateway keys the
	// attachment by rule name). Unnamed rules rendered "undefined (2020)"
	// entries AND made the mirrObjName auto-init below emit undefined forever
	// (an infinite re-render loop — "Maximum update depth exceeded" — whenever
	// the first rule in the gateway list had no name).
	const rules = useMemo(
		() =>
			lbData
				?.filter(lb => !!lb.serviceArguments.name)
				.map((lb, index) => ({id: index, name: `${lb.serviceArguments.name} (${lb.serviceArguments.port})`, send_value: index, param: lb.serviceArguments.name})) || [],
		[lbData],
	);

	const {data: portData} = usePortAttr(inst);
	const ports = useMemo(
		() => portData?.map((port, index) => ({id: index, name: `${port.portName} (Port ${port.portNo})`, send_value: index, param: port.portName})) || [],
		[portData],
	);

	const rule_params = {...params?.mirrObjName};

	const [cur_type, set_cur_type] = useState(0);
	const [cur_rule_index, set_cur_rule_index] = useState(0);
	const [cur_port_index, set_cur_port_index] = useState(0);

	const handleChangeType = (newValue: number) => {
		set_cur_type(newValue);

		if (newValue === 0 && rules.length > 0) {
			onChange({attachment: 0, mirrObjName: rules[0].param});
		} else if (newValue === 1 && ports.length > 0) {
			onChange({attachment: 1, mirrObjName: ports[0].param});
		}
	};

	const handleChangeRule = (newValue: number) => {
		set_cur_rule_index(newValue);

		const cur_value: string = rules[newValue].param;
		onChange({attachment: 0, mirrObjName: cur_value});
	};

	const handleChangePort = (newValue: number) => {
		set_cur_port_index(newValue);

		const cur_value: string = ports[newValue].param;
		onChange({attachment: 1, mirrObjName: cur_value});
	};

	const nameInitialized = useRef(false);
	const attachmentInitialized = useRef(false);

	// Initialize attachment to 0 (Rule) if undefined
	useEffect(() => {
		// Only initialize if attachment is undefined AND we haven't successfully set it yet
		if (value.attachment === undefined && !attachmentInitialized.current) {
			onChange({...value, attachment: 0});
			// DON'T set attachmentInitialized here - wait for value to actually change
		}

		// Mark as initialized only when attachment actually has a value
		if (value.attachment !== undefined && !attachmentInitialized.current) {
			attachmentInitialized.current = true;
		}
	}, [value, onChange]);

	// Synchronize cur_type with value.attachment
	useEffect(() => {
		if (value.attachment !== undefined && value.attachment !== cur_type) {
			set_cur_type(value.attachment);
		}
	}, [value.attachment, cur_type]);

	// When attachment is set but mirrObjName is not, set the first available (only once).
	// The emit is guarded on a TRUTHY candidate name: announcing a falsy one can
	// never latch (value.mirrObjName stays empty), so the effect would re-fire on
	// every parent render — the "Maximum update depth exceeded" loop the E2E
	// console guard caught when the gateway listed an unnamed LB rule first.
	useEffect(() => {
		const needsInitialization = !value.mirrObjName || value.mirrObjName.trim() === '';

		// For Rule attachment (0)
		if (value.attachment === 0 && needsInitialization && !nameInitialized.current && rules[0]?.param) {
			onChange({...value, mirrObjName: rules[0].param});
			// DON'T set nameInitialized here - wait for value to actually change
		}
		// For Port attachment (1)
		else if (value.attachment === 1 && needsInitialization && !nameInitialized.current && ports[0]?.param) {
			onChange({...value, mirrObjName: ports[0].param});
			// DON'T set nameInitialized here - wait for value to actually change
		}

		// Mark as initialized only when mirrObjName actually has a value
		if (value.mirrObjName && value.mirrObjName.trim() !== '' && !nameInitialized.current) {
			nameInitialized.current = true;
		}
	}, [value.attachment, value.mirrObjName, rules.length, ports.length, onChange, value, rules, ports]);

	return (
		<Stack spacing={2}>
		   <ParamBox label={t('Attachment Type')} value={value?.attachment ?? ''} param_desc={{...params?.attachment, enum: attachments}} onChange={handleChangeType} />
		   {cur_type === 0 && <ParamBox label={'Attached Rule'} value={cur_rule_index ?? 0} param_desc={{...rule_params, type: 'enum', enum: rules}} onChange={handleChangeRule} />}
		   {cur_type === 1 && <ParamBox label={'Attached Port'} value={cur_port_index ?? 0} param_desc={{...rule_params, type: 'enum', enum: ports}} onChange={handleChangePort} />}
		</Stack>
	);
}
