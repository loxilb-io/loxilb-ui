//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import ParamBox from 'components/element/ParamBox';
import NewBox from 'components/layout/NewBox';
import useFormWithParams from 'hooks/inputFormHook';
import {t} from 'i18next';
import {ISessionAttribute} from 'types/session';
import AccessNetworkTunnelForm from './subforms/AccessNetworkTunnelForm';
import CoreNetworkTunnelForm from './subforms/CoreNetworkTunnelForm';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function SessionInputForm(props: {onChange: any}) {
	const {onChange} = props;

	const {form, params, handleChange} = useFormWithParams<ISessionAttribute>('ISessionAttribute', onChange);

	if (!form) return null;
	return (
		<NewBox item_name={t('Session')}>
			<ParamBox label={t('Session Identifier')} value={form.ident} param_desc={params?.ident} onChange={handleChange('ident')} />
			<ParamBox label={t('Session IP')} value={form.sessionIP} param_desc={{...params?.sessionIP, type: 'ipaddress'}} onChange={handleChange('sessionIP')} />

			<AccessNetworkTunnelForm value={form.accessNetworkTunnel} onChange={handleChange('accessNetworkTunnel')} params={params?.accessNetworkTunnel} />
			<CoreNetworkTunnelForm value={form.coreNetworkTunnel} onChange={handleChange('coreNetworkTunnel')} params={params?.coreNetworkTunnel} />
		</NewBox>
	);
}
