
import { supabase } from '../../lib/supabase';

export const paymongoService = {
  async createLink(data: { amount: number, description: string, remarks: string }) {
    // Try Supabase Function first (Production)
    try {
      const { data: response, error } = await supabase.functions.invoke('paymongo-handler', {
        body: { action: 'create-link', ...data }
      });
      
      if (!error && response) return response;
    } catch (e) {
      console.warn("Supabase function failed, falling back to local server", e);
    }

    // Fallback to local server (Development)
    const response = await fetch('/api/paymongo/create-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Server responded with ${response.status}`);
    }
    return await response.json();
  },

  async checkStatus(linkId: string) {
    // Try Supabase Function first (Production)
    try {
      const { data: response, error } = await supabase.functions.invoke('paymongo-handler', {
        body: { action: 'check-status', id: linkId }
      });
      
      if (!error && response) return response;
    } catch (e) {
      console.warn("Supabase function failed, falling back to local server", e);
    }

    // Fallback to local server (Development)
    const response = await fetch(`/api/paymongo/link/${linkId}`);
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Server responded with ${response.status}`);
    }
    return await response.json();
  }
};
