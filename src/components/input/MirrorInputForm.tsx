//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import ParamBox from 'components/element/ParamBox';
import NewBox from 'components/layout/NewBox';
import useFormWithParams from 'hooks/inputFormHook';
import {t} from 'i18next';
import {IMirrorAttribute} from 'types/mirror';
import MirrorInfoInputForm from './subforms/MirrorInfoInputForm';
import TargetObjectInputForm from './subforms/TargetObjInputForm';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function MirrorInputForm(props: {onChange: (data: IMirrorAttribute) => void}) {
	const {onChange} = props;

	const {form, params, handleChange} = useFormWithParams<IMirrorAttribute>('IMirrorAttribute', onChange);

	if (!form) return null;
	return (
		<NewBox item_name={t('Mirror')}>
			<ParamBox label={t('Mirror Identifier')} value={form.mirrorIdent} onChange={handleChange('mirrorIdent')} param_desc={params?.mirrorIdent} />
			<MirrorInfoInputForm value={form.mirrorInfo} onChange={handleChange('mirrorInfo')} params={params?.mirrorInfo} />
			<TargetObjectInputForm value={form.targetObject} onChange={handleChange('targetObject')} params={params?.targetObject} />
		</NewBox>
	);
}
