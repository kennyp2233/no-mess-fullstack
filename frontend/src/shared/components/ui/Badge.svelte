<script lang="ts">
  /**
   * Color del badge: 'default' | 'success' | 'warning' | 'danger' | 'info'
   */
  export let color: 'default' | 'success' | 'warning' | 'danger' | 'info' = 'default';
  /**
   * Texto del badge
   */
  export let text: string = '';
</script>

<span class="
  inline-block px-2 py-0.5 rounded text-xs font-semibold
  {color === 'default' ? 'bg-gray-200 text-gray-800' : ''}
  {color === 'success' ? 'bg-green-100 text-green-800' : ''}
  {color === 'warning' ? 'bg-yellow-100 text-yellow-800' : ''}
  {color === 'danger' ? 'bg-red-100 text-red-800' : ''}
  {color === 'info' ? 'bg-blue-100 text-blue-800' : ''}
">
  <slot>{text}</slot>
</span> 