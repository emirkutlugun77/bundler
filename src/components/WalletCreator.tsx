import React, { useState, useEffect } from 'react';
import { useWalletStore } from '../store/WalletStore';
import { FolderId } from '../types';
import { Keypair, PublicKey } from '@solana/web3.js';

const WalletCreator: React.FC = () => {
	const { folders, addWallet, wallets, migrateWallets } = useWalletStore();
	const [selectedFolderId, setSelectedFolderId] = useState<FolderId>('');
	const [walletCount, setWalletCount] = useState(5);
	const [walletPrefix, setWalletPrefix] = useState('Wallet');

	const createWallets = () => {
		if (!selectedFolderId) {
			alert('Lütfen bir klasör seçin');
			return;
		}

		const selectedFolder = folders.find(f => f.id === selectedFolderId);
		if (!selectedFolder) {
			alert('Seçilen klasör bulunamadı');
			return;
		}

		for (let i = 0; i < walletCount; i++) {
			const keypair = Keypair.generate();
			const walletName = `${walletPrefix} ${i + 1}`;
			const walletAddress = keypair.publicKey.toString();
			const privateKey = Buffer.from(keypair.secretKey).toString('base64');
			
			addWallet(walletName, walletAddress, selectedFolderId, privateKey);
		}

		alert(`${walletCount} wallet "${selectedFolder.name}" klasörüne eklendi!`);
		setWalletCount(5);
		setWalletPrefix('Wallet');
	};

	const existingWalletsInFolder = wallets.filter(w => w.folderId === selectedFolderId).length;

	const refreshOldWallets = () => {
		const walletsWithoutPrivateKeys = wallets.filter(w => !w.privateKey);
		if (walletsWithoutPrivateKeys.length === 0) {
			alert('Tüm walletlar zaten private key\'e sahip!');
			return;
		}

		if (!window.confirm(`${walletsWithoutPrivateKeys.length} wallet'ın private key'i yok. Bu walletları yenilemek istediğinizden emin misiniz? (Eski walletlar silinecek, yenileri oluşturulacak)`)) {
			return;
		}

		// Group wallets by folder
		const walletsByFolder = walletsWithoutPrivateKeys.reduce((acc, wallet) => {
			if (!acc[wallet.folderId]) acc[wallet.folderId] = [];
			acc[wallet.folderId].push(wallet);
			return acc;
		}, {} as Record<string, typeof walletsWithoutPrivateKeys>);

		let totalCreated = 0;
		for (const [folderId, folderWallets] of Object.entries(walletsByFolder)) {
			for (let i = 0; i < folderWallets.length; i++) {
				const keypair = Keypair.generate();
				const walletName = folderWallets[i].name;
				const walletAddress = keypair.publicKey.toString();
				const privateKey = Buffer.from(keypair.secretKey).toString('base64');
				
				addWallet(walletName, walletAddress, folderId, privateKey);
				totalCreated++;
			}
		}

		// Remove old wallets without private keys
		migrateWallets();
		
		alert(`${totalCreated} wallet yenilendi ve private key'leri eklendi!`);
	};

	return (
		<div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
			<h3 className="text-xl font-semibold mb-4 text-gray-900">
				Toplu Wallet Oluşturma
			</h3>
			
			<div className="space-y-4">
				{/* Folder Selection */}
				<div>
					<label className="block text-sm font-medium mb-2 text-gray-700">Klasör Seç</label>
					<select
						value={selectedFolderId}
						onChange={(e) => setSelectedFolderId(e.target.value)}
						className="w-full p-3 bg-gray-50 rounded-lg text-gray-900 border border-gray-300 focus:border-gray-900 focus:outline-none transition-colors"
					>
						<option value="">Klasör seçin...</option>
						{folders.map((folder) => (
							<option key={folder.id} value={folder.id}>
								{folder.name} ({folder.shortUid}) - {wallets.filter(w => w.folderId === folder.id).length} wallet
							</option>
						))}
					</select>
				</div>

				{/* Wallet Count */}
				<div>
					<label className="block text-sm font-medium mb-2 text-gray-700">Wallet Sayısı</label>
					<input
						type="number"
						min="1"
						max="50"
						value={walletCount}
						onChange={(e) => setWalletCount(parseInt(e.target.value) || 1)}
						className="w-full p-3 bg-gray-50 rounded-lg text-gray-900 border border-gray-300 focus:border-gray-900 focus:outline-none transition-colors"
					/>
				</div>

				{/* Wallet Prefix */}
				<div>
					<label className="block text-sm font-medium mb-2 text-gray-700">Wallet Adı Öneki</label>
					<input
						type="text"
						value={walletPrefix}
						onChange={(e) => setWalletPrefix(e.target.value)}
						placeholder="Wallet"
						className="w-full p-3 bg-gray-50 rounded-lg text-gray-900 border border-gray-300 focus:border-gray-900 focus:outline-none transition-colors"
					/>
				</div>

				{/* Info */}
				{selectedFolderId && (
					<div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
						<div className="flex justify-between items-center text-sm">
							<span className="text-blue-700">Seçili klasör:</span>
							<span className="text-blue-900 font-semibold">
								{folders.find(f => f.id === selectedFolderId)?.name}
							</span>
						</div>
						<div className="flex justify-between items-center text-sm mt-1">
							<span className="text-blue-700">Mevcut wallet sayısı:</span>
							<span className="text-blue-900 font-semibold">{existingWalletsInFolder}</span>
						</div>
						<div className="flex justify-between items-center text-sm mt-1">
							<span className="text-blue-700">Eklenecek wallet sayısı:</span>
							<span className="text-blue-900 font-semibold">{walletCount}</span>
						</div>
					</div>
				)}

				{/* Create Button */}
				<button
					onClick={createWallets}
					disabled={!selectedFolderId}
					className="w-full bg-gray-900 hover:bg-gray-800 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-medium transition-all disabled:cursor-not-allowed"
				>
					{walletCount} Wallet Oluştur
				</button>

				{/* Refresh Old Wallets Button */}
				{wallets.some(w => !w.privateKey) && (
					<div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
						<div className="flex items-center justify-between">
							<div>
								<h4 className="text-sm font-semibold text-yellow-800">Eski Walletlar Tespit Edildi</h4>
								<p className="text-xs text-yellow-700 mt-1">
									{wallets.filter(w => !w.privateKey).length} wallet'ın private key'i yok
								</p>
							</div>
							<button
								onClick={refreshOldWallets}
								className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded text-sm font-medium"
							>
								Eski Walletları Yenile
							</button>
						</div>
					</div>
				)}
			</div>
		</div>
	);
};

export default WalletCreator;
