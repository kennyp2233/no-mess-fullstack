<script lang="ts">
  import VotingList from '../../../features/voting/components/VotingList.svelte';
  import VotingRoom from '../../../features/voting/components/VotingRoom.svelte';
  import VotingResults from '../../../features/voting/components/VotingResults.svelte';
  // Lógica de integración vendrá después
</script>

<div class="space-y-6">
  <h1 class="text-2xl font-bold">Votaciones en Tiempo Real</h1>
  <VotingRoom />
  <VotingResults />
  <VotingList />
</div> 