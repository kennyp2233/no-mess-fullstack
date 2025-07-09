<script lang="ts">
  import { goto } from '$app/navigation';
  import { authStore } from '../../../features/auth/stores/auth.store';
  import LoginForm from '../../../features/auth/components/LoginForm.svelte';
  import { Button } from '../../../shared/components/ui';
  
  let loading = false;
  let error = '';
  let debugInfo = '';

  async function handleLogin(event: CustomEvent) {
    loading = true;
    error = '';
    debugInfo = '';
    
    try {
      const { email, password } = event.detail;
      console.log('Attempting login with:', { email, password });
      
      const result = await authStore.login(email, password);
      console.log('Login successful:', result);
      
      debugInfo = `Login successful! User: ${result.user.name}, Token: ${result.token.substring(0, 20)}...`;
      
      await goto('/dashboard');
    } catch (e: any) {
      console.error('Login error:', e);
      error = e?.message || 'Error al iniciar sesión';
      debugInfo = `Error details: ${JSON.stringify(e, null, 2)}`;
    } finally {
      loading = false;
    }
  }
</script>

<div class="bg-white rounded-lg shadow-lg p-8">
  <LoginForm on:login={handleLogin} />
  
  {#if error}
    <div class="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
      {error}
    </div>
  {/if}
  
  {#if debugInfo}
    <div class="mt-4 p-3 bg-blue-100 border border-blue-400 text-blue-700 rounded text-sm">
      <strong>Debug Info:</strong><br>
      {debugInfo}
    </div>
  {/if}
  
  <div class="mt-6 text-center">
    <p class="text-sm text-gray-600">
      ¿No tienes cuenta? 
      <a href="/register" class="text-blue-600 hover:text-blue-800 font-medium">
        Regístrate aquí
      </a>
    </p>
  </div>
</div> 