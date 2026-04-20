import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';

import { RoleIcon } from '@/components/icons/RoleIcon';
import {
  getStatusPipColor,
  STATUS_PIP_COLORS,
} from '@/components/common/StatusPip';

/**
 * RoleBankHub — Minimalist Executive design system
 * Roles tab workspace: overview stats, needs-attention alerts,
 * and the primary role tile grid with recency pips.
 */

export interface RoleBankHubRole {
  id: string;
  label: string;
  icon?: string;
  color?: string;
}

export interface RoleBankHubProps {
  roles: RoleBankHubRole[];
  lastActivityMap: Map<string, string | null>;
  onRolePress: (role: RoleBankHubRole) => void;
  onAddRolePress?: () => void;
  accentColor: string;
}

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return null;
  return Math.floor((Date.now() - then.getTime()) / 86_400_000);
}

export function RoleBankHub({
  roles,
  lastActivityMap,
  onRolePress,
  onAddRolePress,
  accentColor,
}: RoleBankHubProps) {
  const { activeCount, overdueRoles } = useMemo(() => {
    let active = 0;
    const overdue: Array<{ role: RoleBankHubRole; days: number }> = [];
    for (const role of roles) {
      const d = daysSince(lastActivityMap.get(role.id));
      if (d !== null && d < 3) active += 1;
      if (d !== null && d > 10) overdue.push({ role, days: d });
    }
    overdue.sort((a, b) => b.days - a.days);
    return { activeCount: active, overdueRoles: overdue };
  }, [roles, lastActivityMap]);

  return (
    <View style={styles.container}>
      <View style={styles.statsRow}>
        <View style={styles.statTile}>
          <Text style={styles.statNumber}>{roles.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statTile}>
          <Text style={[styles.statNumber, { color: STATUS_PIP_COLORS.fresh }]}>
            {activeCount}
          </Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
        <View style={styles.statTile}>
          <Text style={[styles.statNumber, { color: STATUS_PIP_COLORS.cold }]}>
            {overdueRoles.length}
          </Text>
          <Text style={styles.statLabel}>Needs attention</Text>
        </View>
      </View>

      {overdueRoles.length > 0 ? (
        <View style={styles.alertSection}>
          <Text style={styles.alertHeader}>NEEDS ATTENTION</Text>
          <View style={styles.alertList}>
            {overdueRoles.map(({ role, days }) => (
              <Pressable
                key={role.id}
                onPress={() => onRolePress(role)}
                style={styles.alertRow}
              >
                <View
                  style={[
                    styles.alertDot,
                    { backgroundColor: STATUS_PIP_COLORS.cold },
                  ]}
                />
                <Text style={styles.alertName} numberOfLines={1}>
                  {role.label}
                </Text>
                <Text style={styles.alertMeta}>
                  No deposits in {days} days
                </Text>
                <ChevronRight size={16} color={STATUS_PIP_COLORS.cold} />
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.gridSection}>
        <Text style={styles.gridHeader}>ALL ROLES</Text>
        <View style={styles.grid}>
          {roles.map(role => {
            const lastActivity = lastActivityMap.get(role.id) ?? null;
            const pipColor = getStatusPipColor(lastActivity);
            return (
              <Pressable
                key={role.id}
                onPress={() => onRolePress(role)}
                style={({ pressed }) => [
                  styles.tile,
                  pressed && {
                    borderColor: accentColor,
                    borderWidth: 1.5,
                  },
                ]}
              >
                <View style={styles.iconContainer}>
                  <View
                    style={[
                      styles.iconCircle,
                      { backgroundColor: role.color || '#6b7280' },
                    ]}
                  >
                    <RoleIcon
                      name={role.icon || role.label}
                      color="#ffffff"
                      size={22}
                    />
                  </View>
                  <View
                    style={[styles.pipOverlay, { backgroundColor: pipColor }]}
                  />
                </View>
                <Text style={styles.tileLabel} numberOfLines={2}>
                  {role.label}
                </Text>
              </Pressable>
            );
          })}
          <Pressable onPress={onAddRolePress} style={styles.addTile}>
            <Text style={styles.addTileText}>+ Add a role</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statTile: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    alignItems: 'center',
    gap: 2,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  statLabel: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '500',
  },
  alertSection: {
    gap: 8,
  },
  alertHeader: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: STATUS_PIP_COLORS.cold,
  },
  alertList: {
    gap: 6,
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  alertDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  alertName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#7f1d1d',
  },
  alertMeta: {
    fontSize: 12,
    color: '#991b1b',
  },
  gridSection: {
    gap: 10,
  },
  gridHeader: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: '#6b7280',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tile: {
    width: '31.5%',
    height: 110,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    gap: 6,
  },
  iconContainer: {
    position: 'relative',
    width: 44,
    height: 44,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pipOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  tileLabel: {
    fontSize: 11,
    color: '#1f2937',
    textAlign: 'center',
    lineHeight: 14,
    fontWeight: '500',
  },
  addTile: {
    width: '31.5%',
    height: 110,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },
  addTileText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
});
