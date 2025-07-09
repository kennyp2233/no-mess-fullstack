<script lang="ts">
  /**
   * Clase adicional opcional
   */
  export let className: string = '';
</script>

<header class={`w-full bg-white shadow px-4 py-3 flex items-center ${className}`}>
  <slot />
</header> 