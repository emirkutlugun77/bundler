import React, { useMemo } from 'react';
import { useWalletStore } from '../store/WalletStore';
import { scaleLinear, scaleTime } from 'd3-scale';
import { extent, group, sum } from 'd3-array';

const WIDTH = 800;
const HEIGHT = 300;
const MARGIN = { top: 20, right: 20, bottom: 40, left: 60 };

function LineChart({ data, color, title, yAxisLabel }: { 
	data: { x: number; y: number }[]; 
	color: string; 
	title: string;
	yAxisLabel: string;
}) {
	const xScale = useMemo(() => {
		const domain = extent(data, (d: { x: number; y: number }) => d.x) as [number, number];
		const safeDomain: [number, number] = domain && Number.isFinite(domain?.[0]) && Number.isFinite(domain?.[1])
			? (domain[0] === domain[1]
				? [domain[0] - 1000, domain[1] + 1000] // pad when all timestamps equal
				: domain)
			: [Date.now() - 60000, Date.now()];
		return scaleTime().domain(safeDomain).range([MARGIN.left, WIDTH - MARGIN.right]);
	}, [data]);
	
	const yScale = useMemo(() => {
		const max = data.length > 0 ? Math.max(1, ...data.map(d => d.y)) : 1;
		return scaleLinear().domain([0, max]).range([HEIGHT - MARGIN.bottom, MARGIN.top]);
	}, [data]);
	
	const pathD = useMemo(() => {
		if (data.length === 0) return '';
		return [...data]
			.sort((a, b) => a.x - b.x)
			.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xScale(d.x)} ${yScale(d.y)}`)
			.join(' ');
	}, [data, xScale, yScale]);

	const areaD = useMemo(() => {
		if (data.length === 0) return '';
		const sortedData = [...data].sort((a, b) => a.x - b.x);
		const first = sortedData[0];
		const last = sortedData[sortedData.length - 1];
		return `${pathD} L ${xScale(last.x)} ${yScale(0)} L ${xScale(first.x)} ${yScale(0)} Z`;
	}, [pathD, data, xScale, yScale]);

	return (
		<div className="bg-white rounded-lg border border-gray-200 p-4">
			<div className="text-lg font-semibold mb-4 text-gray-900">{title}</div>
			{data.length === 0 ? (
				<div className="flex items-center justify-center h-64 text-gray-500">
					Henüz veri yok
				</div>
			) : (
				<svg width={WIDTH} height={HEIGHT}>
					<rect x={0} y={0} width={WIDTH} height={HEIGHT} fill="#ffffff" />
					
					{/* Grid lines */}
					<g className="grid-lines">
						{[0, 0.25, 0.5, 0.75, 1].map(t => (
							<line
								key={t}
								x1={MARGIN.left}
								x2={WIDTH - MARGIN.right}
								y1={yScale(yScale.domain()[1] * t)}
								y2={yScale(yScale.domain()[1] * t)}
								stroke="#e5e7eb"
								strokeWidth={1}
							/>
						))}
					</g>

					{/* Area fill */}
					<path d={areaD} fill={`${color}20`} />
					
					{/* Line */}
					<path d={pathD} fill="none" stroke={color} strokeWidth={3} />
					
					{/* Data points */}
					{data.map((d, i) => (
						<circle
							key={i}
							cx={xScale(d.x)}
							cy={yScale(d.y)}
							r={4}
							fill={color}
							stroke="white"
							strokeWidth={2}
						/>
					))}

					{/* Y-axis */}
					<text
						x={MARGIN.left - 10}
						y={HEIGHT / 2}
						textAnchor="middle"
						transform={`rotate(-90, ${MARGIN.left - 10}, ${HEIGHT / 2})`}
						fontSize="12"
						fill="#6b7280"
					>
						{yAxisLabel}
					</text>

					{/* X-axis */}
					<text
						x={WIDTH / 2}
						y={HEIGHT - 10}
						textAnchor="middle"
						fontSize="12"
						fill="#6b7280"
					>
						Zaman
					</text>
				</svg>
			)}
		</div>
	);
}

function BarChart({ data, title }: { data: Array<{ label: string; value: number; color: string }>; title: string }) {
	const maxValue = data.length > 0 ? Math.max(1, ...data.map(d => (Number.isFinite(d.value) ? d.value : 0))) : 1;
	const barWidth = data.length > 0 ? (WIDTH - MARGIN.left - MARGIN.right) / data.length - 10 : 0;

	return (
		<div className="bg-white rounded-lg border border-gray-200 p-4">
			<div className="text-lg font-semibold mb-4 text-gray-900">{title}</div>
			{data.length === 0 ? (
				<div className="flex items-center justify-center h-64 text-gray-500">
					Henüz veri yok
				</div>
			) : (
				<svg width={WIDTH} height={HEIGHT}>
					<rect x={0} y={0} width={WIDTH} height={HEIGHT} fill="#ffffff" />
					
					{data.map((d, i) => {
						const safeValue = Number.isFinite(d.value) ? d.value : 0;
						const availableHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
						const barHeightRaw = (safeValue / maxValue) * availableHeight;
						const barHeight = Number.isFinite(barHeightRaw) ? Math.max(0, barHeightRaw) : 0;
						const x = MARGIN.left + i * (barWidth + 10);
						const yRaw = HEIGHT - MARGIN.bottom - barHeight;
						const y = Number.isFinite(yRaw) ? yRaw : HEIGHT - MARGIN.bottom;
						
						return (
							<g key={i}>
								<rect
									x={x}
									y={y}
									width={barWidth}
									height={barHeight}
									fill={d.color}
									rx={4}
								/>
								<text
									x={x + barWidth / 2}
									y={HEIGHT - MARGIN.bottom + 20}
									textAnchor="middle"
									fontSize="10"
									fill="#6b7280"
								>
									{d.label}
								</text>
								<text
									x={x + barWidth / 2}
									y={y - 5}
									textAnchor="middle"
									fontSize="10"
									fill="#374151"
									fontWeight="bold"
								>
									{safeValue.toFixed(3)}
								</text>
							</g>
						);
					})}
				</svg>
			)}
		</div>
	);
}

const VolumeCharts: React.FC = () => {
	const { transfers, trades, wallets, folders } = useWalletStore();

	const transferSeries = useMemo(() => {
		const bySec = new Map<number, number>();
		for (const t of transfers) {
			const sec = Math.floor(t.timestamp / 1000) * 1000;
			bySec.set(sec, (bySec.get(sec) || 0) + t.amount);
		}
		return Array.from(bySec.entries()).map(([x, y]) => ({ x, y }));
	}, [transfers]);

	const tradeSeries = useMemo(() => {
		const bySec = new Map<number, number>();
		for (const t of trades) {
			const sec = Math.floor(t.timestamp / 1000) * 1000;
			bySec.set(sec, (bySec.get(sec) || 0) + t.amount);
		}
		return Array.from(bySec.entries()).map(([x, y]) => ({ x, y }));
	}, [trades]);

	const flowByFolder = useMemo(() => {
		const totals = new Map<string, number>();
		for (const t of transfers) {
			const fromFolder = wallets.find(w => w.id === t.fromWalletId)?.folderId;
			const toFolder = wallets.find(w => w.id === t.toWalletId)?.folderId;
			if (fromFolder) totals.set(fromFolder, (totals.get(fromFolder) || 0) - t.amount);
			if (toFolder) totals.set(toFolder, (totals.get(toFolder) || 0) + t.amount);
		}
		return Array.from(totals.entries()).map(([folderId, total]) => ({
			label: folders.find(f => f.id === folderId)?.name || folderId.slice(0, 6),
			value: Math.abs(total),
			color: total >= 0 ? '#10b981' : '#ef4444'
		}));
	}, [transfers, wallets, folders]);

	const totalVolume = useMemo(() => {
		const transferVolume = transfers.reduce((sum, t) => sum + t.amount, 0);
		const tradeVolume = trades.reduce((sum, t) => sum + t.amount, 0);
		return transferVolume + tradeVolume;
	}, [transfers, trades]);

	const transferVolume = useMemo(() => {
		return transfers.reduce((sum, t) => sum + t.amount, 0);
	}, [transfers]);

	const tradeVolume = useMemo(() => {
		return trades.reduce((sum, t) => sum + t.amount, 0);
	}, [trades]);

	const transactionCount = useMemo(() => {
		return transfers.length + trades.length;
	}, [transfers, trades]);

	return (
		<div className="space-y-6">
			{/* Volume Summary */}
			<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
				<div className="bg-white rounded-lg border border-gray-200 p-4">
					<div className="text-sm text-gray-600">Toplam Volume</div>
					<div className="text-2xl font-bold text-gray-900">{totalVolume.toFixed(6)} SOL</div>
				</div>
				<div className="bg-white rounded-lg border border-gray-200 p-4">
					<div className="text-sm text-gray-600">Transfer Volume</div>
					<div className="text-2xl font-bold text-blue-600">{transferVolume.toFixed(6)} SOL</div>
				</div>
				<div className="bg-white rounded-lg border border-gray-200 p-4">
					<div className="text-sm text-gray-600">Trade Volume</div>
					<div className="text-2xl font-bold text-green-600">{tradeVolume.toFixed(6)} SOL</div>
				</div>
				<div className="bg-white rounded-lg border border-gray-200 p-4">
					<div className="text-sm text-gray-600">Toplam İşlem</div>
					<div className="text-2xl font-bold text-purple-600">{transactionCount}</div>
				</div>
			</div>

			{/* Charts */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<LineChart 
					data={transferSeries} 
					color="#3b82f6" 
					title="Transfer Volume Trendi" 
					yAxisLabel="SOL"
				/>
				<LineChart 
					data={tradeSeries} 
					color="#10b981" 
					title="Trade Volume Trendi" 
					yAxisLabel="SOL"
				/>
			</div>

			{/* Folder Flow Chart */}
			{flowByFolder.length > 0 && (
				<BarChart 
					data={flowByFolder} 
					title="Klasör Bazlı Net Akış" 
				/>
			)}
		</div>
	);
};

export default VolumeCharts;


