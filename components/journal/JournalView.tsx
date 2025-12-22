import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FileText, Lightbulb, Flower2, AlertTriangle } from 'lucide-react-native';
import { getSupabaseClient } from '@/lib/supabase';
import { calculateTaskPoints } from '@/lib/taskUtils';
import { fetchBulkLinkedItemsCounts } from '@/lib/followThroughUtils';
import { fetchAttachmentsForReflections } from '@/lib/reflectionUtils';

interface JournalEntry {
  id: string;
  date: string; // created_at (pending task) or completed_at (completed task) or withdrawn_at (withdrawal) or created_at (reflection)
  description: string;
  type: 'deposit' | 'withdrawal' | 'reflection';
  amount: number; // deposit points or withdrawal amount
  balance: number; // running balance
  has_notes: boolean;
  source_id: string; // task_id or withdrawal_id or reflection_id
  source_type: 'task' | 'withdrawal' | 'reflection';
  source_data?: any;
  linked_count?: number; // count of linked actions/reflections
  status?: 'completed' | 'pending'; // track active (pending) vs completed tasks
}

interface JournalViewProps {
  scope: {
    type: 'user' | 'role' | 'key_relationship' | 'domain';
    id?: string;
    name?: string;
  };
  onEntryPress: (entry: JournalEntry) => void;
  dateRange?: 'today' | 'week' | 'month' | 'all';
  refreshKey?: number;
  showTimePeriodSelector?: boolean;
  onDateRangeChange?: (dateRange: 'today' | 'week' | 'month' | 'all') => void;
}

export function JournalView({ scope, onEntryPress, dateRange = 'week', refreshKey, showTimePeriodSelector = false, onDateRangeChange }: JournalViewProps) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month' | 'all'>(dateRange || 'week');
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalBalance, setTotalBalance] = useState(0);
  const [pageSize] = useState(30);
  const [displayedCount, setDisplayedCount] = useState(30);
  const [allEntries, setAllEntries] = useState<JournalEntry[]>([]);
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const fetchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const previousScopeRef = React.useRef<string>('');
  const cacheRef = React.useRef<{
    data: JournalEntry[];
    timestamp: number;
    scope: string;
    dateRange: string;
  } | null>(null);
  const CACHE_TTL = 30000;

  // helper to group records by parent_id for fast lookup
  const groupByParentId = <T extends { parent_id: string }>(rows: T[] | null | undefined) => {
    const map = new Map<string, T[]>();
    (rows ?? []).forEach((r) => {
      const arr = map.get(r.parent_id) ?? [];
      arr.push(r);
      map.set(r.parent_id, arr);
    });
    return map;
  };

  // calculate start date for the range filter (YYYY-MM-DD)
  const getDateFilter = (): string | '' => {
    if (dateRange === 'all') return '';
    const now = new Date();
    let days = 30;
    if (dateRange === 'today') {
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      return todayStart.toISOString().split('T')[0];
    } else if (dateRange === 'week') {
      days = 7;
    }
    const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    return since.toISOString().split('T')[0];
  };

  const fetchJournalEntries = async (forceRefresh: boolean = false) => {
    const scopeKey = JSON.stringify(scope);

    if (!forceRefresh && cacheRef.current) {
      const cacheAge = Date.now() - cacheRef.current.timestamp;
      const cacheMatch =
        cacheRef.current.scope === scopeKey &&
        cacheRef.current.dateRange === dateRange;

      if (cacheMatch && cacheAge < CACHE_TTL) {
        console.log('[JournalView] Using cached data, age:', Math.round(cacheAge / 1000), 'seconds');
        setAllEntries(cacheRef.current.data);
        setEntries(cacheRef.current.data.slice(0, Math.min(displayedCount, cacheRef.current.data.length)));

        let runningBalance = 0;
        const chronological = [...cacheRef.current.data].reverse();
        chronological.forEach((e) => {
          if (e.type === 'deposit' && e.status !== 'pending') runningBalance += e.amount;
          else if (e.type === 'withdrawal') runningBalance -= e.amount;
        });
        setTotalBalance(runningBalance);
        return;
      }
    }

    // Create new AbortController for this fetch
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      console.log('[JournalView] User auth status:', user ? `Logged in as ${user.email} (${user.id})` : 'Not logged in');

      if (!user) {
        console.log('[JournalView] No user found, showing empty journal');
        setEntries([]);
        setAllEntries([]);
        setTotalBalance(0);
        setLoading(false);
        cacheRef.current = null;
        return;
      }

      // Check if aborted
      if (controller.signal.aborted) {
        return;
      }

      const dateFilter = getDateFilter();
      const journalEntries: JournalEntry[] = [];

      // ---------------------------------------------------------
      // 1) Deposits = completed tasks
      // ---------------------------------------------------------
        let tasksQuery = supabase
          .from('0008-ap-tasks')
          .select('id, title, type, status, completed_at, due_date, start_date, end_date, start_time, end_time, is_all_day, is_urgent, is_important, is_twelve_week_goal, recurrence_rule, user_global_timeline_id, custom_timeline_id, parent_task_id')
          .eq('user_id', user.id)
          .eq('status', 'completed')
          .is('deleted_at', null)
          .not('completed_at', 'is', null);

        if (dateFilter) {
          tasksQuery = tasksQuery.gte('completed_at', dateFilter);
        }

        const { data: tasksData, error: tasksError } = await tasksQuery;
        console.log('[JournalView] Completed tasks query result:', tasksData?.length || 0, 'tasks found for user', user.id);
        if (tasksError) {
          console.error('[JournalView] Tasks query error:', tasksError);
          throw tasksError;
        }

        if (tasksData && tasksData.length) {
          const taskIds = tasksData.map((t: any) => t.id);

          // pull role/domain/keyRel/notes/goals for these tasks
          const [
            rolesRes,
            domainsRes,
            keyRelsRes,
            notesRes,
            goalsRes,
          ] = await Promise.all([
            supabase
              .from('0008-ap-universal-roles-join')
              .select('parent_id, role_id, role:0008-ap-roles(id,label)')
              .in('parent_id', taskIds)
              .eq('parent_type', 'task'),
            supabase
              .from('0008-ap-universal-domains-join')
              .select('parent_id, domain_id, domain:0008-ap-domains(id,name)')
              .in('parent_id', taskIds)
              .eq('parent_type', 'task'),
            supabase
              .from('0008-ap-universal-key-relationships-join')
              .select('parent_id, key_relationship_id, key_relationship:0008-ap-key-relationships(id,name)')
              .in('parent_id', taskIds)
              .eq('parent_type', 'task'),
            supabase
              .from('0008-ap-universal-notes-join')
              .select('parent_id, note:0008-ap-notes(id,content,created_at)')
              .in('parent_id', taskIds)
              .eq('parent_type', 'task'),
            supabase
              .from('0008-ap-universal-goals-join')
              .select(`
                parent_id,
                goal_type,
                twelve_wk_goal_id,
                custom_goal_id,
                tw:0008-ap-goals-12wk(id,title,status),
                cg:0008-ap-goals-custom(id,title,status)
              `)
              .in('parent_id', taskIds)
              .eq('parent_type', 'task'),
          ]);

          const taskRoles = rolesRes.data ?? [];
          const taskDomains = domainsRes.data ?? [];
          const taskKeyRels = keyRelsRes.data ?? [];
          const taskNotes = notesRes.data ?? [];
          const taskGoals = goalsRes.data ?? [];

          // scope filter for tasks (role/domain/key_relationship)
          let allowedTaskIds = new Set(taskIds);
          if (scope.type !== 'user' && scope.id) {
            if (scope.type === 'role') {
              allowedTaskIds = new Set(
                taskRoles
                  .filter((r: any) => r.role?.id === scope.id || r.role_id === scope.id)
                  .map((r: any) => r.parent_id)
              );
            } else if (scope.type === 'domain') {
              allowedTaskIds = new Set(
                taskDomains
                  .filter((d: any) => d.domain?.id === scope.id || d.domain_id === scope.id)
                  .map((d: any) => d.parent_id)
              );
            } else if (scope.type === 'key_relationship') {
              allowedTaskIds = new Set(
                taskKeyRels
                  .filter((k: any) => k.key_relationship?.id === scope.id || k.key_relationship_id === scope.id)
                  .map((k: any) => k.parent_id)
              );
            }
          }

          // index lookups
          const rolesByTask = groupByParentId(taskRoles);
          const domainsByTask = groupByParentId(taskDomains);
          const keyRelsByTask = groupByParentId(taskKeyRels);
          const notesByTask = groupByParentId(taskNotes);
          const goalsByTask = groupByParentId(taskGoals);

          for (const t of tasksData) {
            if (!allowedTaskIds.has(t.id)) continue;

            const roles = (rolesByTask.get(t.id) ?? []).map((r: any) => r.role).filter(Boolean);
            const domains = (domainsByTask.get(t.id) ?? []).map((d: any) => d.domain).filter(Boolean);
            const keyRelationships = (keyRelsByTask.get(t.id) ?? [])
              .map((k: any) => k.key_relationship)
              .filter(Boolean);
            const notes = (notesByTask.get(t.id) ?? []).map((n: any) => n.note).filter(Boolean);
            const goals = (goalsByTask.get(t.id) ?? []).map((g: any) => {
              if (g.goal_type === 'twelve_wk_goal' && g.tw) {
                const goal = g.tw;
                if (!goal || goal.status === 'archived' || goal.status === 'cancelled') {
                  return null;
                }
                return { ...goal, goal_type: '12week' };
              } else if (g.goal_type === 'custom_goal' && g.cg) {
                const goal = g.cg;
                if (!goal || goal.status === 'archived' || goal.status === 'cancelled') {
                  return null;
                }
                return { ...goal, goal_type: 'custom' };
              }
              return null;
            }).filter(Boolean);

            const source_data = { ...t, roles, domains, keyRelationships, notes, goals };
            const points = calculateTaskPoints(t, roles, domains, goals);

            journalEntries.push({
              id: t.id,
              date: t.completed_at, // <-- completed_at for tasks
              description: t.title,
              type: 'deposit',
              amount: points,
              balance: 0,
              has_notes: notes.length > 0,
              source_id: t.id,
              source_type: 'task',
              source_data,
              status: 'completed',
            });
          }
        }

      // ---------------------------------------------------------
      // 1b) Pending Tasks (active deposits)
      // ---------------------------------------------------------
        let pendingTasksQuery = supabase
          .from('0008-ap-tasks')
          .select('id, title, type, status, due_date, start_date, end_date, start_time, end_time, is_all_day, is_urgent, is_important, is_twelve_week_goal, recurrence_rule, user_global_timeline_id, custom_timeline_id, parent_task_id, created_at')
          .eq('user_id', user.id)
          .eq('status', 'pending')
          .is('deleted_at', null);

        if (dateFilter) {
          pendingTasksQuery = pendingTasksQuery.gte('created_at', dateFilter);
        }

        const { data: pendingTasksData, error: pendingTasksError } = await pendingTasksQuery;
        console.log('[JournalView] Pending tasks query result:', pendingTasksData?.length || 0, 'tasks found for user', user.id);
        if (pendingTasksError) {
          console.error('[JournalView] Pending tasks query error:', pendingTasksError);
          throw pendingTasksError;
        }

        if (pendingTasksData && pendingTasksData.length) {
          const pendingTaskIds = pendingTasksData.map((t: any) => t.id);

          const [
            pendingRolesRes,
            pendingDomainsRes,
            pendingKeyRelsRes,
            pendingNotesRes,
            pendingGoalsRes,
          ] = await Promise.all([
            supabase
              .from('0008-ap-universal-roles-join')
              .select('parent_id, role_id, role:0008-ap-roles(id,label)')
              .in('parent_id', pendingTaskIds)
              .eq('parent_type', 'task'),
            supabase
              .from('0008-ap-universal-domains-join')
              .select('parent_id, domain_id, domain:0008-ap-domains(id,name)')
              .in('parent_id', pendingTaskIds)
              .eq('parent_type', 'task'),
            supabase
              .from('0008-ap-universal-key-relationships-join')
              .select('parent_id, key_relationship_id, key_relationship:0008-ap-key-relationships(id,name)')
              .in('parent_id', pendingTaskIds)
              .eq('parent_type', 'task'),
            supabase
              .from('0008-ap-universal-notes-join')
              .select('parent_id, note:0008-ap-notes(id,content,created_at)')
              .in('parent_id', pendingTaskIds)
              .eq('parent_type', 'task'),
            supabase
              .from('0008-ap-universal-goals-join')
              .select(`
                parent_id,
                goal_type,
                twelve_wk_goal_id,
                custom_goal_id,
                tw:0008-ap-goals-12wk(id,title,status),
                cg:0008-ap-goals-custom(id,title,status)
              `)
              .in('parent_id', pendingTaskIds)
              .eq('parent_type', 'task'),
          ]);

          const pendingTaskRoles = pendingRolesRes.data ?? [];
          const pendingTaskDomains = pendingDomainsRes.data ?? [];
          const pendingTaskKeyRels = pendingKeyRelsRes.data ?? [];
          const pendingTaskNotes = pendingNotesRes.data ?? [];
          const pendingTaskGoals = pendingGoalsRes.data ?? [];

          // scope filter for pending tasks
          let allowedPendingTaskIds = new Set(pendingTaskIds);
          if (scope.type !== 'user' && scope.id) {
            if (scope.type === 'role') {
              allowedPendingTaskIds = new Set(
                pendingTaskRoles
                  .filter((r: any) => r.role?.id === scope.id || r.role_id === scope.id)
                  .map((r: any) => r.parent_id)
              );
            } else if (scope.type === 'domain') {
              allowedPendingTaskIds = new Set(
                pendingTaskDomains
                  .filter((d: any) => d.domain?.id === scope.id || d.domain_id === scope.id)
                  .map((d: any) => d.parent_id)
              );
            } else if (scope.type === 'key_relationship') {
              allowedPendingTaskIds = new Set(
                pendingTaskKeyRels
                  .filter((k: any) => k.key_relationship?.id === scope.id || k.key_relationship_id === scope.id)
                  .map((k: any) => k.parent_id)
              );
            }
          }

          const pendingRolesByTask = groupByParentId(pendingTaskRoles);
          const pendingDomainsByTask = groupByParentId(pendingTaskDomains);
          const pendingKeyRelsByTask = groupByParentId(pendingTaskKeyRels);
          const pendingNotesByTask = groupByParentId(pendingTaskNotes);
          const pendingGoalsByTask = groupByParentId(pendingTaskGoals);

          for (const t of pendingTasksData) {
            if (!allowedPendingTaskIds.has(t.id)) continue;

            const roles = (pendingRolesByTask.get(t.id) ?? []).map((r: any) => r.role).filter(Boolean);
            const domains = (pendingDomainsByTask.get(t.id) ?? []).map((d: any) => d.domain).filter(Boolean);
            const keyRelationships = (pendingKeyRelsByTask.get(t.id) ?? [])
              .map((k: any) => k.key_relationship)
              .filter(Boolean);
            const notes = (pendingNotesByTask.get(t.id) ?? []).map((n: any) => n.note).filter(Boolean);
            const goals = (pendingGoalsByTask.get(t.id) ?? []).map((g: any) => {
              if (g.goal_type === 'twelve_wk_goal' && g.tw) {
                const goal = g.tw;
                if (!goal || goal.status === 'archived' || goal.status === 'cancelled') {
                  return null;
                }
                return { ...goal, goal_type: '12week' };
              } else if (g.goal_type === 'custom_goal' && g.cg) {
                const goal = g.cg;
                if (!goal || goal.status === 'archived' || goal.status === 'cancelled') {
                  return null;
                }
                return { ...goal, goal_type: 'custom' };
              }
              return null;
            }).filter(Boolean);

            const source_data = { ...t, roles, domains, keyRelationships, notes, goals };

            journalEntries.push({
              id: t.id,
              date: t.created_at, // use created_at for pending tasks
              description: `${t.title} (active)`,
              type: 'deposit',
              amount: 0, // no points until completion
              balance: 0,
              has_notes: notes.length > 0,
              source_id: t.id,
              source_type: 'task',
              source_data,
              status: 'pending',
            });
          }
        }

      // ---------------------------------------------------------
      // 2) Withdrawals
      // ---------------------------------------------------------
        let withdrawalsQuery = supabase
          .from('0008-ap-withdrawals')
          .select('id, title, amount, withdrawn_at, user_id')
          .eq('user_id', user.id);

        if (dateFilter) {
          withdrawalsQuery = withdrawalsQuery.gte('withdrawn_at', dateFilter);
        }

        const { data: withdrawalsData, error: withdrawalsError } = await withdrawalsQuery;
        if (withdrawalsError) {
          console.error('Withdrawals query error:', withdrawalsError);
          throw withdrawalsError;
        }

        if (withdrawalsData && withdrawalsData.length) {
          const wIds = withdrawalsData.map((w: any) => w.id);

          const [wRolesRes, wDomainsRes, wKeyRelsRes, wNotesRes] = await Promise.all([
            supabase
              .from('0008-ap-universal-roles-join')
              .select('parent_id, role_id, role:0008-ap-roles(id,label)')
              .in('parent_id', wIds)
              .eq('parent_type', 'withdrawal'),
            supabase
              .from('0008-ap-universal-domains-join')
              .select('parent_id, domain_id, domain:0008-ap-domains(id,name)')
              .in('parent_id', wIds)
              .eq('parent_type', 'withdrawal'),
            supabase
              .from('0008-ap-universal-key-relationships-join')
              .select('parent_id, key_relationship_id, key_relationship:0008-ap-key-relationships(id,name)')
              .in('parent_id', wIds)
              .eq('parent_type', 'withdrawal'),
            supabase
              .from('0008-ap-universal-notes-join')
              .select('parent_id, note:0008-ap-notes(id,content,created_at)')
              .in('parent_id', wIds)
              .eq('parent_type', 'withdrawal'),
          ]);

          const wRoles = wRolesRes.data ?? [];
          const wDomains = wDomainsRes.data ?? [];
          const wKeyRels = wKeyRelsRes.data ?? [];
          const wNotes = wNotesRes.data ?? [];

          // scope filter for withdrawals
          let allowedWids = new Set(wIds);
          if (scope.type !== 'user' && scope.id) {
            if (scope.type === 'role') {
              allowedWids = new Set(
                wRoles
                  .filter((r: any) => r.role?.id === scope.id || r.role_id === scope.id)
                  .map((r: any) => r.parent_id)
              );
            } else if (scope.type === 'domain') {
              allowedWids = new Set(
                wDomains
                  .filter((d: any) => d.domain?.id === scope.id || d.domain_id === scope.id)
                  .map((d: any) => d.parent_id)
              );
            } else if (scope.type === 'key_relationship') {
              allowedWids = new Set(
                wKeyRels
                  .filter((k: any) => k.key_relationship?.id === scope.id || k.key_relationship_id === scope.id)
                  .map((k: any) => k.parent_id)
              );
            }
          }

          const rolesByW = groupByParentId(wRoles);
          const domainsByW = groupByParentId(wDomains);
          const keyRelsByW = groupByParentId(wKeyRels);
          const notesByW = groupByParentId(wNotes);

          for (const w of withdrawalsData) {
            if (!allowedWids.has(w.id)) continue;

            const roles = (rolesByW.get(w.id) ?? []).map((r: any) => r.role).filter(Boolean);
            const domains = (domainsByW.get(w.id) ?? []).map((d: any) => d.domain).filter(Boolean);
            const keyRelationships = (keyRelsByW.get(w.id) ?? [])
              .map((k: any) => k.key_relationship)
              .filter(Boolean);
            const notes = (notesByW.get(w.id) ?? []).map((n: any) => n.note).filter(Boolean);
            const amountNum = parseFloat(String(w.amount ?? 0)) || 0;

            journalEntries.push({
              id: w.id,
              date: w.withdrawn_at, // <-- withdrawn_at for withdrawals
              description: w.title,
              type: 'withdrawal',
              amount: amountNum,
              balance: 0,
              has_notes: notes.length > 0,
              source_id: w.id,
              source_type: 'withdrawal',
              source_data: { ...w, roles, domains, keyRelationships, notes },
            });
          }
        }

      // ---------------------------------------------------------
      // 3) Reflections (don't affect balance)
      // ---------------------------------------------------------
        let reflectionsQuery = supabase
        .from('0008-ap-reflections')
        .select('id, content, date, created_at, reflection_type, daily_rose, daily_thorn')
        .eq('user_id', user.id)
        .eq('archived', false);

      if (dateFilter) {
        reflectionsQuery = reflectionsQuery.gte('created_at', dateFilter);
      }

      const { data: reflectionsData, error: reflectionsError } = await reflectionsQuery;
      if (reflectionsError) {
        console.error('Reflections query error:', reflectionsError);
        throw reflectionsError;
      }

      if (reflectionsData && reflectionsData.length) {
        const rIds = reflectionsData.map((r: any) => r.id);

        const [rRolesRes, rDomainsRes, rKeyRelsRes, rNotesRes, rAttachmentsMap] = await Promise.all([
          supabase
            .from('0008-ap-universal-roles-join')
            .select('parent_id, role_id, role:0008-ap-roles(id,label)')
            .in('parent_id', rIds)
            .eq('parent_type', 'reflection'),
          supabase
            .from('0008-ap-universal-domains-join')
            .select('parent_id, domain_id, domain:0008-ap-domains(id,name)')
            .in('parent_id', rIds)
            .eq('parent_type', 'reflection'),
          supabase
            .from('0008-ap-universal-key-relationships-join')
            .select('parent_id, key_relationship_id, key_relationship:0008-ap-key-relationships(id,name)')
            .in('parent_id', rIds)
            .eq('parent_type', 'reflection'),
          supabase
            .from('0008-ap-universal-notes-join')
            .select('parent_id, note:0008-ap-notes(id,content,created_at)')
            .in('parent_id', rIds)
            .eq('parent_type', 'reflection'),
          fetchAttachmentsForReflections(rIds),
        ]);

        const rRoles = rRolesRes.data ?? [];
        const rDomains = rDomainsRes.data ?? [];
        const rKeyRels = rKeyRelsRes.data ?? [];
        const rNotes = rNotesRes.data ?? [];

        // scope filter for reflections
        let allowedRids = new Set(rIds);
        if (scope.type !== 'user' && scope.id) {
          if (scope.type === 'role') {
            allowedRids = new Set(
              rRoles
                .filter((r: any) => r.role?.id === scope.id || r.role_id === scope.id)
                .map((r: any) => r.parent_id)
            );
          } else if (scope.type === 'domain') {
            allowedRids = new Set(
              rDomains
                .filter((d: any) => d.domain?.id === scope.id || d.domain_id === scope.id)
                .map((d: any) => d.parent_id)
            );
          } else if (scope.type === 'key_relationship') {
            allowedRids = new Set(
              rKeyRels
                .filter((k: any) => k.key_relationship?.id === scope.id || k.key_relationship_id === scope.id)
                .map((k: any) => k.parent_id)
            );
          }
        }

        const rolesByR = groupByParentId(rRoles);
        const domainsByR = groupByParentId(rDomains);
        const keyRelsByR = groupByParentId(rKeyRels);
        const notesByR = groupByParentId(rNotes);

        for (const r of reflectionsData) {
          if (!allowedRids.has(r.id)) continue;

          const roles = (rolesByR.get(r.id) ?? []).map((rl: any) => rl.role).filter(Boolean);
          const domains = (domainsByR.get(r.id) ?? []).map((d: any) => d.domain).filter(Boolean);
          const keyRelationships = (keyRelsByR.get(r.id) ?? [])
            .map((k: any) => k.key_relationship)
            .filter(Boolean);
          const notes = (notesByR.get(r.id) ?? []).map((n: any) => n.note).filter(Boolean);
          const attachments = rAttachmentsMap.get(r.id) ?? [];

          journalEntries.push({
            id: r.id,
            date: r.created_at,
            description: r.content.substring(0, 100) + (r.content.length > 100 ? '...' : ''),
            type: 'reflection',
            amount: 0, // reflections don't affect balance
            balance: 0,
            has_notes: notes.length > 0,
            source_id: r.id,
            source_type: 'reflection',
            source_data: { ...r, roles, domains, keyRelationships, notes, attachments },
          });
        }
      }

      // ---------------------------------------------------------
      // 4) Deposit Ideas (stored separately, appear as reflections)
      // ---------------------------------------------------------
        let depositIdeasQuery = supabase
        .from('0008-ap-deposit-ideas')
        .select('id, title, created_at, user_id, is_active')
        .eq('user_id', user.id)
        .eq('archived', false)
        .eq('is_active', true);

      if (dateFilter) {
        depositIdeasQuery = depositIdeasQuery.gte('created_at', dateFilter);
      }

      const { data: depositIdeasData, error: depositIdeasError } = await depositIdeasQuery;
      if (depositIdeasError) {
        console.error('Deposit ideas query error:', depositIdeasError);
        throw depositIdeasError;
      }

      if (depositIdeasData && depositIdeasData.length) {
        const dIds = depositIdeasData.map((d: any) => d.id);

        const [dRolesRes, dDomainsRes, dKeyRelsRes, dNotesRes] = await Promise.all([
          supabase
            .from('0008-ap-universal-roles-join')
            .select('parent_id, role_id, role:0008-ap-roles(id,label)')
            .in('parent_id', dIds)
            .eq('parent_type', 'depositIdea'),
          supabase
            .from('0008-ap-universal-domains-join')
            .select('parent_id, domain_id, domain:0008-ap-domains(id,name)')
            .in('parent_id', dIds)
            .eq('parent_type', 'depositIdea'),
          supabase
            .from('0008-ap-universal-key-relationships-join')
            .select('parent_id, key_relationship_id, key_relationship:0008-ap-key-relationships(id,name)')
            .in('parent_id', dIds)
            .eq('parent_type', 'depositIdea'),
          supabase
            .from('0008-ap-universal-notes-join')
            .select('parent_id, note:0008-ap-notes(id,content,created_at)')
            .in('parent_id', dIds)
            .eq('parent_type', 'depositIdea'),
        ]);

        const dRoles = dRolesRes.data ?? [];
        const dDomains = dDomainsRes.data ?? [];
        const dKeyRels = dKeyRelsRes.data ?? [];
        const dNotes = dNotesRes.data ?? [];

        // scope filter for deposit ideas
        let allowedDids = new Set(dIds);
        if (scope.type !== 'user' && scope.id) {
          if (scope.type === 'role') {
            allowedDids = new Set(
              dRoles
                .filter((r: any) => r.role?.id === scope.id || r.role_id === scope.id)
                .map((r: any) => r.parent_id)
            );
          } else if (scope.type === 'domain') {
            allowedDids = new Set(
              dDomains
                .filter((d: any) => d.domain?.id === scope.id || d.domain_id === scope.id)
                .map((d: any) => d.parent_id)
            );
          } else if (scope.type === 'key_relationship') {
            allowedDids = new Set(
              dKeyRels
                .filter((k: any) => k.key_relationship?.id === scope.id || k.key_relationship_id === scope.id)
                .map((k: any) => k.parent_id)
            );
          }
        }

        const rolesByD = groupByParentId(dRoles);
        const domainsByD = groupByParentId(dDomains);
        const keyRelsByD = groupByParentId(dKeyRels);
        const notesByD = groupByParentId(dNotes);

        for (const d of depositIdeasData) {
          if (!allowedDids.has(d.id)) continue;

          const roles = (rolesByD.get(d.id) ?? []).map((rl: any) => rl.role).filter(Boolean);
          const domains = (domainsByD.get(d.id) ?? []).map((dm: any) => dm.domain).filter(Boolean);
          const keyRelationships = (keyRelsByD.get(d.id) ?? [])
            .map((k: any) => k.key_relationship)
            .filter(Boolean);
          const notes = (notesByD.get(d.id) ?? []).map((n: any) => n.note).filter(Boolean);

          journalEntries.push({
            id: d.id,
            date: d.created_at,
            description: d.title,
            type: 'reflection', // Display as reflection type
            amount: 0, // deposit ideas don't affect balance
            balance: 0,
            has_notes: notes.length > 0,
            source_id: d.id,
            source_type: 'depositIdea' as any, // Store actual type for icon display
            source_data: { ...d, roles, domains, keyRelationships, notes, is_deposit_idea: true },
          });
        }
      }

      // ---------------------------------------------------------
      // 5) Sort & compute running balance
      // ---------------------------------------------------------
      journalEntries.sort((a, b) => {
        const ta = new Date(a.date).getTime();
        const tb = new Date(b.date).getTime();
        return tb - ta;
      });

      // compute balance across time (oldest->newest), then assign (newest-first view)
      // NOTE: Reflections and pending tasks don't affect balance
      let runningBalance = 0;
      const chronological = [...journalEntries].reverse();
      chronological.forEach((e) => {
        if (e.type === 'deposit' && e.status !== 'pending') runningBalance += e.amount;
        else if (e.type === 'withdrawal') runningBalance -= e.amount;
        // reflections and pending tasks don't affect balance
      });

      let current = runningBalance;
      journalEntries.forEach((e) => {
        e.balance = current;
        if (e.type === 'deposit' && e.status !== 'pending') current -= e.amount;
        else if (e.type === 'withdrawal') current += e.amount;
        // reflections and pending tasks don't affect balance
      });

      // ---------------------------------------------------------
      // 6) Fetch linked items count for all entries in bulk
      // ---------------------------------------------------------
      const parentEntries = journalEntries
        .filter(entry => entry.source_type !== 'withdrawal')
        .map(entry => ({
          id: entry.source_id,
          type: (entry.source_type === 'task' ? 'task' :
                entry.source_type === 'depositIdea' ? 'depositIdea' : 'reflection') as any
        }));

      const linkedCountsMap = await fetchBulkLinkedItemsCounts(parentEntries, user.id);

      journalEntries.forEach(entry => {
        if (entry.source_type !== 'withdrawal') {
          entry.linked_count = linkedCountsMap.get(entry.source_id) || 0;
        } else {
          entry.linked_count = 0;
        }
      });

      // Final abort check before setting state
      if (controller.signal.aborted) {
        return;
      }

      console.log('[JournalView] Setting', journalEntries.length, 'journal entries, total balance:', runningBalance);

      cacheRef.current = {
        data: journalEntries,
        timestamp: Date.now(),
        scope: scopeKey,
        dateRange,
      };

      setAllEntries(journalEntries);
      setEntries(journalEntries.slice(0, pageSize));
      setDisplayedCount(Math.min(pageSize, journalEntries.length));
      setTotalBalance(runningBalance);
    } catch (err: any) {
      // Don't show errors if request was aborted
      if (controller.signal.aborted) {
        return;
      }
      console.error('Error fetching journal entries:', err);
      Alert.alert('Error loading journal', err?.message ?? String(err));
      setEntries([]);
      setAllEntries([]);
      setDisplayedCount(0);
      setTotalBalance(0);
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  };

  const loadMore = () => {
    if (loadingMore || displayedCount >= allEntries.length) {
      return;
    }

    setLoadingMore(true);

    setTimeout(() => {
      const newCount = Math.min(displayedCount + pageSize, allEntries.length);
      setEntries(allEntries.slice(0, newCount));
      setDisplayedCount(newCount);
      setLoadingMore(false);
    }, 100);
  };

  useEffect(() => {
    if (dateRange) {
      setSelectedPeriod(dateRange);
    }
  }, [dateRange]);

  useEffect(() => {
    setDisplayedCount(pageSize);
    cacheRef.current = null;
  }, [dateRange, pageSize]);

  const handlePeriodChange = (period: 'today' | 'week' | 'month' | 'all') => {
    setSelectedPeriod(period);
    if (onDateRangeChange) {
      onDateRangeChange(period);
    }
  };

  useEffect(() => {
    // Create a stable scope key for comparison
    const scopeKey = JSON.stringify(scope);

    // Only fetch if scope actually changed (unless refreshKey changed which forces refresh)
    if (scopeKey === previousScopeRef.current && !dateRange && refreshKey === undefined) {
      return;
    }

    previousScopeRef.current = scopeKey;

    // Clear any pending fetch timeout
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }

    // Abort any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Debounce the fetch to prevent rapid consecutive calls
    fetchTimeoutRef.current = setTimeout(() => {
      const forceRefresh = refreshKey !== undefined;
      if (forceRefresh) {
        cacheRef.current = null;
      }
      fetchJournalEntries(forceRefresh);
    }, 300);

    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, dateRange, refreshKey]);

  // Real-time subscription for task status changes
  useEffect(() => {
    const supabase = getSupabaseClient();
    let subscription: any = null;

    const setupSubscription = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      subscription = supabase
        .channel('journal-tasks-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: '0008-ap-tasks',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            console.log('[JournalView] Task change detected:', payload);
            cacheRef.current = null;
            fetchJournalEntries(true);
          }
        )
        .subscribe();
    };

    setupSubscription();

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    });
  };

  const formatBalance = (balance: number) => {
    const prefix = balance >= 0 ? '+' : '';
    return `${prefix}${balance.toFixed(1)}`;
  };

  const getBalanceColor = (balance: number) => (balance >= 0 ? '#16a34a' : '#dc2626');

  return (
    <View style={styles.container}>
      {/* Time Period Selector (if enabled) */}
      {showTimePeriodSelector && (
        <View style={styles.timePeriodContainer}>
          <View style={styles.timePeriodSelector}>
            <TouchableOpacity
              style={[
                styles.timePeriodButton,
                selectedPeriod === 'today' && styles.timePeriodButtonActive
              ]}
              onPress={() => handlePeriodChange('today')}
            >
              <Text style={[
                styles.timePeriodButtonText,
                selectedPeriod === 'today' && styles.timePeriodButtonTextActive
              ]}>Today</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.timePeriodButton,
                selectedPeriod === 'week' && styles.timePeriodButtonActive
              ]}
              onPress={() => handlePeriodChange('week')}
            >
              <Text style={[
                styles.timePeriodButtonText,
                selectedPeriod === 'week' && styles.timePeriodButtonTextActive
              ]}>Week</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.timePeriodButton,
                selectedPeriod === 'month' && styles.timePeriodButtonActive
              ]}
              onPress={() => handlePeriodChange('month')}
            >
              <Text style={[
                styles.timePeriodButtonText,
                selectedPeriod === 'month' && styles.timePeriodButtonTextActive
              ]}>Month</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.timePeriodButton,
                selectedPeriod === 'all' && styles.timePeriodButtonActive
              ]}
              onPress={() => handlePeriodChange('all')}
            >
              <Text style={[
                styles.timePeriodButtonText,
                selectedPeriod === 'all' && styles.timePeriodButtonTextActive
              ]}>All</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Journal Header */}
      <View style={styles.journalHeader}>
        <Text style={styles.headerDate}>Date</Text>
        <Text style={styles.headerDescription}>Description</Text>
        <Text style={styles.headerLinked}>Linked</Text>
        <Text style={styles.headerNotes}>Notes</Text>
        <Text style={styles.headerDeposit}>Impact</Text>
        <Text style={styles.headerBalance}>Balance</Text>
      </View>

      {/* Journal Entries */}
      <ScrollView style={styles.journalContent}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading journal...</Text>
          </View>
        ) : entries.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No journal entries found</Text>
          </View>
        ) : (
          entries.map((entry, index) => (
            <TouchableOpacity
              key={`${entry.source_type}-${entry.id}`}
              style={[styles.journalRow, index % 2 === 0 ? styles.evenRow : styles.oddRow]}
              onPress={() => onEntryPress(entry)}
            >
              <Text style={styles.cellDate}>{formatDate(entry.date)}</Text>
              <Text style={styles.cellDescription} numberOfLines={2}>
                {entry.description}
              </Text>
              <Text style={styles.cellLinked}>
                {entry.linked_count !== undefined && entry.linked_count > 0 ? entry.linked_count : '—'}
              </Text>
              <View style={styles.cellNotes}>
                {entry.type === 'reflection' ? (
                  entry.source_type === 'depositIdea' ? (
                    <Lightbulb size={16} color="#f59e0b" />
                  ) : entry.source_data?.daily_rose ? (
                    <Flower2 size={16} color="#ec4899" />
                  ) : entry.source_data?.daily_thorn ? (
                    <AlertTriangle size={16} color="#ef4444" />
                  ) : (
                    <View style={styles.reflectionBadge}>
                      <Text style={styles.reflectionBadgeText}>R</Text>
                    </View>
                  )
                ) : entry.type === 'withdrawal' ? (
                  <AlertTriangle size={16} color="#ef4444" />
                ) : entry.has_notes ? (
                  <FileText size={14} color="#6b7280" />
                ) : null}
              </View>
              <Text style={[styles.cellImpact, entry.type === 'deposit' && entry.status !== 'pending' && { color: '#16a34a' }, entry.type === 'withdrawal' && { color: '#dc2626' }]}>
                {entry.status === 'pending' ? '—' : entry.type === 'deposit' ? `+${entry.amount.toFixed(1)}` : entry.type === 'withdrawal' ? `-${entry.amount.toFixed(1)}` : '—'}
              </Text>
              <Text style={[styles.cellBalance, { color: getBalanceColor(entry.balance) }]}>
                {entry.type === 'reflection' || entry.status === 'pending' ? '—' : formatBalance(entry.balance)}
              </Text>
            </TouchableOpacity>
          ))
        )}

        {!loading && entries.length > 0 && displayedCount < allEntries.length && (
          <View style={styles.loadMoreContainer}>
            <TouchableOpacity
              style={styles.loadMoreButton}
              onPress={loadMore}
              disabled={loadingMore}
            >
              <Text style={styles.loadMoreText}>
                {loadingMore ? 'Loading...' : `Load More (${allEntries.length - displayedCount} remaining)`}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  journalHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#d1d5db',
  },
  headerDate: { width: 70, fontSize: 12, fontWeight: '600', color: '#374151', textAlign: 'center' },
  headerDescription: { flex: 1, fontSize: 12, fontWeight: '600', color: '#374151', paddingHorizontal: 8 },
  headerLinked: { width: 50, fontSize: 12, fontWeight: '600', color: '#374151', textAlign: 'center' },
  headerNotes: { width: 40, fontSize: 12, fontWeight: '600', color: '#374151', textAlign: 'center' },
  headerDeposit: { width: 70, fontSize: 12, fontWeight: '600', color: '#374151', textAlign: 'right' },
  headerBalance: { width: 70, fontSize: 12, fontWeight: '600', color: '#374151', textAlign: 'right' },
  journalContent: { flex: 1 },
  journalRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  evenRow: { backgroundColor: '#ffffff' },
  oddRow: { backgroundColor: '#f1f5f9' },
  cellDate: { width: 70, fontSize: 12, color: '#374151', textAlign: 'center' },
  cellDescription: { flex: 1, fontSize: 14, color: '#1f2937', paddingHorizontal: 8, lineHeight: 18 },
  cellLinked: { width: 50, fontSize: 14, color: '#6b7280', textAlign: 'center', fontWeight: '500' },
  cellNotes: { width: 40, alignItems: 'center', justifyContent: 'center' },
  cellImpact: { width: 70, fontSize: 14, fontWeight: '600', textAlign: 'right' },
  cellBalance: { width: 70, fontSize: 14, fontWeight: '700', textAlign: 'right' },
  loadingContainer: { padding: 40, alignItems: 'center' },
  loadingText: { color: '#6b7280', fontSize: 16 },
  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#6b7280', fontSize: 16, textAlign: 'center' },
  reflectionBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#8b5cf6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#7c3aed',
  },
  reflectionBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  loadMoreContainer: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  loadMoreButton: {
    backgroundColor: '#0078d4',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 200,
    alignItems: 'center',
  },
  loadMoreText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  timePeriodContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'flex-end',
    backgroundColor: '#f8fafc',
  },
  timePeriodSelector: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  timePeriodButton: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 6,
  },
  timePeriodButtonActive: {
    backgroundColor: '#0078d4',
  },
  timePeriodButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  timePeriodButtonTextActive: {
    color: '#ffffff',
  },
});
