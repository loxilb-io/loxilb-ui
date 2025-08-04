//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import ParamBox from 'components/element/ParamBox';
import NewBox from 'components/layout/NewBox';
import useFormWithParams from 'hooks/inputFormHook';
import {t} from 'i18next';
import {IUlclAttribute} from 'types/session_ulcl';
import UlclArgumentInputForm from './subforms/UlclArgumentInputForm';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function UlclInputForm(props: {onChange: (data: IUlclAttribute) => void}) {
	const {onChange} = props;

	const {form, params, handleChange} = useFormWithParams<IUlclAttribute>('IUlclAttribute', onChange);

	if (!form) return null;
	return (
		<NewBox item_name={t('ULCL Session')}>
			<ParamBox label={t('ULCL Identifier')} value={form.ulclIdent} param_desc={params?.ulclIdent} onChange={handleChange('ulclIdent')} />
			<UlclArgumentInputForm value={form.ulclArgument} onChange={handleChange('ulclArgument')} params={params?.ulclArgument} />
		</NewBox>
	);
}
