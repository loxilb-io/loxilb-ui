//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import ParamBox from 'components/element/ParamBox';
import NewBox from 'components/layout/NewBox';
import useFormWithParams from 'hooks/inputFormHook';
import {t} from 'i18next';
import {IFdbAttribute} from 'types/fdb';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {usePortAttr} from 'hooks/query/queryHooks';
import {useMemo, useState, useEffect} from 'react';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function FdbInputForm(props: {onChange: (data: IFdbAttribute) => void}) {
	const {onChange} = props;
	const {form, params, handleChange} = useFormWithParams<IFdbAttribute>('IFdbAttribute', onChange);

	const inst = useInstanceFromURL();
	const {data: portData} = usePortAttr(inst);
	const ports = useMemo(
		() => portData?.map((port, index) => ({
			id: index,
			name: `${port.portName} (Port ${port.portNo})`,
			send_value: port.portName,
			param: port.portName
		})) || [],
		[portData]
	);

	// Set default device name when ports are loaded and form.dev is empty
	useEffect(() => {
		if (ports.length > 0 && (!form?.dev || form.dev === '')) {
			const devHandler = handleChange('dev');
			if (devHandler) devHandler(ports[0].send_value);
		}
	}, [ports, form?.dev, handleChange]);

	if (!form) return null;
	return (
		<NewBox item_name={t('FDB Entry')}>
		   <ParamBox 
			   label={t('Device Name')}
			   value={form?.dev ?? ''}
			   param_desc={{...params?.dev, type: 'string', enum: ports}}
			   onChange={handleChange('dev')}
		   />
			<ParamBox label={t('MAC Address')} value={form?.macAddress ?? ''} onChange={handleChange('macAddress')} param_desc={{...params?.macAddress, type: 'macaddress'}} />
		</NewBox>
	);
}
