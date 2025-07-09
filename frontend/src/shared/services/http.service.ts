import type { ApiResponse, RequestConfig } from '../types';
import apiService from './api.service';

class HttpService {
  // Generic HTTP methods with better error handling
  async get<T = any>(url: string, config?: RequestConfig): Promise<any> {
    try {
      const response = await apiService.get(url, config);
      return response;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  async post<T = any>(url: string, data?: any, config?: RequestConfig): Promise<any> {
    try {
      const response = await apiService.post(url, data, config);
      return response;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  async put<T = any>(url: string, data?: any, config?: RequestConfig): Promise<any> {
    try {
      const response = await apiService.put(url, data, config);
      return response;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  async patch<T = any>(url: string, data?: any, config?: RequestConfig): Promise<any> {
    try {
      const response = await apiService.patch(url, data, config);
      return response;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  async delete<T = any>(url: string, config?: RequestConfig): Promise<any> {
    try {
      const response = await apiService.delete(url, config);
      return response;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  // File upload with progress tracking
  async uploadFile<T = any>(
    url: string, 
    file: File, 
    onProgress?: (progress: number) => void,
    config?: RequestConfig
  ): Promise<any> {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await apiService.post(url, formData, {
        ...config,
        headers: {
          ...config?.headers,
          'Content-Type': 'multipart/form-data',
        },
      });
      
      // Note: Progress tracking would need to be implemented in apiService
      // For now, we'll call onProgress with 100% when complete
      if (onProgress) {
        onProgress(100);
      }
      return response;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  // Batch requests
  async batch<T = any>(requests: Array<() => Promise<T>>): Promise<T[]> {
    try {
      const results = await Promise.all(requests.map(request => request()));
      return results;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  // Retry mechanism
  async retry<T = any>(
    request: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    let lastError: any;

    for (let i = 0; i <= maxRetries; i++) {
      try {
        return await request();
      } catch (error) {
        lastError = error;
        
        if (i === maxRetries) {
          break;
        }

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
      }
    }

    throw lastError;
  }

  // Cache mechanism
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();

  async getCached<T = any>(
    url: string, 
    ttl: number = 5 * 60 * 1000, // 5 minutes default
    config?: RequestConfig
  ): Promise<any> {
    const cacheKey = `${url}-${JSON.stringify(config)}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data;
    }

    const data = await this.get(url, config);
    this.cache.set(cacheKey, { data, timestamp: Date.now(), ttl });
    return data;
  }

  // Clear cache
  clearCache(pattern?: string): void {
    if (pattern) {
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }

  // Error handling
  private handleError(error: any): void {
    // Log error for debugging
    console.error('HTTP Service Error:', error);
    
    // Could dispatch to error store or show notification
    // This is a placeholder for future error handling
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await this.get('/health');
      return true;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const httpService = new HttpService();
export default httpService; 