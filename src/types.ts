export type WalletId = string;
export type FolderId = string;
export type TokenMint = string;

export interface Wallet {
	id: WalletId;
	name: string;
	address: string;
	folderId: FolderId;
	privateKey: string; // Base64 encoded private key
}

export interface Folder {
	id: FolderId;
	name: string;
	// human friendly short uid for UI display
	shortUid: string;
}

export interface TransferTx {
	fromWalletId: WalletId;
	toWalletId: WalletId;
	amount: number;
	timestamp: number;
}

export type TradeSide = "buy" | "sell";

export interface TradeTx {
	folderId: FolderId;
	initiatorWalletId: WalletId;
	relayWalletId: WalletId; // random wallet receiving signature to mirror opposite trade
	token: TokenMint;
	amount: number;
	side: TradeSide;
	timestamp: number;
}

export interface VolumeMetricsPoint {
	timestamp: number;
	transferVolume: number;
	tradeVolume: number;
}

export interface AppStateSnapshot {
	folders: Folder[];
	wallets: Wallet[];
	transfers: TransferTx[];
	trades: TradeTx[];
}



