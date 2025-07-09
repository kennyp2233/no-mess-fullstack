<script lang="ts">
  import { page } from '$app/stores';
  import { requireGuestAsync } from '../../shared/guards/route.guard';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
</script>

{#if browser}
  {#await requireGuestAsync()}
    <!-- Loading -->
  {:catch error}
    <!-- Redirect handled by guard -->
  {/await}
{/if}

<div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
  <div class="max-w-md w-full space-y-8 p-8">
    <div class="text-center">
      <h1 class="text-3xl font-bold text-gray-900 mb-2">
        Sistema de Receipts
      </h1>
      <p class="text-gray-600">
        {#if $page.url.pathname === '/login'}
          Inicia sesión en tu cuenta
        {:else if $page.url.pathname === '/register'}
          Crea una nueva cuenta
        {:else}
          Bienvenido
        {/if}
      </p>
    </div>
    
    <slot />
  </div>
</div> 