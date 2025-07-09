<script lang="ts">
  /**
   * Columnas de la tabla
   */
  export let columns: { key: string; label: string; sortable?: boolean }[] = [];
  /**
   * Datos de la tabla
   */
  export let data: any[] = [];
  /**
   * Página actual
   */
  export let page: number = 1;
  /**
   * Tamaño de página
   */
  export let pageSize: number = 10;
  /**
   * Total de elementos
   */
  export let total: number = 0;
  /**
   * Orden actual
   */
  export let sortBy: string = '';
  export let sortOrder: 'asc' | 'desc' = 'asc';

  function handleSort(key: string) {
    if (sortBy === key) {
      sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      sortBy = key;
      sortOrder = 'asc';
    }
    // Emitir evento de sort
    const event = new CustomEvent('sort', { detail: { sortBy, sortOrder } });
    dispatchEvent(event);
  }

  function handlePageChange(newPage: number) {
    if (newPage < 1 || newPage > Math.ceil(total / pageSize)) return;
    page = newPage;
    const event = new CustomEvent('page', { detail: { page } });
    dispatchEvent(event);
  }
</script>

<table class="min-w-full divide-y divide-gray-200">
  <thead class="bg-gray-50">
    <tr>
      {#each columns as col}
        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none" on:click={() => col.sortable && handleSort(col.key)}>
          {col.label}
          {#if col.sortable && sortBy === col.key}
            <span>{sortOrder === 'asc' ? '▲' : '▼'}</span>
          {/if}
        </th>
      {/each}
    </tr>
  </thead>
  <tbody class="bg-white divide-y divide-gray-200">
    {#each data as row}
      <tr>
        {#each columns as col}
          <td class="px-4 py-2 whitespace-nowrap">{row[col.key]}</td>
        {/each}
      </tr>
    {/each}
  </tbody>
</table>

<!-- Paginación mínima -->
<div class="flex items-center justify-between mt-2">
  <button class="px-2 py-1 text-sm" on:click={() => handlePageChange(page - 1)} disabled={page === 1}>Anterior</button>
  <span class="text-sm">Página {page} de {Math.max(1, Math.ceil(total / pageSize))}</span>
  <button class="px-2 py-1 text-sm" on:click={() => handlePageChange(page + 1)} disabled={page >= Math.ceil(total / pageSize)}>Siguiente</button>
</div> 