# SpindleGold Component

## Overview
The Gold (Big) Spindle SVG component that locks to 4 cardinal directions representing the four banks/domains of the Compass coaching instrument.

## File Location
`components/compass/SpindleGold.tsx`

## Cardinal Direction Mapping
- **North (0°)** → Mission
- **East (90°)** → Wellness
- **South (180°)** → Goals
- **West (270°)** → Roles

## Props

### `angle` (required)
- Type: `number`
- Description: The target angle to rotate to. The spindle will automatically snap to the nearest cardinal direction (0°, 90°, 180°, or 270°).
- Example: `angle={45}` will snap to `0°` (North/Mission)

### `size` (optional)
- Type: `number`
- Default: `288`
- Description: The size of the spindle in pixels. Component scales proportionally.
- Example: `size={400}` for a larger spindle

### `onSnapComplete` (optional)
- Type: `(direction: 0 | 90 | 180 | 270) => void`
- Description: Callback fired when the snap animation completes
- Example:
  ```typescript
  onSnapComplete={(direction) => {
    console.log('Snapped to:', direction);
  }}
  ```

## Usage Example

```typescript
import SpindleGold from '@/components/compass/SpindleGold';

function MyCompass() {
  const [angle, setAngle] = useState(0);

  return (
    <SpindleGold
      angle={angle}
      size={288}
      onSnapComplete={(direction) => {
        console.log('Now pointing to:', direction);
      }}
    />
  );
}
```

## Features

### Automatic Cardinal Snapping
The spindle automatically snaps to the nearest cardinal direction:
- Input angles 0°-44° snap to 0° (North)
- Input angles 45°-134° snap to 90° (East)
- Input angles 135°-224° snap to 180° (South)
- Input angles 225°-314° snap to 270° (West)
- Input angles 315°-359° snap to 0° (North)

### Smooth Animation
- Duration: 300ms
- Easing: Cubic out (smooth deceleration)
- Handles shortest rotation path (won't spin 270° when 90° is shorter)

### Smart Rotation
The component calculates the shortest path to the target cardinal direction, so it never rotates more than 180°.

## Technical Details

### Dependencies
- `react-native-reanimated` v3.x
- `react-native-svg`
- React Native / Expo

### Color
- Gold/Brass: `#C9A227`

### Rotation Center
- Center point: (144, 144) in the 288×288 viewBox

### SVG ViewBox
- Default: `0 0 288 288`
- Scales proportionally based on `size` prop

## Animation Behavior

1. When `angle` prop changes, the component:
   - Calculates the nearest cardinal direction
   - Determines the shortest rotation path
   - Animates smoothly over 300ms
   - Fires `onSnapComplete` callback when done

2. Multiple rapid angle changes:
   - Each new angle interrupts the previous animation
   - Starts fresh animation to new target
   - Only the final animation fires the callback

## Demo Component

See `SpindleGoldExample.tsx` for a working demo with interactive buttons to test all cardinal directions.

## Integration with LifeCompass

```typescript
// In LifeCompass.tsx
import SpindleGold from './SpindleGold';

function LifeCompass() {
  const [selectedBank, setSelectedBank] = useState<'mission' | 'wellness' | 'goals' | 'roles'>('mission');

  const bankToAngle = {
    mission: 0,
    wellness: 90,
    goals: 180,
    roles: 270,
  };

  return (
    <SpindleGold
      angle={bankToAngle[selectedBank]}
      size={288}
      onSnapComplete={(direction) => {
        // Update app state based on direction
        const angleToBank = {
          0: 'mission',
          90: 'wellness',
          180: 'goals',
          270: 'roles',
        };
        console.log('Selected bank:', angleToBank[direction]);
      }}
    />
  );
}
```

## Verification Checklist

✓ Component renders without errors
✓ Setting `angle={0}` points spindle to top (North/Mission)
✓ Setting `angle={90}` points spindle to right (East/Wellness)
✓ Setting `angle={180}` points spindle to bottom (South/Goals)
✓ Setting `angle={270}` points spindle to left (West/Roles)
✓ Spindle animates smoothly between positions
✓ `onSnapComplete` fires after animation
✓ Gold metallic color is visible
✓ Responsive sizing works correctly
✓ Shortest path rotation logic works

## Future Enhancements

Potential improvements for future phases:
- Touch/gesture controls for manual rotation
- Sound effects on snap
- Haptic feedback
- Visual glow/highlight effect on snap completion
- Customizable animation duration/easing
