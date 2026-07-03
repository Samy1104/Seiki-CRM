import { supabase } from './supabaseClient';

export interface EventItem {
  id: string;
  name: string;
  event_date: string;
  end_date: string | null;
  location: string | null;
  segment: string | null;
  objective: string | null;
  ical_uid: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const eventsService = {
  async getEvents(): Promise<EventItem[]> {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('event_date', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async createEvent(event: Omit<EventItem, 'id' | 'created_at' | 'updated_at' | 'ical_uid'>): Promise<EventItem> {
    const { data, error } = await supabase
      .from('events')
      .insert([event])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateEvent(id: string, updates: Partial<EventItem>): Promise<void> {
    const { error } = await supabase
      .from('events')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  },

  async deleteEvent(id: string): Promise<void> {
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
};
