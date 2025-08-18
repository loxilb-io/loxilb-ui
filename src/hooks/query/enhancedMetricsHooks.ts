//---------------------------------------------------------
// Enhanced Metrics API Hooks - Main Export
//---------------------------------------------------------

// Alert Management Hooks
export * from './alertHooks';

// Backup Management Hooks  
export * from './backupHooks';

// Compression Management Hooks
export * from './compressionHooks';

// Advanced Metrics Hooks (new implementation)
export * from './advancedMetricsHooks';

// Re-export existing hooks for backwards compatibility
export {
	useMetrics,
	useMetrics as useLegacyMetrics,
} from './metricsHook';

export {
	useTrafficSeries,
	useServiceDistSeries,
	useConntrackSeries,
	useNetflowSeries,
	useFwDropSeries,
	useErrorSeries,
	useLbProcessedSeries,
	useHostCountSeries,
	useLiveMetricsCriticalSeries,
	useLiveMetricsFullSeries,
	useCacheStatsSeries,
	useSystemHealthSeries,
	useNewFlowSeries,
	useLbRuleSeries,
} from './metricsTimeSeriesHook';
