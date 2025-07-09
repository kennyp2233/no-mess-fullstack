<script lang="ts">
  /**
   * Clase adicional opcional
   */
  export let className: string = '';
</script>

<footer class={`w-full bg-gray-50 text-gray-500 text-sm px-4 py-3 flex items-center justify-center ${className}`}>
  <slot />
</footer> 