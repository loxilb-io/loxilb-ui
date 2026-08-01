//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, Button, Stack, Typography} from '@mui/material';
import ParamBox from 'components/element/ParamBox';
import {request_configure_bgp_global} from 'connector/instance/bgp';
import useFormWithParams from 'hooks/inputFormHook';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {usePopUp} from 'hooks/popupHook';
import {t} from 'i18next';
import {IBgpGlobalConfig} from 'types/bgp_policy';

//---------------------------------------------------------
// Main Component
//---------------------------------------------------------
export default function BGPGlobalPage() {
	const inst = useInstanceFromURL();
	const {openPopUp} = usePopUp();

	const {form, params, handleChange} = useFormWithParams<IBgpGlobalConfig>('IBgpGlobalConfig');

	const handleApply = () => {
		if (!inst || !form) return;
		if (!form.routerId || !form.localAs) {
			openPopUp(t('Error'), t('Router ID and Local AS are required.'), t('OK'));
			return;
		}
		openPopUp(t('Apply BGP Global Config'), t('Are you sure you want to apply the BGP global configuration?'), t('Apply'), t('Cancel'), async () => {
			const res = await request_configure_bgp_global(inst, form);
			if (res.status === 'success') {
				openPopUp(t('Success'), t('BGP global configuration applied.'), t('OK'));
			} else openPopUp(t('Error'), t('Failed to update. {{error}}', {error: res.error}), t('OK'));
		});
	};

	if (!form) return null;
	return (
		<Stack spacing={4} maxWidth={600} padding={2}>
			<Typography variant="h6">{t('BGP Global Configuration')}</Typography>

			<ParamBox label={t('Router ID')} value={form.routerId ?? ''} onChange={handleChange('routerId')} param_desc={{...params?.routerId, type: 'ipaddress'}} />
			<ParamBox
				label={t('Local AS')}
				value={form.localAs ?? ''}
				onChange={(v: any) => handleChange('localAs')(parseInt(v) || 0)}
				param_desc={{...params?.localAs, type: 'integer'}}
			/>
			<ParamBox
				label={t('Listen Port')}
				value={form.listenPort ?? ''}
				onChange={(v: any) => handleChange('listenPort')(parseInt(v) || 0)}
				param_desc={{...params?.listenPort, type: 'port', description: 'BGP listen port (default 179)'}}
			/>
			<ParamBox
				label={t('Set Next-Hop Self')}
				value={form.SetNextHopSelf ?? false}
				onChange={handleChange('SetNextHopSelf')}
				param_desc={{...params?.SetNextHopSelf, type: 'boolean', description: 'Advertise routes with this router as next hop'}}
			/>

			<Box>
				<Button variant="contained" onClick={handleApply}>
					{t('Apply')}
				</Button>
			</Box>
		</Stack>
	);
}
