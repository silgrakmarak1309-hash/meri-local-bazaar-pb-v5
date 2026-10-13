import React, { useState, useEffect } from 'react';
import {
  Package,
  Clock,
  CheckCircle,
  Truck,
  MapPin,
  Phone,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { SellerOrder, OrderStatus, Shop } from '../../types';
import { updateSellerOrderStatus, fetchSellerOrdersFromSupabase } from '../../services/dbService';
import { supabase } from '../../supabase';

interface SellerOrdersProps {
  orders: SellerOrder[];
  shop: Shop;
  onRefresh?: () => void;
}

export const SellerOrders: React.FC<SellerOrdersProps> = ({ orders, shop, onRefresh }) => {
  const [localOrders, setLocalOrders] = useState<SellerOrder[]>(orders);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'new_orders' | 'in_progress' | 'ready' | 'delivered'>('all');

  useEffect(() => {
    const targetShop = {
      id: shop?.id || 'shop_1791092440747',
      shopName: shop?.shopName || 'Marak shop',
      ownerId: shop?.ownerId,
    };

    const loadOrders = async () => {
      const fresh = await fetchSellerOrdersFromSupabase(targetShop);
      if (fresh) {
        setLocalOrders(fresh);
      }
    };

    loadOrders();

    // Setup Supabase Realtime channel for instant order reflection on confirmation
    const channel = supabase
      .channel(`realtime:seller_orders_${shop?.id || 'global'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        loadOrders();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'seller_orders' }, () => {
        loadOrders();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [shop?.id, shop?.shopName]);

  useEffect(() => {
    if (orders && orders.length > 0) {
      setLocalOrders(orders);
    }
  }, [orders]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      const fresh = await fetchSellerOrdersFromSupabase({
        id: shop?.id || 'shop_1791092440747',
        shopName: shop?.shopName || 'Marak shop',
        ownerId: shop?.ownerId,
      });
      if (fresh) {
        setLocalOrders(fresh);
      }
    } catch (e) {
      console.warn('Seller orders refresh notice:', e);
    } finally {
      setIsRefreshing(false);
      if (onRefresh) onRefresh();
    }
  };

  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    setUpdatingId(orderId);
    // Optimistically update local view
    setLocalOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
    );
    try {
      await updateSellerOrderStatus(orderId, newStatus, {
        shopId: shop.id,
        shopName: shop.shopName,
        shopAddress: shop.shopAddress,
        shopPhone: shop.phoneNumber,
      });
      if (onRefresh) onRefresh();
    } catch (e) {
      console.error('Error updating status:', e);
    } finally {
      setUpdatingId(null);
    }
  };

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'delivered':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'pending':
      case 'pending_verification':
        return 'bg-amber-100 text-amber-900 border-amber-300 font-bold animate-pulse';
      case 'confirmed':
        return 'bg-emerald-100 text-emerald-900 border-emerald-400 font-bold';
      case 'ready_for_pickup':
        return 'bg-purple-100 text-purple-800 border-purple-300 animate-pulse';
      case 'packed':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'processing':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'picked_up':
      case 'out_for_delivery':
        return 'bg-indigo-100 text-indigo-800 border-indigo-300';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  const newOrdersCount = localOrders.filter((o) => o.status === 'confirmed').length;
  const inProgressCount = localOrders.filter((o) => o.status === 'processing' || o.status === 'packed').length;
  const readyCount = localOrders.filter((o) => o.status === 'ready_for_pickup' || o.status === 'picked_up' || o.status === 'out_for_delivery').length;
  const deliveredCount = localOrders.filter((o) => o.status === 'delivered').length;

  const filteredOrders = localOrders.filter((o) => {
    if (statusFilter === 'new_orders') return o.status === 'confirmed';
    if (statusFilter === 'in_progress') return o.status === 'processing' || o.status === 'packed';
    if (statusFilter === 'ready') return o.status === 'ready_for_pickup' || o.status === 'picked_up' || o.status === 'out_for_delivery';
    if (statusFilter === 'delivered') return o.status === 'delivered';
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-black text-slate-900">
            Order Fulfillment Center ({localOrders.length})
          </h2>
          <p className="text-xs text-slate-500">
            Fulfill incoming customer orders, pack items, and dispatch to delivery fleet
          </p>
        </div>
        <button
          onClick={handleManualRefresh}
          disabled={isRefreshing}
          className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
          <span>{isRefreshing ? 'Refreshing...' : 'Refresh Orders'}</span>
        </button>
      </div>

      {/* Filter Tabs for Quick Processing */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-100 rounded-xl text-xs">
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
            statusFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          All Orders ({localOrders.length})
        </button>
        <button
          onClick={() => setStatusFilter('new_orders')}
          className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
            statusFilter === 'new_orders'
              ? 'bg-emerald-600 text-white shadow-2xs'
              : 'text-emerald-800 hover:text-emerald-950'
          }`}
        >
          <span>⚡ New Orders (Awaiting Preparation)</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${statusFilter === 'new_orders' ? 'bg-white text-emerald-900' : 'bg-emerald-100 text-emerald-900'}`}>
            {newOrdersCount}
          </span>
        </button>
        <button
          onClick={() => setStatusFilter('in_progress')}
          className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
            statusFilter === 'in_progress' ? 'bg-white text-blue-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Packing & In Progress ({inProgressCount})
        </button>
        <button
          onClick={() => setStatusFilter('ready')}
          className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
            statusFilter === 'ready' ? 'bg-white text-purple-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Ready for Pickup ({readyCount})
        </button>
        <button
          onClick={() => setStatusFilter('delivered')}
          className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
            statusFilter === 'delivered' ? 'bg-white text-emerald-800 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Delivered ({deliveredCount})
        </button>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center shadow-2xs">
          <Package className="w-12 h-12 text-slate-300 mx-auto mb-2" />
          <h3 className="font-bold text-slate-800 text-sm">No Orders in this Category</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
            {statusFilter === 'new_orders'
              ? 'No new confirmed orders awaiting preparation right now.'
              : 'When customers purchase products from your shop, their orders appear here for fulfillment.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => (
            <div
              key={order.id}
              className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 space-y-3 transition"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-slate-900">#{order.id}</span>
                  <span className="text-[10px] text-slate-400">
                    Master Order: #{order.orderId}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${getStatusBadge(
                      order.status
                    )}`}
                  >
                    {order.status.replace(/_/g, ' ')}
                  </span>
                  {order.transactionId && (
                    <span className="text-[10px] font-mono font-bold bg-blue-50 text-blue-900 px-2 py-0.5 rounded border border-blue-200">
                      UTR: {order.transactionId}
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-400">
                  {new Date(order.createdAt).toLocaleDateString()} at{' '}
                  {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>

              {/* Items in order */}
              <div className="divide-y divide-slate-100">
                {order.items.map((it, idx) => (
                  <div key={idx} className="py-2 flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <img
                        src={it.image}
                        alt=""
                        className="w-10 h-10 object-contain rounded bg-slate-50 p-1 border border-slate-100 shrink-0"
                      />
                      <div>
                        <h5 className="font-bold text-slate-800">{it.name}</h5>
                        <p className="text-[10px] text-slate-400">
                          Qty: {it.quantity} × ₹{it.discountPrice.toLocaleString('en-IN')}
                        </p>
                      </div>
                    </div>
                    <div className="font-bold text-slate-900">
                      ₹{(it.discountPrice * it.quantity).toLocaleString('en-IN')}
                    </div>
                  </div>
                ))}
              </div>

              {/* Customer & Address details */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Deliver To</span>
                  <span className="font-bold text-slate-800">{order.customerName}</span>
                  <p className="text-slate-600 mt-0.5">
                    {order.deliveryAddress.streetAddress}, {order.deliveryAddress.city} -{' '}
                    {order.deliveryAddress.postalCode}
                  </p>
                  <p className="text-slate-500">{order.customerPhone}</p>
                </div>

                <div className="space-y-1 sm:text-right">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Earnings Breakdown</span>
                  <div className="flex justify-between sm:justify-end sm:gap-4 text-slate-600">
                    <span>Gross Sales:</span>
                    <span className="font-semibold">₹{order.sellerSubtotal.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between sm:justify-end sm:gap-4 text-slate-500">
                    <span>Platform Commission:</span>
                    <span>-₹{order.commissionAmount.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between sm:justify-end sm:gap-4 text-emerald-700 font-bold border-t border-slate-200 pt-1">
                    <span>Your Net Earning:</span>
                    <span className="text-sm font-black">₹{order.sellerEarnings.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              {/* Workflow Actions */}
              <div className="pt-1 flex flex-wrap items-center justify-between gap-2">
                <div className="text-[11px] text-slate-500 font-medium">
                  {(order.status === 'pending_verification' || order.status === 'pending') && '⏳ Payment Verification: Verify customer UPI UTR in bank statement before processing.'}
                  {order.status === 'confirmed' && 'Action Required: Accept order to begin packing.'}
                  {order.status === 'processing' && 'Packing in progress. Mark packed when items are boxed.'}
                  {order.status === 'packed' && 'Ready to dispatch. Notify delivery partner fleet.'}
                  {order.status === 'ready_for_pickup' && '🛵 Waiting for delivery partner pickup at your shop.'}
                  {order.status === 'picked_up' && '🚚 Order picked up by rider and in transit.'}
                  {order.status === 'delivered' && '🎉 Order successfully delivered to customer!'}
                </div>

                <div className="flex items-center gap-2">
                  {(order.status === 'pending_verification' || order.status === 'pending') && (
                    <button
                      onClick={() => handleStatusChange(order.id, 'processing')}
                      disabled={updatingId === order.id}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-2xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Verify UTR & Accept Order</span>
                    </button>
                  )}

                  {order.status === 'confirmed' && (
                    <button
                      onClick={() => handleStatusChange(order.id, 'processing')}
                      disabled={updatingId === order.id}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95 animate-bounce-subtle"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-emerald-200" />
                      <span>Accept & Start Preparation 📦</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {order.status === 'processing' && (
                    <button
                      onClick={() => handleStatusChange(order.id, 'packed')}
                      disabled={updatingId === order.id}
                      className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg shadow-2xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <span>Mark Packed 📦</span>
                    </button>
                  )}

                  {order.status === 'packed' && (
                    <button
                      onClick={() => handleStatusChange(order.id, 'ready_for_pickup')}
                      disabled={updatingId === order.id}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <span>Dispatch (Ready for Pickup) 🛵</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
