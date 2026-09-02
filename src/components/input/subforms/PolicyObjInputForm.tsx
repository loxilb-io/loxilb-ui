//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Alert, Stack} from '@mui/material';
import ParamBox from 'components/element/ParamBox';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {useInstanceCapabilities} from 'hooks/query/flavorHook';
import {useLoadBalancerConfig, usePortAttr} from 'hooks/query/queryHooks';
import {t} from 'i18next';
import {useEffect, useMemo, useState} from 'react';
import {IEnumItem} from 'types/global';
import {buildQoSRuleTarget, IQoSTargetObject, QoSAttachment} from 'types/qos';

const attachments: IEnumItem[] = [
	{id: 0, name: 'Load-balancer rule', send_value: 0},
	{id: 1, name: 'Port ingress', send_value: 1},
	{id: 2, name: 'Port egress (host-originated)', send_value: 2},
];

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function TargetObjectInputForm(props: {value: IQoSTargetObject; onChange: (data: IQoSTargetObject) => void; params?: any}) {
	const {value, onChange, params} = props;

	const inst = useInstanceFromURL();
	const caps = useInstanceCapabilities();
	const attachmentOptions = attachments.filter(item =>
		caps.allowedEnum('PolicyEntry.targetObject.attachment', [item.send_value as QoSAttachment]).length > 0,
	);

	const {data: lbData} = useLoadBalancerConfig(inst);
	const rules = useMemo(
		() =>
			lbData?.map((lb, index) => {
				const target = buildQoSRuleTarget(lb.serviceArguments);
				return {
					id: index,
					name: `${lb.serviceArguments.name} (${target})`,
					send_value: index,
					param: target,
					mode: lb.serviceArguments.mode,
				};
			}) || [],
		[lbData],
	);

	const {data: portData} = usePortAttr(inst);
	const ports = useMemo(
		() => portData?.map((port, index) => ({id: index, name: `${port.portName} (Port ${port.portNo})`, send_value: index, param: port.portName})) || [],
		[portData],
	);

	const rule_params = {...params?.polObjName};

	const [cur_type, set_cur_type] = useState<QoSAttachment>(value?.attachment ?? 0);
	const [cur_rule_index, set_cur_rule_index] = useState(0);
	const [cur_port_index, set_cur_port_index] = useState(0);

	const handleChangeType = (newValue: QoSAttachment) => {
		set_cur_type(newValue);

		if (newValue === 0 && rules.length > 0) {
			onChange({attachment: 0, polObjName: rules[0].param});
		} else if ((newValue === 1 || newValue === 2) && ports.length > 0) {
			onChange({attachment: newValue, polObjName: ports[0].param});
		}
	};

	const handleChangeRule = (newValue: number) => {
		set_cur_rule_index(newValue);

		const cur_value: string = rules[newValue].param;
		onChange({attachment: 0, polObjName: cur_value});
	};

	const handleChangePort = (newValue: number) => {
		set_cur_port_index(newValue);

		const cur_value: string = ports[newValue].param;
		onChange({attachment: cur_type === 2 ? 2 : 1, polObjName: cur_value});
	};

	// Always initialize with a valid default selection for type and polObjName
	useEffect(() => {
		if (cur_type === 0) {
			if (rules.length > 0) {
				onChange({attachment: 0, polObjName: rules[0].param});
			} else {
				onChange({attachment: 0, polObjName: ''});
			}
		} else if (cur_type === 1 || cur_type === 2) {
			if (ports.length > 0) {
				onChange({attachment: cur_type, polObjName: ports[0].param});
			} else {
				onChange({attachment: cur_type, polObjName: ''});
			}
		}
	// eslint-disable-next-line react-hooks/exhaustive-deps -- deps intentionally frozen: widening this list changes refetch/render behavior; verify at runtime before changing
	}, [cur_type, rules, ports]);

	return (
		<Stack spacing={2}>
			   <ParamBox label={t('Attachment Type')} value={value?.attachment ?? ''} param_desc={{...params?.attachment, enum: attachmentOptions}} onChange={handleChangeType} />
			   {cur_type === 0 && <ParamBox label={t('Attached Rule')} value={cur_rule_index ?? 0} param_desc={{...rule_params, type: 'enum', enum: rules}} onChange={handleChangeRule} />}
			   {(cur_type === 1 || cur_type === 2) && <ParamBox label={t('Attached Port')} value={cur_port_index ?? 0} param_desc={{...rule_params, type: 'enum', enum: ports}} onChange={handleChangePort} />}
			   {cur_type === 0 && rules[cur_rule_index]?.mode === 4 && <Alert severity="info">{t('Fullproxy rule attachment uses the bidirectional L7 plaintext byte shaper with independent direction buckets.')}</Alert>}
			   {cur_type === 0 && rules[cur_rule_index]?.mode !== 4 && <Alert severity="info">{t('Non-fullproxy rule attachment uses the bidirectional L4 datapath policer.')}</Alert>}
			   {cur_type === 1 && <Alert severity="info">{t('Port ingress applies the ingress policer to traffic entering this port.')}</Alert>}
			   {cur_type === 2 && <Alert severity="warning">{t('Port egress requires Gateway --egr-hooks and currently covers host-originated egress only. It does not police VIP transit egress.')}</Alert>}
		</Stack>
	);
}
