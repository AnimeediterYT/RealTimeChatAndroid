import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.dropchat.app',
  appName: 'dropchat',
  webDir: 'out',
  server: {
    androidScheme: 'https',
  },
}

export default config
