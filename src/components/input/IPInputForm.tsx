//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import ParamBox from 'components/element/ParamBox';
import NewBox from 'components/layout/NewBox';
import useFormWithParams from 'hooks/inputFormHook';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {usePortAttr} from 'hooks/query/queryHooks';
import {t} from 'i18next';
import {useMemo, useEffect, useRef} from 'react';
import {IEnumItem} from 'types/global';
import {IIpAttributeInput} from 'types/ip';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function IpInputForm(props: {onChange: (data: IIpAttributeInput) => void; initialData?: Partial<IIpAttributeInput>; isEdit?: boolean}) {
	const {onChange, initialData, isEdit} = props;
	const inst = useInstanceFromURL();
	const hasSetInitialData = useRef(false);

	const {form, params, handleChange} = useFormWithParams<IIpAttributeInput>('IIpAttributeInput', onChange);

	const {data: portData} = usePortAttr(inst);

	const deviceList: IEnumItem[] = useMemo(() => {
		if (!portData || !Array.isArray(portData)) return [];

		const devices = portData.map(port => port.portName).filter(Boolean);
		const uniqueDevices = [...new Set(devices)];

		return uniqueDevices.map((device, index) => ({id: index, name: device, send_value: device}));
	}, [portData]);

	// Set initial data when editing - run when form becomes available
	useEffect(() => {
		if (initialData && isEdit && form && !hasSetInitialData.current) {
			// Set device name and IP address from initialData
			if (initialData.dev) {
				handleChange('dev')(initialData.dev);
			}
			if (initialData.ipAddress) {
				handleChange('ipAddress')(initialData.ipAddress);
			}
			hasSetInitialData.current = true;
		}
	}, [form, isEdit, initialData]); // Run when form becomes available


	if (!form) return null;
	return (
		<NewBox item_name={t('IP Address')}>
			{isEdit ? (
				<ParamBox label={t('Device Name')} value={initialData?.dev ?? ''} onChange={() => {}} param_desc={{type: 'string'}} disabled={true} />
			) : (
				<ParamBox label={t('Device Name')} value={form?.dev ?? ''} onChange={handleChange('dev')} param_desc={{...params?.deviceList, enum: deviceList}} />
			)}
		   	<ParamBox label={t('IP Address')} value={form?.ipAddress ?? ''} onChange={handleChange('ipAddress')} param_desc={{...params?.ipAddress, type: 'ipaddress_cidr'}} />
		</NewBox>
	);
}
