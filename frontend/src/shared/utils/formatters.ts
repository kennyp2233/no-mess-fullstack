// Currency formatters
export const currencyFormatters = {
  // Format currency for display
  formatCurrency: (amount: number, currency: string = 'COP', locale: string = 'es-CO'): string => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  },

  // Format currency with decimals
  formatCurrencyWithDecimals: (amount: number, currency: string = 'COP', locale: string = 'es-CO'): string => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  },

  // Format number with thousands separator
  formatNumber: (number: number, locale: string = 'es-CO'): string => {
    return new Intl.NumberFormat(locale).format(number);
  },

  // Parse currency string to number
  parseCurrency: (currencyString: string): number => {
    return parseFloat(currencyString.replace(/[^\d.-]/g, ''));
  },
};

// Date formatters
export const dateFormatters = {
  // Format date for display
  formatDate: (date: string | Date, locale: string = 'es-CO'): string => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(dateObj);
  },

  // Format date with time
  formatDateTime: (date: string | Date, locale: string = 'es-CO'): string => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(dateObj);
  },

  // Format date for input fields (YYYY-MM-DD)
  formatDateForInput: (date: string | Date): string => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toISOString().split('T')[0];
  },

  // Format time only
  formatTime: (date: string | Date, locale: string = 'es-CO'): string => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
    }).format(dateObj);
  },

  // Get relative time (e.g., "hace 2 horas")
  getRelativeTime: (date: string | Date, locale: string = 'es-CO'): string => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return 'hace un momento';
    }

    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return `hace ${diffInMinutes} ${diffInMinutes === 1 ? 'minuto' : 'minutos'}`;
    }

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return `hace ${diffInHours} ${diffInHours === 1 ? 'hora' : 'horas'}`;
    }

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) {
      return `hace ${diffInDays} ${diffInDays === 1 ? 'día' : 'días'}`;
    }

    return dateFormatters.formatDate(dateObj, locale);
  },

  // Check if date is today
  isToday: (date: string | Date): boolean => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const today = new Date();
    return dateObj.toDateString() === today.toDateString();
  },

  // Check if date is in the past
  isPast: (date: string | Date): boolean => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj < new Date();
  },

  // Check if date is in the future
  isFuture: (date: string | Date): boolean => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj > new Date();
  },
};

// Text formatters
export const textFormatters = {
  // Capitalize first letter
  capitalize: (text: string): string => {
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
  },

  // Capitalize each word
  capitalizeWords: (text: string): string => {
    return text.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
  },

  // Truncate text
  truncate: (text: string, maxLength: number, suffix: string = '...'): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - suffix.length) + suffix;
  },

  // Convert to slug
  toSlug: (text: string): string => {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  },

  // Remove HTML tags
  stripHtml: (html: string): string => {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  },

  // Format phone number
  formatPhone: (phone: string): string => {
    const cleaned = phone.replace(/\D/g, '');
    const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
    if (match) {
      return `(${match[1]}) ${match[2]}-${match[3]}`;
    }
    return phone;
  },

  // Format file size
  formatFileSize: (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },
};

// Validation formatters
export const validationFormatters = {
  // Format email for display (hide part of it)
  maskEmail: (email: string): string => {
    const [username, domain] = email.split('@');
    if (username.length <= 2) return email;
    
    const maskedUsername = username.charAt(0) + '*'.repeat(username.length - 2) + username.charAt(username.length - 1);
    return `${maskedUsername}@${domain}`;
  },

  // Format phone for display (hide part of it)
  maskPhone: (phone: string): string => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length < 10) return phone;
    
    return cleaned.replace(/(\d{3})(\d{3})(\d{4})/, '($1) ***-$3');
  },

  // Format credit card number
  maskCreditCard: (cardNumber: string): string => {
    const cleaned = cardNumber.replace(/\D/g, '');
    if (cleaned.length < 4) return cardNumber;
    
    return cleaned.replace(/(\d{4})(\d{4})(\d{4})(\d{4})/, '$1 **** **** $4');
  },
};

// Percentage formatters
export const percentageFormatters = {
  // Format percentage
  formatPercentage: (value: number, decimals: number = 1): string => {
    return `${value.toFixed(decimals)}%`;
  },

  // Calculate percentage
  calculatePercentage: (part: number, total: number): number => {
    if (total === 0) return 0;
    return (part / total) * 100;
  },

  // Format ratio (e.g., "3 de 5")
  formatRatio: (current: number, total: number): string => {
    return `${current} de ${total}`;
  },
};

// Export all formatters
export const formatters = {
  currency: currencyFormatters,
  date: dateFormatters,
  text: textFormatters,
  validation: validationFormatters,
  percentage: percentageFormatters,
}; 