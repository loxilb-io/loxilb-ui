//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField} from '@mui/material';
import {Controller, DefaultValues, FieldValues, Path, useForm} from 'react-hook-form';
import {IBaseFormDialogProps, IFormConfig, IFormField} from 'types/global';

//---------------------------------------------------------
// Function Component
//---------------------------------------------------------
function InstanceBaseFormDialog<T extends FieldValues>(props: IBaseFormDialogProps<T & Record<string, IFormField>>) {
	const {open, onClose, onSubmit, initialConfig} = props;

	const {
		control,
		handleSubmit,
		formState: {errors},
	} = useForm<T>({
		defaultValues: initialConfig.fields as unknown as DefaultValues<T>,
	});

	const onSubmitHandler = (data: T) => {
		const processedData = Object.entries(data).reduce((acc, [key, field]) => {
			return {
				...acc,
				[key]: field.value,
			};
		}, {} as T & Record<string, IFormField>);

		onSubmit(processedData);
		onClose();
	};

	const getValidationRules = (fieldName: string) => {
		const rules = initialConfig.validationRules?.[fieldName];
		if (!rules) return {};

		return {
			validate: (field: IFormField) => {
				if (rules.required && !field.value) return `${initialConfig.labels?.[fieldName] || fieldName} is required`;
				if (rules.pattern && !rules.pattern.test(String(field.value))) return 'Invalid format';
				if (typeof rules.min === 'number' && Number(field.value) < rules.min) return `Must be at least ${rules.min}`;
				if (typeof rules.max === 'number' && Number(field.value) > rules.max) return `Must not exceed ${rules.max}`;
				if (rules.custom) return rules.custom(field.value);
				else return true;
			},
		};
	};

	const renderField = (fieldName: string, index: number) => {
		const isNumberField = fieldName.includes('interval') || fieldName.includes('retry');
		const fieldValue = initialConfig.fields[fieldName];

		return (
			<Controller
				key={fieldName}
				name={fieldName as Path<T>}
				control={control}
				rules={getValidationRules(fieldName)}
				render={({field: {value, onChange, ...fieldProps}}) => (
					<TextField
						{...fieldProps}
						value={value?.value ?? fieldValue.value}
						onChange={e =>
							onChange({
								value: isNumberField ? Number(e.target.value) : e.target.value,
								isFullWidth: fieldValue.isFullWidth,
							})
						}
						label={initialConfig.labels?.[fieldName]}
						type={isNumberField ? 'number' : 'text'}
						error={!!errors[fieldName]}
						helperText={errors[fieldName]?.message as string}
						sx={{width: fieldValue.isFullWidth ? '100%' : '48%'}}
						variant="filled"
					/>
				)}
			/>
		);
	};

	return (
		<Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
			<DialogTitle sx={{padding: '24px 16px'}}>Add Configuration</DialogTitle>

			<form onSubmit={handleSubmit(onSubmitHandler)}>
				<DialogContent sx={{padding: '0px 16px'}}>
					<Box gap={2} display="flex" flexWrap="wrap">
						{Object.keys(initialConfig.fields).map((fieldName, index) => renderField(fieldName, index))}
					</Box>
				</DialogContent>

				<DialogActions sx={{padding: 3}}>
					<Button onClick={onClose} color="secondary" variant="contained">
						Cancel
					</Button>
					<Button type="submit" variant="contained">
						Submit
					</Button>
				</DialogActions>
			</form>
		</Dialog>
	);
}

export default function InstanceDialog<T extends FieldValues>(props: IBaseFormDialogProps<T & Record<string, IFormField>>) {
	return (
		<InstanceBaseFormDialog<T & Record<string, IFormField>>
			open={props.open}
			onClose={props.onClose}
			onSubmit={props.onSubmit}
			initialConfig={
				props.initialConfig ||
				({
					fields: {} as Record<keyof T, IFormField>,
					validationRules: {},
					labels: {},
				} as IFormConfig<T & Record<string, IFormField>>)
			}
		/>
	);
}
