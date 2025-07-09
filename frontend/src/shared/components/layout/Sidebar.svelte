<script lang="ts">
  /**
   * Clase adicional opcional
   */
  export let className: string = '';
  /**
   * Ancho del sidebar
   */
  export let width: string = '16rem';
</script>

<aside class={`bg-gray-100 h-full shadow flex flex-col ${className}`} style={`width: ${width}`}> 
  <slot />
</aside> 