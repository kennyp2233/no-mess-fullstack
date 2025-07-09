// Generic API response wrapper
export interface ApiResponse<T = any> {
  data: T;
  message?: string;
  success: boolean;
}

// Error response
export interface ApiError {
  message: string;
  status: number;
  code?: string;
  details?: any;
}

// Pagination
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// File upload
export interface FileUploadResponse {
  filename: string;
  path: string;
  size: number;
  mimetype: string;
  url: string;
}

// Search/Filter
export interface SearchParams {
  search?: string;
  filters?: Record<string, any>;
  include?: string[];
}

// HTTP Methods
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

// Request configuration
export interface RequestConfig {
  headers?: Record<string, string>;
  params?: Record<string, any>;
  timeout?: number;
  withCredentials?: boolean;
}

// API endpoints
export interface ApiEndpoints {
  auth: {
    login: string;
    register: string;
    logout: string;
    refresh: string;
    me: string;
  };
  users: {
    base: string;
    profile: string;
    update: string;
  };
  houses: {
    base: string;
    assign: string;
    balance: string;
  };
  transactions: {
    base: string;
    upload: string;
  };
  accounts: {
    base: string;
    balance: string;
  };
  projects: {
    base: string;
  };
  assemblies: {
    base: string;
  };
  votings: {
    base: string;
    vote: string;
    stats: string;
  };
  proposals: {
    base: string;
  };
  minutes: {
    base: string;
    validate: string;
    publish: string;
  };
  notifications: {
    base: string;
    markRead: string;
  };
  fileStorage: {
    upload: string;
    download: string;
  };
}

// WebSocket events
export interface WebSocketEvents {
  // Voting events
  'voting:created': any;
  'voting:updated': any;
  'voting:ended': any;
  'vote:cast': any;
  
  // Notification events
  'notification:created': any;
  'notification:updated': any;
  
  // General events
  'user:connected': any;
  'user:disconnected': any;
  'error': any;
}

// WebSocket message
export interface WebSocketMessage<T = any> {
  event: keyof WebSocketEvents;
  data: T;
  timestamp: string;
  userId?: string;
}

// Authentication
export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}

// User session
export interface UserSession {
  user: any;
  tokens: AuthTokens;
  lastActivity: string;
}

// API status
export interface ApiStatus {
  status: 'online' | 'offline' | 'maintenance';
  version: string;
  timestamp: string;
  uptime: number;
} 