<script lang="ts">
  /**
   * Tipo de loading: 'spinner' | 'skeleton'
   */
  export let type: 'spinner' | 'skeleton' = 'spinner';
  /**
   * Ancho del skeleton (solo si type = skeleton)
   */
  export let width: string = '100%';
  /**
   * Alto del skeleton (solo si type = skeleton)
   */
  export let height: string = '1.5rem';
</script>

{#if type === 'spinner'}
  <div class="flex items-center justify-center">
    <svg class="animate-spin h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
    </svg>
  </div>
{:else}
  <div class="bg-gray-200 rounded animate-pulse" style="width: {width}; height: {height};"></div>
{/if} 