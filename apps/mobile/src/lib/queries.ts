import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FeedResponse } from '@passtra/core';
import { useQuery } from '@tanstack/react-query';
import i18n from '@/i18n';
import { api, type LocationParams } from './api';
import { useAppState } from './store';

const FEED_CACHE = 'passtra.feed.v1';

/** Today feed with an offline fallback: the last successful feed is kept on the device. */
export function useFeed(params: LocationParams) {
  const interests = useAppState((s) => s.interests);
  const budget = useAppState((s) => s.budget);
  return useQuery({
    queryKey: ['feed', params, interests, budget, i18n.language],
    queryFn: async (): Promise<FeedResponse & { fromCache?: boolean }> => {
      try {
        const feed = await api.feed({ ...params, interests, budget });
        AsyncStorage.setItem(FEED_CACHE, JSON.stringify(feed)).catch(() => undefined);
        return feed;
      } catch (e) {
        const raw = await AsyncStorage.getItem(FEED_CACHE).catch(() => null);
        if (raw) return { ...(JSON.parse(raw) as FeedResponse), fromCache: true };
        throw e;
      }
    },
    staleTime: 60_000,
  });
}

export const useMeta = () => useQuery({ queryKey: ['meta', i18n.language], queryFn: api.meta, staleTime: 3_600_000 });
