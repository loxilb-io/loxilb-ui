# LoxiLB Advanced Metrics Implementation

## Overview
This implementation extends the LoxiLB UI with comprehensive advanced metrics capabilities based on the metrics API swagger specification. The system provides both real-time and historical metrics with intelligent caching and database query capabilities.

## New Features Added

### 1. Extended API Layer (`/src/connector/instance/metrics.ts`)
- **Live Metrics API**: Real-time metrics from cache system
- **Cache Management**: Cache statistics and performance monitoring
- **Historical Metrics**: Database queries with pagination and filtering
- **Unified Query**: Intelligent routing between cache and database
- **Health Monitoring**: System health checks and status reporting

### 2. Type Definitions (`/src/types/metrics.ts`)
- `ILiveMetricsResponse`: Live metrics from cache
- `ICacheStatsResponse`: Cache system statistics
- `IMetricHistoryResponse`: Historical metric data
- `IQueryResponse`: Database query results
- `IHealthResponse`: System health status
- Parameter interfaces for all query types

### 3. Time Series Hooks (`/src/hooks/query/metricsTimeSeriesHook.ts`)
- `useLiveMetricsCriticalSeries`: Critical metrics only (phase 1)
- `useLiveMetricsFullSeries`: All metrics (phase 2)
- `useCacheStatsSeries`: Cache performance over time
- `useSystemHealthSeries`: System health trends

### 4. Advanced Query Hooks (`/src/hooks/query/advancedMetricsHook.ts`)
- `useLiveMetrics`: Real-time cache metrics
- `useMetricsDatabase`: Historical database queries
- `useMetricsAggregate`: Aggregation queries (avg, sum, max, min, p95, p99)
- `useUnifiedMetrics`: Intelligent routing queries
- `useHistoricalMetrics`: Database-only historical queries

### 5. New UI Components

#### Cache Statistics Card (`/src/components/card/CacheStatsCard.tsx`)
- Real-time cache utilization monitoring
- Memory usage tracking
- Buffer statistics
- Performance metrics visualization

#### System Health Card (`/src/components/card/SystemHealthCard.tsx`)
- Overall system health status
- Performance utilization tracking
- Memory and buffer monitoring
- Health trend visualization

#### Live Metrics Card (`/src/components/card/LiveMetricsCard.tsx`)
- Real-time metrics display
- Critical vs Important metrics separation
- Response time monitoring
- Cache status indicators

#### Delta Traffic Card (`/src/components/card/DeltaTrafficCard.tsx`)
- **Rate Calculation**: Converts cumulative counters to bps/pps
- **Real-time BPS/PPS**: Shows actual traffic rates
- **Delta Processing**: Calculates differences between consecutive data points
- **Unit Formatting**: Intelligent display (Gbps, Mbps, Kbps, bps)

### 6. Enhanced Dashboard (`/src/pages/DashboardPage.tsx`)
Extended dashboard layout with:
- **Traditional cumulative traffic cards** (existing functionality)
- **New real-time rate cards** (bps/pps calculations)
- **Advanced metrics monitoring** (cache, health, live metrics)
- **Intelligent grid layout** organizing related metrics

### 7. Advanced Metrics Page (`/src/pages/AdvancedMetricsPage.tsx`)
Comprehensive metrics analysis dashboard:
- **Live metrics monitoring** with real-time updates
- **Historical data queries** with time range selection
- **Aggregation analysis** (avg, sum, max, min, percentiles)
- **Performance monitoring** with cache and health status
- **Interactive query interface** for custom analysis

## Key Technical Improvements

### Delta Rate Calculation
The `DeltaTrafficCard` component implements efficient delta calculation:
```typescript
const calculateDeltaRate = (points: ITimeSeriesPoint<IProcessedTraffic>[], dataKey: keyof IProcessedTraffic) => {
  return points.slice(1).map((point, index) => {
    const prevPoint = points[index];
    const deltaValue = (point.data[dataKey] ?? 0) - (prevPoint.data[dataKey] ?? 0);
    const deltaTime = (point.timestamp - prevPoint.timestamp) / 1000;
    const rate = deltaTime > 0 ? deltaValue / deltaTime : 0;
    return { timestamp: point.timestamp, data: Math.max(rate, 0) };
  });
};
```

### Intelligent Caching
- **Memory-based time series**: 24-hour data retention
- **Local storage persistence**: Survives page refreshes
- **Smart polling**: 1-second intervals for real-time updates
- **Automatic pruning**: Removes old data to prevent memory leaks

### Performance Optimization
- **Phase-based metrics**: Critical vs Important metric separation
- **Lazy loading**: Only fetch data when components are visible
- **Infinity caching**: Historical data cached indefinitely
- **Smart routing**: Auto-select between cache and database based on query

## API Endpoints Implemented

### Live Metrics
- `GET /metrics/live?phase={1|2}` - Real-time metrics from cache
- `GET /metrics/live/advanced?phase={1|2}&metrics=filter` - Advanced live metrics

### Cache Management
- `GET /metrics/cache/stats` - Cache system statistics

### Historical Data
- `GET /metrics/history/{metric_name}?count={1-1000}` - Metric history
- `GET /metrics/value/{metric_name}` - Latest metric value

### Database Queries
- `GET /metrics/db/query` - Advanced database queries
- `GET /metrics/db/aggregate` - Aggregation queries
- `GET /metrics/historical` - Historical data (database-only)

### Unified API
- `GET /metrics/query` - Intelligent routing queries
- `GET /metrics/health` - System health check

## Usage Examples

### Real-time BPS Monitoring
```typescript
// Display TCP traffic rate instead of cumulative bytes
<DeltaTrafficCard 
  title="TCP Traffic Rate" 
  points={traffics} 
  data_key="processed_tcp_bytes" 
  unit="bps" 
/>
```

### Historical Analysis
```typescript
// Query last 24 hours of specific metrics
const historicalData = useHistoricalMetrics(instance, {
  time_start: Math.floor((Date.now() - 24*60*60*1000) / 1000),
  time_end: Math.floor(Date.now() / 1000),
  metrics: "processed_bytes,processed_packets",
  limit: 100
});
```

### Performance Monitoring
```typescript
// Monitor cache performance
const cacheStats = useCacheStatsSeries(instance);
const utilization = cacheStats.map(point => point.data.average_utilization * 100);
```

## Benefits

1. **Real-time Rate Calculation**: True bps/pps from cumulative counters
2. **Advanced Analytics**: Historical trends and aggregation analysis
3. **Performance Monitoring**: Cache and system health tracking
4. **Intelligent Caching**: Optimal performance for both live and historical data
5. **Scalable Architecture**: Easy to extend with new metrics
6. **User-friendly Interface**: Intuitive dashboards and analysis tools

This implementation transforms the LoxiLB UI from a basic monitoring tool into a comprehensive metrics analysis platform, enabling operators to understand both real-time performance and historical trends with unprecedented detail and accuracy.
