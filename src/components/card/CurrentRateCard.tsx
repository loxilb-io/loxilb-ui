//---------------------------------------------------------
// Simple Current Rate Card Component
//---------------------------------------------------------
import {Box, Typography} from '@mui/material';
import {formatRate} from 'common';
import {t} from 'i18next';
import CardBase from './CardBase';

//---------------------------------------------------------
// Component Props
//---------------------------------------------------------
interface CurrentRateCardProps {
	title: string;
	rate: number;
	unit: 'bps' | 'pps';
}

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function CurrentRateCard(props: CurrentRateCardProps) {
	const {title, rate, unit} = props;

	return (
		<CardBase title={title}>
			<Box display="flex" flexDirection="column" alignItems="center" gap={2} py={2}>
				{/* Current Rate Display */}
				<Box textAlign="center">
					<Typography variant="caption" color="textSecondary" gutterBottom>
						{t('Current Rate')}
					</Typography>
					<Typography variant="h4" fontWeight="bold" color="primary">
						{formatRate(rate, unit)}
					</Typography>
				</Box>
				
				{/* Simple Visual Indicator */}
				<Box width="100%" height={4} bgcolor="grey.200" borderRadius={2}>
					<Box 
						height="100%" 
						bgcolor={rate > 0 ? "primary.main" : "grey.300"}
						borderRadius={2}
						sx={{
							width: rate > 0 ? '100%' : '0%',
							transition: 'width 0.3s ease-in-out'
						}}
					/>
				</Box>
				
				{/* Additional Info */}
				<Typography variant="caption" color="textSecondary">
					{rate > 0 ? t('Active') : t('No Traffic')}
				</Typography>
			</Box>
		</CardBase>
	);
}