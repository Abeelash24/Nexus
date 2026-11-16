export const environment = {
  production: true,
  supabaseUrl: 'https://plhehakcdqvibojagund.supabase.co',
  supabaseKey: 'sb_publishable_C_Ssp-AbvH_2JmRDPhbP4A_WJNDxXNQ',
  googleDriveEnabled: true,
  appName: 'CareerNexus',
  appTagline: 'Connect. Prepare. Get Placed.',
  webrtc: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      // Optional TURN servers injected via deployment environment variables without hardcoding secrets
      ...((globalThis as any)?.process?.env?.TURN_SERVER_URL ? [{
        urls: (globalThis as any).process.env.TURN_SERVER_URL,
        username: (globalThis as any).process.env.TURN_USERNAME || '',
        credential: (globalThis as any).process.env.TURN_CREDENTIAL || ''
      }] : [])
    ]
  }
};
