<script lang="ts">
  /**
   * Variante del botón: 'primary' | 'secondary' | 'danger'
   */
  export let variant: 'primary' | 'secondary' | 'danger' = 'primary';
  /**
   * Deshabilitar el botón
   */
  export let disabled: boolean = false;
  /**
   * Tipo de botón
   */
  export let type: 'button' | 'submit' | 'reset' = 'button';
</script>

<button
  class="
    px-4 py-2 rounded font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2
    text-white
    {variant === 'primary' ? 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500' : ''}
    {variant === 'secondary' ? 'bg-gray-500 hover:bg-gray-600 focus:ring-gray-400' : ''}
    {variant === 'danger' ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' : ''}
    disabled:opacity-50 disabled:cursor-not-allowed
  "
  {type}
  {disabled}
  >
  <slot />
</button> 