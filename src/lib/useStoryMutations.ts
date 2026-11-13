import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '../api/client';
import { ApiError, type NewStory, type Story, type StoryChanges } from '../api/types';
import { useToast } from '../components/Toast';

/** Story create/update/delete with cache refresh, and an "Add anyway" option when a sprint is over capacity. */
export function useStoryMutations(teamId: number) {
  const api = useApi();
  const notify = useToast();
  const queryClient = useQueryClient();

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['stories', teamId] });
    queryClient.invalidateQueries({ queryKey: ['sprints', teamId] });
    queryClient.invalidateQueries({ queryKey: ['burndown'] });
  };

  const handleError = (e: Error, retry: () => void) => {
    if (e instanceof ApiError && e.status === 409 && e.message.startsWith('Over capacity')) {
      notify(e.message.replace(/ Use \?force=true to override\.?/, ''), { tone: 'error', action: { label: 'Add anyway', onClick: retry } });
    } else {
      notify(e.message, { tone: 'error' });
    }
  };

  const update = useMutation({
    mutationFn: ({ id, changes, force }: { id: number; changes: StoryChanges; force?: boolean }) => api.updateStory(id, changes, force),
    // Optimistic update: move the card immediately, roll back if the API says no.
    onMutate: async ({ id, changes }) => {
      await queryClient.cancelQueries({ queryKey: ['stories', teamId] });
      const previous = queryClient.getQueryData<Story[]>(['stories', teamId]);
      queryClient.setQueryData<Story[]>(['stories', teamId], (old) => old?.map((s) => (s.id === id ? { ...s, ...changes } : s)));
      return { previous };
    },
    onError: (e: Error, vars, ctx) => {
      queryClient.setQueryData(['stories', teamId], ctx?.previous);
      handleError(e, () => update.mutate({ ...vars, force: true }));
    },
    onSettled: refresh,
  });

  const create = useMutation({
    mutationFn: ({ body, force }: { body: NewStory; force?: boolean }) => api.createStory(teamId, body, force),
    onSuccess: () => notify('Story added'),
    onError: (e: Error, vars) => handleError(e, () => create.mutate({ ...vars, force: true })),
    onSettled: refresh,
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.deleteStory(id),
    onError: (e: Error) => notify(e.message, { tone: 'error' }),
    onSettled: refresh,
  });

  return { update, create, remove };
}
