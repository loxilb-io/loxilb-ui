//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Add} from '@mui/icons-material';
import {Box, Button, Stack} from '@mui/material';
import AccordionBox from 'components/element/AccordionBox';
import ParamBox from 'components/element/ParamBox';
import SimpleButton from 'components/element/SimpleButton';
import HorizontalStack from 'components/layout/HorizontalStack';
import {t} from 'i18next';
import {useCallback} from 'react';
import {IEndpoint} from 'types/load_balancer';

//---------------------------------------------------------
// Component
//---------------------------------------------------------
export default function EndpointListForm(props: {values: IEndpoint[]; onChange: (values: IEndpoint[]) => void; params: any}) {
	const {values, onChange, params} = props;

	const handleChange = useCallback(
		(index: number, field: keyof IEndpoint, value: string | number) => {
			const updated = [...values];
			updated[index] = {...updated[index], [field]: ['weight', 'targetPort'].includes(field) ? Number(value) : value};
			onChange(updated);
		},
		[values, onChange],
	);

	const handleAdd = useCallback(() => {
		onChange([...values, {endpointIP: '', weight: 1, targetPort: 0, state: '', counter: ''}]);
	}, [values, onChange]);

	const handleDelete = useCallback(
		(index: number) => {
			const updated = values.filter((_, i) => i !== index);
			onChange(updated);
		},
		[values, onChange],
	);

	return (
		<AccordionBox title={t('Endpoints')} tooltip={params?.description}>
			<Stack spacing={2}>
				<Stack spacing={2}>
					{values.map((item, index) => (
						<Box border={'1px solid #ccc'} borderRadius={2} padding={2} key={index}>
							<Stack spacing={1} direction="row" justifyContent="space-between" alignItems="center">
								<Stack spacing={2}>
									<HorizontalStack>
										<ParamBox
											label={t('IP')}
											value={item.endpointIP}
											onChange={val => handleChange(index, 'endpointIP', val)}
											param_desc={{...params?.endpointIP, type: 'ipaddress'}}
										/>
									</HorizontalStack>
									<HorizontalStack>
										<ParamBox
											label={t('Target Port')}
											value={item.targetPort}
											onChange={val => handleChange(index, 'targetPort', val)}
											param_desc={{...params?.targetPort, type: 'port'}}
										/>
										<ParamBox label={t('Weight')} value={item.weight} onChange={val => handleChange(index, 'weight', val)} param_desc={params?.weight} />
									</HorizontalStack>
								</Stack>

								<SimpleButton type="delete" onClick={() => handleDelete(index)} />
							</Stack>
						</Box>
					))}
				</Stack>

				<Button
					variant="outlined"
					startIcon={<Add />}
					size="small"
					sx={{width: 'fit-content'}}
					onClick={handleAdd}
					disabled={values.length > 0 && !values.at(-1)?.endpointIP?.trim()}
				>
					{t('Add')}
				</Button>
			</Stack>
		</AccordionBox>
	);
}
