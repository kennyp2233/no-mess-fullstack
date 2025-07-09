<script lang="ts">
  import { authStore } from '../../../features/auth/stores/auth.store';
  import { websocketStore } from '../../../shared/stores/websocket.store';
  import { Card } from '../../../shared/components/ui';
  
  let user = $authStore.user;
  let websocketStatus = $websocketStore.status;
  
  // Subscribe to stores
  authStore.subscribe(state => {
    user = state.user;
  });
  
  websocketStore.subscribe(state => {
    websocketStatus = state.status;
  });
</script>

<svelte:head>
  <title>Dashboard - Sistema de Receipts</title>
</svelte:head>

<div class="space-y-6">
  <!-- Welcome section -->
  <div class="bg-white rounded-lg shadow p-6">
    <h1 class="text-2xl font-bold text-gray-900 mb-2">
      ¡Bienvenido, {user?.name || 'Usuario'}!
    </h1>
    <p class="text-gray-600">
      Sistema de gestión de receipts y votaciones
    </p>
  </div>
  
  <!-- Status cards -->
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
    <Card>
      <div class="p-6">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <div class="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white">
              🏠
            </div>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-500">Casas</p>
            <p class="text-2xl font-semibold text-gray-900">0</p>
          </div>
        </div>
      </div>
    </Card>
    
    <Card>
      <div class="p-6">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <div class="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white">
              💰
            </div>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-500">Transacciones</p>
            <p class="text-2xl font-semibold text-gray-900">0</p>
          </div>
        </div>
      </div>
    </Card>
    
    <Card>
      <div class="p-6">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <div class="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white">
              🗳️
            </div>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-500">Votaciones</p>
            <p class="text-2xl font-semibold text-gray-900">0</p>
          </div>
        </div>
      </div>
    </Card>
    
    <Card>
      <div class="p-6">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <div class="w-8 h-8 bg-yellow-600 rounded-full flex items-center justify-center text-white">
              📝
            </div>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-500">Minutas</p>
            <p class="text-2xl font-semibold text-gray-900">0</p>
          </div>
        </div>
      </div>
    </Card>
  </div>
  
  <!-- System status -->
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <Card>
      <div class="p-6">
        <h3 class="text-lg font-medium text-gray-900 mb-4">Estado del Sistema</h3>
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">WebSocket</span>
            <div class="flex items-center space-x-2">
              <div class={`w-2 h-2 rounded-full ${
                websocketStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'
              }`}></div>
              <span class="text-sm font-medium capitalize">
                {websocketStatus}
              </span>
            </div>
          </div>
          
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">Autenticación</span>
            <div class="flex items-center space-x-2">
              <div class="w-2 h-2 rounded-full bg-green-500"></div>
              <span class="text-sm font-medium">Activa</span>
            </div>
          </div>
          
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">Usuario</span>
            <span class="text-sm font-medium">{user?.role || 'N/A'}</span>
          </div>
        </div>
      </div>
    </Card>
    
    <Card>
      <div class="p-6">
        <h3 class="text-lg font-medium text-gray-900 mb-4">Acciones Rápidas</h3>
        <div class="space-y-3">
          <a 
            href="/houses" 
            class="flex items-center p-3 text-sm font-medium text-gray-700 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors"
          >
            <span class="mr-3">🏘️</span>
            Gestionar Casas
          </a>
          
          <a 
            href="/transactions" 
            class="flex items-center p-3 text-sm font-medium text-gray-700 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors"
          >
            <span class="mr-3">💰</span>
            Ver Transacciones
          </a>
          
          <a 
            href="/voting" 
            class="flex items-center p-3 text-sm font-medium text-gray-700 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors"
          >
            <span class="mr-3">🗳️</span>
            Participar en Votaciones
          </a>
          
          <a 
            href="/minutes" 
            class="flex items-center p-3 text-sm font-medium text-gray-700 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors"
          >
            <span class="mr-3">📝</span>
            Revisar Minutas
          </a>
        </div>
      </div>
    </Card>
  </div>
</div> 