import { cache } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Product, SiteSettings, Order, OrderItem, OrderStatus, PaymentStatus } from './types';
import { INITIAL_PRODUCTS, INITIAL_SITE_SETTINGS, INITIAL_ORDERS } from './mockData';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
// Deliberately NO fallback to the anon key: a privileged client must never
// silently downgrade to a low-privilege key.
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const isSupabaseServerConfigured = Boolean(
  supabaseUrl &&
    serviceRoleKey &&
    !supabaseUrl.includes('placeholder-project') &&
    !serviceRoleKey.includes('placeholder') &&
    supabaseUrl.startsWith('http')
);

/**
 * Demo mode keeps the local in-memory store available (dev previews, or an
 * explicit DEMO_MODE=true). In production without a database the app FAILS
 * CLOSED: no fake orders, no fake success, no mock catalog customers could buy.
 */
export const isDemoMode =
  process.env.NODE_ENV !== 'production' || process.env.DEMO_MODE === 'true';

if (!isSupabaseServerConfigured && process.env.NODE_ENV === 'production' && !isDemoMode) {
  console.error(
    '[supabaseServer] FATAL CONFIG: Supabase is not configured and DEMO_MODE is off. ' +
      'All database operations will fail closed. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
  );
}

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
  var __memoryStore:
    | {
        products: Product[];
        settings: SiteSettings;
        orders: Order[];
      }
    | undefined;
}

if (!global.__memoryStore) {
  global.__memoryStore = {
    products: [...INITIAL_PRODUCTS],
    settings: { ...INITIAL_SITE_SETTINGS },
    orders: [...INITIAL_ORDERS],
  };
}

const memoryStore = global.__memoryStore!;

// ---------------------------------------------------------------------------
// PRODUCTS
// ---------------------------------------------------------------------------

export const getProducts = cache(async function getProducts(options?: {
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
        query = query.ilike('category', options.category);
      }
      if (options?.brand && options.brand !== 'all') {
        query = query.ilike('brand', options.brand);
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
      console.error('Supabase getProducts error:', error?.message);
      return isDemoMode ? fallbackProducts(options) : [];
    } catch (err) {
      console.error('Supabase connection error:', err);
      return isDemoMode ? fallbackProducts(options) : [];
    }
  }

  return isDemoMode ? fallbackProducts(options) : [];
});

function fallbackProducts(options?: {
  category?: string;
  brand?: string;
  isFeatured?: boolean;
  isActive?: boolean;
  sort?: string;
  limit?: number;
}): Product[] {
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

/** Storefront lookup by slug — only active products are returned. */
export const getProductBySlug = cache(async function getProductBySlug(slug: string): Promise<Product | null> {
  const supabase = getSupabaseAdminClient();

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('slug', slug)
        .eq('is_active', true)
        .maybeSingle();
      if (!error && data) {
        return data as Product;
      }
      return null;
    } catch (err) {
      console.error('Supabase getProductBySlug error:', err);
      return isDemoMode ? fallbackProductBySlug(slug) : null;
    }
  }

  return isDemoMode ? fallbackProductBySlug(slug) : null;
});

function fallbackProductBySlug(slug: string): Product | null {
  const found = memoryStore.products.find((p) => p.slug === slug && p.is_active);
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
        .maybeSingle();
      if (!error && data) {
        return data as Product;
      }
      return null;
    } catch (err) {
      console.error('Supabase getProductById error:', err);
      return null;
    }
  }

  if (!isDemoMode) return null;
  const found = memoryStore.products.find((p) => p.id === id);
  return found || null;
}

export async function createProduct(
  product: Omit<Product, 'id' | 'created_at'>
): Promise<Product | null> {
  const supabase = getSupabaseAdminClient();

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('products')
        .insert([product])
        .select()
        .single();
      if (!error && data) {
        memoryStore.products.unshift(data as Product);
        return data as Product;
      }
      console.error('Supabase createProduct error:', error?.message || error);
      return null;
    } catch (err) {
      console.error('Supabase createProduct exception:', err);
      return null;
    }
  }

  if (!isDemoMode) return null;

  const newProduct: Product = {
    ...product,
    id: `prod-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    created_at: new Date().toISOString(),
  };
  memoryStore.products.unshift(newProduct);
  return newProduct;
}

export async function updateProduct(
  id: string,
  updates: Partial<Product>
): Promise<Product | null> {
  const supabase = getSupabaseAdminClient();

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('products')
        .update(updates)
        .eq('id', id)
        .select()
        .maybeSingle();
      if (!error && data) {
        const idx = memoryStore.products.findIndex((p) => p.id === id);
        if (idx !== -1) memoryStore.products[idx] = data as Product;
        return data as Product;
      }
      console.error('Supabase updateProduct error:', error?.message || error);
      return null;
    } catch (err) {
      console.error('Supabase updateProduct exception:', err);
      return null;
    }
  }

  if (!isDemoMode) return null;
  const idx = memoryStore.products.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  memoryStore.products[idx] = { ...memoryStore.products[idx], ...updates };
  return memoryStore.products[idx];
}

export async function deleteProduct(id: string): Promise<boolean> {
  const supabase = getSupabaseAdminClient();

  if (supabase) {
    try {
      const { data, error } = await supabase.from('products').delete().eq('id', id).select('id');
      if (error) {
        console.error('Supabase deleteProduct error:', error.message);
        return false;
      }
      if (!data || data.length === 0) {
        return false; // nothing deleted — unknown id
      }
      memoryStore.products = memoryStore.products.filter((p) => p.id !== id);
      return true;
    } catch (err) {
      console.error('Supabase deleteProduct exception:', err);
      return false;
    }
  }

  if (!isDemoMode) return false;
  const before = memoryStore.products.length;
  memoryStore.products = memoryStore.products.filter((p) => p.id !== id);
  return memoryStore.products.length < before;
}

// ---------------------------------------------------------------------------
// SITE SETTINGS
// ---------------------------------------------------------------------------

export const getSiteSettings = cache(async function getSiteSettings(): Promise<SiteSettings> {
  const supabase = getSupabaseAdminClient();

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('site_settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle();
      if (!error && data) {
        return data as SiteSettings;
      }
      if (error) console.error('Supabase getSiteSettings error:', error.message);
    } catch (err) {
      console.error('Supabase getSiteSettings exception:', err);
    }
  }

  return memoryStore.settings;
});

export async function updateSiteSettings(
  settings: Partial<SiteSettings>
): Promise<SiteSettings | null> {
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
        .maybeSingle();
      if (!error && data) {
        memoryStore.settings = data as SiteSettings;
        return data as SiteSettings;
      }
      console.error('Supabase updateSiteSettings error:', error?.message || error);
      return null;
    } catch (err) {
      console.error('Supabase updateSiteSettings exception:', err);
      return null;
    }
  }

  if (!isDemoMode) return null;
  memoryStore.settings = { ...memoryStore.settings, ...payload };
  return memoryStore.settings;
}

// ---------------------------------------------------------------------------
// ORDERS
// ---------------------------------------------------------------------------

export async function getOrders(options?: { status?: OrderStatus }): Promise<Order[]> {
  const supabase = getSupabaseAdminClient();

  if (supabase) {
    try {
      let query = supabase
        .from('orders')
        .select('*, items:order_items(*)')
        .order('created_at', { ascending: false });
      if (options?.status) {
        query = query.eq('order_status', options.status);
      }
      const { data, error } = await query;
      if (!error && data) {
        return (data as any[]).map(o => ({
          ...o,
          payment_method: o.stripe_session_id === 'bank_transfer' ? 'bank_transfer' : o.payment_method
        })) as Order[];
      }
      console.error('Supabase getOrders error:', error?.message);
      return isDemoMode ? fallbackOrders(options) : [];
    } catch (err) {
      console.error('Supabase getOrders exception:', err);
      return isDemoMode ? fallbackOrders(options) : [];
    }
  }

  return isDemoMode ? fallbackOrders(options) : [];
}

function fallbackOrders(options?: { status?: OrderStatus }): Order[] {
  let orders = [...memoryStore.orders];
  if (options?.status) {
    orders = orders.filter((o) => o.order_status === options.status);
  }
  orders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
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
        .maybeSingle();
      if (!error && data) {
        const orderData = data as any;
        return {
          ...orderData,
          payment_method: orderData.stripe_session_id === 'bank_transfer' ? 'bank_transfer' : orderData.payment_method
        } as Order;
      }
      return null;
    } catch (err) {
      console.error('Supabase getOrderById error:', err);
      return null;
    }
  }

  if (!isDemoMode) return null;
  const found = memoryStore.orders.find((o) => o.id === id);
  return found || null;
}

export async function createOrder(
  order: Omit<Order, 'id' | 'created_at' | 'items'>,
  items: OrderItem[]
): Promise<Order | null> {
  const supabase = getSupabaseAdminClient();

  if (supabase) {
    try {
      // If the database has a check constraint limiting payment_method to ('card', 'cod'),
      // we persist bank_transfer safely by storing 'cod' in payment_method and 'bank_transfer' in stripe_session_id.
      const isBankTransfer = order.payment_method === 'bank_transfer';
      const orderPayload = {
        ...order,
        payment_method: isBankTransfer ? 'cod' : order.payment_method,
        stripe_session_id: isBankTransfer ? 'bank_transfer' : order.stripe_session_id,
      };

      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert([orderPayload])
        .select()
        .single();

      if (orderError || !orderData) {
        console.error('Supabase createOrder error:', orderError?.message || orderError);
        return null;
      }

      const orderId = orderData.id;
      const itemsToInsert = items.map((item) => ({
        order_id: orderId,
        product_id: item.product_id,
        product_title: item.product_title,
        unit_price: item.unit_price,
        quantity: item.quantity,
        selected_options: item.selected_options || {},
      }));

      const { error: itemsError } = await supabase.from('order_items').insert(itemsToInsert);
      if (itemsError) {
        console.error('Supabase createOrder order_items error:', itemsError.message);
        // Roll back the half-written order instead of leaving a header-less order.
        await supabase.from('orders').delete().eq('id', orderId);
        return null;
      }

      const fullOrder = {
        ...orderData,
        payment_method: isBankTransfer ? 'bank_transfer' : orderData.payment_method,
        items: itemsToInsert,
      } as Order;
      memoryStore.orders.unshift(fullOrder);
      return fullOrder;
      memoryStore.orders.unshift(fullOrder);
      return fullOrder;
    } catch (err) {
      console.error('Supabase createOrder exception:', err);
      return null;
    }
  }

  if (!isDemoMode) return null;

  const orderId = `ord-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
  const fullOrder: Order = {
    ...order,
    id: orderId,
    created_at: new Date().toISOString(),
    items: items.map((i) => ({
      ...i,
      id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      order_id: orderId,
    })),
  };

  memoryStore.orders.unshift(fullOrder);
  return fullOrder;
}

export async function deleteOrder(id: string): Promise<boolean> {
  const supabase = getSupabaseAdminClient();

  if (supabase) {
    try {
      const { error } = await supabase.from('orders').delete().eq('id', id);
      if (error) {
        console.error('Supabase deleteOrder error:', error.message);
        return false;
      }
      memoryStore.orders = memoryStore.orders.filter((o) => o.id !== id);
      return true;
    } catch (err) {
      console.error('Supabase deleteOrder exception:', err);
      return false;
    }
  }

  if (!isDemoMode) return false;
  memoryStore.orders = memoryStore.orders.filter((o) => o.id !== id);
  return true;
}

export async function updateOrderStatus(id: string, status: OrderStatus): Promise<boolean> {
  const supabase = getSupabaseAdminClient();

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('orders')
        .update({ order_status: status })
        .eq('id', id)
        .select('id');
      if (error) {
        console.error('Supabase updateOrderStatus error:', error.message);
        return false;
      }
      if (!data || data.length === 0) return false;

      const order = memoryStore.orders.find((o) => o.id === id);
      if (order) order.order_status = status;
      return true;
    } catch (err) {
      console.error('Supabase updateOrderStatus exception:', err);
      return false;
    }
  }

  if (!isDemoMode) return false;
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

  const updates: Record<string, string> = { payment_status: paymentStatus };
  if (stripeSessionId) updates.stripe_session_id = stripeSessionId;

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', id)
        .select('id');
      if (error) {
        console.error('Supabase updateOrderPaymentStatus error:', error.message);
        return false;
      }
      if (!data || data.length === 0) return false;

      const order = memoryStore.orders.find((o) => o.id === id);
      if (order) {
        order.payment_status = paymentStatus;
        if (stripeSessionId) order.stripe_session_id = stripeSessionId;
      }
      return true;
    } catch (err) {
      console.error('Supabase updateOrderPaymentStatus exception:', err);
      return false;
    }
  }

  if (!isDemoMode) return false;
  const order = memoryStore.orders.find((o) => o.id === id);
  if (order) {
    order.payment_status = paymentStatus;
    if (stripeSessionId) order.stripe_session_id = stripeSessionId;
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// STOCK
// ---------------------------------------------------------------------------

/**
 * Atomically decrement stock using compare-and-swap (retries on concurrent
 * modification). Returns false when the product is missing or has insufficient
 * stock — callers must treat that as a hard failure.
 */
export async function decrementProductStock(productId: string, quantity: number): Promise<boolean> {
  if (!Number.isInteger(quantity) || quantity <= 0) return false;

  const supabase = getSupabaseAdminClient();

  if (supabase) {
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const { data: prod, error: readError } = await supabase
          .from('products')
          .select('stock_quantity')
          .eq('id', productId)
          .single();

        if (readError || !prod) return false;
        if (prod.stock_quantity < quantity) return false;

        const nextStock = prod.stock_quantity - quantity;
        const { data: updated, error: writeError } = await supabase
          .from('products')
          .update({ stock_quantity: nextStock })
          .eq('id', productId)
          .eq('stock_quantity', prod.stock_quantity)
          .select('id');

        if (!writeError && updated && updated.length > 0) {
          const memoryProd = memoryStore.products.find((p) => p.id === productId);
          if (memoryProd) memoryProd.stock_quantity = nextStock;
          return true;
        }
        // Concurrent modification — retry with fresh stock.
      }
      return false;
    } catch (err) {
      console.error('Supabase decrementProductStock exception:', err);
      return false;
    }
  }

  if (!isDemoMode) return false;
  const memoryProd = memoryStore.products.find((p) => p.id === productId);
  if (!memoryProd || memoryProd.stock_quantity < quantity) return false;
  memoryProd.stock_quantity -= quantity;
  return true;
}

/** Atomically increment stock (restock / rollback). Best effort. */
export async function incrementProductStock(productId: string, quantity: number): Promise<boolean> {
  if (!Number.isInteger(quantity) || quantity <= 0) return false;

  const supabase = getSupabaseAdminClient();

  if (supabase) {
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const { data: prod, error: readError } = await supabase
          .from('products')
          .select('stock_quantity')
          .eq('id', productId)
          .single();

        if (readError || !prod) return false;

        const nextStock = prod.stock_quantity + quantity;
        const { data: updated, error: writeError } = await supabase
          .from('products')
          .update({ stock_quantity: nextStock })
          .eq('id', productId)
          .eq('stock_quantity', prod.stock_quantity)
          .select('id');

        if (!writeError && updated && updated.length > 0) {
          const memoryProd = memoryStore.products.find((p) => p.id === productId);
          if (memoryProd) memoryProd.stock_quantity = nextStock;
          return true;
        }
      }
      return false;
    } catch (err) {
      console.error('Supabase incrementProductStock exception:', err);
      return false;
    }
  }

  if (!isDemoMode) return false;
  const memoryProd = memoryStore.products.find((p) => p.id === productId);
  if (!memoryProd) return false;
  memoryProd.stock_quantity += quantity;
  return true;
}
