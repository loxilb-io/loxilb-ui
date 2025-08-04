//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, Stack, Typography} from '@mui/material';
import BG from 'assets/image/instance_bg.svg';
import InstanceCardAdd from 'components/card/InstanceAddCard';
import InstanceCard from 'components/card/InstanceCard';
import {useInstanceWithHA} from 'hooks/query/oamHooks';
import {t} from 'i18next';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function InstancePage() {
	const {instance_set} = useInstanceWithHA();

	return (
		<Stack position="relative" id="fixed-container" width="100%" height="100%" padding="16px 0px 16px 16px">
			<Typography id="title" variant="h5" marginBottom="20px">
				{t('Instances')}
			</Typography>

			<Box
				zIndex={10}
				id="scrollable-box"
				padding="5px"
				width="100%"
				height="1px"
				minHeight={0}
				display="flex"
				flexGrow={1}
				flexShrink={1}
				flexBasis="auto"
				overflow="auto"
				flexWrap="wrap"
				gap="24px"
				alignItems="space-between"
			>
				{instance_set.map((item: any) => (
					<InstanceCard key={item.instance.id} instance_info={item.instance} ha={item.ha} />
				))}
				<InstanceCardAdd />
			</Box>

			<Box position="absolute" right="32px" bottom="16px" component="img" src={BG} zIndex={1} width="250px" />
		</Stack>
	);
}
