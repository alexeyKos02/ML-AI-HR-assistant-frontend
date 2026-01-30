<script setup lang="ts">
import Menubar from 'primevue/menubar'
</script>

<template>
  <div class="app-shell">
    <Menubar>
      <template #start>
        <div class="brand">
          <i class="pi pi-sparkles" />
          <span class="brand__text">HR AI Screening</span>
        </div>
      </template>

      <template #end>
        <div class="muted">1.0</div>
      </template>
    </Menubar>

    <main class="app-content">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
  background: var(--surface-ground);
}

.app-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 18px 16px 32px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 700;
}
.brand__text {
  letter-spacing: 0.2px;
}

.muted {
  color: var(--text-color-secondary);
  font-size: 12px;
}

/* Menubar должен быть “плашкой”, без скругления сверху */
:deep(.p-menubar) {
  border-radius: 0;
  border: 0;
  border-bottom: 1px solid var(--surface-border);
  background: var(--surface-card);
  box-shadow: none;
  overflow: visible;
}
</style>