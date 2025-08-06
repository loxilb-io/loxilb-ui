//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Stack} from '@mui/material';
import ParamBox from 'components/element/ParamBox';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {useLoadBalancerConfig, usePortAttr} from 'hooks/query/queryHooks';
import {t} from 'i18next';
import {useEffect, useMemo, useState} from 'react';
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
	const rules = useMemo(
		() =>
			lbData?.map((lb, index) => ({id: index, name: `${lb.serviceArguments.name} (${lb.serviceArguments.port})`, send_value: index, param: lb.serviceArguments.name})) || [],
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

	// Always initialize with a valid default selection for type and mirrObjName
	useEffect(() => {
		if (cur_type === 0) {
			if (rules.length > 0) {
				onChange({attachment: 0, mirrObjName: rules[0].param});
			} else {
				onChange({attachment: 0, mirrObjName: ''});
			}
		} else if (cur_type === 1) {
			if (ports.length > 0) {
				onChange({attachment: 1, mirrObjName: ports[0].param});
			} else {
				onChange({attachment: 1, mirrObjName: ''});
			}
		}
	}, [cur_type, rules, ports]);

	return (
		<Stack spacing={2}>
		   <ParamBox label={t('Attachment Type')} value={value?.attachment ?? ''} param_desc={{...params?.attachment, enum: attachments}} onChange={handleChangeType} />
		   {cur_type === 0 && <ParamBox label={'Attached Rule'} value={cur_rule_index ?? 0} param_desc={{...rule_params, type: 'enum', enum: rules}} onChange={handleChangeRule} />}
		   {cur_type === 1 && <ParamBox label={'Attached Port'} value={cur_port_index ?? 0} param_desc={{...rule_params, type: 'enum', enum: ports}} onChange={handleChangePort} />}
		</Stack>
	);
}
