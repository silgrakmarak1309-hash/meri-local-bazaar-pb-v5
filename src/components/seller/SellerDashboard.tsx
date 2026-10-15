import React, { useState, useEffect } from 'react';
import {
  Store,
  Box,
  Package,
  Wallet,
  Clock,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  Settings,
  Plus,
  ArrowRight,
  ShieldAlert,
  MapPin,
  Bell,
  Volume2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  Shop,
  Product,
  SellerOrder,
  Wallet as WalletType,
  WalletTransaction,
  PayoutRequest,
  PlatformSettings,
} from '../../types';
import {
  listenToShopByOwnerId,
  listenToSellerProducts,
  fetchSellerProductsFromSupabase,
  listenToSellerOrders,
  fetchSellerOrdersFromSupabase,
  ensureWalletExists,
  listenToWallet,
  listenToWalletTransactions,
  listenToUserPayouts,
} from '../../services/dbService';
import { setupSellerOrderRealtime, getNotificationPermission, requestNotificationPermission, playTestSound } from '../../services/notificationService';
import { supabase } from '../../supabase';
import { BecomeSellerButton } from '../common/BecomeSellerButton';
import { SellerProducts } from './SellerProducts';
import { SellerOrders } from './SellerOrders';
import { SellerWallet } from './SellerWallet';
import { PostProductAdModal } from './PostProductAdModal';
import { VillageDeliveryRatesManager } from '../admin/VillageDeliveryRatesManager';

interface SellerDashboardProps {
  onOpenRegistration?: () => void;
  settings: PlatformSettings;
  activeSubTab?: string;
  onSelectSubTab?: (tab: string) => void;
  onRedirectToLogin?: () => void;
  onRedirectToMarketplace?: () => void;
}

export const SellerDashboard: React.FC<SellerDashboardProps> = ({
  onOpenRegistration,
  settings,
  activeSubTab = 'dashboard',
  onSelectSubTab,
  onRedirectToLogin,
  onRedirectToMarketplace,
}) => {
  const { user } = useAuth();
  const [shop, setShop] = useState<Shop | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [wallet, setWallet] = useState<WalletType | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPostAdOpen, setIsPostAdOpen] = useState(false);

  // Route protection state
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const [isAccessDenied, setIsAccessDenied] = useState(false);
  const [accessDeniedMessage, setAccessDeniedMessage] = useState('');

  // Tab state
  const currentTab = activeSubTab;
  const setTab = onSelectSubTab || (() => {});

  // Robust Route Protection Check:
  // 1. Check logged-in user's role from Supabase
  // 2. If logged out, send to /login
  // 3. If role is NOT 'seller', immediately block access, show alert message, and redirect back to marketplace page
  useEffect(() => {
    let isMounted = true;

    async function checkSellerAccess() {
      setIsCheckingAccess(true);

      // Check current session from Supabase
      const { data: sessionData } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
      const suUser = sessionData?.session?.user;
      const currentEmail = (suUser?.email || user?.email || '').toLowerCase().trim();
      const currentUid = suUser?.id || user?.uid;

      // 1. If user is logged out, send them to /login
      if (!suUser && !user) {
        if (!isMounted) return;
        setIsCheckingAccess(false);
        setIsAccessDenied(true);
        setAccessDeniedMessage('You are logged out. Please sign in to access the Seller Dashboard.');
        window.history.pushState({}, '', '/login');
        if (onRedirectToLogin) {
          onRedirectToLogin();
        } else {
          window.location.hash = '#login';
        }
        return;
      }

      // 2. Check logged-in user's role from Supabase 'users' table
      let fetchedRole: string = 'customer';
      try {
        let query = supabase.from('users').select('role');
        if (currentUid && currentEmail) {
          query = query.or(`id.eq.${currentUid},uid.eq.${currentUid},email.ilike.${currentEmail}`);
        } else if (currentUid) {
          query = query.or(`id.eq.${currentUid},uid.eq.${currentUid}`);
        } else if (currentEmail) {
          query = query.eq('email', currentEmail);
        }

        const { data: userRow, error } = await query.limit(1).maybeSingle();
        if (!error && userRow?.role) {
          fetchedRole = userRow.role;
        } else if (user?.role) {
          fetchedRole = user.role;
        }
      } catch (err) {
        console.error('Error verifying seller permissions:', err);
        if (user?.role) fetchedRole = user.role;
      }

      if (!isMounted) return;

      // 3. If role is NOT 'seller' (e.g., they are a 'customer'), immediately block access,
      // show an alert message, and redirect them back to the marketplace page.
      if (fetchedRole !== 'seller') {
        setIsCheckingAccess(false);
        setIsAccessDenied(true);
        const deniedMsg =
          'Access Denied: You do not have seller privileges. Only registered sellers can access the Seller Dashboard.';
        setAccessDeniedMessage(deniedMsg);

        // Show alert message
        alert(deniedMsg);

        // Redirect back to marketplace page (/marketplace or /)
        window.history.pushState({}, '', '/');
        if (onRedirectToMarketplace) {
          onRedirectToMarketplace();
        }
        return;
      }

      // Verified as seller
      setIsAccessDenied(false);
      setIsCheckingAccess(false);
    }

    checkSellerAccess();

    return () => {
      isMounted = false;
    };
  }, [user, onRedirectToLogin, onRedirectToMarketplace]);

  useEffect(() => {
    if (!user) return;

    // 1. Seller Wallet Sync: Immediately check and auto-create wallet in Supabase using authenticated owner_id (user.uid)
    ensureWalletExists(user.uid, 'seller', 0).catch(() => {});

    const unsubShop = listenToShopByOwnerId(
      user.uid,
      (data) => {
        setShop(data);
        setLoading(false);
        if (data?.ownerId && data.ownerId !== user.uid) {
          ensureWalletExists(data.ownerId, 'seller', 0).catch(() => {});
        }
      },
      user.email
    );

    // Collect all candidate IDs (authenticated owner_id, shop owner_id, shop id)
    const sellerOwnerIds = Array.from(new Set([user.uid, shop?.ownerId, shop?.id].filter(Boolean) as string[]));

    const unsubWallet = listenToWallet(sellerOwnerIds, 'seller', (w) => setWallet(w));
    const unsubTx = listenToWalletTransactions(sellerOwnerIds, (txs) => setTransactions(txs));
    const unsubPayouts = listenToUserPayouts(sellerOwnerIds, (ps) => setPayouts(ps));

    return () => {
      unsubShop();
      unsubWallet();
      unsubTx();
      unsubPayouts();
    };
  }, [user, shop?.id, shop?.ownerId]);

  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>('default');

  useEffect(() => {
    setNotifPermission(getNotificationPermission());
  }, []);

  useEffect(() => {
    const activeShopId = shop?.id || 'shop_1791092440747';
    const activeShopName = shop?.shopName || 'Marak shop';
    const activeOwnerId = shop?.ownerId || user?.uid || '';
    const activeEmail = user?.email || shop?.email || '';

    const sellerContext = {
      id: activeShopId,
      shopName: activeShopName,
      ownerId: activeOwnerId,
      email: activeEmail,
    };

    // Immediately fetch seller products from Supabase so count is populated instantly without waiting
    fetchSellerProductsFromSupabase(sellerContext).then((initialProds) => {
      if (initialProds && initialProds.length > 0) {
        setProducts(initialProds);
      }
    });

    // Immediately fetch orders so count is populated instantly without waiting
    fetchSellerOrdersFromSupabase(sellerContext).then((initialOrders) => {
      if (initialOrders && initialOrders.length > 0) {
        setOrders(initialOrders);
      }
    });

    const unsubProd = listenToSellerProducts(sellerContext, (p) => setProducts(p));
    // Listen to orders matching active shop ID (shop_1791092440747) or shop name (Marak shop)
    const unsubOrd = listenToSellerOrders(
      sellerContext,
      (o) => setOrders(o)
    );

    // Supabase Realtime channel for order arrival: plays loud cash-register chime + native device push
    const unsubRealtimePush = setupSellerOrderRealtime(activeShopId, user?.uid || '', () => {
      fetchSellerOrdersFromSupabase(sellerContext).then((fresh) => {
        if (fresh) setOrders(fresh);
      });
      fetchSellerProductsFromSupabase(sellerContext).then((freshProds) => {
        if (freshProds && freshProds.length > 0) setProducts(freshProds);
      });
    });

    return () => {
      unsubProd();
      unsubOrd();
      unsubRealtimePush();
    };
  }, [shop?.id, shop?.shopName, shop?.ownerId, shop?.email, user?.uid, user?.email]);

  const handleEnablePush = async () => {
    const res = await requestNotificationPermission();
    setNotifPermission(res);
  };

  // 1. Loading check for route permissions
  if (isCheckingAccess) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center space-y-3">
        <div className="w-10 h-10 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <h3 className="text-sm font-bold text-slate-800">Verifying Seller Permissions</h3>
        <p className="text-xs text-slate-500">Checking credentials with Supabase users registry...</p>
      </div>
    );
  }

  // 2. Blocked access screen when user is unauthorized or logged out
  if (isAccessDenied) {
    return (
      <div className="max-w-xl mx-auto my-8 p-6 sm:p-8 bg-white rounded-2xl shadow-lg border border-red-200 text-center space-y-5 animate-in fade-in zoom-in-95 duration-200">
        <div className="w-16 h-16 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto shadow-inner">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <div className="space-y-1.5">
          <span className="inline-block px-3 py-1 bg-red-100 text-red-800 text-[10px] font-extrabold rounded-full uppercase tracking-wider">
            Access Blocked
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900">Seller Dashboard Restricted</h2>
          <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
            {accessDeniedMessage ||
              'Only verified sellers with approved accounts can access the Seller Dashboard. Regular customer accounts are redirected to the marketplace.'}
          </p>
        </div>

        {/* WhatsApp seller approval callout */}
        <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-left space-y-3">
          <div className="flex items-start gap-2.5">
            <span className="text-xl">🏪</span>
            <div>
              <p className="text-xs font-bold text-emerald-950">Want to sell your products on Balpakram?</p>
              <p className="text-[11px] text-emerald-800 mt-0.5">
                Contact Admin directly on WhatsApp to register and approve your store.
              </p>
            </div>
          </div>
          <BecomeSellerButton
            className="w-full justify-center"
            label="Chat with Admin on WhatsApp (916009092096)"
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5 justify-center pt-2">
          <button
            onClick={() => {
              window.history.pushState({}, '', '/');
              if (onRedirectToMarketplace) onRedirectToMarketplace();
            }}
            className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
          >
            Return to Buyer Marketplace
          </button>
          <button
            onClick={() => {
              window.history.pushState({}, '', '/login');
              if (onRedirectToLogin) onRedirectToLogin();
            }}
            className="w-full sm:w-auto px-5 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
          >
            Sign In with Another Account
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center text-slate-400 text-xs">
        Loading Shop Dashboard...
      </div>
    );
  }

  // If no shop registered yet
  if (!shop) {
    return (
      <div className="max-w-2xl mx-auto p-6 sm:p-8 bg-white rounded-2xl shadow-sm border border-slate-200 mt-6 text-center space-y-5">
        <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center mx-auto text-2xl font-bold">
          🏬
        </div>
        <div className="space-y-1">
          <span className="inline-block px-3 py-1 bg-amber-100 text-amber-800 text-[10px] font-extrabold rounded-full uppercase tracking-wider">
            Partner Hub Onboarding
          </span>
          <h2 className="text-xl font-black text-slate-900">No Retail Shop Linked</h2>
        </div>
        <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
          Shop accounts and vendor onboarding are strictly verified and registered by administrators within the protected Partner Hub. Please contact your platform administrator on WhatsApp to provision your store.
        </p>
        <div className="pt-2 max-w-sm mx-auto">
          <BecomeSellerButton
            className="w-full justify-center"
            label="Request Shop Linking on WhatsApp (916009092096)"
          />
        </div>
      </div>
    );
  }

  // Pending Approval Banner
  const isPending = shop.status === 'pending_approval';
  const isRejected = shop.status === 'rejected';
  const isSuspended = shop.status === 'suspended';

  const pendingOrdersCount = orders.filter((o) => o.status === 'confirmed' || o.status === 'processing').length;
  const completedOrdersCount = orders.filter((o) => o.status === 'delivered').length;

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 space-y-5 pb-20">
      {/* Real-time Order Alert Bar */}
      <div className="bg-linear-to-r from-emerald-950 via-slate-900 to-indigo-950 text-white rounded-2xl p-3 sm:p-4 border border-emerald-800/40 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
            <Bell className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
                Live Order Push Alerts
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                ⚡ Supabase Realtime Active
              </span>
            </div>
            <p className="text-[11px] text-slate-300 mt-0.5">
              Instant double-bell cash register chime & device notifications trigger on every customer order.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
          <button
            onClick={() => playTestSound('order')}
            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-xs font-bold text-slate-200 flex items-center gap-1.5 transition cursor-pointer"
            title="Listen to order chime"
          >
            <Volume2 className="w-4 h-4 text-emerald-400" />
            <span>Test Sound</span>
          </button>

          {notifPermission !== 'granted' ? (
            <button
              onClick={handleEnablePush}
              className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-black shadow-md flex items-center gap-1.5 transition cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              <span>Enable Device Push</span>
            </button>
          ) : (
            <span className="px-3 py-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span>Push Enabled</span>
            </span>
          )}
        </div>
      </div>

      {/* Top Shop Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {shop.logoUrl ? (
            <img
              src={shop.logoUrl}
              alt={shop.shopName}
              className="w-14 h-14 rounded-xl object-cover border border-slate-200"
            />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center text-xl font-black">
              {shop.shopName.charAt(0)}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black text-slate-900">{shop.shopName}</h1>
              <span
                className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase ${
                  shop.status === 'approved'
                    ? 'bg-emerald-100 text-emerald-800'
                    : shop.status === 'pending_approval'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {shop.status.replace('_', ' ')}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {shop.category} • {shop.city}, {shop.state}
            </p>
          </div>
        </div>

        {/* Quick Tabs Bar */}
        <div className="w-full sm:w-auto flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold overflow-x-auto scrollbar-none gap-1">
          <button
            onClick={() => setTab('dashboard')}
            className={`min-h-[38px] px-3 py-1.5 rounded-lg transition touch-manipulation active:scale-95 cursor-pointer whitespace-nowrap ${
              currentTab === 'dashboard'
                ? 'bg-white text-emerald-800 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setTab('products')}
            className={`min-h-[38px] px-3 py-1.5 rounded-lg transition touch-manipulation active:scale-95 cursor-pointer whitespace-nowrap ${
              currentTab === 'products'
                ? 'bg-white text-emerald-800 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Products ({products.length})
          </button>
          <button
            onClick={() => setTab('orders')}
            className={`min-h-[38px] px-3 py-1.5 rounded-lg transition touch-manipulation active:scale-95 cursor-pointer whitespace-nowrap ${
              currentTab === 'orders'
                ? 'bg-white text-emerald-800 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Orders ({orders.length})
          </button>
          <button
            onClick={() => setTab('wallet')}
            className={`min-h-[38px] px-3 py-1.5 rounded-lg transition touch-manipulation active:scale-95 cursor-pointer whitespace-nowrap ${
              currentTab === 'wallet'
                ? 'bg-white text-emerald-800 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Wallet (₹{wallet?.currentBalance || 0})
          </button>
          <button
            onClick={() => setTab('village_rates')}
            className={`min-h-[38px] px-3 py-1.5 rounded-lg transition touch-manipulation active:scale-95 cursor-pointer whitespace-nowrap ${
              currentTab === 'village_rates'
                ? 'bg-white text-emerald-800 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Village Delivery Rates (₹10+)
          </button>
        </div>

        <button
          onClick={() => setIsPostAdOpen(true)}
          className="w-full sm:w-auto min-h-[42px] px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer touch-manipulation active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4 text-yellow-300" />
          <span>Post Ad / List Product</span>
        </button>
      </div>

      {/* Warning status banners */}
      {isPending && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 text-xs text-amber-900">
          <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block text-sm">Shop Application Under Review</span>
            <span>
              Your registration is pending approval by the Admin. You can prepare products in the catalog, but they will become visible to customers once the admin approves your shop.
            </span>
          </div>
        </div>
      )}

      {isRejected && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 text-xs text-red-900">
          <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block text-sm">Application Rejected</span>
            <span>Reason: {shop.rejectionReason || 'Business verification could not be completed.'}</span>
          </div>
        </div>
      )}

      {/* Tab 1: Overview */}
      {currentTab === 'dashboard' && (
        <div className="space-y-5">
          {/* Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Total Products</span>
              <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1">{products.length}</div>
              <span className="text-[11px] text-emerald-600 font-semibold">
                {products.filter((p) => p.isActive).length} active
              </span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Total Orders</span>
              <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1">{orders.length}</div>
              <span className="text-[11px] text-blue-600 font-semibold">{pendingOrdersCount} pending</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Net Earnings</span>
              <div className="text-xl sm:text-2xl font-black text-emerald-700 mt-1">
                ₹{(wallet?.totalEarnings || 0).toLocaleString('en-IN')}
              </div>
              <span className="text-[11px] text-slate-400">Available: ₹{wallet?.currentBalance || 0}</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Shop Rating</span>
              <div className="text-xl sm:text-2xl font-black text-amber-500 mt-1">4.8 ★</div>
              <span className="text-[11px] text-slate-400">Super Delivery Verified</span>
            </div>
          </div>

          {/* Quick Shortcuts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Featured Post Ad / Product Listing Shortcut */}
            <div
              onClick={() => setIsPostAdOpen(true)}
              className="col-span-1 sm:col-span-2 bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 text-white p-4 sm:p-5 rounded-2xl shadow-sm hover:shadow-md cursor-pointer transition flex flex-wrap items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3">
                <div className="p-3 bg-white/10 rounded-xl shrink-0">
                  <Plus className="w-6 h-6 text-yellow-300" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-white">Post Ad / Product Listing</h3>
                  <p className="text-xs text-emerald-100">
                    Publish an item with pricing, description, stock, and photos to reach local shoppers immediately
                  </p>
                </div>
              </div>
              <span className="px-4 py-2 bg-white text-emerald-800 rounded-xl font-bold text-xs shrink-0 flex items-center gap-1.5 shadow-xs">
                Post New Ad <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>

            <div
              onClick={() => setTab('products')}
              className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-emerald-500 shadow-2xs cursor-pointer transition flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-100 text-emerald-800 rounded-xl">
                  <Box className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Manage Product Inventory</h3>
                  <p className="text-xs text-slate-500">Add products, edit prices, and manage stock</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-slate-400" />
            </div>

            <div
              onClick={() => setTab('orders')}
              className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-blue-500 shadow-2xs cursor-pointer transition flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 text-blue-800 rounded-xl">
                  <Package className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Fulfill Incoming Orders</h3>
                  <p className="text-xs text-slate-500">
                    {pendingOrdersCount} orders waiting for your action
                  </p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-slate-400" />
            </div>

            <div
              onClick={() => setTab('village_rates')}
              className="col-span-1 sm:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 hover:border-emerald-500 shadow-2xs cursor-pointer transition flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-100 text-emerald-800 rounded-xl">
                  <MapPin className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Hyper-Local Village Delivery Rates (₹10+)</h3>
                  <p className="text-xs text-slate-500">
                    Configure and assign dynamic delivery fees for up to 10 distinct villages under each PIN code
                  </p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-slate-400" />
            </div>
          </div>

          {/* Recent Orders Preview */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-800">Recent Customer Orders</h3>
              <button onClick={() => setTab('orders')} className="text-xs font-bold text-emerald-700 hover:underline">
                View All Orders
              </button>
            </div>

            {orders.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No orders received yet.</p>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {orders.slice(0, 3).map((o) => (
                  <div key={o.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-800">#{o.id}</span>
                      <span className="text-slate-400 ml-2">by {o.customerName}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-slate-900">₹{o.sellerEarnings.toLocaleString('en-IN')}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 font-bold uppercase">
                        {o.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Products */}
      {currentTab === 'products' && (
        <SellerProducts
          shop={shop}
          products={products}
          onOpenPostAd={() => setIsPostAdOpen(true)}
          onDeleteProduct={(id) => setProducts((prev) => prev.filter((p) => p.id !== id))}
          onProductsChange={(updated) => setProducts(updated)}
        />
      )}

      {/* Tab 3: Orders */}
      {currentTab === 'orders' && (
        <SellerOrders
          orders={orders}
          shop={
            shop || {
              id: 'shop_1791092440747',
              ownerId: 'user_sengmimarak12_gmail_com',
              shopName: 'Marak shop',
              ownerName: 'Greja Marak',
              email: 'grejamarak@gmail.com',
              phoneNumber: '+91 6909515061',
              shopAddress: 'Rongara bazaar',
              city: 'South Garo Hills',
              state: 'Meghalaya',
              postalCode: '794114',
              servicePinCode: '794114',
              category: 'Groceries & Daily Essentials',
              description: 'Fresh Local Groceries & Produce',
              logoUrl:
                'https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=300&q=80',
              panNumber: '',
              bankDetails: {
                ifsc: 'SBIN0004885',
                upiId: 'grejamarak@okaxis',
                accountNumber: '12345678909',
                accountHolderName: 'Greja R Marak',
              },
              status: 'approved',
              rating: 4.8,
              totalProducts: 1,
              totalSales: 2,
              createdAt: '2026-10-04T05:40:42.364622+00:00',
              updatedAt: new Date().toISOString(),
            }
          }
          onRefresh={() => {
            fetchSellerOrdersFromSupabase({
              id: shop?.id || 'shop_1791092440747',
              shopName: shop?.shopName || 'Marak shop',
              ownerId: shop?.ownerId || user?.uid,
            }).then((fresh) => {
              if (fresh) setOrders(fresh);
            });
          }}
        />
      )}

      {/* Tab 4: Wallet */}
      {currentTab === 'wallet' && (
        <SellerWallet
          wallet={wallet}
          transactions={transactions}
          payouts={payouts}
          shop={shop}
          settings={settings}
        />
      )}

      {/* Tab 5: Village Delivery Rates */}
      {currentTab === 'village_rates' && (
        <div className="space-y-4">
          <VillageDeliveryRatesManager shop={shop} />
        </div>
      )}

      {/* Post Ad / Product Listing Modal */}
      <PostProductAdModal
        isOpen={isPostAdOpen}
        onClose={() => setIsPostAdOpen(false)}
        shop={shop}
      />
    </div>
  );
};
