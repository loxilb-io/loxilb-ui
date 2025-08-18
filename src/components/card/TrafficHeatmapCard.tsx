//---------------------------------------------------------
// Traffic Heatmap Visualization Card
//---------------------------------------------------------
import {
	Box,
	Typography,
	Grid,
	Chip,
	Stack,
	Switch,
	FormControlLabel,
	Tooltip,
	IconButton,
	useTheme,
	alpha,
	Paper,
	Select,
	MenuItem,
	FormControl,
	InputLabel
} from '@mui/material';
import {
	Refresh as RefreshIcon,
	Timeline as TimelineIcon,
	TrendingUp as TrendingUpIcon,
	Visibility as VisibilityIcon
} from '@mui/icons-material';
import {formatBytes} from 'common';
import {t} from 'i18next';
import {useMemo, useState} from 'react';
import {IInstance} from 'types/oam';
import {ITimeSeriesPoint} from 'types/global';
import {IProcessedTraffic} from 'types/metrics';
import CardBase from './CardBase';

//---------------------------------------------------------
// Interfaces
//---------------------------------------------------------
interface HeatmapCell {
	x: number;
	y: number;
	value: number;
	label: string;
	timestamp: number;
}

interface HeatmapProps {
	title: string;
	points: ITimeSeriesPoint<IProcessedTraffic>[];
	instance: IInstance | null;
}

//---------------------------------------------------------
// Generate Heatmap Data
//---------------------------------------------------------
const generateHeatmapData = (
	points: ITimeSeriesPoint<IProcessedTraffic>[],
	timeWindow: number
): HeatmapCell[] => {
	const cells: HeatmapCell[] = [];
	const recentPoints = points.slice(-timeWindow);
	
	// Create a grid of traffic data over time vs metric types
	const metrics = ['processed_bytes', 'processed_packets', 'processed_tcp_bytes', 'processed_udp_bytes'];
	const timeSlots = Math.min(recentPoints.length, 24); // Max 24 time slots
	
	for (let timeIndex = 0; timeIndex < timeSlots; timeIndex++) {
		for (let metricIndex = 0; metricIndex < metrics.length; metricIndex++) {
			const point = recentPoints[Math.floor((recentPoints.length / timeSlots) * timeIndex)];
			if (!point) continue;
			
			const metric = metrics[metricIndex] as keyof IProcessedTraffic;
			const value = point.data[metric] || 0;
			
			cells.push({
				x: timeIndex,
				y: metricIndex,
				value: typeof value === 'number' ? value : 0,
				label: `${metric}: ${formatBytes(typeof value === 'number' ? value : 0)}`,
				timestamp: point.timestamp
			});
		}
	}
	
	return cells;
};

//---------------------------------------------------------
// Heatmap Cell Component
//---------------------------------------------------------
interface HeatmapCellProps {
	cell: HeatmapCell;
	maxValue: number;
	cellSize: number;
	showValues: boolean;
	colorScheme: 'blue' | 'green' | 'red';
	onCellClick: (cell: HeatmapCell) => void;
}

function HeatmapCellComponent({cell, maxValue, cellSize, showValues, colorScheme, onCellClick}: HeatmapCellProps) {
	const theme = useTheme();
	
	const getColor = () => {
		const intensity = maxValue > 0 ? cell.value / maxValue : 0;
		const colors = {
			blue: theme.palette.primary.main,
			green: theme.palette.success.main,
			red: theme.palette.error.main
		};
		return alpha(colors[colorScheme], Math.max(0.1, intensity));
	};

	const getBorderColor = () => {
		const colors = {
			blue: theme.palette.primary.main,
			green: theme.palette.success.main,
			red: theme.palette.error.main
		};
		return colors[colorScheme];
	};

	return (
		<g onClick={() => onCellClick(cell)} style={{ cursor: 'pointer' }}>
			<rect
				x={cell.x * (cellSize + 2)}
				y={cell.y * (cellSize + 2)}
				width={cellSize}
				height={cellSize}
				fill={getColor()}
				stroke={getBorderColor()}
				strokeWidth={0.5}
				rx={2}
			/>
			{showValues && cell.value > 0 && (
				<text
					x={cell.x * (cellSize + 2) + cellSize / 2}
					y={cell.y * (cellSize + 2) + cellSize / 2}
					textAnchor="middle"
					dominantBaseline="middle"
					fontSize="8"
					fill={theme.palette.text.primary}
					fontWeight="bold"
				>
					{cell.value > 1000000 ? `${(cell.value / 1000000).toFixed(1)}M` : 
					 cell.value > 1000 ? `${(cell.value / 1000).toFixed(1)}K` : 
					 cell.value.toFixed(0)}
				</text>
			)}
		</g>
	);
}

//---------------------------------------------------------
// Main Traffic Heatmap Card
//---------------------------------------------------------
export default function TrafficHeatmapCard({title, points, instance}: HeatmapProps) {
	const theme = useTheme();
	
	const getColorFromScheme = () => {
		const colors = {
			blue: theme.palette.primary.main,
			green: theme.palette.success.main,
			red: theme.palette.error.main
		};
		return colors[colorScheme];
	};
	
	const [timeWindow, setTimeWindow] = useState<number>(60);
	const [colorScheme, setColorScheme] = useState<'blue' | 'green' | 'red'>('blue');
	const [showValues, setShowValues] = useState(false);
	const [selectedCell, setSelectedCell] = useState<HeatmapCell | null>(null);

	// Generate heatmap data
	const heatmapData = useMemo(() => generateHeatmapData(points, timeWindow), [points, timeWindow]);
	
	// Calculate statistics
	const maxValue = useMemo(() => Math.max(...heatmapData.map(cell => cell.value), 1), [heatmapData]);
	const avgValue = useMemo(() => {
		const sum = heatmapData.reduce((acc, cell) => acc + cell.value, 0);
		return heatmapData.length > 0 ? sum / heatmapData.length : 0;
	}, [heatmapData]);

	const cellSize = 25;
	const metrics = ['Bytes', 'Packets', 'TCP', 'UDP'];
	const svgWidth = Math.min(24, timeWindow) * (cellSize + 2) + 100;
	const svgHeight = metrics.length * (cellSize + 2) + 50;

	const handleCellClick = (cell: HeatmapCell) => {
		setSelectedCell(cell);
	};

	return (
		<CardBase title={title}>
			<Box height="100%" display="flex" flexDirection="column">
				{/* Controls */}
				<Box mb={2}>
					<Grid container spacing={2} alignItems="center">
						<Grid item xs={4}>
							<FormControl size="small" fullWidth>
								<InputLabel>{t('Time Window')}</InputLabel>
								<Select
									value={timeWindow}
									label={t('Time Window')}
									onChange={(e) => setTimeWindow(Number(e.target.value))}
								>
									<MenuItem value={30}>{t('30 minutes')}</MenuItem>
									<MenuItem value={60}>{t('1 hour')}</MenuItem>
									<MenuItem value={180}>{t('3 hours')}</MenuItem>
									<MenuItem value={360}>{t('6 hours')}</MenuItem>
								</Select>
							</FormControl>
						</Grid>
						<Grid item xs={4}>
							<FormControl size="small" fullWidth>
								<InputLabel>{t('Color Scheme')}</InputLabel>
								<Select
									value={colorScheme}
									label={t('Color Scheme')}
									onChange={(e) => setColorScheme(e.target.value as 'blue' | 'green' | 'red')}
								>
									<MenuItem value="blue">{t('Blue')}</MenuItem>
									<MenuItem value="green">{t('Green')}</MenuItem>
									<MenuItem value="red">{t('Red')}</MenuItem>
								</Select>
							</FormControl>
						</Grid>
						<Grid item xs={4}>
							<Stack direction="row" spacing={1} justifyContent="flex-end">
								<FormControlLabel
									control={
										<Switch 
											size="small" 
											checked={showValues} 
											onChange={(e) => setShowValues(e.target.checked)} 
										/>
									}
									label={<Typography variant="caption">{t('Values')}</Typography>}
								/>
								<Tooltip title={t('Refresh')}>
									<IconButton size="small">
										<RefreshIcon />
									</IconButton>
								</Tooltip>
							</Stack>
						</Grid>
					</Grid>
				</Box>

				{/* Statistics */}
				<Grid container spacing={2} mb={2}>
					<Grid item xs={4}>
						<Paper variant="outlined" sx={{ p: 1, textAlign: 'center' }}>
							<Typography variant="h6" color="primary.main">
								{formatBytes(maxValue)}
							</Typography>
							<Typography variant="caption" color="text.secondary">{t('Peak')}</Typography>
						</Paper>
					</Grid>
					<Grid item xs={4}>
						<Paper variant="outlined" sx={{ p: 1, textAlign: 'center' }}>
							<Typography variant="h6" color="success.main">
								{formatBytes(avgValue)}
							</Typography>
							<Typography variant="caption" color="text.secondary">{t('Average')}</Typography>
						</Paper>
					</Grid>
					<Grid item xs={4}>
						<Paper variant="outlined" sx={{ p: 1, textAlign: 'center' }}>
							<Typography variant="h6" color="info.main">
								{heatmapData.length}
							</Typography>
							<Typography variant="caption" color="text.secondary">{t('Data Points')}</Typography>
						</Paper>
					</Grid>
				</Grid>

				{/* Heatmap Visualization */}
				<Box flexGrow={1} display="flex" justifyContent="center" alignItems="center" overflow="auto">
					<Box>
						<svg width={svgWidth} height={svgHeight} style={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 4 }}>
							{/* Y-axis labels (Metrics) */}
							{metrics.map((metric, index) => (
								<text
									key={metric}
									x={10}
									y={index * (cellSize + 2) + cellSize / 2}
									textAnchor="middle"
									dominantBaseline="middle"
									fontSize="10"
									fill={theme.palette.text.primary}
									transform={`rotate(-90, 10, ${index * (cellSize + 2) + cellSize / 2})`}
								>
									{metric}
								</text>
							))}
							
							{/* X-axis labels (Time) */}
							{Array.from({ length: Math.min(24, timeWindow) }, (_, index) => {
								const step = Math.max(1, Math.floor(timeWindow / 12));
								if (index % step === 0) {
									return (
										<text
											key={index}
											x={index * (cellSize + 2) + cellSize / 2 + 30}
											y={svgHeight - 10}
											textAnchor="middle"
											fontSize="9"
											fill={theme.palette.text.secondary}
										>
											{`-${Math.floor((timeWindow - index) * (timeWindow / 24))}m`}
										</text>
									);
								}
								return null;
							})}
							
							{/* Heatmap cells */}
							<g transform="translate(30, 10)">
								{heatmapData.map((cell, index) => (
									<HeatmapCellComponent
										key={index}
										cell={cell}
										maxValue={maxValue}
										cellSize={cellSize}
										showValues={showValues}
										colorScheme={colorScheme}
										onCellClick={handleCellClick}
									/>
								))}
							</g>
						</svg>
					</Box>
				</Box>

				{/* Selected Cell Info */}
				{selectedCell && (
					<Box mt={2}>
						<Paper variant="outlined" sx={{ p: 2 }}>
							<Typography variant="subtitle2" color="primary.main" mb={1}>
								{t('Cell Details')}
							</Typography>
							<Grid container spacing={2}>
								<Grid item xs={6}>
									<Typography variant="caption" color="text.secondary">
										{selectedCell.label}
									</Typography>
								</Grid>
								<Grid item xs={6}>
									<Typography variant="caption" color="text.secondary">
										{t('Time')}: {new Date(selectedCell.timestamp).toLocaleTimeString()}
									</Typography>
								</Grid>
							</Grid>
						</Paper>
					</Box>
				)}

				{/* Legend */}
				<Box mt={2}>
					<Typography variant="caption" color="text.secondary" display="block" mb={1}>
						{t('Intensity Scale')}:
					</Typography>
					<Stack direction="row" alignItems="center" spacing={1}>
						<Typography variant="caption" color="text.secondary">{t('Low')}</Typography>
						<Box 
							width={100} 
							height={12} 
							sx={{
								background: `linear-gradient(90deg, ${alpha(getColorFromScheme(), 0.1)}, ${getColorFromScheme()})`,
								borderRadius: 1,
								border: `1px solid ${theme.palette.divider}`
							}}
						/>
						<Typography variant="caption" color="text.secondary">{t('High')}</Typography>
					</Stack>
				</Box>
			</Box>
		</CardBase>
	);
}