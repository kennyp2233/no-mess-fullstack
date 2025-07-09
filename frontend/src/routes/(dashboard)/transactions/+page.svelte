<script lang="ts">
  import TransactionsList from '../../../features/transactions/components/TransactionsList.svelte';
  import TransactionForm from '../../../features/transactions/components/TransactionForm.svelte';
  import TransactionFilters from '../../../features/transactions/components/TransactionFilters.svelte';
  import BalanceSummary from '../../../features/transactions/components/BalanceSummary.svelte';
  // Lógica de integración vendrá después
</script>

<div class="space-y-6">
  <h1 class="text-2xl font-bold">Gestión de Transacciones</h1>
  <TransactionFilters />
  <TransactionForm />
  <BalanceSummary />
  <TransactionsList />
</div> 