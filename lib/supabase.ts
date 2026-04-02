
import { createClient } from '@supabase/supabase-js';

//MAIN DATABASE
//const supabaseUrl = 'https://xzjdatstzdaryfmxgmor.supabase.co';
//const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6amRhdHN0emRhcnlmbXhnbW9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyNjE1NDAsImV4cCI6MjA4MzgzNzU0MH0.goynHBdatbvbZQyP_MBLq8DGE8ZkDHEsXohEDfx6Q_Y'; 

//SECONDARY DATABASE
//const supabaseUrl = 'https://susjfezwcwzwqbqmqtgd.supabase.co';
//const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN1c2pmZXp3Y3d6d3FicW1xdGdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzODc1MjcsImV4cCI6MjA4NDk2MzUyN30.LLuc-kitZ_ac9rAsxguECo-U9jOp7v43a5BI15okOIU";



const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase credentials missing. Check your environment variables.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
