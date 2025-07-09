<script lang="ts">
  /**
   * Clase adicional opcional
   */
  export let className: string = '';
</script>

<div class={`bg-white rounded shadow p-4 ${className}`}>
  <slot />
</div> 