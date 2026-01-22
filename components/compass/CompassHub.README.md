# CompassHub Component

## Overview
The CompassHub is the interactive center element of the compass. It serves as the primary tap target for initiating the "spin" action and provides visual feedback about the current focus state.

## File Location
`components/compass/CompassHub.tsx`

## Visual Design
- **Gray outer ring** (#808285) - Rotates when spinning
- **White inner fill** (#fff) - Provides contrast
- **Red center point** (#ed1c24) - Changes color based on active zone
- **Diameter**: ~28px in 288px viewBox
- **Touch target**: Minimum 44px for accessibility

## Props

### `size` (optional)
- Type: `number`
- Default: `288`
- Description: The size of the compass in pixels. Hub scales proportionally.
- Example: `size={400}` for larger compass

### `isSpinning` (optional)
- Type: `boolean`
- Default: `false`
- Description: Controls the hub's visual state
  - `false`: Shows gentle pulse animation (ready state)
  - `true`: Shows rotating ring indicator (active state)
- Example: `isSpinning={true}` during guided sequence

### `onTap` (optional)
- Type: `() => void`
- Description: Callback fired when hub is tapped
- Example:
  ```typescript
  onTap={() => {
    console.log('Starting spin sequence');
    triggerSpinSequence();
  }}
  ```

### `activeZone` (optional)
- Type: `'mission' | 'wellness' | 'goals' | 'roles' | null`
- Default: `null`
- Description: Changes the center point color to match the active zone
  - `'mission'`: Red (#ed1c24)
  - `'wellness'`: Green (#39b54a)
  - `'goals'`: Blue (#00abc5)
  - `'roles'`: Yellow (#ffd400)
  - `null`: Default red (#ed1c24)
- Example: `activeZone="wellness"`

## Usage Example

### Basic Usage
```typescript
import CompassHub from '@/components/compass/CompassHub';

function MyCompass() {
  const [isSpinning, setIsSpinning] = useState(false);

  return (
    <CompassHub
      size={288}
      isSpinning={isSpinning}
      onTap={() => {
        console.log('Hub tapped!');
      }}
    />
  );
}
```

### With Active Zone
```typescript
<CompassHub
  size={288}
  isSpinning={false}
  onTap={() => startSpinSequence()}
  activeZone="wellness"
/>
```

### Complete Integration
```typescript
function LifeCompass() {
  const [isSpinning, setIsSpinning] = useState(false);
  const [currentZone, setCurrentZone] = useState<Zone>(null);

  const startSpinSequence = () => {
    setIsSpinning(true);
    const zones: Zone[] = ['mission', 'wellness', 'goals', 'roles'];

    zones.forEach((zone, index) => {
      setTimeout(() => {
        setCurrentZone(zone);
        if (index === zones.length - 1) {
          setTimeout(() => setIsSpinning(false), 1000);
        }
      }, index * 1000);
    });
  };

  return (
    <View style={styles.compass}>
      <CompassHub
        size={288}
        isSpinning={isSpinning}
        onTap={startSpinSequence}
        activeZone={currentZone}
      />
    </View>
  );
}
```

## Features

### Pulse Animation (Ready State)
When `isSpinning={false}`:
- Gentle scale animation (1.0 → 1.15 → 1.0)
- 2-second cycle (1s expand, 1s contract)
- Continuous loop
- Indicates "tap me" affordance

### Spinning Indicator (Active State)
When `isSpinning={true}`:
- Gray ring rotates continuously
- 2-second per rotation
- Linear easing for smooth motion
- Indicates active processing

### Touch Feedback
- Visual opacity change on press (100% → 70%)
- Immediate response for tactile feedback
- Respects platform conventions

### Accessibility
- Minimum 44x44px touch target (iOS Human Interface Guidelines)
- `accessibilityRole="button"`
- Descriptive labels based on state:
  - Ready: "Tap to spin compass"
  - Spinning: "Compass spinning"
- `accessibilityHint` provides context

### Zone Color Indication
Center point changes color to reflect active zone:
```typescript
const ZONE_COLORS = {
  mission: '#ed1c24',   // Red
  wellness: '#39b54a',  // Green
  goals: '#00abc5',     // Blue
  roles: '#ffd400',     // Yellow
};
```

## Technical Details

### Dependencies
- `react-native-reanimated` v3.x
- `react-native-svg`
- React Native / Expo

### Animation System
- Uses Reanimated's `withRepeat` for continuous animations
- Proper cleanup with `cancelAnimation` on unmount
- Separate animation values for pulse and spin
- Smooth transitions between states (300ms)

### SVG Structure
```
<G> (container)
  └─ Animated pulse wrapper
      ├─ Outer gray ring (animated rotation when spinning)
      ├─ White inner fill paths
      └─ Center red/colored circle
```

### Performance
- Animations run on UI thread via Reanimated
- No JS thread blocking
- Efficient SVG rendering
- Smooth at 60fps

### Platform Support
- iOS: Full support with haptic feedback potential
- Android: Full support
- Web: Full support with cursor pointer

## States & Behaviors

### State Matrix

| isSpinning | activeZone | Visual Result |
|------------|------------|---------------|
| `false` | `null` | Pulsing hub, red center |
| `false` | `'mission'` | Pulsing hub, red center |
| `false` | `'wellness'` | Pulsing hub, green center |
| `false` | `'goals'` | Pulsing hub, blue center |
| `false` | `'roles'` | Pulsing hub, yellow center |
| `true` | any | Rotating ring, colored center |

### Animation Lifecycle
1. Mount: Initialize animation values
2. State change: Cancel old animations, start new
3. Unmount: Clean up all animations

## Integration with Full Compass

```typescript
function FullCompass() {
  const [goldAngle, setGoldAngle] = useState(0);
  const [silverAngle, setSilverAngle] = useState(180);
  const [isSpinning, setIsSpinning] = useState(false);
  const [activeZone, setActiveZone] = useState<Zone>(null);

  return (
    <View style={styles.compassContainer}>
      {/* Background compass ring */}
      <CompassRing size={288} />

      {/* Gold spindle (domain) */}
      <View style={styles.spindleLayer}>
        <SpindleGold
          angle={goldAngle}
          size={288}
          onSnapComplete={(direction) => {
            const zoneMap = {
              0: 'mission',
              90: 'wellness',
              180: 'goals',
              270: 'roles',
            };
            setActiveZone(zoneMap[direction]);
          }}
        />
      </View>

      {/* Silver spindle (item) */}
      <View style={[styles.spindleLayer, StyleSheet.absoluteFill]}>
        <SpindleSilver
          angle={silverAngle}
          size={288}
          animated={true}
        />
      </View>

      {/* Hub (center) */}
      <View style={[styles.hubLayer, StyleSheet.absoluteFill]}>
        <CompassHub
          size={288}
          isSpinning={isSpinning}
          onTap={() => startSpinSequence()}
          activeZone={activeZone}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  compassContainer: {
    width: 288,
    height: 288,
    position: 'relative',
  },
  spindleLayer: {
    width: 288,
    height: 288,
  },
  hubLayer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
```

## Demo Component

See `CompassHubExample.tsx` for a comprehensive interactive demo featuring:
- Spin sequence demonstration
- Manual state toggles
- Active zone selection
- Tap counter
- State visualization
- Reset controls

## Use Cases

### 1. Spin Sequence Trigger
```typescript
<CompassHub
  size={288}
  isSpinning={isSpinning}
  onTap={() => startGuidedSequence()}
/>
```

### 2. State Indicator
```typescript
// Show which domain is currently active
<CompassHub
  size={288}
  isSpinning={false}
  activeZone={selectedDomain}
/>
```

### 3. Loading State
```typescript
// Show processing/loading with spinning indicator
<CompassHub
  size={288}
  isSpinning={isLoading}
/>
```

### 4. Navigation Feedback
```typescript
// Provide visual feedback during navigation
<CompassHub
  size={288}
  isSpinning={isNavigating}
  activeZone={currentRoute}
/>
```

## Accessibility Best Practices

### Touch Target Size
The component automatically ensures minimum 44px touch target:
```typescript
const touchAreaSize = Math.max(MIN_TOUCH_TARGET, HUB_DIAMETER * scale);
```

### Screen Reader Support
- Clear role: `accessibilityRole="button"`
- Descriptive label changes with state
- Hint provides action context

### Visual Feedback
- Color changes for state indication
- Motion provides additional feedback
- Press state shows immediate response

## Customization Options

### Future Enhancements
While not currently implemented, these could be added:

```typescript
interface CompassHubPropsExtended {
  // Current props...

  // Potential additions:
  pulseSpeed?: number;           // Control pulse animation speed
  spinSpeed?: number;            // Control rotation speed
  centerSize?: number;           // Customize center dot size
  ringColor?: string;            // Custom ring color
  hapticFeedback?: boolean;      // Enable haptic on tap
  onLongPress?: () => void;      // Add long press handler
  disabled?: boolean;            // Disable interaction
}
```

## Troubleshooting

### Hub not visible
- Ensure parent has sufficient size
- Check z-index/layering if overlaying components
- Verify size prop matches compass size

### Tap not working
- Confirm onTap prop is provided
- Check if component is disabled
- Verify touch target isn't blocked by overlay

### Animation not smooth
- Ensure Reanimated is properly configured
- Check for JS thread blocking
- Verify no conflicting animations

### Color not changing
- Confirm activeZone prop is set correctly
- Verify zone name matches type union
- Check if color constants are defined

## Verification Checklist

✓ Component renders matching source SVG appearance
✓ Tapping fires onTap callback
✓ Pulse animation visible when isSpinning={false}
✓ Spinning indicator visible when isSpinning={true}
✓ Touch feedback feels responsive (press state)
✓ Meets 44px minimum touch target requirement
✓ Center color changes with activeZone prop
✓ Animations are smooth and performant
✓ Accessibility labels are descriptive
✓ Works across iOS, Android, and Web

## Performance Notes

- Animations run on UI thread (no JS blocking)
- Efficient SVG rendering (static paths)
- Cleanup prevents memory leaks
- Scales well across device sizes
- Minimal re-render overhead
