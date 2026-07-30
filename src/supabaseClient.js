import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // This will show up in the browser console (F12) if the .env values
  // (or Netlify environment variables) haven't been set yet.
  console.warn(
    "Supabase credentials are missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY " +
    "in your .env file locally, or in Netlify's Site settings > Environment variables."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
