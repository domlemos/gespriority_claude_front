<script setup>
defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
})
</script>

<template>
  <div class="auth-layout">
    <div class="auth-layout__brand d-none d-md-flex">
      <div class="auth-layout__brand-content">
        <div class="auth-layout__logo">
          <v-icon icon="mdi-shield-check" size="40" />
          <span>upITSM</span>
        </div>
        <h1 class="text-h4 font-weight-bold mt-8 mb-4">
          Gestão de chamados, sem enrolação.
        </h1>
        <p class="text-body-1 opacity-90">
          Um único lugar para sua equipe atender, priorizar e resolver — e para seus
          clientes acompanharem cada chamado do início ao fim.
        </p>
      </div>
    </div>

    <div class="auth-layout__form">
      <v-card
        class="auth-layout__card pa-4 pa-sm-8"
        max-width="440"
        width="100%"
        elevation="4"
      >
        <div class="d-flex d-md-none align-center mb-6 text-primary">
          <v-icon icon="mdi-shield-check" size="32" class="mr-2" />
          <span class="text-h6 font-weight-bold">upITSM</span>
        </div>

        <h2 class="text-h5 font-weight-bold mb-1">{{ title }}</h2>
        <p v-if="subtitle" class="text-body-2 text-medium-emphasis mb-6">
          {{ subtitle }}
        </p>

        <slot />
      </v-card>
    </div>
  </div>
</template>

<style scoped>
.auth-layout {
  min-height: 100vh;
  display: flex;
}

.auth-layout__brand {
  flex: 1 1 45%;
  background: linear-gradient(
    135deg,
    rgb(var(--v-theme-secondary-darken-1)) 0%,
    rgb(var(--v-theme-secondary)) 50%,
    rgb(var(--v-theme-primary)) 150%
  );
  color: #fff;
  align-items: center;
  justify-content: center;
  padding: 64px;
}

.auth-layout__brand-content {
  max-width: 480px;
}

.auth-layout__logo {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 1.5rem;
  font-weight: 700;
}

.auth-layout__form {
  flex: 1 1 55%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgb(var(--v-theme-background));
}

.auth-layout__card {
  border-radius: 16px;
}
</style>
