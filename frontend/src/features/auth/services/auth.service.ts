import { httpService } from '../../../shared/services/http.service';
import type { LoginRequest, RegisterRequest, LoginResponse, UserResponse } from '../../../shared/types';

export const authService = {
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    console.log('AuthService: Attempting login with:', credentials);
    
    const response = await httpService.post('/auth/login', credentials);
    
    console.log('AuthService: Raw login response:', response);
    console.log('AuthService: Response type:', typeof response);
    console.log('AuthService: Response keys:', Object.keys(response || {}));
    
    if (!response) {
      throw new Error('No response received from server');
    }

    // Handle different response formats flexibly
    let loginResponse: LoginResponse;
    
    if (response.access_token && response.user) {
      // Backend format: { access_token, user }
      loginResponse = {
        token: response.access_token,
        user: response.user
      };
    } else if (response.token && response.user) {
      // Frontend format: { token, user }
      loginResponse = response;
    } else if (response.data) {
      // Wrapped format: { data: { access_token, user } }
      loginResponse = {
        token: response.data.access_token || response.data.token,
        user: response.data.user
      };
    } else {
      // Try to extract from any format
      loginResponse = {
        token: response.access_token || response.token || response.auth_token,
        user: response.user || response.userData || response.data
      };
    }

    console.log('AuthService: Transformed response:', loginResponse);
    
    return loginResponse;
  },
  
  async register(data: RegisterRequest): Promise<LoginResponse> {
    const response = await httpService.post('/auth/register', data);
    
    console.log('Raw register response:', response);
    
    // Handle different response formats flexibly
    if (response.access_token && response.user) {
      return {
        user: response.user,
        token: response.access_token,
      };
    } else if (response.token && response.user) {
      return response;
    } else if (response.data) {
      return {
        user: response.data.user,
        token: response.data.access_token || response.data.token,
      };
    } else {
      return {
        user: response.user || response.userData || response.data,
        token: response.access_token || response.token || response.auth_token,
      };
    }
  },
  
  async logout(): Promise<void> {
    // Opcional: llamar endpoint de logout si existe
    return;
  },
  
  async getCurrentUser(): Promise<UserResponse> {
    return await httpService.get('/auth/profile');
  },
}; 