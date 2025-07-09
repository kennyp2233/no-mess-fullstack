<script lang="ts">
  import { authStore } from '../stores/auth.store';
  import { Button, Input, Loading } from '../../../shared/components/ui';
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';

  let name = '';
  let email = '';
  let password = '';
  let confirmPassword = '';
  let error: string | null = null;
  let loading = false;

  function validate() {
    if (!name) return 'El nombre es obligatorio';
    if (!email) return 'El correo es obligatorio';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return 'Correo inválido';
    if (!password) return 'La contraseña es obligatoria';
    if (password.length < 8) return 'La contraseña debe tener al menos 8 caracteres';
    if (password !== confirmPassword) return 'Las contraseñas no coinciden';
    return null;
  }

  async function handleSubmit() {
    error = validate();
    if (error) return;
    loading = true;
    try {
      await authStore.login(email, password); // Simulación, reemplazar por register si se habilita
      error = null;
    } catch (e: any) {
      error = e?.message || 'Error de registro';
    } finally {
      loading = false;
    }
  }
</script>

<form class="space-y-4 max-w-sm mx-auto" on:submit|preventDefault={handleSubmit}>
  <div>
    <label class="block mb-1 text-sm font-medium">Nombre</label>
    <Input type="text" bind:value={name} placeholder="Nombre completo" />
  </div>
  <div>
    <label class="block mb-1 text-sm font-medium">Correo electrónico</label>
    <Input type="email" bind:value={email} placeholder="usuario@correo.com" />
  </div>
  <div>
    <label class="block mb-1 text-sm font-medium">Contraseña</label>
    <Input type="password" bind:value={password} placeholder="********" />
  </div>
  <div>
    <label class="block mb-1 text-sm font-medium">Confirmar contraseña</label>
    <Input type="password" bind:value={confirmPassword} placeholder="********" />
  </div>
  {#if error}
    <div class="text-red-600 text-sm">{error}</div>
  {/if}
  <Button type="submit" variant="primary" disabled={loading}>
    {#if loading}
      <Loading type="spinner" />
    {:else}
      Registrar usuario
    {/if}
  </Button>
</form>
