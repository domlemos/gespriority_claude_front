import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'
import { createVuetify } from 'vuetify'

// Paleta extraída do bundle CSS de https://login.uplexis.com/login
// (classes utilitárias `bg-brand-*`/`text-brand-*` do Tailwind gerado no build deles).
const brand = {
  orange: '#FF8C1A',
  orangeLight: '#FFA64D',
  orangeDark: '#E67300',
  purple: '#7922B9',
  purpleDark: '#551782',
  purpleLight: '#C371FF',
}

export default createVuetify({
  theme: {
    defaultTheme: 'light',
    themes: {
      light: {
        dark: false,
        colors: {
          primary: brand.orange,
          'primary-darken-1': brand.orangeDark,
          'primary-lighten-1': brand.orangeLight,
          secondary: brand.purple,
          'secondary-darken-1': brand.purpleDark,
          'secondary-lighten-1': brand.purpleLight,
          background: '#F5F5F7',
          surface: '#FFFFFF',
          error: '#E53935',
          success: '#166534',
          warning: '#F59E0B',
          info: '#2563EB',
        },
      },
      dark: {
        dark: true,
        colors: {
          primary: brand.orangeLight,
          'primary-darken-1': brand.orange,
          'primary-lighten-1': '#FFC285',
          secondary: brand.purpleLight,
          'secondary-darken-1': brand.purple,
          'secondary-lighten-1': '#DDA6FF',
          background: '#121212',
          surface: '#1E1E1E',
          error: '#EF5350',
          success: '#4ADE80',
          warning: '#FBBF24',
          info: '#60A5FA',
        },
      },
    },
  },
  defaults: {
    VBtn: { rounded: 'lg' },
    VCard: { rounded: 'lg' },
    VTextField: { variant: 'outlined', density: 'comfortable', color: 'primary' },
  },
})
