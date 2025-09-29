import React, { createContext, useContext, useMemo, useState, useEffect, useCallback } from 'react';
import { Folder, FolderId, Wallet, WalletId, TransferTx, TradeTx, AppStateSnapshot } from '../types';
import { generateUid, toShortUid } from '../utils/id';

interface SelectionState {
	selectedFolderIds: Set<FolderId>;
}

interface WalletStoreValue {
	folders: Folder[];
	wallets: Wallet[];
	transfers: TransferTx[];
	trades: TradeTx[];
	selection: SelectionState;

	createFolder(name: string): Folder;
	deleteFolder(id: FolderId): void;
	renameFolder(id: FolderId, name: string): void;
	toggleFolderSelection(id: FolderId): void;
	clearSelection(): void;

	addWallet(name: string, address: string, folderId: FolderId, privateKey: string): Wallet;
	moveWallet(walletId: WalletId, targetFolderId: FolderId): void;
	removeWallet(walletId: WalletId): void;

	addTransfer(tx: TransferTx): void;
	addTrade(tx: TradeTx): void;

	load(snapshot: AppStateSnapshot): void;
	migrateWallets(): void;
}

const WalletStoreContext = createContext<WalletStoreValue | undefined>(undefined);

const STORAGE_KEY = 'bundler-store-v1';

export const WalletStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	// Initialize state from localStorage immediately
	const getInitialState = () => {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (raw) {
				const parsed: AppStateSnapshot = JSON.parse(raw);
				return {
					folders: parsed.folders || [],
					wallets: parsed.wallets || [],
					transfers: parsed.transfers || [],
					trades: parsed.trades || []
				};
			}
		} catch (error) {
			console.error('Error loading initial state:', error);
		}
		return {
			folders: [],
			wallets: [],
			transfers: [],
			trades: []
		};
	};

	const initialState = getInitialState();
	const [folders, setFolders] = useState<Folder[]>(initialState.folders);
	const [wallets, setWallets] = useState<Wallet[]>(initialState.wallets);
	const [transfers, setTransfers] = useState<TransferTx[]>(initialState.transfers);
	const [trades, setTrades] = useState<TradeTx[]>(initialState.trades);
	const [selection, setSelection] = useState<SelectionState>({ selectedFolderIds: new Set() });

	// persist to localStorage
	useEffect(() => {
		const snapshot: AppStateSnapshot = { folders, wallets, transfers, trades };
		console.log('Saving to localStorage:', snapshot);
		localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
	}, [folders, wallets, transfers, trades]);

	const createFolder = useCallback((name: string): Folder => {
		const id = generateUid('fld');
		const folder: Folder = { id, name, shortUid: toShortUid(id, 4) };
		console.log('Creating folder:', folder);
		setFolders(prev => {
			const newFolders = [...prev, folder];
			console.log('New folders array:', newFolders);
			return newFolders;
		});
		return folder;
	}, []);

	const deleteFolder = useCallback((id: FolderId) => {
		setFolders(prev => prev.filter(f => f.id !== id));
		setWallets(prev => prev.filter(w => w.folderId !== id));
		setSelection(s => ({ selectedFolderIds: new Set(Array.from(s.selectedFolderIds).filter(fid => fid !== id)) }));
	}, []);

	const renameFolder = useCallback((id: FolderId, name: string) => {
		setFolders(prev => prev.map(f => (f.id === id ? { ...f, name } : f)));
	}, []);

	const toggleFolderSelection = useCallback((id: FolderId) => {
		setSelection(prev => {
			const next = new Set(prev.selectedFolderIds);
			if (next.has(id)) next.delete(id); else next.add(id);
			return { selectedFolderIds: next };
		});
	}, []);

	const clearSelection = useCallback(() => {
		setSelection({ selectedFolderIds: new Set() });
	}, []);

	const addWallet = useCallback((name: string, address: string, folderId: FolderId, privateKey: string): Wallet => {
		const wallet: Wallet = { id: generateUid('wlt'), name, address, folderId, privateKey };
		setWallets(prev => [...prev, wallet]);
		return wallet;
	}, []);

	const moveWallet = useCallback((walletId: WalletId, targetFolderId: FolderId) => {
		setWallets(prev => prev.map(w => (w.id === walletId ? { ...w, folderId: targetFolderId } : w)));
	}, []);

	const removeWallet = useCallback((walletId: WalletId) => {
		setWallets(prev => prev.filter(w => w.id !== walletId));
	}, []);

	const addTransfer = useCallback((tx: TransferTx) => setTransfers(prev => [...prev, tx]), []);
	const addTrade = useCallback((tx: TradeTx) => setTrades(prev => [...prev, tx]), []);

	const load = useCallback((snapshot: AppStateSnapshot) => {
		setFolders(snapshot.folders);
		setWallets(snapshot.wallets);
		setTransfers(snapshot.transfers);
		setTrades(snapshot.trades);
	}, []);

	// Migration function to clean up wallets without private keys
	const migrateWallets = useCallback(() => {
		const walletsWithPrivateKeys = wallets.filter(wallet => wallet.privateKey);
		if (walletsWithPrivateKeys.length !== wallets.length) {
			console.log(`Migrating wallets: ${wallets.length} -> ${walletsWithPrivateKeys.length}`);
			setWallets(walletsWithPrivateKeys);
		}
	}, [wallets]);

	const value = useMemo<WalletStoreValue>(() => ({
		folders,
		wallets,
		transfers,
		trades,
		selection,
		createFolder,
		deleteFolder,
		renameFolder,
		toggleFolderSelection,
		clearSelection,
		addWallet,
		moveWallet,
		removeWallet,
		addTransfer,
		addTrade,
		load,
		migrateWallets,
	}), [folders, wallets, transfers, trades, selection, createFolder, deleteFolder, renameFolder, toggleFolderSelection, clearSelection, addWallet, moveWallet, removeWallet, addTransfer, addTrade, load, migrateWallets]);

	return (
		<WalletStoreContext.Provider value={value}>{children}</WalletStoreContext.Provider>
	);
};

export function useWalletStore(): WalletStoreValue {
	const ctx = useContext(WalletStoreContext);
	if (!ctx) throw new Error('useWalletStore must be used within WalletStoreProvider');
	return ctx;
}


