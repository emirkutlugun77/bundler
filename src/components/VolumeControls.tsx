import React, { useEffect, useState } from 'react';
import { useWalletStore } from '../store/WalletStore';
import { FolderId, TradeSide } from '../types';
import { Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL, Connection, Transaction, clusterApiUrl } from '@solana/web3.js';

interface VolumeControlsProps {
	onVolumeTransaction: (transactions: Array<{
		fromWallet: { address: string; privateKey: string };
		toWallet: { address: string; privateKey: string };
		amount: number;
		type: 'transfer' | 'buy' | 'sell';
	}>) => Promise<boolean[]>; // returns per-tx success
	isLoading: boolean;
}

const VolumeControls: React.FC<VolumeControlsProps> = ({ onVolumeTransaction, isLoading }) => {
	const { folders, selection, wallets, addTransfer, addTrade, toggleFolderSelection, clearSelection } = useWalletStore();
	const [amount, setAmount] = useState(0.001);
	const [token, setToken] = useState<string>('So11111111111111111111111111111111111111112');
	const [volumeLimit, setVolumeLimit] = useState<number | null>(null);
	const [currentVolume, setCurrentVolume] = useState(0);
	const selectedIds = Array.from(selection.selectedFolderIds);

	// Listen real-time confirmations from App and record immediately
	useEffect(() => {
		const handler = (evt: Event) => {
			const e = evt as CustomEvent<{ fromWallet: { address: string }; toWallet: { address: string }; amount: number; type: 'transfer' | 'buy' | 'sell' }>;
			const tx = e.detail;
			if (!tx) return;
			const from = wallets.find(w => w.address === tx.fromWallet.address);
			const to = wallets.find(w => w.address === tx.toWallet.address);
			if (!from || !to) return;
			if (tx.type === 'transfer') {
				addTransfer({ fromWalletId: from.id, toWalletId: to.id, amount: tx.amount, timestamp: Date.now() });
			} else {
				addTrade({ folderId: from.folderId, initiatorWalletId: from.id, relayWalletId: to.id, token, amount: tx.amount, side: tx.type as any, timestamp: Date.now() });
			}
			setCurrentVolume(prev => prev + tx.amount);
		};
		window.addEventListener('volume-tx-confirmed', handler as EventListener);
		return () => window.removeEventListener('volume-tx-confirmed', handler as EventListener);
	}, [wallets, addTransfer, addTrade, token]);

	const selectAllFolders = () => {
		folders.forEach(folder => {
			if (!selection.selectedFolderIds.has(folder.id)) {
				toggleFolderSelection(folder.id);
			}
		});
	};

	const runInterFolderTransfers = async () => {
		if (selectedIds.length < 2) {
			alert('En az 2 klasör seçmelisiniz');
			return;
		}

		const selectedWallets = wallets.filter(w => selection.selectedFolderIds.has(w.folderId) && w.privateKey);
		if (selectedWallets.length === 0) {
			alert('Seçili klasörlerde private key\'i olan wallet bulunamadı');
			return;
		}

		// Check volume limit
		if (volumeLimit && currentVolume >= volumeLimit) {
			alert(`Volume limiti (${volumeLimit} SOL) aşıldı! İşlem durduruldu.`);
			return;
		}

		// Group wallets by folder
		const walletsByFolder = selectedWallets.reduce((acc, wallet) => {
			if (!acc[wallet.folderId]) acc[wallet.folderId] = [];
			acc[wallet.folderId].push(wallet);
			return acc;
		}, {} as Record<string, typeof selectedWallets>);

		const folderIds = Object.keys(walletsByFolder);
		const transactions: Array<{
			fromWallet: { address: string; privateKey: string };
			toWallet: { address: string; privateKey: string };
			amount: number;
			type: 'transfer' | 'buy' | 'sell';
		}> = [];

		// Create offset matches between folders
		for (let i = 0; i < folderIds.length; i++) {
			for (let j = i + 1; j < folderIds.length; j++) {
				const folder1Id = folderIds[i];
				const folder2Id = folderIds[j];
				const folder1Wallets = walletsByFolder[folder1Id];
				const folder2Wallets = walletsByFolder[folder2Id];

				const maxPairs = Math.min(folder1Wallets.length, folder2Wallets.length);
				
				for (let k = 0; k < maxPairs; k++) {
					// Check volume limit before each transaction
					if (volumeLimit && currentVolume + amount > volumeLimit) {
						alert(`Volume limiti (${volumeLimit} SOL) yaklaşıldı! İşlem durduruldu.`);
						break;
					}

					const wallet1 = folder1Wallets[k];
					const wallet2 = folder2Wallets[(k + 1) % folder2Wallets.length]; // Offset by 1
					
					// Wallet1 -> Wallet2 transfer
					transactions.push({
						fromWallet: { address: wallet1.address, privateKey: wallet1.privateKey },
						toWallet: { address: wallet2.address, privateKey: wallet2.privateKey },
						amount,
						type: 'transfer'
					});
				}
			}
		}

		try {
			await onVolumeTransaction(transactions);
			alert(`${transactions.length} transfer işlemi başlatıldı!`);
		} catch (error) {
			console.error('Volume transaction error:', error);
			alert('Volume işlemi hatası: ' + (error as Error).message);
		}
	};

	const runTradeWithRelay = async (side: TradeSide) => {
		if (selectedIds.length < 1) {
			alert('En az 1 klasör seçmelisiniz');
			return;
		}

		const selectedWallets = wallets.filter(w => selection.selectedFolderIds.has(w.folderId) && w.privateKey);
		if (selectedWallets.length < 2) {
			alert('En az 2 wallet gereklidir (bir initiator, bir relay)');
			return;
		}

		// Check volume limit
		if (volumeLimit && currentVolume >= volumeLimit) {
			alert(`Volume limiti (${volumeLimit} SOL) aşıldı! İşlem durduruldu.`);
			return;
		}

		// Group wallets by folder
		const walletsByFolder = selectedWallets.reduce((acc, wallet) => {
			if (!acc[wallet.folderId]) acc[wallet.folderId] = [];
			acc[wallet.folderId].push(wallet);
			return acc;
		}, {} as Record<string, typeof selectedWallets>);

		const transactions: Array<{
			fromWallet: { address: string; privateKey: string };
			toWallet: { address: string; privateKey: string };
			amount: number;
			type: 'transfer' | 'buy' | 'sell';
		}> = [];

		// Create offset trading pairs
		for (const [folderId, folderWallets] of Object.entries(walletsByFolder)) {
			if (folderWallets.length < 2) continue;

			for (let i = 0; i < folderWallets.length; i++) {
				// Check volume limit before each trade pair
				if (volumeLimit && currentVolume + amount > volumeLimit) {
					alert(`Volume limiti (${volumeLimit} SOL) yaklaşıldı! İşlem durduruldu.`);
					break;
				}

				const initiator = folderWallets[i];
				const relay = folderWallets[(i + 1) % folderWallets.length]; // Offset by 1

				// Initiator does the original trade
				transactions.push({
					fromWallet: { address: initiator.address, privateKey: initiator.privateKey },
					toWallet: { address: relay.address, privateKey: relay.privateKey },
					amount,
					type: side
				});

				// Relay does the opposite trade
				transactions.push({
					fromWallet: { address: relay.address, privateKey: relay.privateKey },
					toWallet: { address: initiator.address, privateKey: initiator.privateKey },
					amount,
					type: side === 'buy' ? 'sell' : 'buy'
				});
			}
		}

		try {
			await onVolumeTransaction(transactions);
			alert(`${transactions.length} trade işlemi başlatıldı!`);
		} catch (error) {
			console.error('Volume transaction error:', error);
			alert('Volume işlemi hatası: ' + (error as Error).message);
		}
	};

	return (
		<div className="space-y-6">
			{/* Folder Selection */}
			<div className="bg-white rounded-lg border border-gray-200 p-4">
				<div className="flex items-center justify-between mb-4">
					<h3 className="text-lg font-semibold text-gray-900">Klasör Seçimi</h3>
					<div className="flex gap-2">
						<button
							onClick={selectAllFolders}
							className="px-3 py-1 bg-blue-600 text-white rounded text-sm"
						>
							Tümünü Seç
						</button>
						<button
							onClick={clearSelection}
							className="px-3 py-1 bg-gray-600 text-white rounded text-sm"
						>
							Temizle
						</button>
					</div>
				</div>

				{folders.length === 0 ? (
					<div className="text-center py-8 text-gray-500">
						<p>Henüz klasör oluşturulmadı</p>
						<p className="text-sm">Önce "Klasörler" sekmesinde klasör oluşturun</p>
					</div>
				) : (
					<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
						{folders.map((folder) => {
							const folderWallets = wallets.filter(w => w.folderId === folder.id);
							const isSelected = selection.selectedFolderIds.has(folder.id);
							
							return (
								<div
									key={folder.id}
									className={`p-3 rounded-lg border cursor-pointer transition-all ${
										isSelected 
											? 'bg-blue-50 border-blue-300' 
											: 'bg-gray-50 border-gray-200 hover:bg-gray-100'
									}`}
									onClick={() => toggleFolderSelection(folder.id)}
								>
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-3">
											<input
												type="checkbox"
												checked={isSelected}
												onChange={() => toggleFolderSelection(folder.id)}
												className="w-4 h-4"
											/>
											<div>
												<div className="font-medium text-gray-900">{folder.name}</div>
												<div className="text-xs text-gray-500 font-mono">{folder.shortUid}</div>
											</div>
										</div>
										<div className="text-sm text-gray-600">
											{folderWallets.length} wallet
										</div>
									</div>
								</div>
							);
						})}
					</div>
				)}
			</div>

			{/* Volume Controls */}
			<div className="bg-white rounded-lg border border-gray-200 p-4">
				<div className="flex items-center justify-between mb-3">
					<h3 className="text-lg font-semibold text-gray-900">Volume Fonksiyonları</h3>
					<div className="flex items-center gap-3">
						<div className="text-xs text-gray-500">Seçili klasör: {selectedIds.length}</div>
						{volumeLimit && (
							<button
								onClick={() => {
									setCurrentVolume(0);
									alert('Volume sayacı sıfırlandı!');
								}}
								className="px-2 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded"
							>
								Sıfırla
							</button>
						)}
					</div>
				</div>
				
				<div className="grid md:grid-cols-3 gap-3 mb-4">
					<div>
						<label className="block text-xs text-gray-600 mb-1">Miktar (SOL)</label>
						<input type="number" step="0.0001" value={amount} onChange={(e) => setAmount(parseFloat(e.target.value) || 0)} className="w-full p-2 bg-gray-50 border border-gray-300 rounded" />
					</div>
					<div>
						<label className="block text-xs text-gray-600 mb-1">Token Mint</label>
						<input value={token} onChange={(e) => setToken(e.target.value)} className="w-full p-2 bg-gray-50 border border-gray-300 rounded font-mono" />
					</div>
					<div>
						<label className="block text-xs text-gray-600 mb-1">Volume Limiti (SOL)</label>
						<input 
							type="number" 
							step="0.1" 
							min="0" 
							placeholder="Opsiyonel" 
							value={volumeLimit || ''} 
							onChange={(e) => setVolumeLimit(e.target.value ? parseFloat(e.target.value) : null)} 
							className="w-full p-2 bg-gray-50 border border-gray-300 rounded" 
						/>
					</div>
				</div>

				{/* Volume Status */}
				{volumeLimit && (
					<div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
						<div className="flex items-center justify-between">
							<div>
								<div className="text-sm font-medium text-blue-900">Volume Durumu</div>
								<div className="text-xs text-blue-700">
									Mevcut: {currentVolume.toFixed(6)} SOL / Limit: {volumeLimit} SOL
								</div>
							</div>
							<div className="flex items-center">
								<div className="w-32 bg-gray-200 rounded-full h-2 mr-2">
									<div 
										className="bg-blue-600 h-2 rounded-full transition-all duration-300"
										style={{ width: `${Math.min(100, (currentVolume / volumeLimit) * 100)}%` }}
									></div>
								</div>
								<span className="text-xs text-blue-700">
									{((currentVolume / volumeLimit) * 100).toFixed(1)}%
								</span>
							</div>
						</div>
					</div>
				)}

				{selectedIds.length > 0 && (
					<div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
						<div className="text-sm text-blue-800">
							<span className="font-semibold">{selectedIds.length}</span> klasör seçili, 
							toplam <span className="font-semibold">{wallets.filter(w => selection.selectedFolderIds.has(w.folderId)).length}</span> wallet
						</div>
					</div>
				)}

				<div className="flex flex-wrap gap-2">
					<button 
						onClick={runInterFolderTransfers} 
						disabled={selectedIds.length < 2 || isLoading} 
						className="px-4 py-2 bg-gray-900 text-white rounded disabled:bg-gray-400 disabled:cursor-not-allowed"
					>
						{isLoading ? 'İşleniyor...' : '2.1 Klasörler Arası Transfer'}
					</button>
					<button 
						onClick={() => runTradeWithRelay('buy')} 
						disabled={selectedIds.length < 1 || isLoading} 
						className="px-4 py-2 border border-gray-300 rounded disabled:bg-gray-100 disabled:cursor-not-allowed"
					>
						{isLoading ? 'İşleniyor...' : '2.2 Al + Relay'}
					</button>
					<button 
						onClick={() => runTradeWithRelay('sell')} 
						disabled={selectedIds.length < 1 || isLoading} 
						className="px-4 py-2 border border-gray-300 rounded disabled:bg-gray-100 disabled:cursor-not-allowed"
					>
						{isLoading ? 'İşleniyor...' : '2.2 Sat + Relay'}
					</button>
				</div>
			</div>
		</div>
	);
};

export default VolumeControls;



