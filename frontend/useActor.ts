import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

// ✅ Import from the correct `src/declarations/backend`
import { canisterId, createActor } from '../src/declarations/backend';
import type { _SERVICE } from '../src/declarations/backend/backend.did';

const ACTOR_QUERY_KEY = 'actor';

// Type alias for the backend actor
type BackendActor = import('../src/declarations/backend/backend.did')._SERVICE;


export function useActor() {
    const queryClient = useQueryClient();

    const actorQuery = useQuery<BackendActor>({
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

    return {
        actor: actorQuery.data || null,
        isFetching: actorQuery.isFetching
    };
}
