//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import ParamBox from 'components/element/ParamBox';
import NewBox from 'components/layout/NewBox';
import useFormWithParams from 'hooks/inputFormHook';
import {t} from 'i18next';
import {INeighborAttr} from 'types/device_neighbor';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {usePortAttr} from 'hooks/query/queryHooks';
import {useMemo} from 'react';
import {IEnumItem} from 'types/global';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function DeviceNeighborInputForm(props: {onChange: (data: INeighborAttr) => void}) {
	const {onChange} = props;
	const inst = useInstanceFromURL();
	const {form, params, handleChange} = useFormWithParams<INeighborAttr>('INeighborAttr', onChange);
	const {data: portData} = usePortAttr(inst);
	const deviceList: IEnumItem[] = useMemo(() => {
		if (!portData || !Array.isArray(portData)) return [];
		const devices = portData.map(port => port.portName).filter(Boolean);
		const uniqueDevices = [...new Set(devices)];
		return uniqueDevices.map((device, index) => ({id: index, name: device, send_value: device}));
	}, [portData]);

	if (!form) return null;
	return (
		<NewBox item_name={t('Device Neighbor')}>
			<ParamBox label={t('IP Address')} value={form?.ipAddress ?? ''} onChange={handleChange('ipAddress')} param_desc={{...params?.ipAddress, type: 'ipaddress'}} />
			<ParamBox label={t('Device Name')} value={form?.dev ?? ''} onChange={handleChange('dev')} param_desc={{...params?.deviceList, enum: deviceList}} />
			<ParamBox label={t('MAC Address')} value={form?.macAddress ?? ''} onChange={handleChange('macAddress')} param_desc={{...params?.macAddress, type: 'macaddress'}} />
		</NewBox>
	);
}
