import { Alert, Platform } from 'react-native';

/**
 * fireComingSoonAlert — platform-aware "Coming soon" alert util.
 *
 * Extracted from the deleted ZoneNorthStarPlaceholder.tsx (W-0). Used by
 * placeholder tiles that haven't been wired to real content yet —
 * currently the North Star Questions tile in ZoneToolshed Surfaces.
 * Future RoleToolshed (R-4) consumes the same util.
 *
 * Web branch: React Native's Alert.alert() does not render on
 * react-native-web, so the browser's native modal is used instead.
 *
 * @param scopeName  Zone or role name interpolated into the default message
 *                   (e.g. "Physical", "Father").
 * @param customMessage  Optional override for callers that want a different
 *                       message body. When omitted, falls back to a generic
 *                       scope-flavored default.
 */
export function fireComingSoonAlert(
  scopeName: string,
  customMessage?: string,
): void {
  const message =
    customMessage ??
    `This space is coming soon. We're designing the deeper questions experience for ${scopeName}.`;

  if (Platform.OS === 'web') {
    // Alert.alert() does not render on React Native Web; use the browser's native modal.
    window.alert(`Coming soon\n\n${message}`);
  } else {
    Alert.alert('Coming soon', message);
  }
}
