import React from 'react';
import { MessageCircle } from 'lucide-react';

interface BecomeSellerButtonProps {
  className?: string;
  variant?: 'primary' | 'outline' | 'compact';
  label?: string;
  showIcon?: boolean;
}

const ADMIN_WHATSAPP_NUMBER = '916009092096';
const PREFILLED_MESSAGE =
  'Hello Admin, I want to register my account as a seller on Balpakram Online Store. Please approve my request.';

export const getBecomeSellerWhatsAppUrl = () => {
  return `https://wa.me/${ADMIN_WHATSAPP_NUMBER}?text=${encodeURIComponent(PREFILLED_MESSAGE)}`;
};

export const BecomeSellerButton: React.FC<BecomeSellerButtonProps> = ({
  className = '',
  variant = 'primary',
  label = 'Become a Seller',
  showIcon = true,
}) => {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = getBecomeSellerWhatsAppUrl();
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-[#25D366] hover:bg-[#20ba5a] active:scale-95 shadow-xs transition cursor-pointer touch-manipulation ${className}`}
        title="Chat on WhatsApp with Admin to become a seller"
      >
        {showIcon && <MessageCircle className="w-3.5 h-3.5 shrink-0" />}
        <span>{label}</span>
      </button>
    );
  }

  if (variant === 'outline') {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-[#128C7E] bg-emerald-50 hover:bg-emerald-100 border border-[#25D366] active:scale-95 transition cursor-pointer touch-manipulation ${className}`}
      >
        {showIcon && <MessageCircle className="w-4 h-4 text-[#25D366] shrink-0" />}
        <span>{label}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-[#25D366] hover:bg-[#20ba5a] active:scale-95 shadow-md hover:shadow-lg transition cursor-pointer touch-manipulation ${className}`}
    >
      {showIcon && <MessageCircle className="w-4 h-4 shrink-0" />}
      <span>{label}</span>
    </button>
  );
};
