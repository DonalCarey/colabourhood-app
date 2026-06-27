const SUPABASE_URL = "https://htooqkvrrkfcwknlodfd.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0b29xa3ZycmtmY3drbmxvZGZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1MTg4NjEsImV4cCI6MjA5ODA5NDg2MX0.jRRcGCTeJb1uaYM1GT2k0RcecmP44ckCQgOfClyBxJM";

window.COLABOURHOOD_SUPABASE = window.supabase?.createClient
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;
