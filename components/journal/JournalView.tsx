import React, { useEffect, useState } from 'react';
import { Alert, SectionList, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator, Image } from 'react-native';
import { SquareCheck, BookOpen, Calendar } from 'lucide-react-native';
import { getSupabaseClient } from '@/lib/supabase';
import { calculateTaskPoints } from '@/lib/taskUtils';
import { fetchBulkLinkedItemsCountsDetailed, LinkedItemCounts } from '@/lib/followThroughUtils';
import { fetchAttachmentsForReflections } from '@/lib/reflectionUtils';
import { formatLocalDate } from '@/lib/dateUtils';

const roseImage = require('@/assets/images/rose-81.png');
const thornImage = require('@/assets/images/thorn-81.png');
const reflectionImage = require('@/assets/images/reflections-72.png');
const depositIdeaImage = require('@/assets/images/deposit-idea.png');

interface JournalEntry {
  id: string;
  date: string;
  description: string;
  type: 'deposit' | 'withdrawal' | 'reflection';
  amount: number;
  balance: number;
  has_notes: boolean;
  source_id: string;
  source_type: 'task' | 'withdrawal' | 'reflection' | 'depositIdea';
  source_data?: any;
  linked_count?: number;
  linkedCounts?: LinkedItemCounts;
  status?: 'completed';
}

interface DateSection {
  title: string;
  data: JournalEntry[];
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
  const [sections, setSections] = useState<DateSection[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month' | 'all'>(dateRange || 'week');
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalImpact, setTotalImpact] = useState(0);
  const [allEntries, setAllEntries] = useState<JournalEntry[]>([]);
  const [hasMore, setHasMore] = useState(false);
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
  const INITIAL_LOAD = 20;

  // Helper to group records by parent_id for fast lookup
  const groupByParentId = <T extends { parent_id: string }>(rows: T[] | null | undefined) => {
    const map = new Map<string, T[]>();
    (rows ?? []).forEach((r) => {
      const arr = map.get(r.parent_id) ?? [];
      arr.push(r);
      map.set(r.parent_id, arr);
    });
    return map;
  };

  // Calculate start date for the range filter (YYYY-MM-DD)
  const getDateFilter = (): string | '' => {
    if (dateRange === 'all') return '';
    const now = new Date();
    let days = 30;
    if (dateRange === 'today') {
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      return formatLocalDate(todayStart);
    } else if (dateRange === 'week') {
      days = 7;
    }
    const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    return formatLocalDate(since);
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

        const sectionsData = groupEntriesByDate(cacheRef.current.data, selectedPeriod === 'all' ? INITIAL_LOAD : cacheRef.current.data.length);
        setSections(sectionsData);
        setHasMore(selectedPeriod === 'all' && cacheRef.current.data.length > INITIAL_LOAD);

        const impact = cacheRef.current.data.reduce((sum, e) => {
          if (e.type === 'deposit') return sum + e.amount;
          if (e.type === 'withdrawal') return sum - e.amount;
          return sum;
        }, 0);
        setTotalImpact(impact);
        return;
      }
    }

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
        setSections([]);
        setAllEntries([]);
        setTotalImpact(0);
        setLoading(false);
        cacheRef.current = null;
        return;
      }

      if (controller.signal.aborted) {
        return;
      }

      const dateFilter = getDateFilter();
      const journalEntries: JournalEntry[] = [];

      // 1a) Completed TASKS
      let completedTasksQuery = supabase
        .from('0008-ap-tasks')
        .select('id, title, type, status, completed_at, due_date, start_date, end_date, start_time, end_time, is_all_day, is_urgent, is_important, is_twelve_week_goal, recurrence_rule, user_global_timeline_id, custom_timeline_id, parent_task_id')
        .eq('user_id', user.id)
        .eq('type', 'task')
        .eq('status', 'completed')
        .is('deleted_at', null)
        .is('parent_task_id', null)
        .not('completed_at', 'is', null);

      if (dateFilter) {
        completedTasksQuery = completedTasksQuery.gte('completed_at', dateFilter);
      }

      const { data: completedTasksData, error: completedTasksError } = await completedTasksQuery;
      console.log('[JournalView] Completed TASKS query result:', completedTasksData?.length || 0, 'tasks found');
      if (completedTasksError) {
        console.error('[JournalView] Completed tasks query error:', completedTasksError);
        throw completedTasksError;
      }

      // 1b) Completed EVENTS
      let completedEventsQuery = supabase
        .from('0008-ap-tasks')
        .select('id, title, type, status, completed_at, due_date, start_date, end_date, start_time, end_time, is_all_day, is_urgent, is_important, is_twelve_week_goal, recurrence_rule, user_global_timeline_id, custom_timeline_id, parent_task_id')
        .eq('user_id', user.id)
        .eq('type', 'event')
        .eq('status', 'completed')
        .is('deleted_at', null)
        .is('parent_task_id', null)
        .not('completed_at', 'is', null);

      if (dateFilter) {
        // For events, filter by end_date (or start_date if no end_date)
        completedEventsQuery = completedEventsQuery.or(`end_date.gte.${dateFilter},and(end_date.is.null,start_date.gte.${dateFilter})`);
      }

      const { data: completedEventsData, error: completedEventsError } = await completedEventsQuery;
      console.log('[JournalView] Completed EVENTS query result:', completedEventsData?.length || 0, 'events found');
      if (completedEventsError) {
        console.error('[JournalView] Completed events query error:', completedEventsError);
        throw completedEventsError;
      }

      const tasksData = [...(completedTasksData || []), ...(completedEventsData || [])];

      if (tasksData && tasksData.length) {
        const taskIds = tasksData.map((t: any) => t.id);

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

          // For events, use end_date (when event ended) or start_date, for tasks use completed_at
          let displayDate: string;
          if (t.type === 'event') {
            displayDate = t.end_date || t.start_date || t.completed_at;
          } else {
            displayDate = t.completed_at;
          }

          journalEntries.push({
            id: t.id,
            date: displayDate,
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

      // 2) Withdrawals
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
            date: w.withdrawn_at,
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

      // 3) Reflections
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
            amount: 0,
            balance: 0,
            has_notes: notes.length > 0,
            source_id: r.id,
            source_type: 'reflection',
            source_data: { ...r, roles, domains, keyRelationships, notes, attachments },
          });
        }
      }

      // 4) Deposit Ideas
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
            type: 'reflection',
            amount: 0,
            balance: 0,
            has_notes: notes.length > 0,
            source_id: d.id,
            source_type: 'depositIdea',
            source_data: { ...d, roles, domains, keyRelationships, notes, is_deposit_idea: true },
          });
        }
      }

      // Sort entries by date (newest first)
      journalEntries.sort((a, b) => {
        const ta = new Date(a.date).getTime();
        const tb = new Date(b.date).getTime();
        return tb - ta;
      });

      // Fetch linked items count
      const parentEntries = journalEntries
        .filter(entry => entry.source_type !== 'withdrawal')
        .map(entry => ({
          id: entry.source_id,
          type: (entry.source_type === 'task' ? 'task' :
                entry.source_type === 'depositIdea' ? 'depositIdea' : 'reflection') as any
        }));

      const linkedCountsMap = await fetchBulkLinkedItemsCountsDetailed(parentEntries, user.id);

      journalEntries.forEach(entry => {
        if (entry.source_type !== 'withdrawal') {
          const counts = linkedCountsMap.get(entry.source_id);
          if (counts) {
            entry.linkedCounts = counts;
            entry.linked_count = counts.total;
          } else {
            entry.linkedCounts = { tasks: 0, reflections: 0, depositIdeas: 0, total: 0 };
            entry.linked_count = 0;
          }
        } else {
          entry.linkedCounts = { tasks: 0, reflections: 0, depositIdeas: 0, total: 0 };
          entry.linked_count = 0;
        }
      });

      if (controller.signal.aborted) {
        return;
      }

      // Calculate total impact
      const impact = journalEntries.reduce((sum, e) => {
        if (e.type === 'deposit') return sum + e.amount;
        if (e.type === 'withdrawal') return sum - e.amount;
        return sum;
      }, 0);

      console.log('[JournalView] Setting', journalEntries.length, 'journal entries, total impact:', impact);

      cacheRef.current = {
        data: journalEntries,
        timestamp: Date.now(),
        scope: scopeKey,
        dateRange,
      };

      setAllEntries(journalEntries);

      // For "All" tab, initially load only first 20 items
      const initialCount = selectedPeriod === 'all' ? INITIAL_LOAD : journalEntries.length;
      const sectionsData = groupEntriesByDate(journalEntries, initialCount);
      setSections(sectionsData);
      setHasMore(selectedPeriod === 'all' && journalEntries.length > INITIAL_LOAD);
      setTotalImpact(impact);
    } catch (err: any) {
      if (controller.signal.aborted) {
        return;
      }
      console.error('Error fetching journal entries:', err);
      Alert.alert('Error loading journal', err?.message ?? String(err));
      setSections([]);
      setAllEntries([]);
      setTotalImpact(0);
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  };

  const groupEntriesByDate = (entries: JournalEntry[], count: number): DateSection[] => {
    const limitedEntries = entries.slice(0, count);
    const grouped = new Map<string, JournalEntry[]>();

    limitedEntries.forEach(entry => {
      const dateKey = formatDate(entry.date);
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      grouped.get(dateKey)!.push(entry);
    });

    return Array.from(grouped.entries()).map(([title, data]) => ({ title, data }));
  };

  const loadMore = () => {
    if (loadingMore || !hasMore || selectedPeriod !== 'all') {
      return;
    }

    setLoadingMore(true);

    setTimeout(() => {
      const currentCount = sections.reduce((sum, section) => sum + section.data.length, 0);
      const newCount = Math.min(currentCount + INITIAL_LOAD, allEntries.length);
      const newSections = groupEntriesByDate(allEntries, newCount);
      setSections(newSections);
      setHasMore(newCount < allEntries.length);
      setLoadingMore(false);
    }, 300);
  };

  useEffect(() => {
    if (dateRange) {
      setSelectedPeriod(dateRange);
    }
  }, [dateRange]);

  useEffect(() => {
    cacheRef.current = null;
  }, [dateRange]);

  const handlePeriodChange = (period: 'today' | 'week' | 'month' | 'all') => {
    setSelectedPeriod(period);
    if (onDateRangeChange) {
      onDateRangeChange(period);
    }
  };

  useEffect(() => {
    const scopeKey = JSON.stringify(scope);

    if (scopeKey === previousScopeRef.current && !dateRange && refreshKey === undefined) {
      return;
    }

    previousScopeRef.current = scopeKey;

    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

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
  }, [scope, dateRange, refreshKey]);

  // Real-time subscription
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
  }, []);

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '—';

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const entryDate = new Date(d);
    entryDate.setHours(0, 0, 0, 0);

    const formattedDate = d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    if (entryDate.getTime() === today.getTime()) {
      return `Today - ${formattedDate}`;
    }

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (entryDate.getTime() === yesterday.getTime()) {
      return `Yesterday - ${formattedDate}`;
    }

    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const getEntryIcon = (entry: JournalEntry) => {
    // Rose (Beauty)
    if (entry.source_data?.daily_rose) {
      return {
        image: roseImage,
        bgColor: '#ffe4e6',
      };
    }

    // Thorn (Challenge)
    if (entry.source_data?.daily_thorn) {
      return {
        image: thornImage,
        bgColor: '#f1f5f9',
      };
    }

    // Deposit Idea (Future)
    if (entry.source_type === 'depositIdea') {
      return {
        image: depositIdeaImage,
        bgColor: '#fef3c7',
      };
    }

    // Event (Calendar icon)
    if (entry.type === 'deposit' && entry.source_data?.type === 'event') {
      return {
        icon: Calendar,
        bgColor: '#dbeafe',
        iconColor: '#2563eb',
      };
    }

    // Task (Checkmark icon)
    if (entry.type === 'deposit') {
      return {
        icon: SquareCheck,
        bgColor: '#dbeafe',
        iconColor: '#2563eb',
      };
    }

    // Reflection (Thought) - default
    return {
      image: reflectionImage,
      bgColor: '#f3e8ff',
    };
  };

  const getPreviewText = (entry: JournalEntry): string => {
    if (entry.source_data?.roles?.length > 0) {
      const roleNames = entry.source_data.roles.map((r: any) => r.label).join(', ');
      return roleNames;
    }

    if (entry.source_data?.keyRelationships?.length > 0) {
      const krName = entry.source_data.keyRelationships[0].name;
      return krName;
    }

    // Show content preview for reflections
    if (entry.source_data?.content) {
      return entry.source_data.content.substring(0, 60) + (entry.source_data.content.length > 60 ? '...' : '');
    }

    return '';
  };

  const renderLinkedBadges = (linkedCounts?: LinkedItemCounts) => {
    if (!linkedCounts || linkedCounts.total === 0) {
      return null;
    }

    const badges = [];

    if (linkedCounts.tasks > 0) {
      badges.push(
        <View key="tasks" style={styles.linkedBadge}>
          <SquareCheck size={12} color="#6b7280" strokeWidth={2} />
          <Text style={styles.linkedBadgeText}>{linkedCounts.tasks}</Text>
        </View>
      );
    }

    if (linkedCounts.reflections > 0) {
      badges.push(
        <View key="reflections" style={styles.linkedBadge}>
          <BookOpen size={12} color="#6b7280" strokeWidth={2} />
          <Text style={styles.linkedBadgeText}>{linkedCounts.reflections}</Text>
        </View>
      );
    }

    if (linkedCounts.depositIdeas > 0) {
      badges.push(
        <View key="ideas" style={styles.linkedBadge}>
          <Image source={depositIdeaImage} style={styles.linkedBadgeImage} resizeMode="contain" />
          <Text style={styles.linkedBadgeText}>{linkedCounts.depositIdeas}</Text>
        </View>
      );
    }

    return (
      <View style={styles.linkedBadgesContainer}>
        {badges}
      </View>
    );
  };

  const renderSectionHeader = ({ section }: { section: DateSection }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{section.title}</Text>
    </View>
  );

  const renderItem = ({ item }: { item: JournalEntry }) => {
    const iconData = getEntryIcon(item);
    const previewText = getPreviewText(item);
    const impactText = item.type === 'deposit'
      ? `+${item.amount.toFixed(1)}`
      : item.type === 'withdrawal'
      ? `-${item.amount.toFixed(1)}`
      : '';
    const impactColor = item.type === 'deposit' ? '#16a34a' : '#dc2626';

    return (
      <TouchableOpacity
        style={styles.entryRow}
        onPress={() => onEntryPress(item)}
      >
        <View style={[styles.avatar, { backgroundColor: iconData.bgColor }]}>
          {iconData.image ? (
            <Image source={iconData.image} style={styles.avatarImage} resizeMode="contain" />
          ) : iconData.icon ? (
            React.createElement(iconData.icon, { size: 20, color: iconData.iconColor, strokeWidth: 2 })
          ) : null}
        </View>

        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={1}>
            {item.description}
          </Text>
          {(previewText || item.linkedCounts) ? (
            <View style={styles.previewRow}>
              {previewText ? (
                <Text style={styles.preview} numberOfLines={1}>
                  {previewText}
                </Text>
              ) : null}
              {previewText && item.linkedCounts && item.linkedCounts.total > 0 ? (
                <Text style={styles.previewSeparator}>•</Text>
              ) : null}
              {renderLinkedBadges(item.linkedCounts)}
            </View>
          ) : null}
        </View>

        {impactText ? (
          <Text style={[styles.impact, { color: impactColor }]}>
            {impactText}
          </Text>
        ) : null}
      </TouchableOpacity>
    );
  };

  const renderFooter = () => {
    if (!hasMore || selectedPeriod !== 'all') return null;

    if (loadingMore) {
      return (
        <View style={styles.footerLoader}>
          <ActivityIndicator size="small" color="#3b82f6" />
        </View>
      );
    }

    return null;
  };

  return (
    <View style={styles.container}>
      {/* Time Period Selector with Total Impact */}
      {showTimePeriodSelector && (
        <View style={styles.timePeriodContainer}>
          <View style={styles.impactSection}>
            <Text style={styles.impactLabel}>Total Impact:</Text>
            <Text style={[styles.impactValue, { color: totalImpact >= 0 ? '#16a34a' : '#dc2626' }]}>
              {totalImpact >= 0 ? '+' : ''}{totalImpact.toFixed(1)}
            </Text>
          </View>
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

      {/* Feed */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading journal...</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => `${item.source_type}-${item.id}`}
          renderSectionHeader={renderSectionHeader}
          renderItem={renderItem}
          stickySectionHeadersEnabled={true}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No journal entries found</Text>
            </View>
          }
          contentContainerStyle={sections.length === 0 ? styles.emptyList : undefined}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff'
  },
  timePeriodContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  impactSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  impactLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  impactValue: {
    fontSize: 20,
    fontWeight: '700',
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
    backgroundColor: '#3b82f6',
  },
  timePeriodButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  timePeriodButtonTextActive: {
    color: '#ffffff',
  },
  sectionHeader: {
    backgroundColor: '#f8fafc',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  sectionHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarImage: {
    width: 24,
    height: 24,
  },
  content: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
    lineHeight: 20,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  preview: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
    flexShrink: 1,
  },
  previewSeparator: {
    fontSize: 13,
    color: '#d1d5db',
    marginHorizontal: 4,
  },
  linkedBadgesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  linkedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  linkedBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6b7280',
  },
  linkedBadgeImage: {
    width: 12,
    height: 12,
  },
  impact: {
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    color: '#6b7280',
    fontSize: 16,
    marginTop: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    color: '#6b7280',
    fontSize: 16,
    textAlign: 'center'
  },
  emptyList: {
    flexGrow: 1,
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});
