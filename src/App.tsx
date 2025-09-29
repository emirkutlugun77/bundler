import React, { useState, useEffect } from 'react';
import { WalletStoreProvider } from './store/WalletStore';
import FolderList from './components/FolderList';
import WalletCreator from './components/WalletCreator';
import DistributeManager from './components/DistributeManager';
import CollectManager from './components/CollectManager';
import VolumeControls from './components/VolumeControls';
import VolumeCharts from './components/VolumeCharts';
import TransactionList from './components/TransactionList';
import { 
  Connection, 
  Keypair, 
  LAMPORTS_PER_SOL, 
  PublicKey, 
  SystemProgram, 
  Transaction,
  clusterApiUrl
} from '@solana/web3.js';
import bs58 from 'bs58';

// Phantom Wallet Types
interface PhantomWallet {
  isPhantom: boolean;
  publicKey: PublicKey | null;
  isConnected: boolean;
  connect(): Promise<{ publicKey: PublicKey }>;
  disconnect(): Promise<void>;
  signTransaction(transaction: Transaction): Promise<Transaction>;
  signAllTransactions(transactions: Transaction[]): Promise<Transaction[]>;
}

declare global {
  interface Window {
    solana?: PhantomWallet;
  }
}

// Wallet Storage
interface StoredWallet {
  publicKey: string;
  privateKey: string;
  balance: number;
}

const WalletStorage = {
  save: (wallets: StoredWallet[]) => {
    localStorage.setItem('solana-wallets', JSON.stringify(wallets));
  },
  load: (): StoredWallet[] => {
    const stored = localStorage.getItem('solana-wallets');
    return stored ? JSON.parse(stored) : [];
  },
  clear: () => {
    localStorage.removeItem('solana-wallets');
  }
};

function App() {
  const [phantom, setPhantom] = useState<PhantomWallet | null>(null);
  const [phantomPublicKey, setPhantomPublicKey] = useState<PublicKey | null>(null);
  const [wallets, setWallets] = useState<StoredWallet[]>([]);
  const [numberOfWallets, setNumberOfWallets] = useState(5);
  const [distributionAmount, setDistributionAmount] = useState('0.01');
  const [targetAddress, setTargetAddress] = useState('');
  const [transferAmount, setTransferAmount] = useState('0.005');
  const [hardcodedPrivateKey] = useState('59KqkXuAKaKU3f7hZGUhAvemp4X6L7CyfG9zUDRAemfBNc5urCtjwKteT1WzJi8AWvxS2DE8U942wqQdqiajWUPA');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('connect');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [connection] = useState(new Connection(clusterApiUrl('devnet'), 'confirmed'));
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [pendingAction, setPendingAction] = useState<null | (() => Promise<void>)>(null);

  // Phantom wallet'ı kontrol et
  useEffect(() => {
    const checkPhantom = () => {
      if (window.solana && window.solana.isPhantom) {
        setPhantom(window.solana);
        
        // Eğer zaten bağlıysa
        if (window.solana.isConnected && window.solana.publicKey) {
          setPhantomPublicKey(window.solana.publicKey);
        }
      } else {
        console.log('Phantom wallet bulunamadı!');
      }
    };

    // Sayfa yüklendiğinde kontrol et
    if (window.solana) {
      checkPhantom();
    } else {
      // Phantom yüklenmesini bekle
      const interval = setInterval(() => {
        if (window.solana) {
          checkPhantom();
          clearInterval(interval);
        }
      }, 100);
      
      // 5 saniye sonra vazgeç
      setTimeout(() => clearInterval(interval), 5000);
    }
  }, []);

  // Load wallets on mount
  useEffect(() => {
    const savedWallets = WalletStorage.load();
    setWallets(savedWallets);
    updateBalances(savedWallets);
  }, []);

  // Phantom wallet bağlantısı
  const connectPhantom = async () => {
    if (!phantom) {
      alert('Phantom Wallet yüklü değil! Lütfen phantom.app\'dan indirin.');
      window.open('https://phantom.app', '_blank');
      return;
    }

    try {
      const response = await phantom.connect();
      setPhantomPublicKey(response.publicKey);
      alert('Phantom Wallet başarıyla bağlandı!');
    } catch (error) {
      console.error('Phantom bağlantı hatası:', error);
      alert('Phantom bağlantısı başarısız!');
    }
  };

  // Phantom wallet bağlantısını kes
  const disconnectPhantom = async () => {
    if (phantom) {
      try {
        await phantom.disconnect();
        setPhantomPublicKey(null);
        alert('Phantom Wallet bağlantısı kesildi!');
      } catch (error) {
        console.error('Phantom bağlantı kesme hatası:', error);
      }
    }
  };

  // Update wallet balances
  const updateBalances = async (walletsToUpdate: StoredWallet[]) => {
    const updatedWallets = await Promise.all(
      walletsToUpdate.map(async (wallet) => {
        try {
          const balance = await connection.getBalance(new PublicKey(wallet.publicKey));
          return { ...wallet, balance: balance / LAMPORTS_PER_SOL };
        } catch (error) {
          return { ...wallet, balance: 0 };
        }
      })
    );
    setWallets(updatedWallets);
    WalletStorage.save(updatedWallets);
  };

  // 1) Wallet oluşturma
  const createWallets = async () => {
    if (!getHardcodedKeypair()) {
      alert('Geçerli bir private key gerekli.');
      return;
    }

    setIsLoading(true);
    try {
      const newWallets: StoredWallet[] = [];
      
      for (let i = 0; i < numberOfWallets; i++) {
        const keypair = Keypair.generate();
        newWallets.push({
          publicKey: keypair.publicKey.toString(),
          privateKey: Buffer.from(keypair.secretKey).toString('base64'),
          balance: 0
        });
      }

      // Para dağıtma
      if (parseFloat(distributionAmount) > 0) {
        const walletsToDistribute = newWallets.map(wallet => ({
          address: wallet.publicKey,
          privateKey: wallet.privateKey
        }));
        await distributeSOL(walletsToDistribute, parseFloat(distributionAmount));
      }

      const allWallets = [...wallets, ...newWallets];
      setWallets(allWallets);
      WalletStorage.save(allWallets);
      
      alert(`${numberOfWallets} wallet oluşturuldu!`);
    } catch (error) {
      console.error('Wallet oluşturma hatası:', error);
      alert('Wallet oluşturma başarısız: ' + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  // Private key'den keypair oluştur (hardcoded)
  const getHardcodedKeypair = (): Keypair | null => {
    try {
      // Base58 formatında decode et
      const secretKey = bs58.decode(hardcodedPrivateKey);
      return Keypair.fromSecretKey(secretKey);
    } catch (error) {
      console.error('Hardcoded private key error:', error);
      try {
        // Base64 formatı da dene
        const secretKey = Buffer.from(hardcodedPrivateKey, 'base64');
        return Keypair.fromSecretKey(secretKey);
      } catch (error2) {
        console.error('Base64 decode also failed:', error2);
        return null;
      }
    }
  };

  // Para dağıtma fonksiyonu
  const distributeSOL = async (targetWallets: Array<{ address: string; privateKey: string }>, amount: number) => {
    // Sadece gömülü private key ile gönder
    let fromKeypair: Keypair | null = getHardcodedKeypair();
    if (!fromKeypair) {
      alert('Private key mevcut değil veya geçersiz.');
      return;
    }

    if (amount <= 0) return;

    setIsLoading(true);
    let successCount = 0;
    
    try {
      for (const wallet of targetWallets) {
        try {
          const fromPubkey = fromKeypair!.publicKey;
          
          const transaction = new Transaction().add(
            SystemProgram.transfer({
              fromPubkey: fromPubkey,
              toPubkey: new PublicKey(wallet.address),
              lamports: amount * LAMPORTS_PER_SOL,
            })
          );

          const { blockhash } = await connection.getLatestBlockhash();
          transaction.recentBlockhash = blockhash;
          transaction.feePayer = fromPubkey;

          let signature: string;
          
          // Private key ile imzala
          signature = await connection.sendTransaction(transaction, [fromKeypair!]);
          
          // Transaction'ı confirm et ve bekle
          const confirmation = await connection.confirmTransaction(signature, 'confirmed');
          if (confirmation.value.err) {
            throw new Error('Transaction failed');
          }
          
          successCount++;
          console.log(`${amount} SOL gönderildi: ${wallet.address}`);
        } catch (error) {
          console.error(`Transfer hatası ${wallet.address}:`, error);
        }
      }

      alert(`${successCount}/${targetWallets.length} transfer başarılı!`);
    } finally {
      setIsLoading(false);
    }
  };

  // 2) Mevcut wallet'lara para dağıtma
  const redistributeToWallets = async () => {
    if (wallets.length === 0) {
      alert('Önce wallet oluşturun!');
      return;
    }

    const walletsToDistribute = wallets.map(wallet => ({
      address: wallet.publicKey,
      privateKey: wallet.privateKey
    }));

    const amount = parseFloat(distributionAmount);
    await distributeSOL(walletsToDistribute, amount);
  };

  // 3) Walletlardan belirli adrese para yollama
  const sendToAddress = async () => {
    if (!targetAddress || wallets.length === 0) {
      alert('Hedef adres ve wallet\'lar gerekli!');
      return;
    }

    const run = async () => {
      setIsLoading(true);
      try {
        const amount = parseFloat(transferAmount);
        let successCount = 0;

        for (const wallet of wallets) {
          try {
            const privateKeyBuffer = Buffer.from(wallet.privateKey, 'base64');
            const keypair = Keypair.fromSecretKey(privateKeyBuffer);

            // Balance check and fee buffer
            const balanceLamports = await connection.getBalance(keypair.publicKey);
            const desiredLamports = Math.floor(amount * LAMPORTS_PER_SOL);
            const feeBufferLamports = 5000; // leave a small buffer for fees
            const maxSendLamports = Math.max(0, balanceLamports - feeBufferLamports);
            const lamportsToSend = Math.min(desiredLamports, maxSendLamports);

            if (lamportsToSend <= 0) {
              console.warn(`Yetersiz bakiye, atlanıyor: ${wallet.publicKey}`);
              continue;
            }

            const transaction = new Transaction().add(
              SystemProgram.transfer({
                fromPubkey: keypair.publicKey,
                toPubkey: new PublicKey(targetAddress),
                lamports: lamportsToSend,
              })
            );

            const { blockhash } = await connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = keypair.publicKey;

            const signature = await connection.sendTransaction(transaction, [keypair]);
            await connection.confirmTransaction(signature);
            
            successCount++;
            console.log(`Transfer başarılı: ${wallet.publicKey} -> ${targetAddress}`);
          } catch (error) {
            console.error(`Transfer hatası ${wallet.publicKey}:`, error);
          }
        }

        alert(`${successCount}/${wallets.length} transfer başarılı!`);
        updateBalances(wallets);
      } catch (error) {
        alert('Transfer işlemi başarısız: ' + (error as Error).message);
      } finally {
        setIsLoading(false);
      }
    };

    setConfirmMessage(`${wallets.length} wallet'tan ${transferAmount} SOL, ${targetAddress} adresine gönderilsin mi?`);
    setPendingAction(() => run);
    setConfirmOpen(true);
  };

  // Volume transaction handler
  const handleVolumeTransaction = async (transactions: Array<{
    fromWallet: { address: string; privateKey: string };
    toWallet: { address: string; privateKey: string };
    amount: number;
    type: 'transfer' | 'buy' | 'sell';
  }>): Promise<boolean[]> => {
    setIsLoading(true);
    let successCount = 0;
    const results: boolean[] = [];

    try {
      for (const tx of transactions) {
        try {
          const fromKeypair = Keypair.fromSecretKey(Buffer.from(tx.fromWallet.privateKey, 'base64'));
          const toPublicKey = new PublicKey(tx.toWallet.address);

          let transaction: Transaction;

          if (tx.type === 'transfer') {
            // SOL transfer
            transaction = new Transaction().add(
              SystemProgram.transfer({
                fromPubkey: fromKeypair.publicKey,
                toPubkey: toPublicKey,
                lamports: tx.amount * LAMPORTS_PER_SOL,
              })
            );
          } else {
            // For buy/sell, we'll do SOL transfers for now
            // In real implementation, you'd integrate with DEX
            transaction = new Transaction().add(
              SystemProgram.transfer({
                fromPubkey: fromKeypair.publicKey,
                toPubkey: toPublicKey,
                lamports: tx.amount * LAMPORTS_PER_SOL,
              })
            );
          }

          const { blockhash } = await connection.getLatestBlockhash();
          transaction.recentBlockhash = blockhash;
          transaction.feePayer = fromKeypair.publicKey;

          const signature = await connection.sendTransaction(transaction, [fromKeypair]);
          const confirmation = await connection.confirmTransaction(signature, 'confirmed');
          
          if (confirmation.value.err) {
            throw new Error('Transaction failed');
          }

          successCount++;
          results.push(true);
          // Emit event so UI can record immediately
          const event = new CustomEvent('volume-tx-confirmed', {
            detail: {
              fromWallet: { address: tx.fromWallet.address },
              toWallet: { address: tx.toWallet.address },
              amount: tx.amount,
              type: tx.type
            }
          });
          window.dispatchEvent(event);
          console.log(`${tx.type} işlemi başarılı: ${tx.fromWallet.address} -> ${tx.toWallet.address}`);
        } catch (error) {
          console.error(`Volume transaction error:`, error);
          results.push(false);
        }
      }

      alert(`${successCount}/${transactions.length} volume işlemi başarılı!`);
    } catch (error) {
      alert('Volume işlemi hatası: ' + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
    return results;
  };

  // 4) Walletlardaki SOL'ları toplama
  const collectSOL = async (targetWallets: Array<{ address: string; privateKey: string }>) => {
    const hardcodedKeypair = getHardcodedKeypair();
    if (!hardcodedKeypair) {
      alert('Private key gerekli!');
      return;
    }
    
    if (targetWallets.length === 0) {
      alert('Toplanacak wallet bulunamadı!');
      return;
    }

    const targetPubkey = hardcodedKeypair!.publicKey;

    setIsLoading(true);
    try {
      let successCount = 0;

      for (const wallet of targetWallets) {
        try {
          // Check if private key exists
          if (!wallet.privateKey) {
            console.log(`Private key bulunamadı: ${wallet.address} - atlanıyor`);
            continue;
          }

          // Use the actual private key from the wallet
          const privateKeyBuffer = Buffer.from(wallet.privateKey, 'base64');
          const keypair = Keypair.fromSecretKey(privateKeyBuffer);

          // Get current balance
          const balance = await connection.getBalance(keypair.publicKey);
          const transferAmount = balance - 5000; // Leave some for fees

          if (transferAmount > 0) {
            const transaction = new Transaction().add(
              SystemProgram.transfer({
                fromPubkey: keypair.publicKey,
                toPubkey: targetPubkey,
                lamports: transferAmount,
              })
            );

            const { blockhash } = await connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = keypair.publicKey;

            const signature = await connection.sendTransaction(transaction, [keypair]);
            const confirmation = await connection.confirmTransaction(signature, 'confirmed');
            if (confirmation.value.err) {
              throw new Error('Transaction failed');
            }
            
            successCount++;
            console.log(`SOL toplandı: ${wallet.address} -> Ana wallet (${transferAmount / LAMPORTS_PER_SOL} SOL)`);
          } else {
            console.log(`Yetersiz bakiye: ${wallet.address}`);
          }
        } catch (error) {
          console.error(`Toplama hatası ${wallet.address}:`, error);
        }
      }

      alert(`${successCount}/${targetWallets.length} wallet'tan SOL toplandı!`);
    } catch (error) {
      alert('SOL toplama işlemi başarısız: ' + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  // 5) Wallet'ları temizle
  const clearWallets = () => {
    if (window.confirm('Tüm wallet\'ları silmek istediğinizden emin misiniz?')) {
      setWallets([]);
      WalletStorage.clear();
      alert('Tüm wallet\'lar silindi!');
    }
  };

  // Individual wallet management
  const deleteWallet = (publicKey: string) => {
    if (window.confirm('Bu wallet\'ı silmek istediğinizden emin misiniz?')) {
      const updatedWallets = wallets.filter(w => w.publicKey !== publicKey);
      setWallets(updatedWallets);
      WalletStorage.save(updatedWallets);
    }
  };

  const exportWallet = (wallet: StoredWallet) => {
    const walletData = {
      publicKey: wallet.publicKey,
      privateKey: wallet.privateKey,
      balance: wallet.balance
    };
    
    const dataStr = JSON.stringify(walletData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `wallet-${wallet.publicKey.slice(0, 8)}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Kopyalandı!');
  };

  // Per-wallet send using global targetAddress and transferAmount with confirmation
  const sendFromSingleWallet = async (wallet: StoredWallet) => {
    if (!targetAddress) {
      alert('Hedef adres gerekli');
      return;
    }

    const amount = parseFloat(transferAmount);
    if (!amount || amount <= 0) {
      alert('Geçerli bir miktar girin');
      return;
    }

    const run = async () => {
      try {
        setIsLoading(true);
        const privateKeyBuffer = Buffer.from(wallet.privateKey, 'base64');
        const keypair = Keypair.fromSecretKey(privateKeyBuffer);

        // Balance check and fee buffer
        const balanceLamports = await connection.getBalance(keypair.publicKey);
        const desiredLamports = Math.floor(amount * LAMPORTS_PER_SOL);
        const feeBufferLamports = 5000; // leave small buffer for fees
        const maxSendLamports = Math.max(0, balanceLamports - feeBufferLamports);
        const lamportsToSend = Math.min(desiredLamports, maxSendLamports);

        if (lamportsToSend <= 0) {
          alert('Yetersiz bakiye.');
          return;
        }

        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: keypair.publicKey,
            toPubkey: new PublicKey(targetAddress),
            lamports: lamportsToSend,
          })
        );

        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = keypair.publicKey;

        const signature = await connection.sendTransaction(transaction, [keypair]);
        await connection.confirmTransaction(signature);
        updateBalances(wallets);
      } catch (error) {
        alert('Transfer hatası: ' + (error as Error).message);
      } finally {
        setIsLoading(false);
      }
    };

    setConfirmMessage(`${wallet.publicKey.slice(0,8)}... cüzdanından ${transferAmount} SOL, ${targetAddress} adresine gönderilsin mi?`);
    setPendingAction(() => run);
    setConfirmOpen(true);
  };

  const tabs = [
    { id: 'connect', label: 'Phantom Bağlantı' },
    { id: 'wallets', label: 'Wallet Yönetimi' },
    { id: 'folders', label: 'Klasörler' },
    { id: 'volume', label: 'Volume' },
    { id: 'distribute', label: 'Para Dağıtma' },
    { id: 'transfers', label: 'Transfer İşlemleri' },
    { id: 'collect', label: 'Para Toplama' }
  ];

  return (
    <WalletStoreProvider>
    <div className="min-h-screen bg-white text-gray-900 flex">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-16'} transition-all duration-300 bg-gray-900 border-r border-gray-700 flex flex-col`}>
        {/* Logo */}
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
              <span className="text-gray-900 font-bold text-sm">SB</span>
            </div>
            {sidebarOpen && (
              <div>
                <h1 className="text-lg font-bold text-white">
                  Solana Bundler
                </h1>
                <p className="text-xs text-gray-400">Wallet Manager</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
            >
              {sidebarOpen && <span className="text-sm">{tab.label}</span>}
            </button>
          ))}
        </nav>

        {/* Wallet Status */}
        {sidebarOpen && (
          <div className="p-4 border-t border-gray-700">
            <div className="bg-gray-800 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400">Wallets</span>
                <span className="text-xs font-bold text-white">{wallets.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Total SOL</span>
                <span className="text-xs font-bold text-white">
                  {wallets.reduce((sum, w) => sum + w.balance, 0).toFixed(4)}
                </span>
              </div>
              {phantomPublicKey && (
                <div className="mt-2 pt-2 border-t border-gray-600">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-xs text-green-400">Phantom Connected</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Toggle Button */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-4 border-t border-gray-700 text-gray-400 hover:text-white transition-colors"
        >
          <div className="flex items-center justify-center">
            <span className="text-lg">{sidebarOpen ? '◀' : '▶'}</span>
          </div>
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-gray-50 border-b border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {tabs.find(tab => tab.id === activeTab)?.label}
              </h1>
              <p className="text-gray-600 text-sm mt-1">
                {activeTab === 'connect' && 'Phantom Wallet bağlantısını yönetin'}
                {activeTab === 'wallets' && 'Wallet\'larınızı oluşturun ve yönetin'}
                {activeTab === 'folders' && 'Klasör sistemini yönetin ve UID\'leri görün'}
                {activeTab === 'volume' && 'Klasör seçin, volume fonksiyonlarını çalıştırın ve görselleştirin'}
                {activeTab === 'distribute' && 'Mevcut wallet\'lara SOL dağıtın'}
                {activeTab === 'transfers' && 'Wallet\'lardan belirli adrese transfer yapın'}
                {activeTab === 'collect' && 'Tüm wallet\'lardaki SOL\'ları toplayın'}
              </p>
            </div>
            
            {phantomPublicKey && (
              <div className="bg-gray-100 rounded-lg p-3 border border-gray-200">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-green-600">Phantom Connected</span>
                </div>
                <p className="text-xs text-gray-500 mt-1 font-mono">
                  {phantomPublicKey.toString().slice(0, 8)}...{phantomPublicKey.toString().slice(-8)}
                </p>
              </div>
            )}
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 p-6 overflow-auto relative">
          <div className="max-w-6xl mx-auto">
            {activeTab === 'connect' && (
              <div className="max-w-2xl mx-auto">
                <div className="bg-white rounded-lg border border-gray-200 p-8 shadow-sm">
                  <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold mb-2 text-gray-900">Phantom Wallet</h2>
                    <p className="text-gray-600">Solana blockchain ile etkileşim kurmak için Phantom Wallet'a bağlanın</p>
                  </div>
                  
                  <div className="space-y-6">
                    {!phantom ? (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                        <h3 className="text-lg font-semibold text-red-600 mb-2">Phantom Wallet Bulunamadı</h3>
                        <p className="text-gray-600 text-sm mb-6">
                          Phantom Wallet browser extension'ını yüklemeniz gerekiyor.
                        </p>
                        <button
                          onClick={() => window.open('https://phantom.app', '_blank')}
                          className="bg-gray-900 hover:bg-gray-800 text-white px-6 py-3 rounded-lg font-medium transition-all"
                        >
                          Phantom'u İndir
                        </button>
                      </div>
                    ) : !phantomPublicKey ? (
                      <div className="text-center space-y-6">
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">Phantom Wallet Hazır!</h3>
                          <p className="text-gray-600 text-sm">
                            Bağlanmak için aşağıdaki butona tıklayın.
                          </p>
                        </div>
                        
                        <button
                          onClick={connectPhantom}
                          className="bg-gray-900 hover:bg-gray-800 text-white px-8 py-4 rounded-lg font-medium w-full transition-all shadow-sm"
                        >
                          Phantom Wallet'a Bağlan
                        </button>
                      </div>
                    ) : (
                      <div className="text-center space-y-6">
                        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                          <h3 className="text-lg font-semibold text-green-600 mb-2">Phantom Wallet Bağlı!</h3>
                          <div className="bg-gray-100 rounded-lg p-3 mt-4">
                            <p className="text-xs text-gray-500 mb-1">Public Key:</p>
                            <p className="text-sm font-mono text-gray-900 break-all">
                              {phantomPublicKey.toString()}
                            </p>
                          </div>
                        </div>
                        
                        <button
                          onClick={disconnectPhantom}
                          className="bg-red-600 hover:bg-red-700 text-white px-8 py-4 rounded-lg font-medium w-full transition-all shadow-sm"
                        >
                          Bağlantıyı Kes
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'wallets' && (
              <div className="space-y-6">
                <WalletCreator />
              </div>
            )}

            {activeTab === 'folders' && (
              <div className="space-y-6">
                <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                  <h3 className="text-xl font-semibold mb-4 text-gray-900">Klasörler</h3>
                  <FolderList />
                </div>
              </div>
            )}

            {activeTab === 'volume' && (
              <div className="space-y-6">
                <VolumeControls 
                  onVolumeTransaction={handleVolumeTransaction} 
                  isLoading={isLoading}
                />
                <TransactionList />
                <VolumeCharts />
              </div>
            )}

            {activeTab === 'distribute' && (
              <div className="space-y-6">
                <DistributeManager 
                  onDistribute={distributeSOL} 
                  isLoading={isLoading}
                />
              </div>
            )}

            {activeTab === 'transfers' && (
              <div className="max-w-2xl mx-auto">
                <div className="bg-white rounded-lg border border-gray-200 p-8 shadow-sm">
                  <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold mb-2 text-gray-900">Transfer İşlemleri</h2>
                    <p className="text-gray-600">Wallet'larınızdan belirli adrese SOL gönderin</p>
                  </div>
                  
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-700">Hedef Adres</label>
                      <input
                        type="text"
                        placeholder="Solana wallet adresi"
                        value={targetAddress}
                        onChange={(e) => setTargetAddress(e.target.value)}
                        className="w-full p-4 bg-gray-50 rounded-lg text-gray-900 border border-gray-300 focus:border-gray-900 focus:outline-none transition-colors font-mono"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-700">Transfer Miktarı (SOL)</label>
                      <input
                        type="number"
                        step="0.001"
                        value={transferAmount}
                        onChange={(e) => setTransferAmount(e.target.value)}
                        className="w-full p-4 bg-gray-50 rounded-lg text-gray-900 border border-gray-300 focus:border-gray-900 focus:outline-none transition-colors"
                        placeholder="0.005"
                      />
                    </div>
                    
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">Gönderen Wallet:</span>
                        <span className="text-gray-900 font-semibold">{wallets.length}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm mt-1">
                        <span className="text-gray-600">Toplam Gönderilecek:</span>
                        <span className="text-gray-900 font-semibold">
                          {(parseFloat(transferAmount) * wallets.length).toFixed(6)} SOL
                        </span>
                      </div>
                    </div>
                    
                    <button
                      onClick={sendToAddress}
                      disabled={!targetAddress || isLoading || wallets.length === 0}
                      className="bg-gray-900 hover:bg-gray-800 disabled:bg-gray-400 text-white px-8 py-4 rounded-lg font-medium w-full transition-all disabled:cursor-not-allowed shadow-sm"
                    >
                      {isLoading ? 'Gönderiliyor...' : `${wallets.length} Wallet'tan Gönder`}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'collect' && (
              <div className="space-y-6">
                <CollectManager 
                  onCollect={collectSOL} 
                  isLoading={isLoading}
                />
              </div>
            )}
          </div>
          {/* Confirmation Modal */}
          {confirmOpen && (
            <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg border border-gray-200 p-6 w-full max-w-md shadow-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Onay Gerekli</h3>
                <p className="text-gray-700 text-sm mb-6">{confirmMessage}</p>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setConfirmOpen(false);
                      setPendingAction(null);
                    }}
                    className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    İptal
                  </button>
                  <button
                    onClick={async () => {
                      if (pendingAction) {
                        setConfirmOpen(false);
                        await pendingAction();
                        setPendingAction(null);
                      }
                    }}
                    className="px-4 py-2 rounded-lg bg-gray-900 hover:bg-gray-800 text-white"
                  >
                    Onayla
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </WalletStoreProvider>
  );
}

export default App;