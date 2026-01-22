# SpindleSilver Component

## Overview
The Silver (Small) Spindle SVG component for precise item selection within a domain. Unlike SpindleGold which snaps to cardinal directions, SpindleSilver can point to any angle from 0-360°.

## File Location
`components/compass/SpindleSilver.tsx`

## Default Orientation
- **South (180°)** - The spindle points downward by default (opposite of SpindleGold)

## Props

### `angle` (required)
- Type: `number`
- Description: The target angle to rotate to. Can be any value from 0-360° (or beyond - will normalize).
- Example: `angle={345}` points to 345° (15° left of north)

### `size` (optional)
- Type: `number`
- Default: `288`
- Description: The size of the spindle in pixels. Component scales proportionally.
- Example: `size={400}` for a larger spindle

### `animated` (optional)
- Type: `boolean`
- Default: `true`
- Description: Whether to animate rotation or jump instantly to the angle.
- Example:
  - `animated={true}` - Smooth 300ms rotation
  - `animated={false}` - Instant position change

### `onAngleChange` (optional)
- Type: `(angle: number) => void`
- Description: Callback fired when the angle changes (after animation if animated, immediately if not)
- Example:
  ```typescript
  onAngleChange={(angle) => {
    console.log('Now pointing to:', angle);
  }}
  ```

## Usage Example

```typescript
import SpindleSilver from '@/components/compass/SpindleSilver';

function MyCompass() {
  const [angle, setAngle] = useState(180);
  const [animated, setAnimated] = useState(true);

  return (
    <SpindleSilver
      angle={angle}
      size={288}
      animated={animated}
      onAngleChange={(newAngle) => {
        console.log('Spindle at:', newAngle);
      }}
    />
  );
}
```

## Features

### 360° Free Rotation
The spindle can point to any angle:
- 0° = North (straight up)
- 90° = East (right)
- 180° = South (straight down - default orientation)
- 270° = West (left)
- Any value in between (e.g., 45°, 127°, 283°)

### Smart Shortest Path
The component always rotates via the shortest path:
- From 350° to 10° → rotates 20° clockwise (not 340° counter-clockwise)
- From 10° to 350° → rotates 20° counter-clockwise (not 340° clockwise)

### Conditional Animation
- `animated={true}`: Smooth 300ms rotation with cubic easing
- `animated={false}`: Instant position update (useful for initialization or rapid updates)

### Angle Normalization
Input angles are automatically normalized:
- 370° → 10°
- -45° → 315°
- 720° → 0°

## Technical Details

### Dependencies
- `react-native-reanimated` v3.x
- `react-native-svg`
- React Native / Expo

### Color
- Metallic Silver: `#A8A9AD`
- Can be enhanced with gradient from `#A8A9AD` to `#C0C0C0` for more metallic appearance

### Rotation Center
- Center point: (144, 144) in the 288×288 viewBox

### SVG ViewBox
- Default: `0 0 288 288`
- Scales proportionally based on `size` prop

### Z-Index / Layering
When using both spindles:
- SpindleSilver should render **above** SpindleGold
- Use `position: 'absolute'` with matching positioning to overlay them

## Animation Behavior

### With `animated={true}`
1. When `angle` prop changes:
   - Calculates shortest rotation path
   - Animates smoothly over 300ms
   - Fires `onAngleChange` callback when complete

### With `animated={false}`
1. When `angle` prop changes:
   - Updates position immediately
   - Fires `onAngleChange` callback immediately
   - No animation overhead

## Comparison with SpindleGold

| Feature | SpindleGold | SpindleSilver |
|---------|-------------|---------------|
| **Purpose** | Domain selection | Item selection within domain |
| **Rotation** | Snaps to cardinals (0°, 90°, 180°, 270°) | Free 360° rotation |
| **Default** | North (0°) | South (180°) |
| **Color** | Gold (#C9A227) | Silver (#A8A9AD) |
| **Animation** | Always animated | Optional via prop |
| **Callback** | `onSnapComplete` | `onAngleChange` |
| **Precision** | 4 positions | 360 positions |
| **Visual Size** | Larger | Smaller |
| **Z-Index** | Below | Above |

## Integration with LifeCompass

```typescript
import SpindleGold from './SpindleGold';
import SpindleSilver from './SpindleSilver';

function LifeCompass() {
  const [goldAngle, setGoldAngle] = useState(0);
  const [silverAngle, setSilverAngle] = useState(180);

  return (
    <View style={styles.compassContainer}>
      {/* Gold spindle (domain selector) */}
      <View style={styles.spindleLayer}>
        <SpindleGold
          angle={goldAngle}
          size={288}
          onSnapComplete={(direction) => {
            console.log('Selected domain:', direction);
          }}
        />
      </View>

      {/* Silver spindle (item selector) - overlaid on top */}
      <View style={[styles.spindleLayer, StyleSheet.absoluteFill]}>
        <SpindleSilver
          angle={silverAngle}
          size={288}
          animated={true}
          onAngleChange={(angle) => {
            console.log('Selected item at angle:', angle);
          }}
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
});
```

## Slot Code Mapping

The angle can map to slot codes from the `0008-ap-compass-coordinates` table:

```typescript
// Example: Roles domain has 8 slots at 45° intervals
const rolesSlotAngles = {
  'R1': 0,     // North
  'R2': 45,    // NE
  'R3': 90,    // East
  'R4': 135,   // SE
  'R5': 180,   // South
  'R6': 225,   // SW
  'R7': 270,   // West
  'R8': 315,   // NW
};

// Point to specific role
<SpindleSilver angle={rolesSlotAngles['R3']} />
```

## Demo Component

See `SpindleSilverExample.tsx` for a comprehensive interactive demo featuring:
- Preset angle buttons
- Custom angle input
- Animation toggle
- Automated test sequences
- Real-time angle display

## Use Cases

### 1. Role Selection
```typescript
// Select "Father" role at slot R1
<SpindleSilver angle={0} animated={true} />
```

### 2. Wellness Zone Selection
```typescript
// Select "Physical" wellness at slot W4
<SpindleSilver angle={135} animated={true} />
```

### 3. Goal Activation
```typescript
// Point to specific goal position
<SpindleSilver angle={goalAngle} animated={true} />
```

### 4. Rapid Updates (No Animation)
```typescript
// Update position without animation for initialization
<SpindleSilver angle={initialAngle} animated={false} />
```

## Performance Notes

- Uses React Native Reanimated for native-thread animations
- Very efficient for rapid angle changes
- Set `animated={false}` for batch updates to avoid animation overhead
- Angle calculations happen on JS thread, rotation on UI thread

## Verification Checklist

✓ Component renders without errors
✓ Spindle can point to any angle (0°, 45°, 90°, 135°, 180°, 225°, 270°, 315°)
✓ `animated={true}` causes smooth rotation
✓ `animated={false}` causes instant position change
✓ Silver appearance distinct from gold spindle
✓ `onAngleChange` callback fires correctly
✓ Shortest path rotation works (350° to 10° goes clockwise)
✓ Angle normalization works (400° → 40°)
✓ Responsive sizing works correctly
✓ Default orientation is 180° (South)

## Future Enhancements

Potential improvements for future phases:
- Metallic gradient shader for more realistic silver appearance
- Touch/drag gesture controls for manual rotation
- Haptic feedback at specific angles (e.g., every 45°)
- Snap-to-slot mode with tolerance zones
- Angular velocity control for different animation speeds
- Multiple silver spindles for multi-selection scenarios
