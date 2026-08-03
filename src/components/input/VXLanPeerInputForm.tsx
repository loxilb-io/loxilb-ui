//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Alert} from '@mui/material';
import {isValidIPAddress} from 'common';
import ParamBox from 'components/element/ParamBox';
import NewBox from 'components/layout/NewBox';
import {t} from 'i18next';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------

export default function VxlanPeerInputForm(props: {value: string; onChange: (peerIP: string) => void}) {
	const {value, onChange} = props;

	// The gateway parses the peer IP without rejecting a malformed one — a
	// garbage address would be programmed as a zero-IP FDB entry, so it must
	// not leave the form.
	const malformed = !!value && !isValidIPAddress(value.trim());

	return (
		<NewBox item_name={t('VxLAN Peer')}>
			<ParamBox label={t('Peer IP')} value={value} onChange={onChange} param_desc={{type: 'ipaddress'}} />
			{malformed && (
				<Alert severity="warning">{t('Peer IP must be a valid IP address.')}</Alert>
			)}
		</NewBox>
	);
}
