//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, Tab, Tabs} from '@mui/material';
import {useState} from 'react';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function SubTabs(props: {tabs: string[]; onChange?: (index: number) => void}) {
	const {tabs, onChange} = props;

	const [value, setValue] = useState(0);

	const handleChange = (_event: React.SyntheticEvent, newValue: number) => {
		setValue(newValue);
		onChange?.(newValue);
	};

	return (
		<Box borderBottom={1} borderColor="divider">
			<Tabs value={value} onChange={handleChange} textColor="secondary" indicatorColor="secondary">
				{tabs.map((tab, index) => (
					<Tab key={index} label={tab} id={`tab-${index}`} aria-controls={`tabpanel-${index}`} />
				))}
			</Tabs>
		</Box>
	);
}
