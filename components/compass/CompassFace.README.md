# CompassFace Component

## Overview
The CompassFace component renders dynamic outer ring items based on the active zone (domain), with conditional color visibility. It fetches personalized items from the database and positions them at correct angles around the compass edge.

## File Location
`components/compass/CompassFace.tsx`

## Purpose
- Display zone-specific items around the compass perimeter
- Show different items based on active domain (Mission, Wellness, Goals, Roles)
- Respect color visibility rule (color only at Wellness/90°)
- Provide interactive item selection with callbacks
- Animate smooth transitions between zones

## Props

### `activeZone` (required)
- Type: `'mission' | 'wellness' | 'goals' | 'roles'`
- Description: The currently active domain, determines which items to display
- Example: `activeZone="wellness"`

### `showColorRing` (required)
- Type: `boolean`
- Description: Controls background ring color visibility
  - `true`: Shows wellness color gradient (green)
  - `false`: Shows grayscale background
- **CRITICAL**: Should be `true` ONLY when gold spindle is at 90° (Wellness)
- Example: `showColorRing={compassState.bigSpindleAngle === 90}`

### `items` (optional)
- Type: `CompassItem[]`
- Description: Override automatic item loading with custom items
- Example:
  ```typescript
  items={[
    { id: '1', label: 'Father', slotCode: 'R1', angle: 270 },
    { id: '2', label: 'Husband', slotCode: 'R2', angle: 315 }
  ]}
  ```

### `onItemTap` (optional)
- Type: `(slotCode: string) => void`
- Description: Callback fired when user taps an item
- Returns the slot code of the tapped item
- Example:
  ```typescript
  onItemTap={(slotCode) => {
    console.log('Selected:', slotCode);
    // Update silver spindle, load details, etc.
  }}
  ```

### `highlightedSlot` (optional)
- Type: `string | null`
- Description: Slot code of item to visually highlight
- Highlighted items have larger dot, bolder text, and zone color
- Example: `highlightedSlot="R1"`

### `size` (optional)
- Type: `number`
- Default: `288`
- Description: Size of the compass face in pixels
- Scales all elements proportionally
- Example: `size={320}`

## Item Data Structure

```typescript
interface CompassItem {
  id: string;           // Unique identifier
  label: string;        // Display text
  slotCode: string;     // Slot code (R1, WZ3, G5, etc.)
  angle: number;        // Position angle (0-360)
  color?: string;       // Optional override color
}
```

## Data Sources by Zone

### Wellness (activeZone="wellness")
**Fixed 8 zones** - No database fetch required
```typescript
[
  { id: 'wz1', label: 'Mental', slotCode: 'WZ1', angle: 45 },
  { id: 'wz2', label: 'Emotional', slotCode: 'WZ2', angle: 67.5 },
  { id: 'wz3', label: 'Physical', slotCode: 'WZ3', angle: 90 },
  { id: 'wz4', label: 'Spiritual', slotCode: 'WZ4', angle: 112.5 },
  { id: 'wz5', label: 'Social', slotCode: 'WZ5', angle: 135 },
  { id: 'wz6', label: 'Financial', slotCode: 'WZ6', angle: 157.5 },
  { id: 'wz7', label: 'Career', slotCode: 'WZ7', angle: 180 },
  { id: 'wz8', label: 'Environmental', slotCode: 'WZ8', angle: 202.5 },
]
```

### Roles (activeZone="roles")
**Database**: `0008-ap-roles`
- Fetches user's active roles
- Joins with `0008-ap-user-slot-mappings` for slot codes
- Joins with `0008-ap-compass-coordinates` for angles
- Slot codes: R1-R20
- Default angle: 270° (if no mapping)

### Goals (activeZone="goals")
**Database**: `0008-ap-goals-12wk`
- Fetches user's active 12-week goals
- Joins with `0008-ap-user-slot-mappings` for slot codes
- Joins with `0008-ap-compass-coordinates` for angles
- Slot codes: G1-G25
- Default angle: 180° (if no mapping)
- Limit: 20 goals

### Mission (activeZone="mission")
**Database**: `0008-ap-aspirations-library`
- Fetches user's mission/vision/values (MVV)
- No slot mapping (generates sequential slots)
- Slot codes: M1-M10
- Angles: 0° + (index * 10°)
- Limit: 10 items

## Visual States

### Background Ring

**Color Mode** (`showColorRing={true}`)
- Wellness gradient: `#39b54a → #8dc63f → #00a651`
- Opacity: 0.15
- Stroke width: 24px
- Radius: 108px
- Used ONLY for Wellness domain

**Grayscale Mode** (`showColorRing={false}`)
- Color: `#e0e0e0`
- Opacity: 0.3
- Stroke width: 24px
- Radius: 108px
- Used for Mission, Goals, and Roles

### Item Dots

**Normal State**
- Size: 5px radius
- Color: Zone color or item color
- Opacity: 0.7

**Highlighted State** (`highlightedSlot` matches)
- Size: 8px radius
- Color: Zone color or item color
- Opacity: 1.0

### Item Labels

**Normal State**
- Font size: 10px
- Color: #666
- Font weight: 400
- Text anchor: middle
- Max length: 12 characters (truncated with "...")

**Highlighted State**
- Font size: 10px
- Color: Zone color
- Font weight: 600
- Text anchor: middle

## Positioning

Items are positioned in a circle around the compass:

```typescript
const COMPASS_CENTER = { x: 144, y: 144 };
const ITEM_RADIUS = 120;

const calculateItemPosition = (angle: number) => {
  const angleRad = (angle - 90) * (Math.PI / 180);
  const x = COMPASS_CENTER.x + ITEM_RADIUS * Math.cos(angleRad);
  const y = COMPASS_CENTER.y + ITEM_RADIUS * Math.sin(angleRad);
  return { x, y };
};
```

- Items positioned at radius 120px from center
- Angle adjusted by -90° for proper orientation
- Touch targets: 44px (iOS HIG compliant)

## Animations

### Zone Change
When `activeZone` changes:
1. Items fade out (150ms)
2. New items loaded from database
3. Items fade in (300ms)
4. Total transition: 450ms

### Color Ring
When `showColorRing` changes:
1. Crossfade between color and grayscale (400ms)
2. Easing: inOut ease
3. Smooth opacity transition

### Item Highlight
When `highlightedSlot` changes:
- Instant visual update
- No animation (for responsiveness)

## Usage Examples

### Basic Integration with LifeCompass

```typescript
import CompassFace from './CompassFace';

function LifeCompass() {
  const [compassState, setCompassState] = useState({
    bigSpindleAngle: 0,
    smallSpindleAngle: 0,
    activeZone: 'mission',
    focusedSlot: null,
  });

  return (
    <View style={styles.compass}>
      {/* Base compass elements */}

      <CompassFace
        activeZone={compassState.activeZone}
        showColorRing={compassState.bigSpindleAngle === 90}
        onItemTap={(slotCode) => {
          // Update silver spindle to point to this item
          const item = findItemBySlotCode(slotCode);
          setCompassState(prev => ({
            ...prev,
            smallSpindleAngle: item.angle,
            focusedSlot: slotCode,
          }));
        }}
        highlightedSlot={compassState.focusedSlot}
        size={288}
      />

      {/* Spindles and hub */}
    </View>
  );
}
```

### With Custom Items

```typescript
const customItems: CompassItem[] = [
  { id: '1', label: 'Custom 1', slotCode: 'C1', angle: 45, color: '#ff0000' },
  { id: '2', label: 'Custom 2', slotCode: 'C2', angle: 90, color: '#00ff00' },
];

<CompassFace
  activeZone="mission"
  showColorRing={false}
  items={customItems}
  onItemTap={(slotCode) => console.log('Tapped:', slotCode)}
/>
```

### Synchronized with Spindles

```typescript
function SyncedCompass() {
  const [goldAngle, setGoldAngle] = useState(0);
  const [silverAngle, setSilverAngle] = useState(0);
  const [activeZone, setActiveZone] = useState<Zone>('mission');
  const [focusedSlot, setFocusedSlot] = useState<string | null>(null);

  const angleToZone = (angle: 0 | 90 | 180 | 270): Zone => {
    const map = { 0: 'mission', 90: 'wellness', 180: 'goals', 270: 'roles' };
    return map[angle];
  };

  return (
    <View style={styles.container}>
      <CompassFace
        activeZone={activeZone}
        showColorRing={goldAngle === 90}
        onItemTap={(slotCode) => {
          // Find item and update silver spindle
          setFocusedSlot(slotCode);
        }}
        highlightedSlot={focusedSlot}
      />

      <SpindleGold
        angle={goldAngle}
        onSnapComplete={(angle) => {
          setGoldAngle(angle);
          setActiveZone(angleToZone(angle));
        }}
      />

      <SpindleSilver
        angle={silverAngle}
        animated={true}
      />
    </View>
  );
}
```

## Color Visibility Matrix

| Gold Spindle | Active Zone | `showColorRing` | Background |
|--------------|-------------|-----------------|------------|
| 0° (North) | Mission | `false` | Grayscale |
| 90° (East) | Wellness | **`true`** | **Color gradient** |
| 180° (South) | Goals | `false` | Grayscale |
| 270° (West) | Roles | `false` | Grayscale |

**Rule**: Color ring visible ONLY when viewing Wellness domain (90°).

## Database Queries

### Roles Query
```typescript
const { data: roles } = await supabase
  .from('0008-ap-roles')
  .select(`
    id,
    name,
    0008-ap-user-slot-mappings!inner(
      slot_code,
      0008-ap-compass-coordinates!inner(angle)
    )
  `)
  .eq('profile_id', user.id)
  .eq('is_active', true)
  .order('name');
```

### Goals Query
```typescript
const { data: goals } = await supabase
  .from('0008-ap-goals-12wk')
  .select(`
    id,
    title,
    0008-ap-user-slot-mappings!inner(
      slot_code,
      0008-ap-compass-coordinates!inner(angle)
    )
  `)
  .eq('profile_id', user.id)
  .eq('is_active', true)
  .order('title')
  .limit(20);
```

### Mission Query
```typescript
const { data: aspirations } = await supabase
  .from('0008-ap-aspirations-library')
  .select('id, title, aspiration_type')
  .eq('profile_id', user.id)
  .eq('is_active', true)
  .order('aspiration_type')
  .limit(10);
```

## Loading States

### Initial Load
- Shows dashed circle indicator
- Items fade in when loaded
- Smooth transition (300ms)

### Zone Change
- Fade out old items (150ms)
- Load new data
- Fade in new items (300ms)

### Error Handling
- Logs error to console
- Sets empty items array
- No visual error state (graceful degradation)

## Accessibility

- Touch targets: 44px minimum (iOS HIG)
- Visual feedback on press (`activeOpacity: 0.6`)
- Haptic feedback on mobile
- Readable text sizes (10px minimum)
- High contrast for highlighted items

## Performance Considerations

- Database queries cached by Supabase
- SVG rendering optimized (static paths)
- Animations run on UI thread (Reanimated)
- Touch targets positioned via transform
- Item list re-renders only on zone change
- Conditional fetching (wellness uses static data)

## Integration Checklist

When integrating CompassFace into LifeCompass:

✓ Position behind spindles (lower z-index)
✓ Position above base compass (higher z-index than rings)
✓ Sync `activeZone` with gold spindle position
✓ Calculate `showColorRing` from gold spindle angle
✓ Connect `onItemTap` to silver spindle and state
✓ Pass `highlightedSlot` from compass state
✓ Match `size` prop with other compass components
✓ Ensure proper absolute positioning
✓ Test all 4 zones with real data
✓ Verify color ring only shows at Wellness

## Layering in LifeCompass

Recommended z-index order (bottom to top):

1. Base compass SVG (rings, star, lines)
2. **CompassFace** - Dynamic items
3. SpindleGold - Domain selector
4. SpindleSilver - Item selector
5. CompassHub - Interactive center
6. Color ring overlay (if separate)

## Troubleshooting

### Items not showing
- Check database connection
- Verify user is authenticated
- Check `is_active` status in database
- Inspect console for query errors

### Wrong positions
- Verify compass coordinates in database
- Check slot mapping exists
- Confirm angle calculation

### Color ring not showing
- Verify `showColorRing` prop is `true`
- Check gold spindle angle is exactly 90
- Inspect animated style values

### Items not tappable
- Verify touch targets positioned correctly
- Check z-index layering
- Ensure `onItemTap` callback provided

## Future Enhancements

Potential improvements:
1. Loading skeleton for items
2. Error state UI
3. Item icons from database
4. Custom item colors per zone
5. Drag-to-reorder items
6. Item detail tooltips on long press
7. Animated item entry/exit
8. Cluster dense items
9. Search/filter items
10. Cached queries for performance

## Dependencies

- `react-native-reanimated` v3.x
- `react-native-svg`
- `@supabase/supabase-js`
- `expo-haptics`

## Summary

CompassFace dynamically renders zone-specific items around the compass perimeter, respecting the critical color visibility rule (color only at Wellness/90°). It fetches personalized data from Supabase, positions items accurately, and provides interactive selection with smooth animations.
