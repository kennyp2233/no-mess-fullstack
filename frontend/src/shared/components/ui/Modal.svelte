<script lang="ts">
  /**
   * Controla la visibilidad del modal
   */
  export let open: boolean = false;
  /**
   * Evento de cierre
   */
  export let onClose: () => void = () => {};

  function handleOverlayClick(e: MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }
</script>

{#if open}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" on:click={handleOverlayClick}>
    <div class="bg-white rounded shadow-lg max-w-lg w-full relative">
      <button class="absolute top-2 right-2 text-gray-500 hover:text-gray-700" on:click={onClose} aria-label="Cerrar">
        &times;
      </button>
      <div class="p-6">
        <slot />
      </div>
    </div>
  </div>
{/if} 