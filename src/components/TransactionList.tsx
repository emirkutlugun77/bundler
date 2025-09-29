import React, { useState, useEffect } from 'react';
import { useWalletStore } from '../store/WalletStore';
import { TransferTx, TradeTx } from '../types';

interface TransactionListProps {
	className?: string;
}

const TransactionList: React.FC<TransactionListProps> = ({ className = '' }) => {
	const { transfers, trades, wallets, folders } = useWalletStore();
	const [isExpanded, setIsExpanded] = useState(false);

	// Combine and sort all transactions by timestamp
	const allTransactions = React.useMemo(() => {
		const transferTxs = transfers.map(tx => ({
			...tx,
			type: 'transfer' as const,
			fromWalletName: wallets.find(w => w.id === tx.fromWalletId)?.name || 'Unknown',
			toWalletName: wallets.find(w => w.id === tx.toWalletId)?.name || 'Unknown',
			fromFolderName: folders.find(f => f.id === wallets.find(w => w.id === tx.fromWalletId)?.folderId)?.name || 'Unknown',
			toFolderName: folders.find(f => f.id === wallets.find(w => w.id === tx.toWalletId)?.folderId)?.name || 'Unknown',
		}));

		const tradeTxs = trades.map(tx => ({
			...tx,
			type: 'trade' as const,
			initiatorWalletName: wallets.find(w => w.id === tx.initiatorWalletId)?.name || 'Unknown',
			relayWalletName: wallets.find(w => w.id === tx.relayWalletId)?.name || 'Unknown',
			folderName: folders.find(f => f.id === tx.folderId)?.name || 'Unknown',
		}));

		return [...transferTxs, ...tradeTxs].sort((a, b) => b.timestamp - a.timestamp);
	}, [transfers, trades, wallets, folders]);

	const formatTime = (timestamp: number) => {
		const date = new Date(timestamp);
		const timeString = date.toLocaleTimeString('tr-TR', {
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		});
		const milliseconds = date.getMilliseconds().toString().padStart(3, '0');
		return `${timeString}.${milliseconds}`;
	};

	const formatAmount = (amount: number) => {
		return amount.toFixed(6);
	};

	const getTransactionIcon = (type: string, side?: string) => {
		if (type === 'transfer') {
			return '🔄';
		} else if (type === 'trade') {
			return side === 'buy' ? '📈' : '📉';
		}
		return '❓';
	};

	const getTransactionColor = (type: string, side?: string) => {
		if (type === 'transfer') {
			return 'text-blue-600';
		} else if (type === 'trade') {
			return side === 'buy' ? 'text-green-600' : 'text-red-600';
		}
		return 'text-gray-600';
	};

	return (
		<div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
			<div className="p-4 border-b border-gray-200">
				<div className="flex items-center justify-between">
					<h3 className="text-lg font-semibold text-gray-900">
						Gerçek Zamanlı İşlemler
					</h3>
					<div className="flex items-center gap-3">
						<span className="text-sm text-gray-500">
							{allTransactions.length} işlem
						</span>
						<button
							onClick={() => setIsExpanded(!isExpanded)}
							className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded"
						>
							{isExpanded ? 'Gizle' : 'Göster'}
						</button>
					</div>
				</div>
			</div>

			{isExpanded && (
				<div className="max-h-96 overflow-y-auto">
					{allTransactions.length === 0 ? (
						<div className="p-4 text-center text-gray-500">
							Henüz işlem yapılmadı
						</div>
					) : (
						<div className="divide-y divide-gray-100">
							{allTransactions.map((tx, index) => (
								<div key={`${tx.type}-${tx.timestamp}-${index}`} className="p-3 hover:bg-gray-50">
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-3">
											<span className="text-lg">
												{getTransactionIcon(tx.type, 'side' in tx ? tx.side : undefined)}
											</span>
											<div>
												<div className="flex items-center gap-2">
													<span className={`text-sm font-medium ${getTransactionColor(tx.type, 'side' in tx ? tx.side : undefined)}`}>
														{tx.type === 'transfer' ? 'Transfer' : `Trade (${'side' in tx ? tx.side : 'unknown'})`}
													</span>
													<span className="text-xs text-gray-500">
														{formatTime(tx.timestamp)}
													</span>
												</div>
												<div className="text-xs text-gray-600 mt-1">
													{tx.type === 'transfer' ? (
														<>
															<span className="font-medium">{tx.fromWalletName}</span>
															<span className="mx-1">({tx.fromFolderName})</span>
															<span className="mx-1">→</span>
															<span className="font-medium">{tx.toWalletName}</span>
															<span className="mx-1">({tx.toFolderName})</span>
														</>
													) : (
														<>
															<span className="font-medium">{tx.initiatorWalletName}</span>
															<span className="mx-1">↔</span>
															<span className="font-medium">{tx.relayWalletName}</span>
															<span className="mx-1">({tx.folderName})</span>
														</>
													)}
												</div>
											</div>
										</div>
										<div className="text-right">
											<div className="text-sm font-semibold text-gray-900">
												{formatAmount(tx.amount)} SOL
											</div>
											{tx.type === 'trade' && 'token' in tx && (
												<div className="text-xs text-gray-500 font-mono">
													{tx.token.slice(0, 8)}...
												</div>
											)}
										</div>
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			)}
		</div>
	);
};

export default TransactionList;
