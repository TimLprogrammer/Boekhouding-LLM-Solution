import { createClient } from '@supabase/supabase-js';

// We gebruiken hier direct de keys die je hebt aangeleverd om zeker te zijn van een werkende verbinding
// in deze omgeving waar process.env mogelijk niet beschikbaar is.
const supabaseUrl = "https://pwywlubzwcxghjbypuip.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3eXdsdWJ6d2N4Z2hqYnlwdWlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2ODg1NzksImV4cCI6MjA3OTI2NDU3OX0.oryUwNE-zhKVaOzqWrjguau_YzfykApEsKuITwF0t54";

export const supabase = createClient(supabaseUrl, supabaseKey);