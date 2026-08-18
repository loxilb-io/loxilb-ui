//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Chip, Tooltip} from '@mui/material';
import {useInstanceFlavor} from 'hooks/query/flavorHook';
import {t} from 'i18next';
import {IInstance} from 'types/oam';

//---------------------------------------------------------
// Component
//---------------------------------------------------------
// Small chip identifying the backend flavor of an instance (plain upstream
// loxilb vs loxilb-inference-gateway), detected from GET /version. Renders
// nothing until the probe resolves — a wrong provisional label would be
// worse than a briefly absent one.
export default function FlavorBadge(props: {instance: IInstance | null}) {
	const {flavor, resolved} = useInstanceFlavor(props.instance);
	if (!resolved) return null;

	const is_gateway = flavor === 'inference-gateway';
	return (
		<Tooltip title={is_gateway ? t('loxilb-inference-gateway — full feature set') : t('Upstream loxilb — gateway-only features are hidden for this instance')}>
			<Chip
				size="small"
				label={is_gateway ? t('AI Gateway') : 'loxilb'}
				color={is_gateway ? 'primary' : 'default'}
				variant="outlined"
				sx={{height: 20, fontSize: '0.7rem'}}
			/>
		</Tooltip>
	);
}
