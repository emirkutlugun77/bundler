import React, { useState, useMemo } from 'react';
import { useWalletStore } from '../store/WalletStore';
import { FolderId } from '../types';

interface CollectManagerProps {
	onCollect: (wallets: Array<{ address: string; privateKey: string }>) => Promise<void>;
	isLoading: boolean;
}

const CollectManager: React.FC<CollectManagerProps> = ({ onCollect, isLoading }) => {
	const { folders, wallets, migrateWallets } = useWalletStore();
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

	const collectSOL = async () => {
		if (selectedWallets.length === 0) {
			alert('Lütfen en az bir klasör seçin');
			return;
		}

		// Filter wallets that have private keys
		const walletsWithPrivateKeys = selectedWallets.filter(wallet => wallet.privateKey);
		const walletsWithoutPrivateKeys = selectedWallets.filter(wallet => !wallet.privateKey);

		if (walletsWithoutPrivateKeys.length > 0) {
			alert(`${walletsWithoutPrivateKeys.length} wallet'ta private key bulunamadı. Bu walletlar atlanacak.`);
		}

		if (walletsWithPrivateKeys.length === 0) {
			alert('Toplanacak geçerli wallet bulunamadı!');
			return;
		}

		// Convert to the format expected by the collect function
		const walletsToCollect = walletsWithPrivateKeys.map(wallet => ({
			address: wallet.address,
			privateKey: wallet.privateKey
		}));

		try {
			await onCollect(walletsToCollect);
		} catch (error) {
			console.error('Collection error:', error);
			alert('Toplama hatası: ' + (error as Error).message);
		}
	};

	return (
		<div className="max-w-4xl mx-auto space-y-6">
			{/* Folder Selection */}
			<div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
				<div className="flex items-center justify-between mb-4">
					<h3 className="text-lg font-semibold text-gray-900">Klasör Seçimi</h3>
					<div className="flex gap-2">
						<button
							onClick={migrateWallets}
							className="px-3 py-1 bg-yellow-600 text-white rounded text-sm"
							title="Private key'i olmayan eski walletları temizle"
						>
							Eski Walletları Temizle
						</button>
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

			{/* Collection Info */}
			{selectedWallets.length > 0 && (
				<div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
					<h3 className="text-lg font-semibold mb-4 text-gray-900">Toplama Bilgileri</h3>
					
					<div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
						<div className="grid grid-cols-2 gap-4 text-sm">
							<div className="flex justify-between">
								<span className="text-gray-600">Seçili Klasörler:</span>
								<span className="text-gray-900 font-semibold">{selectedFolderIds.size}</span>
							</div>
							<div className="flex justify-between">
								<span className="text-gray-600">Toplanacak Wallet:</span>
								<span className="text-gray-900 font-semibold">{selectedWallets.length}</span>
							</div>
						</div>
					</div>

					<div className="mt-4">
						<div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
							<div className="flex items-start space-x-3">
								<div className="w-6 h-6 bg-yellow-200 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
									<span className="text-sm text-yellow-600">ℹ</span>
								</div>
								<div>
									<h3 className="text-yellow-900 font-semibold mb-2">Nasıl Çalışır?</h3>
									<p className="text-yellow-800 text-sm mb-2">
										Seçili klasörlerdeki wallet'lardaki SOL'ları ana wallet'ınıza toplar.
									</p>
									<p className="text-yellow-700 text-xs">
										Transaction fee için her wallet'ta küçük bir miktar bırakılır.
									</p>
								</div>
							</div>
						</div>
					</div>

					<button
						onClick={collectSOL}
						disabled={selectedWallets.length === 0 || isLoading}
						className="w-full mt-6 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-medium transition-all disabled:cursor-not-allowed"
					>
						{isLoading 
							? 'Toplanıyor...' 
							: `${selectedWallets.length} Wallet'tan SOL Topla`
						}
					</button>
				</div>
			)}

			{/* Selected Wallets Preview */}
			{selectedWallets.length > 0 && (
				<div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
					<h3 className="text-lg font-semibold mb-4 text-gray-900">
						Seçili Walletlar ({selectedWallets.length})
					</h3>
					<div className="max-h-60 overflow-y-auto space-y-2">
						{selectedWallets.map((wallet) => (
							<div key={wallet.id} className={`flex items-center justify-between p-2 rounded border ${
								wallet.privateKey ? 'bg-gray-50' : 'bg-red-50 border-red-200'
							}`}>
								<div className="min-w-0">
									<div className="font-medium text-sm text-gray-900 truncate">
										{wallet.name}
									</div>
									<div className="text-xs text-gray-500 font-mono truncate">
										{wallet.address}
									</div>
									{!wallet.privateKey && (
										<div className="text-xs text-red-600 font-medium">
											⚠️ Private key yok
										</div>
									)}
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

export default CollectManager;
