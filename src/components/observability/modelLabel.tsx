//---------------------------------------------------------
// Rendering a `model` metric label
//---------------------------------------------------------
// Two of the values this label can take are NOT model names, and presenting
// either one as a model misinforms:
//
//   "other"  the gateway's `boundModelLabel` collapses every model past its
//            64-distinct-model bound into this literal, so the row is an
//            aggregate of an unknown number of models
//   ""       the datapath passes an empty model for traffic that declared
//            none, so the label is present and empty rather than missing
//
// Lives under components/ because a panel mounted on a configuration page
// must not import from pages/ — the same move formatRate and PanelPaper made
// in J3. pages/observability/common.tsx re-exports both names, so existing
// page code is unchanged.

import {Tooltip, Typography} from '@mui/material';
import {useTranslation} from 'react-i18next';

export const MODEL_OVERFLOW_LABEL = 'other';

export function ModelName({model}: {model: string}) {
	const {t} = useTranslation();

	if (model === '') {
		// An empty cell reads as missing data. This is a real, known value.
		return (
			<Typography variant="body2" component="em" color="text.secondary">
				{t('No model declared')}
			</Typography>
		);
	}

	if (model === MODEL_OVERFLOW_LABEL) {
		return (
			// ⚠️ A model genuinely NAMED "other" is indistinguishable from the
			// bucket. The tooltip says so rather than pretending the
			// ambiguity is not there.
			<Tooltip title={t('The gateway collapses every model past its 64-model label bound into this bucket, so it may cover several models. A model actually named “other” lands here too.')}>
				<Typography variant="body2" component="em" color="text.secondary">
					{t('Other models (overflow bucket)')}
				</Typography>
			</Tooltip>
		);
	}

	return <>{model}</>;
}
