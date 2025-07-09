<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { authStore } from '../features/auth/stores/auth.store';
  import { websocketStore } from '../shared/stores/websocket.store';
</script>

<svelte:head>
  <title>Sistema de Receipts</title>
  <meta name="description" content="Sistema de gestión de receipts y votaciones" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</svelte:head>

<div class="min-h-screen bg-gray-50">
  <slot />
</div>

{#if browser}
  <!-- Global error handling -->
  {#if $authStore.error}
    <div class="fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded shadow-lg z-50">
      {$authStore.error}
    </div>
  {/if}
{/if} 