import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/supabase';

interface CompassQuote {
  text: string;
  source: 'mission' | 'vision' | null;
}

const CACHE_KEY = 'compass_quote_cache';
const CACHE_DURATION = 5 * 60 * 1000;

interface CachedQuote {
  quote: CompassQuote;
  timestamp: number;
}

export function useCompassQuote() {
  const [quote, setQuote] = useState<CompassQuote>({ text: '', source: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const extractFirstSentence = (text: string): string => {
    if (!text || text.trim().length === 0) return '';

    const cleaned = text.trim();
    const sentenceEnd = cleaned.search(/[.!?]\s/);

    if (sentenceEnd !== -1) {
      const sentence = cleaned.substring(0, sentenceEnd + 1);
      if (sentence.length <= 120) return sentence;
      return cleaned.substring(0, 117) + '...';
    }

    if (cleaned.length <= 120) return cleaned;
    return cleaned.substring(0, 117) + '...';
  };

  const fetchQuote = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setQuote({ text: '', source: null });
        setLoading(false);
        return;
      }

      const { data: northStarData, error: fetchError } = await supabase
        .from('0008-ap-north-star')
        .select('mission_text, vision_text')
        .eq('user_id', user.id)
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching North Star data:', fetchError);
        setError('Failed to load quote');
        setQuote({ text: '', source: null });
        setLoading(false);
        return;
      }

      let quoteText = '';
      let source: 'mission' | 'vision' | null = null;

      if (northStarData?.mission_text && northStarData.mission_text.trim().length > 0) {
        quoteText = extractFirstSentence(northStarData.mission_text);
        source = 'mission';
      } else if (northStarData?.vision_text && northStarData.vision_text.trim().length > 0) {
        quoteText = extractFirstSentence(northStarData.vision_text);
        source = 'vision';
      }

      const newQuote = { text: quoteText, source };
      setQuote(newQuote);

      try {
        const cacheData: CachedQuote = {
          quote: newQuote,
          timestamp: Date.now(),
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
      } catch (cacheError) {
        console.warn('Failed to cache quote:', cacheError);
      }

      setLoading(false);
    } catch (err) {
      console.error('Error in fetchQuote:', err);
      setError('An error occurred');
      setQuote({ text: '', source: null });
      setLoading(false);
    }
  }, []);

  const loadFromCache = useCallback(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsedCache: CachedQuote = JSON.parse(cached);
        const age = Date.now() - parsedCache.timestamp;

        if (age < CACHE_DURATION) {
          setQuote(parsedCache.quote);
          return true;
        }
      }
    } catch (err) {
      console.warn('Failed to load cached quote:', err);
    }
    return false;
  }, []);

  useEffect(() => {
    const hasCachedQuote = loadFromCache();

    if (!hasCachedQuote) {
      fetchQuote();
    } else {
      setLoading(false);
      fetchQuote();
    }

    const supabase = getSupabaseClient();
    const channel = supabase
      .channel('north-star-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: '0008-ap-north-star',
        },
        () => {
          fetchQuote();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchQuote, loadFromCache]);

  const refresh = useCallback(() => {
    fetchQuote();
  }, [fetchQuote]);

  return {
    quote: quote.text,
    source: quote.source,
    loading,
    error,
    refresh,
  };
}
