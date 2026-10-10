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
  DEFAULT_CATEGORIES,
  listenToProducts,
  listenToCategories,
  listenToSettings,
  listenToNotifications,
  listenToCustomerOrders,
  fetchCustomerOrdersFromSupabase,
  seedMarketplaceIfEmpty,
  clearMarketplaceDemoData,
} from './services/dbService';

function MarketplaceMain() {
  const { user, role, switchRole, hasRegisteredShop, hasRegisteredDelivery } = useAuth();
  const { clearCart, subtotal, addToCart } = useCart();

  // Firestore Real-Time State
  const [products, setProducts] = useState<Product[]>([]);
  const [isProductsLoading, setIsProductsLoading] = useState<boolean>(true);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [settings, setSettings] = useState<PlatformSettings>(DEFAULT_SETTINGS);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);

  // Navigation State
  const [activeTab, setActiveTab] = useState<string>('home');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Dedicated Partner Hub Mode (ensures state persists regardless of browser iframe path handling)
  const [isPartnerHubMode, setIsPartnerHubMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname + window.location.hash;
      return path.startsWith('/partner-hub') || path.startsWith('#partner-hub');
    }
    return false;
  });

  // Route & URL Path State (Private Route Isolation for Partner Hub)
  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return window.location.pathname + window.location.hash;
    }
    return '/';
  });

  useEffect(() => {
    const updateLocation = () => {
      const p = window.location.pathname + window.location.hash;
      setCurrentPath(p);
      if (p.startsWith('/partner-hub') || p.startsWith('#partner-hub')) {
        setIsPartnerHubMode(true);
      }
    };
    window.addEventListener('popstate', updateLocation);
    window.addEventListener('hashchange', updateLocation);
    return () => {
      window.removeEventListener('popstate', updateLocation);
      window.removeEventListener('hashchange', updateLocation);
    };
  }, []);

  const isPartnerHubRoute =
    isPartnerHubMode ||
    currentPath.startsWith('/partner-hub') ||
    currentPath.startsWith('#partner-hub');

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

  const navigateToPartnerHub = () => {
    setIsPartnerHubMode(true);
    window.history.pushState({}, '', '/partner-hub');
    setCurrentPath('/partner-hub');
  };

  // Strict Profile Bypass: If user already has an active delivery profile, bypass registration modal
  useEffect(() => {
    if (isDeliveryRegOpen && hasRegisteredDelivery) {
      setIsDeliveryRegOpen(false);
      switchRole('delivery_partner');
      setActiveTab('home');
    }
  }, [isDeliveryRegOpen, hasRegisteredDelivery]);

  // Partner Hub Secure Authorization State (Checks both sessionStorage and persistent localStorage for APK / mobile apps)
  const [isPartnerHubAuthenticated, setIsPartnerHubAuthenticated] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const token = sessionStorage.getItem('partner_hub_token') || localStorage.getItem('partner_hub_token');
      const savedAdminStr = sessionStorage.getItem('partner_hub_admin') || localStorage.getItem('partner_hub_admin');
      if (token && savedAdminStr) {
        try {
          const parsed = JSON.parse(savedAdminStr);
          return parsed?.role === 'admin' || parsed?.email?.toLowerCase() === 'silgrakmarak1309@gmail.com' || parsed?.username === 'silgrakmarak1309';
        } catch {}
      }
    }
    return false;
  });
  const [partnerHubAdmin, setPartnerHubAdmin] = useState<any>(() => {
    if (typeof window !== 'undefined') {
      const savedAdminStr = sessionStorage.getItem('partner_hub_admin') || localStorage.getItem('partner_hub_admin');
      if (savedAdminStr) {
        try {
          const parsed = JSON.parse(savedAdminStr);
          if (parsed?.role === 'admin' || parsed?.email?.toLowerCase() === 'silgrakmarak1309@gmail.com') return parsed;
        } catch {}
      }
    }
    return null;
  });
  const [isVerifyingSession, setIsVerifyingSession] = useState<boolean>(false);

  // Synchronize admin session with logged-in user or stored token on mount and auth changes
  useEffect(() => {
    // If the active user profile is the super administrator
    if (user?.email?.toLowerCase() === 'silgrakmarak1309@gmail.com' || role === 'admin') {
      const superAdminData = {
        uid: user?.uid || 'admin_silgrakmarak1309',
        username: 'silgrakmarak1309',
        displayName: user?.displayName || 'Silgrak Marak (Super Administrator)',
        email: 'silgrakmarak1309@gmail.com',
        role: 'admin' as const,
      };
      setIsPartnerHubAuthenticated(true);
      setPartnerHubAdmin(superAdminData);
      localStorage.setItem('partner_hub_admin', JSON.stringify(superAdminData));
      sessionStorage.setItem('partner_hub_admin', JSON.stringify(superAdminData));
      if (!localStorage.getItem('partner_hub_token')) {
        const dummyToken = 'ph_auth_' + Date.now();
        localStorage.setItem('partner_hub_token', dummyToken);
        sessionStorage.setItem('partner_hub_token', dummyToken);
      }
      return;
    }

    const token = sessionStorage.getItem('partner_hub_token') || localStorage.getItem('partner_hub_token');
    const savedAdminStr = sessionStorage.getItem('partner_hub_admin') || localStorage.getItem('partner_hub_admin');

    if (token && savedAdminStr) {
      try {
        const parsed = JSON.parse(savedAdminStr);
        if (parsed?.role === 'admin' || parsed?.email?.toLowerCase() === 'silgrakmarak1309@gmail.com') {
          setIsPartnerHubAuthenticated(true);
          setPartnerHubAdmin(parsed);
        }
      } catch {}
    }
  }, [user?.email, role]);

  // Verify Partner Hub session with server or local storage when on Partner Hub route
  useEffect(() => {
    if (isPartnerHubRoute) {
      if (user?.email?.toLowerCase() === 'silgrakmarak1309@gmail.com' || role === 'admin') {
        setIsPartnerHubAuthenticated(true);
        return;
      }

      const token = sessionStorage.getItem('partner_hub_token') || localStorage.getItem('partner_hub_token');
      const savedAdminStr = sessionStorage.getItem('partner_hub_admin') || localStorage.getItem('partner_hub_admin');

      if (!token) {
        setIsPartnerHubAuthenticated(false);
        setPartnerHubAdmin(null);
        return;
      }

      // Check saved admin data in storage
      if (savedAdminStr) {
        try {
          const parsed = JSON.parse(savedAdminStr);
          if (parsed?.role === 'admin' || parsed?.email?.toLowerCase() === 'silgrakmarak1309@gmail.com') {
            setIsPartnerHubAuthenticated(true);
            setPartnerHubAdmin(parsed);
          }
        } catch {}
      }

      // If backend API endpoint is reachable, verify token silently in background
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
            localStorage.setItem('partner_hub_admin', JSON.stringify(data.user));
          }
        })
        .catch(() => {
          // Keep storage valid on static host or network disconnect
        });
    }
  }, [isPartnerHubRoute, user?.email, role]);

  const handlePartnerHubLoginSuccess = (sessionData: any) => {
    setIsPartnerHubAuthenticated(true);
    setPartnerHubAdmin(sessionData.user);
    sessionStorage.setItem('partner_hub_token', sessionData.token);
    sessionStorage.setItem('partner_hub_admin', JSON.stringify(sessionData.user));
    localStorage.setItem('partner_hub_token', sessionData.token);
    localStorage.setItem('partner_hub_admin', JSON.stringify(sessionData.user));
    setIsPartnerHubMode(true);
    setActiveTab('dashboard');
    window.history.pushState({}, '', '/partner-hub');
    setCurrentPath('/partner-hub');
  };

  const handlePartnerHubLogout = async () => {
    const token = sessionStorage.getItem('partner_hub_token') || localStorage.getItem('partner_hub_token');
    if (token) {
      fetch('/api/partner-hub/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    sessionStorage.removeItem('partner_hub_token');
    sessionStorage.removeItem('partner_hub_admin');
    localStorage.removeItem('partner_hub_token');
    localStorage.removeItem('partner_hub_admin');
    setIsPartnerHubAuthenticated(false);
    setPartnerHubAdmin(null);
    setIsPartnerHubMode(false);
    window.history.pushState({}, '', '/');
    setCurrentPath('/');
    switchRole('customer');
    setActiveTab('home');
  };

  const handlePartnerHubExit = () => {
    setIsPartnerHubMode(false);
    window.history.pushState({}, '', '/');
    setCurrentPath('/');
    switchRole('customer');
    setActiveTab('home');
  };

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

  // Listen to Customer Orders directly from Supabase
  useEffect(() => {
    // Initial fetch to load orders immediately
    fetchCustomerOrdersFromSupabase(user || undefined).then((orders) => {
      if (orders && orders.length > 0) {
        setCustomerOrders(orders);
      }
    });

    const unsubOrders = listenToCustomerOrders(user || '', (orders) => {
      setCustomerOrders(orders);
    });
    return () => unsubOrders();
  }, [user?.uid, user?.email, user?.phoneNumber]);

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
    const effectivePrice = product.discountPrice || product.price;
    // Strict minimum order value restriction (₹200)
    if (effectivePrice < 200) {
      addToCart(product, 1);
      setIsCartOpen(true);
      return;
    }
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }
    setSingleBuyProduct(product);
    setIsCheckoutOpen(true);
  };

  const handleProceedCheckoutFromCart = () => {
    // Strict minimum order value restriction (₹200)
    if (subtotal < 200) {
      setIsCartOpen(true);
      return;
    }
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }
    setSingleBuyProduct(null);
    setIsCartOpen(false);
    setIsCheckoutOpen(true);
  };

  const handleOrderPlaced = (order: Order) => {
    setCustomerOrders((prev) => [order, ...prev.filter((o) => o.id !== order.id)]);
    setActiveTab('orders');
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Dedicated Private Route Isolation: Partner Hub is only rendered on /partner-hub or /partner-hub/login
  if (isPartnerHubRoute) {
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
            activeSubTab={activeTab === 'partner-hub' ? 'dashboard' : activeTab}
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
        isPartnerHubAuthenticated={isPartnerHubAuthenticated}
        onNavigateToPartnerHub={navigateToPartnerHub}
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
                onProductsUpdate={(updatedProds) => setProducts(updatedProds)}
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
                        {cat.name.toLowerCase() === 'food'
                          ? '🍲'
                          : cat.name.toLowerCase().includes('veg')
                          ? '🥦'
                          : cat.name.toLowerCase() === 'electronics'
                          ? '🎧'
                          : cat.name.toLowerCase() === 'mobiles'
                          ? '📱'
                          : cat.name.toLowerCase() === 'fashion'
                          ? '👕'
                          : cat.name.toLowerCase() === 'grocery'
                          ? '🥑'
                          : cat.name.toLowerCase().includes('kitchen')
                          ? '🍳'
                          : cat.name.toLowerCase().includes('beauty')
                          ? '✨'
                          : '📦'}
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
                onRefresh={() => {
                  fetchCustomerOrdersFromSupabase(user || undefined).then((orders) => {
                    if (orders) setCustomerOrders(orders);
                  });
                }}
              />
            )}

            {activeTab === 'profile' && (
              <CustomerProfile
                onOpenDeliveryRegistration={() => setIsDeliveryRegOpen(true)}
                onOpenAuth={(mode) => handleOpenAuth(mode)}
                onNavigateToPartnerHub={navigateToPartnerHub}
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

        {/* ================= 4. SUPER ADMINISTRATOR ROLE ================= */}
        {role === 'admin' && (
          <AdminDashboard
            settings={settings}
            activeSubTab={activeTab === 'partner-hub' ? 'dashboard' : activeTab}
            onSelectSubTab={setActiveTab}
            onLogout={handlePartnerHubLogout}
            adminUser={
              partnerHubAdmin || {
                uid: 'admin_silgrakmarak1309',
                username: 'silgrakmarak1309',
                displayName: 'Silgrak Marak (Super Administrator)',
                email: 'silgrakmarak1309@gmail.com',
                role: 'admin',
              }
            }
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
