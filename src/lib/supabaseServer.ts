import { createClient } from '@supabase/supabase-js';
import { Product, SiteSettings, Order, OrderItem, OrderStatus, PaymentStatus } from './types';
import { INITIAL_PRODUCTS, INITIAL_SITE_SETTINGS, INITIAL_ORDERS } from './mockData';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseServerConfigured = Boolean(
  supabaseUrl &&
  serviceRoleKey &&
  !supabaseUrl.includes('placeholder-project') &&
  !serviceRoleKey.includes('placeholder') &&
  supabaseUrl.startsWith('http')
);

export function getSupabaseAdminClient() {
  if (!isSupabaseServerConfigured) {
    return null;
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// Fallback in-memory store for development/preview when Supabase is not connected
declare global {
  // eslint-disable-next-line no-var
  var __memoryStore: {
    products: Product[];
    settings: SiteSettings;
    orders: Order[];
  } | undefined;
}

if (!global.__memoryStore) {
  global.__memoryStore = {
    products: [...INITIAL_PRODUCTS],
    settings: { ...INITIAL_SITE_SETTINGS },
    orders: [...INITIAL_ORDERS],
  };
}

const memoryStore = global.__memoryStore!;

// PRODUCTS
export async function getProducts(options?: {
  category?: string;
  brand?: string;
  isFeatured?: boolean;
  isActive?: boolean;
  sort?: string;
  limit?: number;
}): Promise<Product[]> {
  const supabase = getSupabaseAdminClient();

  if (supabase) {
    try {
      let query = supabase.from('products').select('*');

      if (options?.isActive !== undefined) {
        query = query.eq('is_active', options.isActive);
      }
      if (options?.isFeatured !== undefined) {
        query = query.eq('is_featured', options.isFeatured);
      }
      if (options?.category && options.category !== 'all') {
        query = query.eq('category', options.category);
      }
      if (options?.brand && options.brand !== 'all') {
        query = query.eq('brand', options.brand);
      }

      if (options?.sort === 'price_asc') {
        query = query.order('price', { ascending: true });
      } else if (options?.sort === 'price_desc') {
        query = query.order('price', { ascending: false });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;
      if (!error && data) {
        return data as Product[];
      }
      console.warn('Supabase query error, falling back to memory store:', error?.message);
    } catch (err) {
      console.warn('Supabase connection error:', err);
    }
  }

  // Fallback to in-memory store
  let items = [...memoryStore.products];

  if (options?.isActive !== undefined) {
    items = items.filter((p) => p.is_active === options.isActive);
  }
  if (options?.isFeatured !== undefined) {
    items = items.filter((p) => p.is_featured === options.isFeatured);
  }
  if (options?.category && options.category !== 'all') {
    items = items.filter((p) => p.category.toLowerCase() === options.category!.toLowerCase());
  }
  if (options?.brand && options.brand !== 'all') {
    items = items.filter((p) => p.brand.toLowerCase() === options.brand!.toLowerCase());
  }

  if (options?.sort === 'price_asc') {
    items.sort((a, b) => a.price - b.price);
  } else if (options?.sort === 'price_desc') {
    items.sort((a, b) => b.price - a.price);
  } else {
    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  if (options?.limit) {
    items = items.slice(0, options.limit);
  }

  return items;
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const supabase = getSupabaseAdminClient();

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('slug', slug)
        .single();
      if (!error && data) {
        return data as Product;
      }
    } catch (err) {
      console.warn('Supabase getProductBySlug error:', err);
    }
  }

  const found = memoryStore.products.find((p) => p.slug === slug);
  return found || null;
}

export async function getProductById(id: string): Promise<Product | null> {
  const supabase = getSupabaseAdminClient();

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();
      if (!error && data) {
        return data as Product;
      }
    } catch (err) {
      console.warn('Supabase getProductById error:', err);
    }
  }

  const found = memoryStore.products.find((p) => p.id === id);
  return found || null;
}

export async function createProduct(product: Omit<Product, 'id' | 'created_at'>): Promise<Product> {
  const supabase = getSupabaseAdminClient();

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('products')
        .insert([product])
        .select()
        .single();
      if (!error && data) {
        // Also update memory store
        memoryStore.products.unshift(data as Product);
        return data as Product;
      }
      console.error('Supabase createProduct error:', error);
    } catch (err) {
      console.error('Supabase createProduct exception:', err);
    }
  }

  const newProduct: Product = {
    ...product,
    id: `prod-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    created_at: new Date().toISOString(),
  };
  memoryStore.products.unshift(newProduct);
  return newProduct;
}

export async function updateProduct(id: string, updates: Partial<Product>): Promise<Product | null> {
  const supabase = getSupabaseAdminClient();

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('products')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (!error && data) {
        const idx = memoryStore.products.findIndex((p) => p.id === id);
        if (idx !== -1) memoryStore.products[idx] = data as Product;
        return data as Product;
      }
      console.error('Supabase updateProduct error:', error);
    } catch (err) {
      console.error('Supabase updateProduct exception:', err);
    }
  }

  const idx = memoryStore.products.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  memoryStore.products[idx] = { ...memoryStore.products[idx], ...updates };
  return memoryStore.products[idx];
}

export async function deleteProduct(id: string): Promise<boolean> {
  const supabase = getSupabaseAdminClient();

  if (supabase) {
    try {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (!error) {
        memoryStore.products = memoryStore.products.filter((p) => p.id !== id);
        return true;
      }
    } catch (err) {
      console.error('Supabase deleteProduct error:', err);
    }
  }

  memoryStore.products = memoryStore.products.filter((p) => p.id !== id);
  return true;
}

// SITE SETTINGS
export async function getSiteSettings(): Promise<SiteSettings> {
  const supabase = getSupabaseAdminClient();

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('site_settings')
        .select('*')
        .eq('id', 1)
        .single();
      if (!error && data) {
        return data as SiteSettings;
      }
    } catch (err) {
      console.warn('Supabase getSiteSettings error:', err);
    }
  }

  return memoryStore.settings;
}

export async function updateSiteSettings(settings: Partial<SiteSettings>): Promise<SiteSettings> {
  const supabase = getSupabaseAdminClient();

  const payload = {
    ...settings,
    updated_at: new Date().toISOString(),
  };

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('site_settings')
        .update(payload)
        .eq('id', 1)
        .select()
        .single();
      if (!error && data) {
        memoryStore.settings = data as SiteSettings;
        return data as SiteSettings;
      }
    } catch (err) {
      console.error('Supabase updateSiteSettings error:', err);
    }
  }

  memoryStore.settings = { ...memoryStore.settings, ...payload };
  return memoryStore.settings;
}

// ORDERS
export async function getOrders(options?: { status?: OrderStatus }): Promise<Order[]> {
  const supabase = getSupabaseAdminClient();

  if (supabase) {
    try {
      let query = supabase.from('orders').select('*, items:order_items(*)').order('created_at', { ascending: false });
      if (options?.status) {
        query = query.eq('order_status', options.status);
      }
      const { data, error } = await query;
      if (!error && data) {
        return data as Order[];
      }
    } catch (err) {
      console.warn('Supabase getOrders error:', err);
    }
  }

  let orders = [...memoryStore.orders];
  if (options?.status) {
    orders = orders.filter((o) => o.order_status === options.status);
  }
  return orders;
}

export async function getOrderById(id: string): Promise<Order | null> {
  const supabase = getSupabaseAdminClient();

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*, items:order_items(*)')
        .eq('id', id)
        .single();
      if (!error && data) {
        return data as Order;
      }
    } catch (err) {
      console.warn('Supabase getOrderById error:', err);
    }
  }

  const found = memoryStore.orders.find((o) => o.id === id);
  return found || null;
}

export async function createOrder(
  order: Omit<Order, 'id' | 'created_at' | 'items'>,
  items: OrderItem[]
): Promise<Order> {
  const supabase = getSupabaseAdminClient();

  if (supabase) {
    try {
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert([order])
        .select()
        .single();

      if (!orderError && orderData) {
        const orderId = orderData.id;
        const itemsToInsert = items.map((item) => ({
          order_id: orderId,
          product_id: item.product_id,
          product_title: item.product_title,
          unit_price: item.unit_price,
          quantity: item.quantity,
          selected_options: item.selected_options || {},
        }));

        await supabase.from('order_items').insert(itemsToInsert);

        const fullOrder = { ...orderData, items: itemsToInsert } as Order;
        memoryStore.orders.unshift(fullOrder);
        return fullOrder;
      }
    } catch (err) {
      console.error('Supabase createOrder error:', err);
    }
  }

  const orderId = `ord-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
  const fullOrder: Order = {
    ...order,
    id: orderId,
    created_at: new Date().toISOString(),
    items: items.map((i) => ({ ...i, id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`, order_id: orderId })),
  };

  memoryStore.orders.unshift(fullOrder);
  return fullOrder;
}

export async function updateOrderStatus(id: string, status: OrderStatus): Promise<boolean> {
  const supabase = getSupabaseAdminClient();

  if (supabase) {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ order_status: status })
        .eq('id', id);
      if (!error) {
        const order = memoryStore.orders.find((o) => o.id === id);
        if (order) order.order_status = status;
        return true;
      }
    } catch (err) {
      console.error('Supabase updateOrderStatus error:', err);
    }
  }

  const order = memoryStore.orders.find((o) => o.id === id);
  if (order) {
    order.order_status = status;
    return true;
  }
  return false;
}

export async function updateOrderPaymentStatus(
  id: string,
  paymentStatus: PaymentStatus,
  stripeSessionId?: string
): Promise<boolean> {
  const supabase = getSupabaseAdminClient();

  const updates: Record<string, any> = { payment_status: paymentStatus };
  if (stripeSessionId) updates.stripe_session_id = stripeSessionId;

  if (supabase) {
    try {
      const { error } = await supabase.from('orders').update(updates).eq('id', id);
      if (!error) {
        const order = memoryStore.orders.find((o) => o.id === id);
        if (order) {
          order.payment_status = paymentStatus;
          if (stripeSessionId) order.stripe_session_id = stripeSessionId;
        }
        return true;
      }
    } catch (err) {
      console.error('Supabase updateOrderPaymentStatus error:', err);
    }
  }

  const order = memoryStore.orders.find((o) => o.id === id);
  if (order) {
    order.payment_status = paymentStatus;
    if (stripeSessionId) order.stripe_session_id = stripeSessionId;
    return true;
  }
  return false;
}

export async function decrementProductStock(productId: string, quantity: number): Promise<boolean> {
  const supabase = getSupabaseAdminClient();

  if (supabase) {
    try {
      const { data: prod } = await supabase
        .from('products')
        .select('stock_quantity')
        .eq('id', productId)
        .single();

      if (prod) {
        const newStock = Math.max(0, prod.stock_quantity - quantity);
        await supabase
          .from('products')
          .update({ stock_quantity: newStock })
          .eq('id', productId);
        
        const memoryProd = memoryStore.products.find((p) => p.id === productId);
        if (memoryProd) memoryProd.stock_quantity = newStock;
        return true;
      }
    } catch (err) {
      console.error('Supabase decrementProductStock error:', err);
    }
  }

  const memoryProd = memoryStore.products.find((p) => p.id === productId);
  if (memoryProd) {
    memoryProd.stock_quantity = Math.max(0, memoryProd.stock_quantity - quantity);
    return true;
  }
  return false;
}
