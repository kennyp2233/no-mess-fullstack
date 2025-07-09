<script lang="ts">
  import { authStore } from '../stores/auth.store';
  import { Button, Input, Loading } from '../../../shared/components/ui';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { get } from 'svelte/store';

  let email = '';
  let password = '';
  let error: string | null = null;
  let loading = false;

  function validate() {
    if (!email) return 'El correo es obligatorio';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return 'Correo inválido';
    if (!password) return 'La contraseña es obligatoria';
    return null;
  }

  async function handleSubmit() {
    error = validate();
    if (error) return;
    loading = true;
    try {
      await authStore.login(email, password);
      error = null;
      goto('/dashboard');
    } catch (e: any) {
      error = e?.message || 'Error de autenticación';
    } finally {
      loading = false;
    }
  }
</script>

<form class="space-y-4 max-w-sm mx-auto" on:submit|preventDefault={handleSubmit}>
  <div>
    <label class="block mb-1 text-sm font-medium">Correo electrónico</label>
    <Input type="email" bind:value={email} placeholder="usuario@correo.com" />
  </div>
  <div>
    <label class="block mb-1 text-sm font-medium">Contraseña</label>
    <Input type="password" bind:value={password} placeholder="********" />
  </div>
  {#if error}
    <div class="text-red-600 text-sm">{error}</div>
  {/if}
  <Button type="submit" variant="primary" disabled={loading}>
    {#if loading}
      <Loading type="spinner" />
    {:else}
      Iniciar sesión
    {/if}
  </Button>
</form>
