<script lang="ts">
  import { page } from '$app/stores';
  import { requireAuthAsync } from '../../shared/guards/route.guard';
  import { authStore } from '../../features/auth/stores/auth.store';
  import { websocketStore } from '../../shared/stores/websocket.store';
  import { Header, Sidebar } from '../../shared/components/layout';
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';
  
  let sidebarOpen = true;
  let user = $authStore.user;
  
  // Subscribe to auth store
  authStore.subscribe(state => {
    user = state.user;
  });

  function toggleSidebar() {
    sidebarOpen = !sidebarOpen;
  }

  async function handleLogout() {
    await authStore.logout();
  }

  // Navigation items
  const navigationItems = [
    { name: 'Dashboard', href: '/dashboard', icon: '🏠' },
    { name: 'Casas', href: '/houses', icon: '🏘️' },
    { name: 'Transacciones', href: '/transactions', icon: '💰' },
    { name: 'Votaciones', href: '/voting', icon: '🗳️' },
    { name: 'Minutas', href: '/minutes', icon: '📝' },
    { name: 'Propuestas', href: '/proposals', icon: '📋' },
    { name: 'Presupuestos', href: '/budgets', icon: '📊' },
    { name: 'Asambleas', href: '/assemblies', icon: '👥' },
  ];

  // Admin only items
  const adminItems = [
    { name: 'Usuarios', href: '/users', icon: '👤' },
    { name: 'Configuración', href: '/settings', icon: '⚙️' },
  ];
</script>

{#if browser}
  {#await requireAuthAsync()}
    <!-- Loading -->
  {:catch error}
    <!-- Redirect handled by guard -->
  {/await}
{/if}

<div class="flex h-screen bg-gray-100">
  <!-- Sidebar -->
  <Sidebar 
    className={sidebarOpen ? 'translate-x-0' : '-translate-x-full'} 
    width={sidebarOpen ? '16rem' : '0'}
  >
    <div class="flex flex-col h-full">
      <!-- Logo/Brand -->
      <div class="flex items-center justify-center h-16 bg-blue-600 text-white">
        <h1 class="text-xl font-bold">Sistema Receipts</h1>
      </div>
      
      <!-- Navigation -->
      <nav class="flex-1 px-4 py-6 space-y-2">
        {#each navigationItems as item}
          <a 
            href={item.href}
            class="flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors
                   {$page.url.pathname === item.href 
                     ? 'bg-blue-100 text-blue-700' 
                     : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}"
          >
            <span class="mr-3">{item.icon}</span>
            {item.name}
          </a>
        {/each}
        
        {#if user?.role === 'ADMIN'}
          <div class="pt-4 border-t border-gray-200">
            <h3 class="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Administración
            </h3>
            <div class="mt-2 space-y-1">
              {#each adminItems as item}
                <a 
                  href={item.href}
                  class="flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors
                         {$page.url.pathname === item.href 
                           ? 'bg-blue-100 text-blue-700' 
                           : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}"
                >
                  <span class="mr-3">{item.icon}</span>
                  {item.name}
                </a>
              {/each}
            </div>
          </div>
        {/if}
      </nav>
      
      <!-- User info -->
      <div class="p-4 border-t border-gray-200">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <div class="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
              {user?.name?.charAt(0) || 'U'}
            </div>
          </div>
          <div class="ml-3 flex-1">
            <p class="text-sm font-medium text-gray-900">{user?.name || 'Usuario'}</p>
            <p class="text-xs text-gray-500">{user?.email || ''}</p>
          </div>
          <button 
            on:click={handleLogout}
            class="ml-2 p-1 text-gray-400 hover:text-gray-600"
            title="Cerrar sesión"
          >
            🚪
          </button>
        </div>
      </div>
    </div>
  </Sidebar>
  
  <!-- Main content -->
  <div class="flex-1 flex flex-col overflow-hidden">
    <!-- Header -->
    <Header>
      <div class="flex items-center justify-between w-full">
        <div class="flex items-center">
          <button 
            on:click={toggleSidebar}
            class="p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          >
            ☰
          </button>
          <h1 class="ml-4 text-xl font-semibold text-gray-900">
            {#if $page.url.pathname === '/dashboard'}
              Dashboard
            {:else if $page.url.pathname.startsWith('/houses')}
              Casas
            {:else if $page.url.pathname.startsWith('/transactions')}
              Transacciones
            {:else if $page.url.pathname.startsWith('/voting')}
              Votaciones
            {:else if $page.url.pathname.startsWith('/minutes')}
              Minutas
            {:else if $page.url.pathname.startsWith('/proposals')}
              Propuestas
            {:else if $page.url.pathname.startsWith('/budgets')}
              Presupuestos
            {:else if $page.url.pathname.startsWith('/assemblies')}
              Asambleas
            {:else if $page.url.pathname.startsWith('/users')}
              Usuarios
            {:else if $page.url.pathname.startsWith('/settings')}
              Configuración
            {:else}
              Sistema de Receipts
            {/if}
          </h1>
        </div>
        
        <!-- WebSocket status indicator -->
        <div class="flex items-center space-x-4">
          <div class="flex items-center space-x-2">
            <div class={`w-2 h-2 rounded-full ${
              $websocketStore.isConnected ? 'bg-green-500' : 'bg-red-500'
            }`}></div>
            <span class="text-sm text-gray-500">
              {$websocketStore.isConnected ? 'Conectado' : 'Desconectado'}
            </span>
          </div>
        </div>
      </div>
    </Header>
    
    <!-- Page content -->
    <main class="flex-1 overflow-y-auto p-6">
      <slot />
    </main>
  </div>
</div> 