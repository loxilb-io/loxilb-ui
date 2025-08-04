//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, Chip, Typography} from '@mui/material';
import {clean_string} from 'common';
import {t} from 'i18next';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function ChipField(props: {label: string; item_list?: string[]; onDelete?: (item: string) => void}) {
	const {label, item_list = [], onDelete} = props;
	const min_width = '220px';

	return (
		<Box width="fit-content" minWidth={min_width}>
			<Box position="relative" display="flex" borderRadius="4px" border="1px solid" borderColor="grey.400" padding="12px" gap="10px">
				<Box position="absolute" top="-10px" bgcolor="white" padding="0 5px">
					<Typography variant="caption" color="grey.700">
						{t(label)}
					</Typography>
				</Box>

				{item_list.map((item, index) =>
					item !== '' ? (
						<Chip key={index} label={clean_string(item)} sx={{borderRadius: '4px'}} onDelete={onDelete ? () => onDelete(item) : undefined} />
					) : (
						<Chip key={index} label={t('No data')} sx={{borderRadius: '4px'}} />
					),
				)}
			</Box>
		</Box>
	);
}
