import React, { useMemo, useState } from 'react';
import { useWalletStore } from '../store/WalletStore';
import { FolderId } from '../types';

const FolderList: React.FC = () => {
	const { folders, wallets, selection, toggleFolderSelection, createFolder, renameFolder, deleteFolder } = useWalletStore();
	const [newFolderName, setNewFolderName] = useState('');
	const [editingId, setEditingId] = useState<FolderId | null>(null);
	const [editingName, setEditingName] = useState('');

	const walletsByFolder = useMemo(() => {
		const map: Record<string, typeof wallets> = {};
		for (const w of wallets) {
			if (!map[w.folderId]) map[w.folderId] = [];
			map[w.folderId].push(w);
		}
		return map;
	}, [wallets]);

	return (
		<div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
			<div className="p-4 border-b border-gray-200 flex items-center gap-3">
				<input
					value={newFolderName}
					onChange={(e) => setNewFolderName(e.target.value)}
					placeholder="Yeni klasör adı"
					className="flex-1 p-2 bg-gray-50 rounded border border-gray-300"
				/>
				<button
					onClick={() => {
						if (!newFolderName.trim()) return;
						createFolder(newFolderName.trim());
						setNewFolderName('');
					}}
					className="px-3 py-2 bg-gray-900 text-white rounded"
				>
					Klasör Ekle
				</button>
			</div>
			<div className="divide-y divide-gray-200">
				{folders.length === 0 && (
					<div className="p-6 text-gray-500 text-sm">Henüz klasör yok</div>
				)}
				{folders.map((f) => {
					const selected = selection.selectedFolderIds.has(f.id);
					const folderWallets = walletsByFolder[f.id] || [];
					return (
						<div key={f.id} className={`${selected ? 'bg-gray-50' : ''}`}>
							{/* Folder Header */}
							<div className="p-4 flex items-center justify-between">
								<div className="flex items-center gap-3 min-w-0">
									<input type="checkbox" checked={selected} onChange={() => toggleFolderSelection(f.id)} />
									<div className="min-w-0">
										{editingId === f.id ? (
											<input
												value={editingName}
												onChange={(e) => setEditingName(e.target.value)}
												className="p-1 border border-gray-300 rounded"
											/>
										) : (
											<div className="font-medium text-gray-900 truncate">{f.name}</div>
										)}
										<div className="text-xs text-gray-500 font-mono">{f.shortUid}</div>
									</div>
								</div>
								<div className="flex items-center gap-2">
									<span className="text-xs text-gray-500">{folderWallets.length} wallet</span>
									{editingId === f.id ? (
										<>
											<button
												onClick={() => {
													renameFolder(f.id, editingName.trim() || f.name);
													setEditingId(null);
												}}
												className="px-2 py-1 bg-green-600 text-white rounded text-xs"
											>
												Kaydet
											</button>
											<button
												onClick={() => setEditingId(null)}
												className="px-2 py-1 border border-gray-300 rounded text-xs"
											>
												İptal
											</button>
										</>
									) : (
										<>
											<button onClick={() => { setEditingId(f.id); setEditingName(f.name); }} className="px-2 py-1 border border-gray-300 rounded text-xs">Düzenle</button>
											<button onClick={() => deleteFolder(f.id)} className="px-2 py-1 bg-red-600 text-white rounded text-xs">Sil</button>
										</>
									)}
								</div>
							</div>
							
							{/* Wallets List */}
							{folderWallets.length > 0 && (
								<div className="px-4 pb-4 space-y-2">
									{folderWallets.map((wallet) => (
										<div key={wallet.id} className="flex items-center justify-between p-2 bg-white rounded border border-gray-200">
											<div className="min-w-0">
												<div className="font-medium text-sm text-gray-900 truncate">{wallet.name}</div>
												<div className="text-xs text-gray-500 font-mono truncate">{wallet.address}</div>
											</div>
											<div className="flex gap-1">
												<button className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">Düzenle</button>
												<button className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs">Sil</button>
											</div>
										</div>
									))}
								</div>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
};

export default FolderList;



