//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Add} from '@mui/icons-material';
import {Button, Stack, Typography} from '@mui/material';
import ParamBox from 'components/element/ParamBox';
import SimpleButton from 'components/element/SimpleButton';
import HorizontalStack from 'components/layout/HorizontalStack';
import NewBox from 'components/layout/NewBox';
import useFormWithParams from 'hooks/inputFormHook';
import {t} from 'i18next';
import {useCallback, useState} from 'react';
import {EMMPTY_STATEMENT, IBgpPolicy, IStatement} from 'types/bgp_policy';
import {IPostParamFieldDesc} from 'types/global';
import BGPActionForm from './subforms/BGPActionForm';
import ConditionSetForm from './subforms/BGPConditionForm';

//---------------------------------------------------------
// Component
//---------------------------------------------------------
export default function BGPPolicyInputForm(props: {onChange: (data: IBgpPolicy) => void}) {
	const {onChange} = props;

	const {form, params, handleObjectChange} = useFormWithParams<IBgpPolicy>('IBgpPolicy', onChange);

	const [is_open, set_is_open] = useState(false);

	const handleNameChange = useCallback((value: string | number) => handleObjectChange({name: value.toString()} as Partial<IBgpPolicy>), [handleObjectChange]);

	const handleStatementChange = useCallback(
		(index: number, updatedStatement: IStatement) => {
			if (!form) return;
			const updatedStatements = [...form.statements];
			updatedStatements[index] = updatedStatement;
			handleObjectChange({statements: updatedStatements} as Partial<IBgpPolicy>);
		},
		[form, handleObjectChange],
	);

	const handleAddStatement = useCallback(() => {
		if (!form) return;
		const newStatement: IStatement = {...EMMPTY_STATEMENT, name: `Statement_${form.statements.length + 1}`};
		handleObjectChange({statements: [...form.statements, newStatement]} as Partial<IBgpPolicy>);
	}, [form, handleObjectChange]);

	const handleDeleteStatement = useCallback(
		(index: number) => {
			if (!form) return;
			const updatedStatements = form.statements.filter((_, i) => i !== index);
			handleObjectChange({statements: updatedStatements} as Partial<IBgpPolicy>);
		},
		[form, handleObjectChange],
	);

	const handleClickEdit = () => set_is_open(!is_open);

	if (!form) return null;
	return (
		<NewBox item_name={t('BGP Policy')}>
			<ParamBox label={t('Policy Name')} value={form.name} onChange={handleNameChange} param_desc={params?.name} />

			<Stack width="100%" maxHeight="400px" spacing={2}>
				<Stack width="100%" height="100%" padding="15px 5px" spacing={3} sx={{overflowY: 'auto'}}>
					<Typography variant="subtitle2" color="textSecondary">
						{t('Statements')}
					</Typography>

					{form.statements?.map((stmt, idx) => (
						<Stack key={idx}>
							<HorizontalStack>
								<ParamBox
									label={t('Statement Name')}
									value={stmt.name}
									onChange={val => handleStatementChange(idx, {...stmt, name: val.toString()})}
									param_desc={params?.statements?.items && ((params.statements.items as any).name as IPostParamFieldDesc)}
								/>

								<SimpleButton type="edit" onClick={handleClickEdit} />
								<SimpleButton type="delete" onClick={() => handleDeleteStatement(idx)} />
							</HorizontalStack>

							{is_open && (
								<Stack spacing={2} marginTop="10px">
									<ConditionSetForm
										value={stmt.conditions}
										onChange={val => handleStatementChange(idx, {...stmt, conditions: val})}
										params={params?.statements?.items && ((params.statements.items as any).conditions as IPostParamFieldDesc)}
									/>

									<BGPActionForm
										value={stmt.actions}
										onChange={val => handleStatementChange(idx, {...stmt, actions: val})}
										params={params?.statements?.items && ((params.statements.items as any).actions as IPostParamFieldDesc)}
									/>
								</Stack>
							)}
						</Stack>
					))}

					<Stack direction="row" alignItems="center" spacing={2}>
						<Button
							variant="outlined"
							startIcon={<Add />}
							size="small"
							sx={{width: 'fit-content'}}
							onClick={handleAddStatement}
							disabled={form.statements?.some(stmt => !stmt.name?.trim())}
						>
							{t('Add')}
						</Button>
					</Stack>
				</Stack>
			</Stack>
		</NewBox>
	);
}
