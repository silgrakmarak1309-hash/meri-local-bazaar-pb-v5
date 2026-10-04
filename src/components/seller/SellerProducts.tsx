import React, { useState } from 'react';
import {
  Plus,
  Box,
  Edit2,
  Trash2,
  Check,
  X,
  Image,
  Tag,
  Layers,
  AlertCircle,
  Eye,
  EyeOff,
  MapPin,
} from 'lucide-react';
import { Product, Shop } from '../../types';
import { saveProduct, deleteProduct } from '../../services/dbService';

interface SellerProductsProps {
  shop: Shop;
  products: Product[];
  onOpenPostAd?: () => void;
}

export const SellerProducts: React.FC<SellerProductsProps> = ({ shop, products, onOpenPostAd }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Electronics');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState<number>(999);
  const [discountPrice, setDiscountPrice] = useState<number>(799);
  const [stock, setStock] = useState<number>(20);
  const [sku, setSku] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [specKey, setSpecKey] = useState('');
  const [specVal, setSpecVal] = useState('');
  const [specs, setSpecs] = useState<Record<string, string>>({});
  const [deliveryAvailable, setDeliveryAvailable] = useState(true);
  const [loading, setLoading] = useState(false);

  // Delivery Charges by Location
  const [targetPinCode, setTargetPinCode] = useState<string>('');
  const [villageRows, setVillageRows] = useState<Array<{ villageName: string; deliveryCharge: number }>>([]);

  const openAddModal = () => {
    setEditingProduct(null);
    setName('');
    setCategory('Electronics');
    setDescription('');
    setPrice(999);
    setDiscountPrice(799);
    setStock(20);
    setSku('SKU-' + Math.floor(1000 + Math.random() * 9000));
    setImageUrl('');
    setSpecs({});
    setDeliveryAvailable(true);
    setTargetPinCode(shop?.servicePinCode || shop?.postalCode || '794114');
    setVillageRows([]);
    setIsModalOpen(true);
  };

  const openEditModal = (prod: Product) => {
    setEditingProduct(prod);
    setName(prod.name);
    setCategory(prod.category);
    setDescription(prod.description);
    setPrice(prod.price);
    setDiscountPrice(prod.discountPrice);
    setStock(prod.stock);
    setSku(prod.sku || '');
    setImageUrl(prod.images[0] || '');
    setSpecs(prod.specifications || {});
    setDeliveryAvailable(prod.deliveryAvailable);
    setTargetPinCode(prod.targetPinCode || prod.sellerPinCode || shop?.servicePinCode || '794114');
    setVillageRows(
      Array.isArray(prod.villageDeliveryRates) && prod.villageDeliveryRates.length > 0
        ? [...prod.villageDeliveryRates]
        : []
    );
    setIsModalOpen(true);
  };

  const handleAddVillageRow = () => {
    setVillageRows((prev) => [...prev, { villageName: '', deliveryCharge: 15 }]);
  };

  const handleUpdateVillageRow = (index: number, field: 'villageName' | 'deliveryCharge', value: any) => {
    setVillageRows((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleRemoveVillageRow = (index: number) => {
    setVillageRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddSpec = () => {
    if (!specKey.trim() || !specVal.trim()) return;
    setSpecs({ ...specs, [specKey.trim()]: specVal.trim() });
    setSpecKey('');
    setSpecVal('');
  };

  const handleRemoveSpec = (key: string) => {
    const updated = { ...specs };
    delete updated[key];
    setSpecs(updated);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const prodId = editingProduct ? editingProduct.id : 'prod_' + Date.now();
      const cleanedVillages = villageRows
        .filter((r) => r.villageName.trim().length > 0)
        .map((r) => ({
          villageName: r.villageName.trim(),
          deliveryCharge: Number(r.deliveryCharge) >= 0 ? Number(r.deliveryCharge) : 0,
        }));

      const finalTargetPin = (targetPinCode || shop?.servicePinCode || shop?.postalCode || '794114').trim();

      const productData: Product = {
        id: prodId,
        shopId: shop.id,
        shopName: shop.shopName,
        name,
        category,
        description,
        price: Number(price),
        discountPrice: Number(discountPrice) || Number(price),
        stock: Number(stock),
        sku,
        images: imageUrl
          ? [imageUrl]
          : [
              'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80',
            ],
        specifications: specs,
        isActive: editingProduct ? editingProduct.isActive : true,
        isApproved: editingProduct ? editingProduct.isApproved : true,
        deliveryAvailable,
        createdAt: editingProduct ? editingProduct.createdAt : new Date().toISOString(),
        sellerPinCode: finalTargetPin,
        shopPinCode: shop.postalCode || finalTargetPin,
        targetPinCode: finalTargetPin,
        villageDeliveryRates: cleanedVillages,
      };

      await saveProduct(productData);
      setIsModalOpen(false);
    } catch (err) {
      console.error('Save product error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (prod: Product) => {
    await saveProduct({ ...prod, isActive: !prod.isActive });
  };

  const handleDelete = async (prodId: string) => {
    if (confirm('Are you sure you want to delete this product?')) {
      await deleteProduct(prodId);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base sm:text-lg font-black text-slate-900">
            Product Catalog ({products.length})
          </h2>
          <p className="text-xs text-slate-500">
            Manage your shop products, pricing, specifications, and available stock
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onOpenPostAd && (
            <button
              onClick={onOpenPostAd}
              className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-sm transition cursor-pointer"
            >
              <Plus className="w-4 h-4 text-yellow-300" />
              <span>Post Ad / Product Listing</span>
            </button>
          )}

          <button
            onClick={openAddModal}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-sm transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center shadow-2xs">
          <Box className="w-12 h-12 text-slate-300 mx-auto mb-2" />
          <h3 className="font-bold text-slate-800 text-sm">No Products Listed Yet</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
            Add your first item to start receiving orders from local customers.
          </p>
          <button
            onClick={openAddModal}
            className="mt-4 px-4 py-2 bg-emerald-600 text-white font-bold text-xs rounded-lg shadow-sm hover:bg-emerald-700 transition"
          >
            Add First Product
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {products.map((prod) => (
            <div
              key={prod.id}
              className={`bg-white rounded-xl border p-3 flex flex-col justify-between shadow-2xs transition ${
                prod.isActive ? 'border-slate-200' : 'border-slate-200 opacity-60 bg-slate-50'
              }`}
            >
              <div>
                <div className="flex items-start gap-3">
                  <img
                    src={prod.images[0]}
                    alt={prod.name}
                    className="w-16 h-16 object-contain rounded bg-slate-50 p-1 border border-slate-100 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                      {prod.category}
                    </span>
                    <h4 className="text-xs font-bold text-slate-900 truncate mt-1">{prod.name}</h4>
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <span className="text-xs font-black text-slate-900">
                        ₹{prod.discountPrice.toLocaleString('en-IN')}
                      </span>
                      {prod.price > prod.discountPrice && (
                        <span className="text-[10px] text-slate-400 line-through">
                          ₹{prod.price.toLocaleString('en-IN')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2 rounded border border-slate-100">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Stock</span>
                    <span className={`font-bold ${prod.stock > 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                      {prod.stock > 0 ? `${prod.stock} units` : 'Out of stock'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">SKU</span>
                    <span className="font-semibold text-slate-700 truncate block">
                      {prod.sku || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <button
                  onClick={() => handleToggleActive(prod)}
                  className={`min-h-[36px] px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition touch-manipulation active:scale-95 cursor-pointer ${
                    prod.isActive
                      ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                      : 'text-slate-600 bg-slate-100 hover:bg-slate-200'
                  }`}
                >
                  {prod.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  <span>{prod.isActive ? 'Active' : 'Disabled'}</span>
                </button>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditModal(prod)}
                    className="min-h-[36px] min-w-[36px] flex items-center justify-center p-2 rounded-lg hover:bg-slate-100 text-slate-700 transition touch-manipulation active:scale-95 cursor-pointer"
                    title="Edit Product"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(prod.id)}
                    className="min-h-[36px] min-w-[36px] flex items-center justify-center p-2 rounded-lg hover:bg-red-50 text-red-500 transition touch-manipulation active:scale-95 cursor-pointer"
                    title="Delete Product"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
          <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95">
            <div className="px-5 py-3.5 bg-emerald-700 text-white flex items-center justify-between">
              <h3 className="text-sm sm:text-base font-bold">
                {editingProduct ? 'Edit Product' : 'Add New Product to Catalog'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-full hover:bg-white/20 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Product Title *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Sony WH-1000XM5 Wireless Headphones"
                  className="w-full p-2 border border-slate-300 rounded outline-none focus:border-emerald-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Category *</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded outline-none focus:border-emerald-600"
                  >
                    <option value="Food">Food (Meals & Snacks)</option>
                    <option value="Vegetables">Vegetables & Fresh Greens</option>
                    <option value="Grocery">Grocery & Daily Essentials</option>
                    <option value="Electronics">Electronics</option>
                    <option value="Mobiles">Mobiles & Accessories</option>
                    <option value="Fashion">Fashion</option>
                    <option value="Home & Kitchen">Home & Kitchen</option>
                    <option value="Beauty & Health">Beauty & Health</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">SKU / Item Code</label>
                  <input
                    type="text"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder="e.g. SNY-WH-XM5"
                    className="w-full p-2 border border-slate-300 rounded outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">MRP Price (₹) *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    className="w-full p-2 border border-slate-300 rounded outline-none focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Selling Price (₹) *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={discountPrice}
                    onChange={(e) => setDiscountPrice(Number(e.target.value))}
                    className="w-full p-2 border border-slate-300 rounded outline-none focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Stock Quantity *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={stock}
                    onChange={(e) => setStock(Number(e.target.value))}
                    className="w-full p-2 border border-slate-300 rounded outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Product Image URL</label>
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full p-2 border border-slate-300 rounded outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Key features, specifications, and product summary..."
                  className="w-full p-2 border border-slate-300 rounded outline-none focus:border-emerald-600"
                />
              </div>

              {/* Specifications Builder */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span className="block font-bold text-slate-700 mb-2">Technical Specifications</span>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={specKey}
                    onChange={(e) => setSpecKey(e.target.value)}
                    placeholder="Attribute (e.g. Battery)"
                    className="flex-1 p-1.5 border border-slate-300 rounded bg-white"
                  />
                  <input
                    type="text"
                    value={specVal}
                    onChange={(e) => setSpecVal(e.target.value)}
                    placeholder="Value (e.g. 30 Hours)"
                    className="flex-1 p-1.5 border border-slate-300 rounded bg-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddSpec}
                    className="px-3 py-1 bg-slate-800 text-white font-bold rounded hover:bg-slate-900"
                  >
                    Add
                  </button>
                </div>

                <div className="space-y-1">
                  {Object.entries(specs).map(([k, v]) => (
                    <div
                      key={k}
                      className="flex items-center justify-between bg-white px-2 py-1 rounded border border-slate-200 text-[11px]"
                    >
                      <span className="font-medium text-slate-600">{k}: {v}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSpec(k)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Delivery Charges by Location */}
              <div className="bg-slate-50 p-3 sm:p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center gap-2 pb-1 border-b border-slate-200/80">
                  <MapPin className="w-4 h-4 text-emerald-700" />
                  <div>
                    <h4 className="font-bold text-slate-800 text-xs sm:text-sm">
                      Delivery Charges by Location
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Set up custom village or locality delivery charges under a specific target pincode.
                    </p>
                  </div>
                </div>

                {/* Target Pincode Field */}
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Target Pincode *
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={targetPinCode}
                    onChange={(e) => setTargetPinCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="e.g. 794114"
                    className="w-full sm:w-1/2 p-2 border border-slate-300 rounded-lg bg-white outline-none focus:border-emerald-600 font-medium text-slate-800 text-xs"
                  />
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    Customers matching this pincode will see these village delivery fees on checkout.
                  </span>
                </div>

                {/* Dynamic Repeating Rows */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-slate-700 font-semibold text-xs">
                      Villages / Localities & Delivery Fees
                    </label>
                    <button
                      type="button"
                      onClick={handleAddVillageRow}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 transition cursor-pointer shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Add Village & Delivery Fee</span>
                    </button>
                  </div>

                  {villageRows.length === 0 ? (
                    <div className="text-center py-3 px-2 bg-white rounded-lg border border-dashed border-slate-300 text-slate-400 text-[11px]">
                      No custom village delivery rates added yet. Click <span className="font-bold text-emerald-600">+ Add Village & Delivery Fee</span> to set locality fees.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {villageRows.map((row, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-200 shadow-2xs"
                        >
                          <div className="flex-1">
                            <label className="block text-[10px] text-slate-500 font-medium mb-0.5">
                              Village / Locality Name
                            </label>
                            <input
                              type="text"
                              value={row.villageName}
                              onChange={(e) => handleUpdateVillageRow(idx, 'villageName', e.target.value)}
                              placeholder="e.g. Near Bazaar Ward"
                              className="w-full p-1.5 border border-slate-300 rounded text-xs outline-none focus:border-emerald-600"
                            />
                          </div>

                          <div className="w-28 sm:w-32">
                            <label className="block text-[10px] text-slate-500 font-medium mb-0.5">
                              Delivery Charge (₹)
                            </label>
                            <div className="relative">
                              <span className="absolute left-2 top-1.5 text-slate-400 text-xs">₹</span>
                              <input
                                type="number"
                                min={0}
                                value={row.deliveryCharge}
                                onChange={(e) =>
                                  handleUpdateVillageRow(idx, 'deliveryCharge', Number(e.target.value))
                                }
                                placeholder="15"
                                className="w-full p-1.5 pl-5 border border-slate-300 rounded text-xs outline-none focus:border-emerald-600 font-semibold text-slate-800"
                              />
                            </div>
                          </div>

                          <div className="pt-4">
                            <button
                              type="button"
                              onClick={() => handleRemoveVillageRow(idx)}
                              className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition cursor-pointer"
                              title="Delete Row"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-sm"
                >
                  {loading ? 'Saving...' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
