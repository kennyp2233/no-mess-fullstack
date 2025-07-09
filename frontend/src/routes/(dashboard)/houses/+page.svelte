<script lang="ts">
  import HousesList from '../../../features/houses/components/HousesList.svelte';
  import HouseForm from '../../../features/houses/components/HouseForm.svelte';
  import HouseBalance from '../../../features/houses/components/HouseBalance.svelte';
  // Lógica de integración vendrá después
</script>

<div class="space-y-6">
  <h1 class="text-2xl font-bold">Gestión de Casas</h1>
  <HouseForm />
  <HouseBalance />
  <HousesList />
</div> 