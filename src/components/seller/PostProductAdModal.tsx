import React, { useState, useRef } from 'react';
import {
  X,
  Tag,
  DollarSign,
  Layers,
  Image as ImageIcon,
  UploadCloud,
  FileText,
  Package,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  CheckCircle,
  ExternalLink,
  MapPin,
  Store,
  User,
  Trash2,
  Plus,
} from 'lucide-react';
import { Shop, Product } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { saveProduct } from '../../services/dbService';

interface PostProductAdModalProps {
  isOpen: boolean;
  onClose: () => void;
  shop: Shop;
  onProductCreated?: (newProduct: Product) => void;
}

const CATEGORIES = [
  'Food',
  'Vegetables',
  'Grocery',
  'Electronics',
  'Mobiles',
  'Fashion',
  'Home & Kitchen',
  'Beauty & Health',
];

const MAX_IMAGE_SIZE_BYTES = 250 * 1024; // 250 KB strict maximum limit

export const PostProductAdModal: React.FC<PostProductAdModalProps> = ({
  isOpen,
  onClose,
  shop,
  onProductCreated,
}) => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Electronics');
  const [price, setPrice] = useState<string>('');
  const [discountPrice, setDiscountPrice] = useState<string>('');
  const [stock, setStock] = useState<string>('10');
  
  // File Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [fileSizeError, setFileSizeError] = useState<string | null>(null);

  // UI state
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Delivery Charges by Location State
  const [targetPinCode, setTargetPinCode] = useState<string>(shop?.servicePinCode || shop?.postalCode || '794114');
  const [villageRows, setVillageRows] = useState<Array<{ villageName: string; deliveryCharge: number }>>([]);

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

  if (!isOpen) return null;

  // Handle direct file upload from phone gallery / file manager
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileSizeError(null);
    setErrorMessage(null);

    const file = e.target.files?.[0];
    if (!file) return;

    // Strict 250KB limit check
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setFileSizeError('Maximum image size allowed is 250KB');
      setSelectedFile(null);
      setImagePreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    setSelectedFile(file);

    // Read and convert to Data URL for instant preview & backend storage
    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result as string);
    };
    reader.onerror = () => {
      setFileSizeError('Failed to read image file. Please try selecting again.');
      setSelectedFile(null);
      setImagePreview(null);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setSelectedFile(null);
    setImagePreview(null);
    setFileSizeError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // Image validation
    if (fileSizeError) {
      setErrorMessage(fileSizeError);
      return;
    }

    if (!imagePreview || !selectedFile) {
      setErrorMessage('Please upload a product photo from your photo gallery or files.');
      return;
    }

    if (selectedFile.size > MAX_IMAGE_SIZE_BYTES) {
      setErrorMessage('Maximum image size allowed is 250KB');
      return;
    }

    // Form fields validation
    const cleanName = name.trim();
    const cleanDesc = description.trim();
    const numPrice = Number(price);
    const numDiscountPrice = discountPrice ? Number(discountPrice) : numPrice;
    const numStock = Number(stock);

    if (!cleanName) {
      setErrorMessage('Please enter a product title/name.');
      return;
    }

    if (!cleanDesc) {
      setErrorMessage('Please provide a product description.');
      return;
    }

    if (isNaN(numPrice) || numPrice <= 0) {
      setErrorMessage('Please enter a valid MRP price greater than 0.');
      return;
    }

    if (isNaN(numDiscountPrice) || numDiscountPrice <= 0) {
      setErrorMessage('Please enter a valid selling price.');
      return;
    }

    if (numDiscountPrice > numPrice) {
      setErrorMessage('Selling/Discount price cannot be higher than MRP.');
      return;
    }

    if (isNaN(numStock) || numStock < 0) {
      setErrorMessage('Stock quantity must be 0 or more.');
      return;
    }

    setLoading(true);

    try {
      const prodId = 'prod_' + Date.now();
      const finalTargetPin = (targetPinCode || shop.servicePinCode || shop.postalCode || '794114').trim();
      const cleanedVillages = villageRows
        .filter((r) => r.villageName.trim().length > 0)
        .map((r) => ({
          villageName: r.villageName.trim(),
          deliveryCharge: Number(r.deliveryCharge) >= 0 ? Number(r.deliveryCharge) : 0,
        }));

      const newProduct: Product = {
        id: prodId,
        shopId: shop.id,
        shopName: shop.shopName,
        name: cleanName,
        category,
        description: cleanDesc,
        price: numPrice,
        discountPrice: numDiscountPrice,
        stock: numStock,
        sku: 'SKU-' + Math.floor(10000 + Math.random() * 90000),
        images: [imagePreview], // Suitable data URL format stored directly in Supabase text[] column
        specifications: {
          Category: category,
          'Seller ID': user?.uid || shop.ownerId,
          'Service PIN': finalTargetPin,
          Condition: 'Brand New',
          'File Name': selectedFile.name,
          'File Size': `${(selectedFile.size / 1024).toFixed(1)} KB`,
        },
        isActive: true,
        isApproved: true,
        deliveryAvailable: true,
        rating: 4.8,
        reviewCount: 0,
        sellerPinCode: finalTargetPin,
        shopPinCode: (shop.postalCode || finalTargetPin).trim(),
        targetPinCode: finalTargetPin,
        villageDeliveryRates: cleanedVillages,
        createdAt: new Date().toISOString(),
      };

      // Direct insert into Supabase public.products table
      await saveProduct(newProduct);

      setSuccessMessage('Product Ad successfully posted to BazaarX and saved in Supabase!');
      if (onProductCreated) {
        onProductCreated(newProduct);
      }

      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error('Failed to post product ad:', err);
      setErrorMessage(err.message || 'Failed to insert product into database. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[94vh] flex flex-col animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 text-white flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl">
              <Sparkles className="w-5 h-5 text-yellow-300" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">Post Ad / Product Listing</h2>
              <p className="text-xs text-emerald-100">
                Publish a new item for local shoppers on BazaarX Marketplace
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/20 transition cursor-pointer text-white"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* Automatically Captured Seller & Shop Context */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-700 font-medium">
              <Store className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>
                Shop: <strong className="text-slate-900">{shop.shopName}</strong>
              </span>
            </div>

            <div className="flex items-center gap-2 text-slate-700 font-medium">
              <User className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>
                Seller ID:{' '}
                <strong className="text-slate-900 font-mono text-[11px]">
                  {user?.uid || shop.ownerId}
                </strong>
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-slate-600">
              <MapPin className="w-3.5 h-3.5 text-emerald-600" />
              <span>PIN: {shop.servicePinCode || shop.postalCode || '794001'}</span>
            </div>
          </div>

          {/* Feedback Messages */}
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* 1. Product Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Product Name / Title *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Wireless Noise-Cancelling Earbuds or Organic Kashmiri Walnuts (500g)"
              className="w-full p-2.5 border border-slate-300 rounded-xl text-xs bg-white outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition"
            />
          </div>

          {/* 2. Category & Stock Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Category *
              </label>
              <div className="relative">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-xs bg-white outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 appearance-none transition"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                <Layers className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Stock / Available Quantity *
              </label>
              <div className="relative">
                <input
                  type="number"
                  required
                  min={0}
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  placeholder="e.g. 25"
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-xs bg-white outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition"
                />
                <Package className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* 3. Pricing Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                MRP / List Price (₹) *
              </label>
              <div className="relative">
                <input
                  type="number"
                  required
                  min={1}
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="e.g. 1999"
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-xs bg-white outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition"
                />
                <DollarSign className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
              </div>
              <span className="text-[10px] text-slate-400">Regular printed price (MRP)</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Selling / Discounted Price (₹) *
              </label>
              <div className="relative">
                <input
                  type="number"
                  required
                  min={1}
                  step="0.01"
                  value={discountPrice}
                  onChange={(e) => setDiscountPrice(e.target.value)}
                  placeholder="e.g. 1499"
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-xs bg-white outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition"
                />
                <Tag className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
              </div>
              <span className="text-[10px] text-slate-400">Actual customer checkout price</span>
            </div>
          </div>

          {/* 4. Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Description & Highlights *
            </label>
            <textarea
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe key features, package contents, material quality, warranty, and special details..."
              className="w-full p-2.5 border border-slate-300 rounded-xl text-xs bg-white outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition resize-none"
            />
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
              <label className="block text-slate-700 font-semibold text-xs mb-1">
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
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
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

          {/* 5. Product Image Upload (Direct from Phone Gallery / Files, Max 250KB) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />
                <span>Product Photo / Image *</span>
              </label>
              <span className="text-[11px] font-semibold text-slate-500">
                Max allowed: <span className="text-emerald-700 font-bold">250KB</span>
              </span>
            </div>

            {/* Hidden native file input supporting mobile gallery, camera, and desktop file picker */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />

            {!imagePreview ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 group ${
                  fileSizeError
                    ? 'border-red-400 bg-red-50/50 hover:bg-red-50'
                    : 'border-slate-300 hover:border-emerald-600 bg-slate-50/60 hover:bg-emerald-50/30'
                }`}
              >
                <div className="w-12 h-12 rounded-full bg-emerald-100/80 group-hover:bg-emerald-200 text-emerald-700 flex items-center justify-center transition">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800">
                    Click to choose photo from Gallery or Files
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Supports JPG, PNG, WEBP • Max size: 250KB
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="mt-1 px-3 py-1.5 bg-white border border-slate-300 group-hover:border-emerald-600 text-slate-700 group-hover:text-emerald-700 font-semibold text-[11px] rounded-lg shadow-2xs transition"
                >
                  Browse Device Gallery
                </button>
              </div>
            ) : (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-16 h-16 bg-white rounded-lg border border-slate-200 overflow-hidden shrink-0 shadow-2xs">
                    <img
                      src={imagePreview}
                      alt="Uploaded preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">
                      {selectedFile?.name || 'product-image.jpg'}
                    </p>
                    <p className="text-[11px] text-emerald-700 font-semibold mt-0.5 flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        Size: {selectedFile ? (selectedFile.size / 1024).toFixed(1) : 0} KB (Valid ≤ 250KB)
                      </span>
                    </p>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-[11px] text-indigo-600 hover:text-indigo-800 underline mt-0.5 cursor-pointer"
                    >
                      Change photo
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer shrink-0"
                  title="Remove image"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Strict validation message if file exceeds 250KB */}
            {fileSizeError && (
              <div className="mt-2 p-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span className="font-semibold">{fileSizeError}</span>
              </div>
            )}
          </div>

          {/* Footer Submit Buttons */}
          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-end gap-2.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="min-h-[42px] px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-800 transition cursor-pointer touch-manipulation active:scale-95"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className="min-h-[44px] px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer touch-manipulation active:scale-95 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Posting to Supabase...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-yellow-300" />
                  <span>Post Ad & Publish Product</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
