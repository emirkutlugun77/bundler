import React, { useState, useMemo } from 'react';
import { useWalletStore } from '../store/WalletStore';
import { FolderId } from '../types';
import { Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL, Connection, Transaction, clusterApiUrl } from '@solana/web3.js';
import bs58 from 'bs58';

interface DistributeManagerProps {
	onDistribute: (wallets: Array<{ address: string; privateKey: string }>, amount: number) => Promise<void>;
	isLoading: boolean;
}

const DistributeManager: React.FC<DistributeManagerProps> = ({ onDistribute, isLoading }) => {
	const { folders, wallets, selection } = useWalletStore();
	const [distributionAmount, setDistributionAmount] = useState('0.01');
	const [selectedFolderIds, setSelectedFolderIds] = useState<Set<FolderId>>(new Set());

	// Get wallets from selected folders
	const selectedWallets = useMemo(() => {
		if (selectedFolderIds.size === 0) return wallets;
		return wallets.filter(wallet => selectedFolderIds.has(wallet.folderId));
	}, [wallets, selectedFolderIds]);

	const toggleFolderSelection = (folderId: FolderId) => {
		const newSelection = new Set(selectedFolderIds);
		if (newSelection.has(folderId)) {
			newSelection.delete(folderId);
		} else {
			newSelection.add(folderId);
		}
		setSelectedFolderIds(newSelection);
	};

	const selectAllFolders = () => {
		setSelectedFolderIds(new Set(folders.map(f => f.id)));
	};

	const clearSelection = () => {
		setSelectedFolderIds(new Set());
	};

	const distributeSOL = async () => {
		if (selectedWallets.length === 0) {
			alert('Lütfen en az bir klasör seçin');
			return;
		}

		const amount = parseFloat(distributionAmount);
		if (amount <= 0) {
			alert('Geçerli bir miktar girin');
			return;
		}

		// Generate keypairs for selected wallets (simulating wallet creation)
		const walletsToDistribute = selectedWallets.map(wallet => {
			const keypair = Keypair.generate();
			return {
				address: wallet.address,
				privateKey: Buffer.from(keypair.secretKey).toString('base64')
			};
		});

		try {
			await onDistribute(walletsToDistribute, amount);
		} catch (error) {
			console.error('Distribution error:', error);
			alert('Dağıtım hatası: ' + (error as Error).message);
		}
	};

	const totalDistribution = parseFloat(distributionAmount) * selectedWallets.length;

	return (
		<div className="max-w-4xl mx-auto space-y-6">
			{/* Folder Selection */}
			<div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
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
							const isSelected = selectedFolderIds.has(folder.id);
							
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

			{/* Distribution Settings */}
			<div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
				<h3 className="text-lg font-semibold mb-4 text-gray-900">Dağıtım Ayarları</h3>
				
				<div className="space-y-4">
					<div>
						<label className="block text-sm font-medium mb-2 text-gray-700">
							Her Wallet'a Gönderilecek SOL
						</label>
						<input
							type="number"
							step="0.001"
							value={distributionAmount}
							onChange={(e) => setDistributionAmount(e.target.value)}
							className="w-full p-3 bg-gray-50 rounded-lg text-gray-900 border border-gray-300 focus:border-gray-900 focus:outline-none transition-colors"
							placeholder="0.01"
						/>
					</div>

					{selectedWallets.length > 0 && (
						<div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
							<div className="grid grid-cols-2 gap-4 text-sm">
								<div className="flex justify-between">
									<span className="text-gray-600">Seçili Klasörler:</span>
									<span className="text-gray-900 font-semibold">{selectedFolderIds.size}</span>
								</div>
								<div className="flex justify-between">
									<span className="text-gray-600">Toplam Wallet:</span>
									<span className="text-gray-900 font-semibold">{selectedWallets.length}</span>
								</div>
								<div className="flex justify-between">
									<span className="text-gray-600">Wallet Başına:</span>
									<span className="text-gray-900 font-semibold">{distributionAmount} SOL</span>
								</div>
								<div className="flex justify-between">
									<span className="text-gray-600">Toplam Dağıtım:</span>
									<span className="text-gray-900 font-semibold">
										{totalDistribution.toFixed(6)} SOL
									</span>
								</div>
							</div>
						</div>
					)}

					<button
						onClick={distributeSOL}
						disabled={selectedWallets.length === 0 || parseFloat(distributionAmount) <= 0 || isLoading}
						className="w-full bg-gray-900 hover:bg-gray-800 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-medium transition-all disabled:cursor-not-allowed"
					>
						{isLoading 
							? 'Dağıtılıyor...' 
							: selectedWallets.length > 0 
								? `${selectedWallets.length} Wallet'a ${distributionAmount} SOL Dağıt`
								: 'Klasör Seçin'
						}
					</button>
				</div>
			</div>

			{/* Selected Wallets Preview */}
			{selectedWallets.length > 0 && (
				<div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
					<h3 className="text-lg font-semibold mb-4 text-gray-900">
						Seçili Walletlar ({selectedWallets.length})
					</h3>
					<div className="max-h-60 overflow-y-auto space-y-2">
						{selectedWallets.map((wallet) => (
							<div key={wallet.id} className="flex items-center justify-between p-2 bg-gray-50 rounded border">
								<div className="min-w-0">
									<div className="font-medium text-sm text-gray-900 truncate">
										{wallet.name}
									</div>
									<div className="text-xs text-gray-500 font-mono truncate">
										{wallet.address}
									</div>
								</div>
								<div className="text-xs text-gray-500">
									{folders.find(f => f.id === wallet.folderId)?.name}
								</div>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
};

export default DistributeManager;
