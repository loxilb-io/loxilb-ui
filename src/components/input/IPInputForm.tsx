//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import ParamBox from 'components/element/ParamBox';
import NewBox from 'components/layout/NewBox';
import useFormWithParams from 'hooks/inputFormHook';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {usePortAttr} from 'hooks/query/queryHooks';
import {t} from 'i18next';
import {useMemo} from 'react';
import {IEnumItem} from 'types/global';
import {IIpAttributeInput} from 'types/ip';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function IpInputForm(props: {onChange: (data: IIpAttributeInput) => void}) {
	const {onChange} = props;
	const inst = useInstanceFromURL();

	const {form, params, handleChange} = useFormWithParams<IIpAttributeInput>('IIpAttributeInput', onChange);

	const {data: portData} = usePortAttr(inst);

	const deviceList: IEnumItem[] = useMemo(() => {
		if (!portData || !Array.isArray(portData)) return [];

		const devices = portData.map(port => port.portName).filter(Boolean);
		const uniqueDevices = [...new Set(devices)];

		return uniqueDevices.map((device, index) => ({id: index, name: device, send_value: device}));
	}, [portData]);

	if (!form) return null;
	return (
		<NewBox item_name={t('IP Address')}>
			<ParamBox label={t('Device Name')} value={form.dev} onChange={handleChange('dev')} param_desc={{...params?.deviceList, enum: deviceList}} />
			<ParamBox label={t('IP Address')} value={form.ipAddress} onChange={handleChange('ipAddress')} param_desc={{...params?.ipAddress, type: 'ipaddress'}} />
		</NewBox>
	);
}
