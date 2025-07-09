// API Configuration
export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  WS_URL: import.meta.env.VITE_WS_URL || 'ws://localhost:3000',
  TIMEOUT: 10000,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
} as const;

// API Endpoints
export const API_ENDPOINTS = {
  // Authentication
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh',
    ME: '/auth/me',
  },
  
  // Users
  USERS: {
    BASE: '/users',
    PROFILE: '/users/profile',
    UPDATE: '/users/profile',
  },
  
  // Houses
  HOUSES: {
    BASE: '/houses',
    ASSIGN: '/houses/assign',
    BALANCE: '/houses/balance',
  },
  
  // Transactions
  TRANSACTIONS: {
    BASE: '/transactions',
    UPLOAD: '/transactions/upload',
  },
  
  // Accounts
  ACCOUNTS: {
    BASE: '/accounts',
    BALANCE: '/accounts/balance',
  },
  
  // Projects
  PROJECTS: {
    BASE: '/projects',
  },
  
  // Assemblies
  ASSEMBLIES: {
    BASE: '/assemblies',
  },
  
  // Votings
  VOTINGS: {
    BASE: '/votings',
    VOTE: '/votings/vote',
    STATS: '/votings/stats',
  },
  
  // Proposals
  PROPOSALS: {
    BASE: '/proposals',
  },
  
  // Minutes
  MINUTES: {
    BASE: '/minutes',
    VALIDATE: '/minutes/validate',
    PUBLISH: '/minutes/publish',
  },
  
  // Notifications
  NOTIFICATIONS: {
    BASE: '/notifications',
    MARK_READ: '/notifications/mark-read',
  },
  
  // File Storage
  FILE_STORAGE: {
    UPLOAD: '/file-storage/upload',
    DOWNLOAD: '/file-storage/download',
  },
} as const;

// App Constants
export const APP_CONSTANTS = {
  // Pagination
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 100,
  
  // File upload
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_FILE_TYPES: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  
  // Validation
  PASSWORD_MIN_LENGTH: 8,
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  
  // UI
  TOAST_DURATION: 5000,
  DEBOUNCE_DELAY: 300,
  
  // Cache
  CACHE_TTL: 5 * 60 * 1000, // 5 minutes
  
  // WebSocket
  WS_RECONNECT_DELAY: 1000,
  WS_MAX_RECONNECT_ATTEMPTS: 5,
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Error de conexión. Verifica tu conexión a internet.',
  UNAUTHORIZED: 'No tienes permisos para realizar esta acción.',
  FORBIDDEN: 'Acceso denegado.',
  NOT_FOUND: 'Recurso no encontrado.',
  SERVER_ERROR: 'Error del servidor. Intenta más tarde.',
  VALIDATION_ERROR: 'Datos inválidos. Verifica la información.',
  FILE_TOO_LARGE: 'El archivo es demasiado grande.',
  INVALID_FILE_TYPE: 'Tipo de archivo no permitido.',
  UPLOAD_FAILED: 'Error al subir el archivo.',
  LOGIN_FAILED: 'Credenciales inválidas.',
  REGISTER_FAILED: 'Error al registrar usuario.',
  GENERIC_ERROR: 'Ha ocurrido un error inesperado.',
} as const;

// Success Messages
export const SUCCESS_MESSAGES = {
  LOGIN_SUCCESS: 'Inicio de sesión exitoso.',
  REGISTER_SUCCESS: 'Registro exitoso.',
  LOGOUT_SUCCESS: 'Sesión cerrada exitosamente.',
  SAVE_SUCCESS: 'Guardado exitosamente.',
  UPDATE_SUCCESS: 'Actualizado exitosamente.',
  DELETE_SUCCESS: 'Eliminado exitosamente.',
  UPLOAD_SUCCESS: 'Archivo subido exitosamente.',
  VOTE_CAST: 'Voto registrado exitosamente.',
} as const;

// Local Storage Keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  USER_DATA: 'user',
  THEME: 'theme',
  LANGUAGE: 'language',
  SIDEBAR_COLLAPSED: 'sidebar_collapsed',
} as const;

// Route Names
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  DASHBOARD: '/dashboard',
  HOUSES: '/houses',
  TRANSACTIONS: '/transactions',
  VOTINGS: '/votings',
  ASSEMBLIES: '/assemblies',
  PROPOSALS: '/proposals',
  MINUTES: '/minutes',
  NOTIFICATIONS: '/notifications',
  PROFILE: '/profile',
  SETTINGS: '/settings',
} as const;

// Theme
export const THEMES = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system',
} as const;

// Languages
export const LANGUAGES = {
  ES: 'es',
  EN: 'en',
} as const; 