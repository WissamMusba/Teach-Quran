export type ProductCategory =
  | 'bats'
  | 'balls'
  | 'pads'
  | 'gloves'
  | 'helmets'
  | 'bags'
  | 'shoes';

export interface Product {
  id: string;
  title: string;
  slug: string;
  category: ProductCategory | string;
  brand: string;
  description: string | null;
  price: number;
  stock_quantity: number;
  images: string[];
  specifications: Record<string, string>;
  is_featured: boolean;
  is_active: boolean;
  created_at: string;
}

export interface ShippingAddress {
  street: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

export type PaymentMethod = 'card' | 'cod';
export type PaymentStatus = 'pending' | 'paid' | 'failed';
export type OrderStatus = 'new' | 'packed' | 'shipped' | 'delivered' | 'cancelled';

export interface OrderItem {
  id?: string;
  order_id?: string;
  product_id: string | null;
  product_title: string;
  unit_price: number;
  quantity: number;
  selected_options?: Record<string, string>;
}

export interface Order {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  shipping_address: ShippingAddress;
  total_amount: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  order_status: OrderStatus;
  stripe_session_id?: string | null;
  created_at: string;
  items?: OrderItem[];
}

export interface SiteSettings {
  id: number;
  announcement_text: string;
  hero_headline: string;
  hero_subheadline: string;
  hero_banner_image: string;
  updated_at: string;
}

export interface CartItem {
  productId: string;
  title: string;
  slug: string;
  price: number;
  image: string;
  quantity: number;
  selectedOptions?: Record<string, string>;
  maxStock: number;
}
