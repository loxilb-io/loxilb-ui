//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, Button, Stack, Typography} from '@mui/material';
import ParamBox from 'components/element/ParamBox';
import {evaluateNumericField} from 'components/input/numericField';
import {isValidPort} from 'common';
import {request_configure_bgp_global} from 'connector/instance/bgp';
import useFormWithParams from 'hooks/inputFormHook';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {usePopUp} from 'hooks/popupHook';
import {t} from 'i18next';
import React from 'react';
import {IBgpGlobalConfig} from 'types/bgp_policy';

// AS number: 1..2^32-1 (0 is reserved, not a usable AS).
const LOCAL_AS_SPEC = {required: true, min: 1, max: 4294967295};

//---------------------------------------------------------
// Main Component
//---------------------------------------------------------
export default function BGPGlobalPage() {
	const inst = useInstanceFromURL();
	const {openPopUp} = usePopUp();

	const {form, params, handleChange} = useFormWithParams<IBgpGlobalConfig>('IBgpGlobalConfig');

	// Raw text as typed (UI-P6-2 / ES-17): the wire value updates only on a
	// valid parse; garbage keeps the text on screen with a field error and
	// blocks Apply — it must never silently become 0 (an invalid AS the
	// old required-check then blamed on a "missing" field).
	const [localAsRaw, setLocalAsRaw] = React.useState('');
	const localAsState = evaluateNumericField(localAsRaw, LOCAL_AS_SPEC);
	const handleLocalAsChange = (raw: string) => {
		setLocalAsRaw(raw);
		handleChange('localAs')(evaluateNumericField(raw, LOCAL_AS_SPEC).parsed);
	};

	// PortBox reports '' as undefined and out-of-range as its own field error;
	// the page only has to keep undefined out of the wire (key omitted — the
	// gateway defaults to 179) and gate Apply on a sane value.
	const listenPortInvalid = form?.listenPort !== undefined && !isValidPort(form.listenPort);

	const handleApply = () => {
		if (!inst || !form) return;
		// Visible field errors block Apply; an untouched empty field falls
		// through to the required popup below instead of a silent no-op.
		if ((localAsRaw !== '' && !localAsState.valid) || listenPortInvalid) return;
		if (!form.routerId || !form.localAs) {
			openPopUp(t('Error'), t('Router ID and Local AS are required.'), t('OK'));
			return;
		}
		openPopUp(t('Apply BGP Global Config'), t('Are you sure you want to apply the BGP global configuration?'), t('Apply'), t('Cancel'), async () => {
			const {listenPort, ...rest} = form;
			const payload = {...rest, ...(listenPort !== undefined && {listenPort})} as IBgpGlobalConfig;
			const res = await request_configure_bgp_global(inst, payload);
			if (res.status === 'confirmed') {
				openPopUp(t('Success'), t('BGP global configuration applied.'), t('OK'));
			} else openPopUp(t('Error'), t('Failed to update. {{error}}', {error: t(res.localeKey)}), t('OK'));
		});
	};

	if (!form) return null;
	return (
		<Stack spacing={4} maxWidth={600} padding={2}>
			<Typography variant="h6">{t('BGP Global Configuration')}</Typography>

			<ParamBox label={t('Router ID')} value={form.routerId ?? ''} onChange={handleChange('routerId')} param_desc={{...params?.routerId, type: 'ipaddress'}} />
			<ParamBox
				label={t('Local AS')}
				value={localAsRaw}
				onChange={handleLocalAsChange}
				raw
				error={localAsRaw !== '' && !localAsState.valid}
				helperText={localAsRaw !== '' ? localAsState.error : undefined}
				param_desc={{...params?.localAs, type: 'integer'}}
			/>
			<ParamBox
				label={t('Listen Port')}
				value={form.listenPort ?? ''}
				onChange={handleChange('listenPort')}
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
