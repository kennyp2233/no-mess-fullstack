<script lang="ts">
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { isAuthenticatedAsync } from '../shared/guards/route.guard';
  import { onMount } from 'svelte';
  
  let loading = true;
  
  onMount(async () => {
    if (browser) {
      try {
        const isAuth = await isAuthenticatedAsync();
        if (isAuth) {
          goto('/dashboard');
        } else {
          goto('/login');
        }
      } catch (error) {
        console.error('Error checking auth status:', error);
        goto('/login');
      }
    }
  });
</script>

<div class="min-h-screen flex items-center justify-center">
  <div class="text-center">
    <h1 class="text-2xl font-bold text-gray-900 mb-4">Sistema de Receipts</h1>
    <p class="text-gray-600">Redirigiendo...</p>
  </div>
</div>
