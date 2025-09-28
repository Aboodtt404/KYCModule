import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
// ✅ Import from the correct `src/declarations/backend`
import { canisterId, createActor } from '../src/declarations/backend';
const ACTOR_QUERY_KEY = 'actor';
export function useActor() {
    const queryClient = useQueryClient();
    const actorQuery = useQuery({
        queryKey: [ACTOR_QUERY_KEY],
        queryFn: async () => {
            return await createActor(canisterId);
        },
        staleTime: Infinity,
        enabled: true
    });
    useEffect(() => {
        if (actorQuery.data) {
            queryClient.invalidateQueries({
                predicate: (query) => !query.queryKey.includes(ACTOR_QUERY_KEY)
            });
            queryClient.refetchQueries({
                predicate: (query) => !query.queryKey.includes(ACTOR_QUERY_KEY)
            });
        }
    }, [actorQuery.data, queryClient]);
    const result = {
        actor: actorQuery.data || null,
        isFetching: actorQuery.isFetching
    };
    console.log('useActor returning:', {
        hasActor: !!result.actor,
        isFetching: result.isFetching,
        error: actorQuery.error,
        status: actorQuery.status
    });
    return result;
}
