//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, FormControlLabel, Switch} from '@mui/material';

//---------------------------------------------------------
// Component
//---------------------------------------------------------
export default function SwitchBox(props: {label: string; value: boolean | undefined; disabled?: boolean; onChange: (val: boolean) => void}) {
	const {label, value, disabled, onChange} = props;

	const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		onChange(event.target.checked);
	};

	return (
		<Box id="switch-wrapper" width="100%" height="100%" minHeight="40px" pl={2} display="flex" alignItems="center" border="1px solid #e0e0e0" borderRadius="4px">
			<FormControlLabel
				label={label}
				labelPlacement="end"
				control={<Switch size="small" checked={!!value} disabled={disabled} onChange={handleChange} />}
				sx={{'& .MuiFormControlLabel-label': {fontSize: '0.875rem'}}}
			/>
		</Box>
	);
}
