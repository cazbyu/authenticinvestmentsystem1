# Note Attachments Display in Weekly Reflection Timeline

## Summary

Successfully implemented note attachment display with thumbnails in the Weekly Reflection timeline view. Task and event notes now show their attachments alongside reflection attachments, providing a complete visual timeline of the week's activities.

## Changes Made

### 1. Enhanced Data Fetching (`WeeklyReflectionView.tsx`)

**Added batch fetching of note attachments:**
```typescript
// Fetch attachments for all notes in batch
const noteIds = notesData?.filter((item: any) => item.note && item.note.id)
  .map((item: any) => item.note.id) || [];
const noteAttachmentsMap = noteIds.length > 0 
  ? await fetchAttachmentsForNotes(noteIds) 
  : new Map();
```

**Updated timeline item structure:**
- Added `noteAttachments?: NoteAttachment[]` to `TimelineItem` interface
- Populated note attachments when mapping notes to timeline items

### 2. Visual Display Enhancements

**Added attachment badge:**
- Displays count of attachments in the header next to the item type badge
- Only shows when attachments are present

**Image attachments:**
- Combined reflection image attachments with note image attachments
- Display up to 3 image thumbnails
- Show "+N" indicator for additional images
- Click to open full-screen image viewer

**Document attachments:**
- Separate section for non-image attachments (PDFs, documents, etc.)
- Display with file type icons using `AttachmentThumbnail` component
- Show file name next to thumbnail
- Click to open file in system default application

### 3. New Styles Added

```typescript
headerRight: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
},
documentAttachmentsContainer: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  marginTop: 12,
  gap: 8,
},
documentAttachmentItem: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
  paddingVertical: 4,
  paddingHorizontal: 8,
  borderRadius: 6,
  backgroundColor: 'rgba(0, 0, 0, 0.05)',
  maxWidth: '100%',
},
documentFileName: {
  fontSize: 12,
  flex: 1,
}
```

## Features

✅ **Batch Loading** - Efficient fetching of attachments for all notes at once
✅ **Visual Thumbnails** - Image previews directly in the timeline
✅ **Attachment Badge** - Clear indicator showing number of attachments
✅ **Interactive** - Click to view images full-screen or open documents
✅ **Mixed Content** - Handles both images and documents in the same note
✅ **Consistent Design** - Matches attachment display in TaskDetailModal

## User Experience

Users can now:
1. See at a glance which timeline items have attachments (badge indicator)
2. Preview image attachments directly in the timeline without opening the item
3. Click image thumbnails to view them full-screen with swipe navigation
4. Access document attachments with visual file type indicators
5. Quickly identify file types (PDF, Word, Excel, etc.) by icon

## Technical Details

**Components Used:**
- `AttachmentBadge` - Displays attachment count
- `AttachmentThumbnail` - Shows file type icons for documents
- `ImageViewerModal` - Full-screen image viewing
- `fetchAttachmentsForNotes` - Batch attachment fetching utility

**Data Flow:**
1. Fetch notes for the week from `0008-ap-universal-notes-join`
2. Extract note IDs and fetch attachments in batch from `0008-ap-note-attachments`
3. Create Map of note ID to attachments array
4. Populate timeline items with their corresponding attachments
5. Render attachments inline with timeline content

## Testing Checklist

- [ ] Verify attachments display for task notes
- [ ] Verify attachments display for event notes
- [ ] Confirm image thumbnails are clickable and open viewer
- [ ] Confirm document attachments open in system app
- [ ] Check attachment badge shows correct count
- [ ] Verify layout works with multiple attachments
- [ ] Test with mixed image and document attachments
- [ ] Confirm reflection attachments still work correctly
- [ ] Verify performance with many attachments

## Related Files

- `/components/reflections/WeeklyReflectionView.tsx` - Main implementation
- `/lib/noteAttachmentUtils.ts` - Attachment utilities
- `/components/attachments/AttachmentBadge.tsx` - Badge component
- `/components/attachments/AttachmentThumbnail.tsx` - Thumbnail component
- `/components/reflections/ImageViewerModal.tsx` - Image viewer
