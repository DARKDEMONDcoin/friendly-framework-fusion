import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Workspace = Tables<"workspaces">;
export type Profile = Tables<"profiles">;
export type Integration = Tables<"integrations">;
export type BrainItem = Tables<"brain_items">;
export type Task = Tables<"tasks">;
export type Message = Tables<"messages">;

export type TaskStep = { label: string; state: "done" | "active" | "todo" | "blocked" };

export function taskSteps(task: Task): TaskStep[] {
  const raw = task.steps;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (s): s is TaskStep =>
      !!s && typeof s === "object" && "label" in (s as Record<string, unknown>),
  );
}

async function must<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>) {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as T;
}

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;
      return must<Profile>(
        supabase.from("profiles").select("*").eq("id", auth.user.id).maybeSingle(),
      );
    },
  });
}

export function useWorkspace() {
  return useQuery({
    queryKey: ["workspace"],
    queryFn: async () => {
      const rows = await must<Workspace[]>(
        supabase.from("workspaces").select("*").order("created_at", { ascending: true }),
      );
      return rows[0] ?? null;
    },
  });
}

export function useIntegrations(workspaceId?: string) {
  return useQuery({
    queryKey: ["integrations", workspaceId],
    enabled: !!workspaceId,
    queryFn: () =>
      must<Integration[]>(
        supabase
          .from("integrations")
          .select("*")
          .eq("workspace_id", workspaceId!)
          .order("created_at", { ascending: true }),
      ),
  });
}

export function useBrainItems(workspaceId?: string) {
  return useQuery({
    queryKey: ["brain", workspaceId],
    enabled: !!workspaceId,
    queryFn: () =>
      must<BrainItem[]>(
        supabase
          .from("brain_items")
          .select("*")
          .eq("workspace_id", workspaceId!)
          .order("created_at", { ascending: false }),
      ),
  });
}

export function useTasks(workspaceId?: string) {
  return useQuery({
    queryKey: ["tasks", workspaceId],
    enabled: !!workspaceId,
    queryFn: () =>
      must<Task[]>(
        supabase
          .from("tasks")
          .select("*")
          .eq("workspace_id", workspaceId!)
          .order("created_at", { ascending: false }),
      ),
  });
}

export function useMessages(workspaceId: string | undefined, employeeId: string) {
  return useQuery({
    queryKey: ["messages", workspaceId, employeeId],
    enabled: !!workspaceId,
    queryFn: () =>
      must<Message[]>(
        supabase
          .from("messages")
          .select("*")
          .eq("workspace_id", workspaceId!)
          .eq("employee_id", employeeId)
          .order("created_at", { ascending: true }),
      ),
  });
}

export function useLastMessages(workspaceId?: string) {
  return useQuery({
    queryKey: ["messages-last", workspaceId],
    enabled: !!workspaceId,
    queryFn: () =>
      must<Message[]>(
        supabase
          .from("messages")
          .select("*")
          .eq("workspace_id", workspaceId!)
          .order("created_at", { ascending: false })
          .limit(60),
      ),
  });
}

export function useUpdateTask(workspaceId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Task> }) => {
      const { error } = await supabase.from("tasks").update(patch).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["tasks", workspaceId] });
    },
  });
}

export function useCreateTask(workspaceId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (task: {
      employee_id: string;
      title: string;
      detail?: string;
      channel?: string;
      kind?: string;
      status?: string;
    }) => {
      const { error } = await supabase
        .from("tasks")
        .insert({ ...task, workspace_id: workspaceId! });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["tasks", workspaceId] });
    },
  });
}

export function useSetIntegrationStatus(workspaceId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      status,
      account,
    }: {
      id: string;
      status: string;
      account: string | null;
    }) => {
      const { error } = await supabase.from("integrations").update({ status, account }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["integrations", workspaceId] });
    },
  });
}

export function useAddBrainItem(workspaceId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: { kind: string; title: string; body?: string; meta?: string }) => {
      const { error } = await supabase.from("brain_items").insert({
        workspace_id: workspaceId!,
        kind: item.kind,
        title: item.title,
        body: item.body ?? null,
        meta: item.meta ?? null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["brain", workspaceId] });
    },
  });
}

export function useDeleteBrainItem(workspaceId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("brain_items").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["brain", workspaceId] });
    },
  });
}

export function useUpdateWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Workspace> }) => {
      const { error } = await supabase.from("workspaces").update(patch).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["workspace"] });
    },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Profile> }) => {
      const { error } = await supabase.from("profiles").update(patch).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}
