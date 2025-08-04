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

	const rule_params = {...params?.mirrObjName, ...params?.polObjName};

	const [cur_type, set_cur_type] = useState(0);
	const [cur_rule_index, set_cur_rule_index] = useState(0);
	const [cur_port_index, set_cur_port_index] = useState(0);

	const handleChangeType = (newValue: number) => {
		set_cur_type(newValue);

		const first_value: string = newValue === 0 ? rules[0].param : ports[0].param;
		if ('mirrObjName' in value) onChange({attachment: newValue, mirrObjName: first_value});
		if ('polObjName' in value) onChange({attachment: newValue, polObjName: first_value});
	};

	const handleChangeRule = (newValue: number) => {
		set_cur_rule_index(newValue);

		const cur_value: string = rules[newValue].param;
		if (!!value.mirrObjName) onChange({attachment: newValue, mirrObjName: cur_value});
		if (!!value.polObjName) onChange({attachment: newValue, polObjName: cur_value});
	};

	const handleChangePort = (newValue: number) => {
		set_cur_port_index(newValue);

		const cur_value: string = ports[newValue].param;
		if (!!value.mirrObjName) onChange({attachment: newValue, mirrObjName: cur_value});
		if (!!value.polObjName) onChange({attachment: newValue, polObjName: cur_value});
	};

	useEffect(() => {
		if (rules.length > 0) onChange({attachment: Number(attachments[0].send_value), mirrObjName: rules[0].param});
	}, [rules]);

	return (
		<Stack spacing={2}>
			<ParamBox label={t('Attachment Type')} value={value.attachment} param_desc={{...params?.attachment, enum: attachments}} onChange={handleChangeType} />
			{cur_type === 0 && <ParamBox label={'Attached Rule'} value={cur_rule_index} param_desc={{...rule_params, type: 'enum', enum: rules}} onChange={handleChangeRule} />}
			{cur_type === 1 && <ParamBox label={'Attached Port'} value={cur_port_index} param_desc={{...rule_params, type: 'enum', enum: ports}} onChange={handleChangePort} />}
		</Stack>
	);
}
