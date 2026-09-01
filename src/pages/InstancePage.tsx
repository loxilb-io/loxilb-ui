//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, Stack, Typography, Button, Tooltip, CircularProgress} from '@mui/material';
import InstanceCardAdd from 'components/card/InstanceAddCard';
import InstanceCard from 'components/card/InstanceCard';
import {useInstanceWithHA, useRole} from 'hooks/query/oamHooks';
import {useInstancesHealthRefresh, useInstanceHealth} from 'hooks/query/healthHook';
import {t} from 'i18next';
import RefreshIcon from '@mui/icons-material/Refresh';
import QueryStateGate from 'components/state/QueryStateGate';
import {toPageState} from 'components/state/pageState';
import {useMemo, memo, useState, useEffect} from 'react';

//---------------------------------------------------------
// Individual Instance Card Wrapper with Health Hook
//---------------------------------------------------------
const InstanceCardWithHealth = memo(({ item, index, onHealthRefresh }: { item: any; index: number; onHealthRefresh?: () => void }) => {
	// Add delay to stagger health checks and prevent thundering herd.
	// Keyed on the card's POSITION, not the instance id: ids only ever grow,
	// so id*100 made a long-lived deployment wait seconds before its first
	// probe (id 60 → 6s) while adding nothing to the staggering.
	const delay = index * 100; // 100ms delay per instance
	const [enableHealthCheck, setEnableHealthCheck] = useState(false);

	useEffect(() => {
		const timer = setTimeout(() => {
			setEnableHealthCheck(true);
		}, delay);

		return () => clearTimeout(timer);
	}, [delay]);

	const { health } = useInstanceHealth(item.instance, enableHealthCheck);

	return (
		<InstanceCard
			key={item.instance.id}
			instance_info={item.instance}
			ha={item.ha}
			health={health}
			onHealthRefresh={onHealthRefresh}
		/>
	);
});

InstanceCardWithHealth.displayName = 'InstanceCardWithHealth';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function InstancePage() {
	const {instance_set, instance_query, refetch} = useInstanceWithHA();
	// Registering an instance is admin-only (OAM ActInstanceWrite) — the card
	// is hidden for other roles rather than letting them build a form the
	// server will 403. Server-side enforcement is independent.
	const {can_manage_instances} = useRole();

	// Extract instances for health refresh functionality
	const instances = useMemo(() => {
		if (!Array.isArray(instance_set)) return [];
		return instance_set.map(item => item.instance);
	}, [instance_set]);

	// Use bulk refresh hook for the refresh all button
	const {refreshAllHealth, isLoading} = useInstancesHealthRefresh(instances);

	// Cards, not a table, so the gate is used directly. Emptiness is a real
	// answer here — a fresh deployment genuinely has no instances — and it
	// gets the sentence that says what to do about it, not an error.
	const instance_state = toPageState(instance_query, {op: 'instance.list'});

	return (
		<Stack position="relative" id="fixed-container" width="100%" height="100%" padding="16px 0px 16px 16px">
			<Box display="flex" alignItems="center" gap="16px" marginBottom="20px">
				<Typography id="title" variant="h5">
					{t('Instances')}
				</Typography>
				<Tooltip title={t('Refresh instance health status')}>
					<Button
						variant="contained"
						size="small"
						onClick={refreshAllHealth}
						disabled={isLoading}
						startIcon={isLoading ? <CircularProgress size={16} /> : <RefreshIcon />}
					>
						{isLoading ? t('Checking...') : t('Check Health')}
					</Button>
				</Tooltip>
			</Box>

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
				{/* The landing page is the one screen with nothing else to
				    contradict it: a failed /oam/loxilbs read used to render as
				    an operator who has registered no instances, next to a
				    friendly "add one" card. The gate makes the read say what
				    actually happened, and withholds the Add card while it is
				    unknown whether this operator may register anything. */}
				<QueryStateGate
					state={instance_state}
					name={t('Instances')}
					onRetry={refetch}
					emptyMessage={t('No instances are registered yet. Add one to start managing a loxilb or inference-gateway deployment.')}
				>
					{(_rows, ctx) => (
						<>
							{Array.isArray(instance_set) &&
								instance_set.map((item: any, index: number) => (
									<InstanceCardWithHealth key={item.instance.id} item={item} index={index} onHealthRefresh={refreshAllHealth} />
								))}
							{can_manage_instances && ctx.writesEnabled && <InstanceCardAdd />}
						</>
					)}
				</QueryStateGate>
			</Box>
		</Stack>
	);
}
