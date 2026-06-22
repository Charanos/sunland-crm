import { useQuery, type UseQueryOptions, type QueryKey } from "@tanstack/react-query";
import { useUIStore } from "@/store/ui";

export function useEntityQuery<TQueryFnData = unknown, TError = Error, TData = TQueryFnData>(
  queryKey: unknown[],
  queryFn: (activeEntityId: string) => Promise<TQueryFnData>,
  options?: Omit<UseQueryOptions<TQueryFnData, TError, TData, QueryKey>, "queryKey" | "queryFn">
) {
  const { activeEntityId } = useUIStore();

  return useQuery<TQueryFnData, TError, TData, QueryKey>({
    queryKey: [...queryKey, activeEntityId],
    queryFn: () => queryFn(activeEntityId),
    ...options,
  });
}
