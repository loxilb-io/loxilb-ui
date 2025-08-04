//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Divider, Stack} from '@mui/material';
import AccordionBox from 'components/element/AccordionBox';
import ParamBox from 'components/element/ParamBox';
import HorizontalStack from 'components/layout/HorizontalStack';
import {t} from 'i18next';
import {useCallback} from 'react';
import {IActionSet, IAsPathPrepend, IBgpActions, IBgpSetCommunity} from 'types/bgp_policy_action';

//---------------------------------------------------------
// Internal Component
//---------------------------------------------------------
function BgpSetCommunityForm(props: {title: string; onChange: any; params?: any}) {
	const {title, onChange, params} = props;

	const handleChange = useCallback((field: keyof IBgpSetCommunity) => (value: any) => onChange((prev: any) => ({...prev, [field]: value})), [onChange]);

	return (
		<AccordionBox title={title}>
			<Stack spacing={2}>
				<ParamBox label={t('Options')} value={params?.options?.value} onChange={handleChange('options')} param_desc={params?.options} />
				<ParamBox label={t('Method')} value={params?.setCommunityMethod?.value} onChange={handleChange('setCommunityMethod')} param_desc={params?.setCommunityMethod} />
			</Stack>
		</AccordionBox>
	);
}

function AsPathPrependForm(props: {onChange: any; params?: any}) {
	const {onChange, params} = props;

	const handleChange = useCallback((field: keyof IAsPathPrepend) => (value: any) => onChange((prev: any) => ({...prev, [field]: value})), [onChange]);

	return (
		<HorizontalStack>
			<ParamBox label={t('AS Path Prepend')} value={params?.as?.value} onChange={handleChange('as')} param_desc={params?.as} />
			<ParamBox label={t('Repeat N')} value={params?.repeatN?.value} onChange={handleChange('repeatN')} param_desc={params?.repeatN} />
		</HorizontalStack>
	);
}

function BgpActionsForm(props: {onChange: any; params: any}) {
	const {onChange, params} = props;

	const handleChange = useCallback((field: keyof IBgpActions) => (value: any) => onChange((prev: any) => ({...prev, [field]: value})), [onChange]);

	return (
		<Stack spacing={2}>
			<HorizontalStack>
				<ParamBox label={t('MED')} value={params?.setMed?.value} onChange={handleChange('setMed')} param_desc={params?.setMed} />
				<ParamBox label={t('Next Hop')} value={params?.setNextHop?.value} onChange={handleChange('setNextHop')} param_desc={params?.setNextHop} />
				<ParamBox label={t('Local Preference')} value={params?.setLocalPerf?.value} onChange={handleChange('setLocalPerf')} param_desc={params?.setLocalPerf} />
			</HorizontalStack>

			<Divider />
			<BgpSetCommunityForm title="Set Community" onChange={handleChange('setCommunity')} params={params?.setCommunity} />
			<BgpSetCommunityForm title="Set Extended Community" onChange={handleChange('setExtCommunity')} params={params?.setExtCommunity} />
			<BgpSetCommunityForm title="Set Large Community" onChange={handleChange('setLargeCommunity')} params={params?.setLargeCommunity} />

			<Divider />
			<AsPathPrependForm onChange={handleChange('setAsPathPrepend')} params={params?.setAsPathPrepend} />
		</Stack>
	);
}

//---------------------------------------------------------
// Component
//---------------------------------------------------------
export default function BGPActionForm(props: {value: IActionSet; onChange: (data: IActionSet) => void; params?: any}) {
	const {value, onChange, params} = props;

	const handleChange = useCallback((field: keyof IActionSet) => (data: any) => onChange({...value, [field]: data}), [onChange, value]);

	return (
		<AccordionBox title={t('BGP Actions')}>
			<Stack spacing={2}>
				<ParamBox label={t('Route Disposition')} value={value.routeDisposition} onChange={handleChange('routeDisposition')} param_desc={params?.routeDisposition} />
				<BgpActionsForm onChange={handleChange('bgpActions')} params={params?.bgpActions} />
			</Stack>
		</AccordionBox>
	);
}
