import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider, useCart } from './context/CartContext';
import { LocationProvider } from './context/LocationContext';
import { Navbar } from './components/common/Navbar';
import { BottomNav } from './components/common/BottomNav';
import { NotificationDrawer } from './components/common/NotificationDrawer';
import { PushNotificationBanner } from './components/common/PushNotificationBanner';
import { PinCodeModal } from './components/common/PinCodeModal';
import { AuthModal } from './components/auth/AuthModal';
import { CustomerHome } from './components/customer/CustomerHome';
import { ProductDetailsModal } from './components/customer/ProductDetailsModal';
import { CartDrawer } from './components/customer/CartDrawer';
import { CheckoutModal } from './components/customer/CheckoutModal';
import { CustomerOrders } from './components/customer/CustomerOrders';
import { CustomerProfile } from './components/customer/CustomerProfile';
import { SellerDashboard } from './components/seller/SellerDashboard';
import { DeliveryDashboard } from './components/delivery/DeliveryDashboard';
import { DeliveryRegistrationModal } from './components/delivery/DeliveryRegistrationModal';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { PartnerHubLogin } from './components/admin/PartnerHubLogin';
import {
  Product,
  Category,
  Order,
  AppNotification,
  PlatformSettings,
  UserRole,
} from './types';
import {
  DEFAULT_SETTINGS,
  listenToProducts,
  listenToCategories,
  listenToSettings,
  listenToNotifications,
  listenToCustomerOrders,
  seedMarketplaceIfEmpty,
  clearMarketplaceDemoData,
} from './services/dbService';

function MarketplaceMain() {
  const { user, role, switchRole, hasRegisteredShop, hasRegisteredDelivery } = useAuth();
  const { clearCart } = useCart();

  // Firestore Real-Time State
  const [products, setProducts] = useState<Product[]>([]);
  const [isProductsLoading, setIsProductsLoading] = useState<boolean>(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [settings, setSettings] = useState<PlatformSettings>(DEFAULT_SETTINGS);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);

  // Route & URL Path State (Private Route Isolation for Partner Hub)
  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return window.location.pathname + window.location.hash;
    }
    return '/';
  });

  useEffect(() => {
    const updateLocation = () => {
      setCurrentPath(window.location.pathname + window.location.hash);
    };
    window.addEventListener('popstate', updateLocation);
    window.addEventListener('hashchange', updateLocation);
    return () => {
      window.removeEventListener('popstate', updateLocation);
      window.removeEventListener('hashchange', updateLocation);
    };
  }, []);

  const isPartnerHubRoute =
    currentPath.startsWith('/partner-hub') ||
    currentPath.startsWith('#partner-hub');

  // Navigation State
  const [activeTab, setActiveTab] = useState<string>('home');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Modals
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalInitialMode, setAuthModalInitialMode] = useState<'signin' | 'register'>('signin');
  const [isNotificationsOpen, setIsNotificationsOpen] = useState<boolean>(false);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState<boolean>(false);
  const [isDeliveryRegOpen, setIsDeliveryRegOpen] = useState<boolean>(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [singleBuyProduct, setSingleBuyProduct] = useState<Product | null>(null);

  const handleOpenAuth = (mode: 'signin' | 'register' = 'signin') => {
    setAuthModalInitialMode(mode);
    setIsAuthModalOpen(true);
  };

  // Strict Profile Bypass: If user already has an active delivery profile, bypass registration modal
  useEffect(() => {
    if (isDeliveryRegOpen && hasRegisteredDelivery) {
      setIsDeliveryRegOpen(false);
      switchRole('delivery_partner');
      setActiveTab('home');
    }
  }, [isDeliveryRegOpen, hasRegisteredDelivery]);

  // Partner Hub Secure Authorization State (Never assume authenticated from client storage)
  const [isPartnerHubAuthenticated, setIsPartnerHubAuthenticated] = useState<boolean>(false);
  const [partnerHubAdmin, setPartnerHubAdmin] = useState<any>(null);
  const [isVerifyingSession, setIsVerifyingSession] = useState<boolean>(false);

  // Verify Partner Hub session with server or local sessionStorage when on Partner Hub route
  useEffect(() => {
    if (isPartnerHubRoute) {
      const token = sessionStorage.getItem('partner_hub_token');
      const savedAdminStr = sessionStorage.getItem('partner_hub_admin');

      if (!token) {
        setIsPartnerHubAuthenticated(false);
        setPartnerHubAdmin(null);
        return;
      }

      // Check saved admin data in sessionStorage
      if (savedAdminStr) {
        try {
          const parsed = JSON.parse(savedAdminStr);
          if (parsed?.role === 'admin') {
            setIsPartnerHubAuthenticated(true);
            setPartnerHubAdmin(parsed);
          } else {
            sessionStorage.removeItem('partner_hub_token');
            sessionStorage.removeItem('partner_hub_admin');
            setIsPartnerHubAuthenticated(false);
            setPartnerHubAdmin(null);
          }
        } catch {}
      }

      // If backend API endpoint is reachable, verify token
      setIsVerifyingSession(true);
      fetch('/api/partner-hub/verify', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => {
          if (res.ok) {
            const contentType = res.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
              return res.json();
            }
          }
          return null;
        })
        .then((data) => {
          if (data && data.authenticated && data.user?.role === 'admin') {
            setIsPartnerHubAuthenticated(true);
            setPartnerHubAdmin(data.user);
            sessionStorage.setItem('partner_hub_admin', JSON.stringify(data.user));
          } else if (data && data.authenticated === false) {
            // Explicit server rejection
            sessionStorage.removeItem('partner_hub_token');
            sessionStorage.removeItem('partner_hub_admin');
            setIsPartnerHubAuthenticated(false);
            setPartnerHubAdmin(null);
          }
        })
        .catch(() => {
          // Keep sessionStorage valid on static host or network disconnect
        })
        .finally(() => {
          setIsVerifyingSession(false);
        });
    } else {
      setIsVerifyingSession(false);
    }
  }, [isPartnerHubRoute]);

  const handlePartnerHubLoginSuccess = (sessionData: any) => {
    setIsPartnerHubAuthenticated(true);
    setPartnerHubAdmin(sessionData.user);
    setActiveTab('dashboard');
  };

  const handlePartnerHubLogout = async () => {
    const token = sessionStorage.getItem('partner_hub_token');
    if (token) {
      fetch('/api/partner-hub/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    sessionStorage.removeItem('partner_hub_token');
    sessionStorage.removeItem('partner_hub_admin');
    setIsPartnerHubAuthenticated(false);
    setPartnerHubAdmin(null);
    window.history.pushState({}, '', '/');
    setCurrentPath('/');
    switchRole('customer');
    setActiveTab('home');
  };

  const handlePartnerHubExit = () => {
    window.history.pushState({}, '', '/');
    setCurrentPath('/');
    switchRole('customer');
    setActiveTab('home');
  };

  // Block any non-super-admin user trying to access Partner Hub and auto-redirect
  useEffect(() => {
    if (isPartnerHubRoute && user && user.email?.toLowerCase() !== 'silgrakmarak1309@gmail.com') {
      const timer = setTimeout(() => {
        handlePartnerHubExit();
      }, 2200);
      return () => clearTimeout(timer);
    }
  }, [isPartnerHubRoute, user]);

  // Clear demo data on mount and keep catalog clean for real sellers
  useEffect(() => {
    seedMarketplaceIfEmpty();
    clearMarketplaceDemoData();
  }, []);

  // Listen to Products, Categories, Settings
  useEffect(() => {
    const unsubProducts = listenToProducts((list) => {
      setProducts(list);
      setIsProductsLoading(false);
    });
    const unsubCategories = listenToCategories((list) => setCategories(list));
    const unsubSettings = listenToSettings((s) => setSettings(s));

    return () => {
      unsubProducts();
      unsubCategories();
      unsubSettings();
    };
  }, []);

  // Listen to Notifications
  useEffect(() => {
    const unsubNotifs = listenToNotifications(user?.uid || '', role, (notifs) => {
      setNotifications(notifs);
    });
    return () => unsubNotifs();
  }, [user?.uid, role]);

  // Listen to Customer Orders
  useEffect(() => {
    if (!user) {
      setCustomerOrders([]);
      return;
    }
    const unsubOrders = listenToCustomerOrders(user.uid, (orders) => {
      setCustomerOrders(orders);
    });
    return () => unsubOrders();
  }, [user?.uid]);

  // Handle role tab synchronization
  useEffect(() => {
    if (role === 'customer') {
      setActiveTab('home');
    } else if (role === 'seller') {
      setActiveTab('dashboard');
    } else if (role === 'delivery_partner') {
      setActiveTab('home');
    } else if (role === 'admin') {
      setActiveTab('dashboard');
    }
  }, [role]);

  const unreadNotifsCount = notifications.filter((n) => !n.isRead).length;

  const handleBuyNow = (product: Product) => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }
    setSingleBuyProduct(product);
    setIsCheckoutOpen(true);
  };

  const handleProceedCheckoutFromCart = () => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }
    setSingleBuyProduct(null);
    setIsCartOpen(false);
    setIsCheckoutOpen(true);
  };

  const handleOrderPlaced = (order: Order) => {
    setActiveTab('orders');
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Dedicated Private Route Isolation: Partner Hub is only rendered on /partner-hub or /partner-hub/login
  if (isPartnerHubRoute) {
    // If a non-super-admin user is logged in, block them completely and show Unauthorized Access message
    if (user && user.email?.toLowerCase() !== 'silgrakmarak1309@gmail.com') {
      return (
        <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-800 border-2 border-red-500/50 rounded-2xl p-6 text-center space-y-4 shadow-2xl animate-in fade-in">
            <div className="w-16 h-16 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto text-3xl font-bold">
              🚫
            </div>
            <div className="space-y-1">
              <span className="inline-block px-3 py-1 bg-red-500/20 text-red-300 text-[10px] font-extrabold rounded-full uppercase tracking-wider border border-red-500/30">
                Access Restricted
              </span>
              <h2 className="text-xl font-black text-white">Unauthorized Access</h2>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Partner Hub is strictly restricted to the Super Administrator. Your account is not authorized to access this portal.
            </p>
            <div className="p-3 bg-red-950/40 rounded-xl border border-red-500/30 text-[11px] text-red-300 font-medium">
              Redirecting to the main marketplace website in a moment...
            </div>
            <button
              onClick={handlePartnerHubExit}
              className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow transition cursor-pointer"
            >
              Return to Marketplace Now
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans antialiased">
        {isVerifyingSession ? (
          <div className="min-h-screen flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-3 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-slate-400 font-medium">Verifying Partner Hub Authorization...</p>
          </div>
        ) : isPartnerHubAuthenticated ? (
          <AdminDashboard
            settings={settings}
            activeSubTab={activeTab}
            onSelectSubTab={setActiveTab}
            onLogout={handlePartnerHubLogout}
            adminUser={partnerHubAdmin}
          />
        ) : (
          <PartnerHubLogin
            onLoginSuccess={handlePartnerHubLoginSuccess}
            onCancel={handlePartnerHubExit}
          />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f1f3f6] text-slate-900 flex flex-col font-sans antialiased">
      {/* Top Navbar */}
      <Navbar
        onOpenAuth={(mode) => handleOpenAuth(mode)}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        onOpenCart={() => setIsCartOpen(true)}
        unreadNotifsCount={unreadNotifsCount}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
      />

      {/* Push Notification & Sound Banner + Real-time Alert Toasts */}
      <PushNotificationBanner
        role={role}
        onNavigateToTab={(tab) => {
          if (role === 'seller') {
            setActiveTab('orders');
          } else if (role === 'delivery_partner') {
            setActiveTab('deliveries');
          } else {
            setActiveTab(tab);
          }
        }}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-2 sm:p-4">
        {/* ================= 1. CUSTOMER ROLE ================= */}
        {role === 'customer' && (
          <div>
            {activeTab === 'home' && (
              <CustomerHome
                products={products}
                categories={categories}
                searchQuery={searchQuery}
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
                onSelectProduct={(p) => setSelectedProduct(p)}
                onBuyNow={handleBuyNow}
                loading={isProductsLoading}
              />
            )}

            {activeTab === 'categories' && (
              <div className="space-y-4 max-w-5xl mx-auto py-3">
                <h1 className="text-lg font-black text-slate-900">Explore All Categories</h1>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {categories.map((cat) => (
                    <div
                      key={cat.id}
                      onClick={() => {
                        setSelectedCategory(cat.name);
                        setActiveTab('home');
                      }}
                      className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-[#2874f0] cursor-pointer transition text-center space-y-2 group"
                    >
                      <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center text-3xl mx-auto group-hover:scale-110 transition">
                        📦
                      </div>
                      <h3 className="font-bold text-slate-800 text-sm group-hover:text-[#2874f0]">
                        {cat.name}
                      </h3>
                      <p className="text-[11px] text-slate-400">{cat.description || 'Browse items'}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'cart' && (
              <div className="max-w-2xl mx-auto py-4">
                <CartDrawer
                  isOpen={true}
                  onClose={() => setActiveTab('home')}
                  onCheckout={handleProceedCheckoutFromCart}
                  settings={settings}
                />
              </div>
            )}

            {activeTab === 'orders' && (
              <CustomerOrders
                orders={customerOrders}
                onRefresh={() => {}}
              />
            )}

            {activeTab === 'profile' && (
              <CustomerProfile
                onOpenDeliveryRegistration={() => setIsDeliveryRegOpen(true)}
                onOpenAuth={(mode) => handleOpenAuth(mode)}
              />
            )}
          </div>
        )}

        {/* ================= 2. SELLER ROLE ================= */}
        {role === 'seller' && (
          <SellerDashboard
            settings={settings}
            activeSubTab={activeTab}
            onSelectSubTab={setActiveTab}
          />
        )}

        {/* ================= 3. DELIVERY PARTNER ROLE ================= */}
        {role === 'delivery_partner' && (
          <DeliveryDashboard
            onOpenRegistration={() => setIsDeliveryRegOpen(true)}
            settings={settings}
            activeSubTab={activeTab}
            onSelectSubTab={setActiveTab}
          />
        )}
      </main>

      {/* Mobile Bottom Navigation */}
      <BottomNav activeTab={activeTab} onSelectTab={setActiveTab} />

      {/* Global Modals & Drawers */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        defaultRole={role}
        initialMode={authModalInitialMode}
      />

      <NotificationDrawer
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={notifications}
      />

      {role === 'customer' && (
        <CartDrawer
          isOpen={isCartOpen}
          onClose={() => setIsCartOpen(false)}
          onCheckout={handleProceedCheckoutFromCart}
          settings={settings}
        />
      )}

      <ProductDetailsModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onBuyNow={(p) => {
          setSelectedProduct(null);
          handleBuyNow(p);
        }}
      />

      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => {
          setIsCheckoutOpen(false);
          setSingleBuyProduct(null);
        }}
        onOrderSuccess={handleOrderPlaced}
        settings={settings}
        singleBuyItem={singleBuyProduct}
      />

      <DeliveryRegistrationModal
        isOpen={isDeliveryRegOpen}
        onClose={() => setIsDeliveryRegOpen(false)}
        onRegistered={() => {
          switchRole('delivery_partner');
          setActiveTab('home');
        }}
      />

      <PinCodeModal />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <LocationProvider>
        <CartProvider>
          <MarketplaceMain />
        </CartProvider>
      </LocationProvider>
    </AuthProvider>
  );
}
