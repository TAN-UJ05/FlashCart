export type UserRole = 'CUSTOMER' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName?: string;
  phone?: string;
  role: UserRole;
  enabled: boolean;
  createdAt: string;
}

export interface AuthTokenResponse {
  accessToken: string;
  tokenType?: string;
  expiresInMs?: number;
  user?: User;
}

export interface Category {
  id: number;
  name: string;
  description?: string;
  slug: string;
  imageUrl?: string;
  active: boolean;
  sortOrder: number;
  parentId?: number;
  createdAt?: string;
}

export interface ProductImage {
  id: string;
  imageUrl: string;
  altText?: string;
  sortOrder: number;
  isPrimary: boolean;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  sku: string;
  price: number;
  compareAtPrice?: number;
  categoryId?: number;
  categoryName?: string;
  categorySlug?: string;
  active: boolean;
  totalStock: number;
  reservedStock: number;
  availableStock: number;
  activeFlashSalePrice?: number;
  activeFlashSaleId?: string;
  images: ProductImage[];
  createdAt?: string;
  updatedAt?: string;
}

export interface InventoryItem {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  totalStock: number;
  reservedStock: number;
  availableStock: number;
  updatedAt?: string;
}

export interface CartItem {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  imageUrl?: string;
  regularPrice: number;
  effectivePrice: number;
  onFlashSale: boolean;
  flashSaleId?: string;
  quantity: number;
  lineTotal: number;
  availableStock: number;
}

export interface Cart {
  id: string;
  items: CartItem[];
  totalItems: number;
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
}

export interface Address {
  id: string;
  fullName: string;
  phone?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
  createdAt?: string;
}

export type OrderStatus =
  | 'PENDING'
  | 'PAYMENT_PENDING'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'PAYMENT_FAILED'
  | 'REFUNDED';

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
  flashSaleId?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  userId?: string;
  customerEmail?: string;
  status: OrderStatus;
  items: OrderItem[];
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  shippingFullName?: string;
  shippingAddressLine1?: string;
  shippingAddressLine2?: string;
  shippingCity?: string;
  shippingState?: string;
  shippingPostalCode?: string;
  shippingCountry?: string;
  shippingPhone?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type PaymentStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED' | 'CANCELLED';

export interface Payment {
  id: string;
  orderId: string;
  orderNumber?: string;
  idempotencyKey?: string;
  amount: number;
  status: PaymentStatus;
  provider?: string;
  transactionId?: string;
  failureReason?: string;
  processedAt?: string;
  createdAt: string;
}

export interface FlashSaleItem {
  id: string;
  flashSaleId: string;
  productId: string;
  productName: string;
  productSku: string;
  imageUrl?: string;
  regularPrice: number;
  salePrice: number;
  saleStock: number;
  soldCount: number;
  remainingStock: number;
}

export interface FlashSale {
  id: string;
  name: string;
  description?: string;
  startTime: string;
  endTime: string;
  active: boolean;
  live: boolean;
  items: FlashSaleItem[];
  createdAt?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
  error?: {
    code: string;
    field?: string;
    value?: unknown;
  };
}

export interface PageResponse<T> {
  content: T[];
  pageNumber: number;
  pageSize: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
  first: boolean;
}

export interface DailyMetric {
  date: string;
  orders: number;
  revenue: number;
}

export interface TopProductData {
  productId: string;
  productName: string;
  productSku?: string;
  unitsSold: number;
  revenue: number;
}

export interface AnalyticsDashboard {
  totalRevenue: number;
  periodRevenue: number;
  totalOrders: number;
  periodOrders: number;
  confirmedOrders: number;
  cancelledOrders: number;
  pendingOrders: number;
  totalCustomers: number;
  totalProducts: number;
  lowStockCount: number;
  activeFlashSalesCount: number;
  revenueByDay: DailyMetric[];
  ordersByStatus: Record<string, number>;
  topProducts: TopProductData[];
  lowStockItems: InventoryItem[];
}
