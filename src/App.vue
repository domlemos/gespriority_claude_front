<script setup></script>

<template>
  <v-app>
    <router-view />
  </v-app>
</template>

<style>
/* Ajustes globais pra celular (< 600px). */
@media (max-width: 599.98px) {
  /* Títulos de página (h1.text-h5) um pouco menores. */
  h1.text-h5 {
    font-size: 1.375rem !important;
    line-height: 1.75rem !important;
  }

  /* Modais aproveitam quase toda a largura — o padrão do Vuetify reserva 24px
     de cada lado, o que espreme formulários. */
  .v-dialog:not(.v-dialog--fullscreen) > .v-overlay__content {
    margin: 8px;
    width: calc(100% - 16px) !important;
    max-width: calc(100% - 16px) !important;
    max-height: calc(100% - 16px);
  }
}
</style>
