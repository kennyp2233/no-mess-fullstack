<script lang="ts">
  /**
   * Tipo de input: 'text' | 'email' | 'password' | 'number'
   */
  export let type: 'text' | 'email' | 'password' | 'number' = 'text';
  /**
   * Valor del input
   */
  export let value: string | number = '';
  /**
   * Placeholder
   */
  export let placeholder: string = '';
  /**
   * Deshabilitado
   */
  export let disabled: boolean = false;
  /**
   * Nombre del input
   */
  export let name: string = '';
</script>

<input
  class="block w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
  {type}
  bind:value
  {placeholder}
  {disabled}
  {name}
/> 