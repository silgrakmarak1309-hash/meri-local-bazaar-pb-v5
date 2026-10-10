import React from 'react';
import {
  Home,
  Grid,
  Package,
  User,
  LayoutDashboard,
  Box,
  Wallet,
  Store,
  Bike,
  TrendingUp,
  Settings,
  CreditCard,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';

interface BottomNavProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onSelectTab }) => {
  const { role } = useAuth();
  const { itemCount } = useCart();

  // Navigation tabs definition based on role
  // For mobile customer view: strictly 4 essential buttons (Home, Categories, My Orders, Account)
  const getNavItems = () => {
    switch (role) {
      case 'customer':
        return [
          { id: 'home', label: 'Home', icon: Home },
          { id: 'categories', label: 'Categories', icon: Grid },
          { id: 'orders', label: 'My Orders', icon: Package },
          { id: 'profile', label: 'Account', icon: User },
        ];
      case 'seller':
        return [
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'products', label: 'Products', icon: Box },
          { id: 'orders', label: 'Orders', icon: Package },
          { id: 'wallet', label: 'Wallet', icon: Wallet },
          { id: 'profile', label: 'Shop Info', icon: Store },
        ];
      case 'delivery_partner':
        return [
          { id: 'home', label: 'Available', icon: Bike },
          { id: 'deliveries', label: 'My Tasks', icon: Package },
          { id: 'wallet', label: 'Wallet', icon: Wallet },
          { id: 'earnings', label: 'Earnings', icon: TrendingUp },
          { id: 'profile', label: 'Profile', icon: User },
        ];
      case 'admin':
        return [
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'shops', label: 'Shops', icon: Store },
          { id: 'orders', label: 'Orders', icon: Package },
          { id: 'delivery', label: 'Fleet', icon: Bike },
          { id: 'payouts', label: 'Payouts', icon: CreditCard },
          { id: 'settings', label: 'Settings', icon: Settings },
        ];
      default:
        return [
          { id: 'home', label: 'Home', icon: Home },
          { id: 'categories', label: 'Categories', icon: Grid },
          { id: 'orders', label: 'My Orders', icon: Package },
          { id: 'profile', label: 'Account', icon: User },
        ];
    }
  };

  const navItems = getNavItems();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200/90 shadow-[0_-4px_20px_rgba(0,0,0,0.07)] px-2 py-1 flex items-center justify-around md:hidden pb-[max(0.5rem,env(safe-area-inset-bottom))] transition-all">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelectTab(item.id)}
            className={`flex-1 flex flex-col items-center justify-center py-1 px-1 min-h-[50px] relative transition-all duration-150 active:scale-95 cursor-pointer touch-manipulation select-none ${
              isActive
                ? 'text-[#2874f0] font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <div className="relative flex items-center justify-center">
              <Icon
                className={`w-5 h-5 transition-transform duration-150 ${
                  isActive ? 'stroke-[2.5] scale-110 text-[#2874f0]' : 'stroke-2'
                }`}
              />
            </div>
            <span
              className={`text-[11px] mt-1 tracking-tight truncate max-w-[76px] ${
                isActive ? 'font-bold text-[#2874f0]' : 'font-medium text-slate-600'
              }`}
            >
              {item.label}
            </span>
            {isActive && (
              <span className="absolute bottom-0 w-8 h-0.5 bg-[#2874f0] rounded-full" />
            )}
          </button>
        );
      })}
    </nav>
  );
};
