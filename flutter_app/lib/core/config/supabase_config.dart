class SupabaseConfig {
  static const url = String.fromEnvironment(
    'SUPABASE_URL',
    defaultValue: 'https://dvjhcdmuuuwepayaatup.supabase.co',
  );

  static const publishableKey = String.fromEnvironment(
    'SUPABASE_PUBLISHABLE_KEY',
    defaultValue:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR2amhjZG11dXV3ZXBheWFhdHVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3ODA4NjIsImV4cCI6MjA4NTM1Njg2Mn0.ra0NZJjeq2GuzzfV1urL9Ys9DbIJNpI_kY_qOYQoKak',
  );
}
