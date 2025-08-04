//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Divider, Stack, Typography} from '@mui/material';
import AccordionBox from 'components/element/AccordionBox';
import ParamBox from 'components/element/ParamBox';
import HorizontalStack from 'components/layout/HorizontalStack';
import {t} from 'i18next';
import {useCallback} from 'react';
import {IAsPathLength, IAsPathSet, IBgpConditions, IConditionSet, IMatchSet} from 'types/bgp_policy_condition';

//---------------------------------------------------------
// Internal Component
//---------------------------------------------------------
function AsPathLengthForm(props: {value: IAsPathLength; onChange: (data: IAsPathLength) => void; params?: any}) {
	const {value, onChange, params} = props;

	const handleChange = useCallback((field: keyof IAsPathLength) => (data: any) => onChange({...value, [field]: data}), [onChange, value]);

	return (
		<Stack spacing={2}>
			<HorizontalStack>
				<ParamBox label={t('AS Path Len Operator')} value={value.operator} onChange={handleChange('operator')} param_desc={params?.operator} />
				<ParamBox label={t('Value')} value={value.value} onChange={handleChange('value')} param_desc={params?.value} />
			</HorizontalStack>
		</Stack>
	);
}

function AsPathSetForm(props: {value: IAsPathSet; onChange: (data: IAsPathSet) => void; params?: any}) {
	const {value, onChange, params} = props;

	const handleChange = useCallback((field: keyof IAsPathSet) => (data: any) => onChange({...value, [field]: data}), [onChange, value]);

	return (
		<HorizontalStack>
			<ParamBox label={t('AS Path Set Name')} value={value.asPathSet} onChange={handleChange('asPathSet')} param_desc={params?.asPathSet} />
			<ParamBox label={t('Match Option')} value={value.matchSetOptions} onChange={handleChange('matchSetOptions')} param_desc={params?.matchSetOptions} />
		</HorizontalStack>
	);
}

function MatchSetForm(props: {title: string; value: IMatchSet; onChange: (data: IMatchSet) => void; params?: any}) {
	const {title, value, onChange, params} = props;

	const handleChange = useCallback((field: keyof IMatchSet) => (data: any) => onChange({...value, [field]: data}), [onChange, value]);

	return (
		<HorizontalStack>
			<ParamBox label={t(title)} value={value.communitySet} onChange={handleChange('communitySet')} param_desc={params?.communitySet} />
			<ParamBox label={t('Option')} value={value.matchSetOptions} onChange={handleChange('matchSetOptions')} param_desc={params?.matchSetOptions} />
		</HorizontalStack>
	);
}

function BgpConditionsForm(props: {value: IBgpConditions; onChange: (data: IBgpConditions) => void; params?: any}) {
	const {value, onChange, params} = props;

	const handleChange = useCallback((field: keyof IBgpConditions) => (data: any) => onChange({...value, [field]: data}), [onChange, value]);

	return (
		<Stack spacing={2}>
			<Typography variant="subtitle2" color="textSecondary">
				{t('BGP Match Conditions')}
			</Typography>

			<ParamBox label={t('AFI/SAFI In')} value={value.afiSafiIn} onChange={handleChange('afiSafiIn')} param_desc={params?.afiSafiIn} />
			<Divider />

			<AsPathLengthForm value={value.asPathLength} onChange={handleChange('asPathLength')} params={params?.asPathLength} />
			<Divider />

			<AsPathSetForm value={value.matchAsPathSet} onChange={handleChange('matchAsPathSet')} params={params?.matchAsPathSet} />
			<Divider />

			<MatchSetForm title="Match Community Set" value={value.matchCommunitySet} onChange={handleChange('matchCommunitySet')} params={params?.matchCommunitySet} />
			<MatchSetForm
				title="Match Extended Community Set"
				value={value.matchExtCommunitySet}
				onChange={handleChange('matchExtCommunitySet')}
				params={params?.matchExtCommunitySet}
			/>
			<MatchSetForm
				title="Match Large Community Set"
				value={value.matchLargeCommunitySet}
				onChange={handleChange('matchLargeCommunitySet')}
				params={params?.matchLargeCommunitySet}
			/>
			<Divider />

			<ParamBox label={t('Next Hop In List')} value={value.nextHopInList} onChange={handleChange('nextHopInList')} param_desc={params?.nextHopInList} />
			<Divider />

			<HorizontalStack>
				<ParamBox label={t('RPKI')} value={value.rpki} onChange={handleChange('rpki')} param_desc={params?.rpki} />
				<ParamBox label={t('Route Type')} value={value.routeType} onChange={handleChange('routeType')} param_desc={params?.routeType} />
			</HorizontalStack>
		</Stack>
	);
}

//---------------------------------------------------------
// Component
//---------------------------------------------------------
export default function ConditionSetForm(props: {value: IConditionSet; onChange: (data: IConditionSet) => void; params?: any}) {
	const {value, onChange, params} = props;

	const handleChange = useCallback((field: keyof IConditionSet) => (data: any) => onChange({...value, [field]: data}), [onChange, value]);

	return (
		<AccordionBox title={t('BGP Conditions')}>
			<Stack spacing={2} width="100%">
				<BgpConditionsForm value={value.bgpConditions} onChange={val => handleChange('bgpConditions')(val)} params={params?.bgpConditions} />

				<HorizontalStack>
					<ParamBox
						label={t('Match Neighbor Set')}
						value={value.matchNeighborSet?.neighborSet}
						onChange={val => handleChange('matchNeighborSet')({...value.matchNeighborSet, neighborSet: val})}
						param_desc={params?.matchNeighborSet?.properties?.neighborSet}
					/>
					<ParamBox
						label={t('Option')}
						value={value.matchNeighborSet?.matchSetOption}
						onChange={val => handleChange('matchNeighborSet')({...value.matchNeighborSet, matchSetOption: val})}
						param_desc={params?.matchNeighborSet?.properties?.matchSetOption}
					/>
				</HorizontalStack>

				<HorizontalStack>
					<ParamBox
						label={t('Match Prefix Set')}
						value={value.matchPrefixSet?.prefixSet}
						onChange={val => handleChange('matchPrefixSet')({...value.matchPrefixSet, prefixSet: val})}
						param_desc={params?.matchPrefixSet?.properties?.prefixSet}
					/>
					<ParamBox
						label={t('Option')}
						value={value.matchPrefixSet?.matchSetOption}
						onChange={val => handleChange('matchPrefixSet')({...value.matchPrefixSet, matchSetOption: val})}
						param_desc={params?.matchPrefixSet?.properties?.matchSetOption}
					/>
				</HorizontalStack>
			</Stack>
		</AccordionBox>
	);
}
