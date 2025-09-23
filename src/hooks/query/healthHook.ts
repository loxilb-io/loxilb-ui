//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {query_instance_health} from 'connector/instance/status';
import {useMemo} from 'react';
import {IInstance} from 'types/oam';

//---------------------------------------------------------
// Types
//---------------------------------------------------------
export interface IInstanceHealth {
	instanceId: number;
	isHealthy: boolean;
	error?: string;
	lastChecked: number;
}

//---------------------------------------------------------
// Individual Instance Health Check Hook
//---------------------------------------------------------
export function useInstanceHealth(instance: IInstance | null, enabled: boolean = true) {
	const query = useQuery({
		queryKey: ['instance', 'health', instance?.id],
		queryFn: async (): Promise<IInstanceHealth> => {
			if (!instance) {
				throw new Error('No instance provided');
			}

			// Create a timeout promise that rejects after 8 seconds
			const timeoutPromise = new Promise<never>((_, reject) => {
				setTimeout(() => reject(new Error('Health check timeout')), 8000);
			});

			try {
				// Race between health check and timeout
				const result = await Promise.race([
					query_instance_health(instance),
					timeoutPromise
				]);

				return {
					instanceId: instance.id,
					isHealthy: result.isHealthy,
					error: result.error,
					lastChecked: Date.now(),
				};
			} catch (error) {
				return {
					instanceId: instance.id,
					isHealthy: false,
					error: error instanceof Error ? error.message : 'Health check failed',
					lastChecked: Date.now(),
				};
			}
		},
		enabled: enabled && !!instance,
		refetchInterval: false,
		staleTime: 5 * 60 * 1000, // Consider data stale after 5 minutes
		retry: false, // Don't retry failed health checks to avoid noise
		// Prevent error boundary triggers for failed health checks
		meta: {
			errorBoundary: false,
		},
		// Set network mode to prevent hanging on network issues
		networkMode: 'online',
	});

	return {
		health: query.data || null,
		isLoading: query.isLoading,
		error: query.error,
		refetch: query.refetch,
	};
}

//---------------------------------------------------------
// Bulk Health Check Hook (for refresh all functionality)
//---------------------------------------------------------
export function useInstancesHealthRefresh(instances: IInstance[] = []) {
	const queryClient = useQueryClient();
	const instanceIds = useMemo(() => {
		if (!Array.isArray(instances)) return [];
		return instances.map(i => i.id);
	}, [instances]);

	const query = useQuery({
		queryKey: ['instances', 'health', 'bulk', instanceIds],
		queryFn: async () => {
			if (!Array.isArray(instances) || instances.length === 0) {
				return [];
			}

			// Check health for all instances in parallel
			const healthPromises = instances.map(async (instance) => {
				try {
					const result = await query_instance_health(instance);
					const healthResult = {
						instanceId: instance.id,
						isHealthy: result.isHealthy,
						error: result.error,
						lastChecked: Date.now(),
					} as IInstanceHealth;
					return healthResult;
				} catch (error) {
					return {
						instanceId: instance.id,
						isHealthy: false,
						error: error instanceof Error ? error.message : 'Health check failed',
						lastChecked: Date.now(),
					} as IInstanceHealth;
				}
			});

			return Promise.all(healthPromises);
		},
		enabled: false, // Only run when manually triggered
		retry: false,
	});

	const refreshAllHealth = async () => {
		const result = await query.refetch();

		// Invalidate individual health checks after bulk refresh
		instances.forEach(instance => {
			queryClient.invalidateQueries({
				queryKey: ['instance', 'health', instance.id]
			});
		});

		return result;
	};

	return {
		isLoading: query.isLoading,
		refreshAllHealth,
	};
}