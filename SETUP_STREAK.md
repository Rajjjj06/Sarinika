# Quick Setup Guide for Streak & Statistics

## What's Been Implemented

✅ **Streak Tracking** - Tracks consecutive days of journal or chat activity  
✅ **Statistics Dashboard** - Shows streak, total entries, and average mood  
✅ **Mood Scoring** - Calculates mood from journal emotions and chat sentiment  
✅ **Real Data Visualization** - Charts show actual user data  
✅ **Recent Entries** - Display and view previous journal entries  
✅ **Journal Detail View** - Read-only view of individual journals  

## Setup Steps

### 1. Update Firestore Security Rules

Go to Firebase Console → Firestore Database → Rules and update to:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    match /chats/{chatId} {
      allow read, write: if request.auth != null && request.resource.data.userId == request.auth.uid;
      allow create: if request.auth != null;
    }
    
    match /journalEntries/{entryId} {
      allow read, write: if request.auth != null && request.resource.data.userId == request.auth.uid;
      allow create: if request.auth != null;
    }
    
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

Click "Publish" to save.

### 2. Test the Implementation

1. **Login** to your Sarinika account
2. **Write a journal entry** - Go to Dashboard → New Entry
3. **Check dashboard** - You should see:
   - Streak: 1 day
   - Total Entries: 1
   - Average Mood calculated from your entry
   - Charts displaying your data
4. **Chat with AI** - Go to Chat and have a conversation
5. **Check dashboard again** - Streak should still be 1 (only counts once per day)
6. **Create another journal** tomorrow - Streak should be 2 days
7. **View journal detail** - Click on a recent entry to see full view

## How It Works

### Streak Logic
- Writing a journal OR having a chat counts as activity for that day
- Missing a day breaks the streak
- Streak starts counting from most recent activity

### Mood Scoring
- Journal emotions are scored: Happy (9), Calm (8), Energetic (8), Thoughtful (6), Anxious (4), Sad (3)
- Chat messages are analyzed for positive/negative words
- Average of all scores provides overall mood

### Charts
- **Weekly Mood Trend**: Last 7 days based on journal emotions
- **Journal Entries**: Last 4 weeks showing entry count per week

## New Files Created

1. `app/api/stats/route.ts` - Statistics API endpoint
2. `app/journal/[id]/page.tsx` - Journal detail view page
3. `STREAK_IMPLEMENTATION.md` - Complete documentation
4. `SETUP_STREAK.md` - This file

## Modified Files

1. `app/dashboard/page.tsx` - Now loads real data and calculates statistics
2. `FIRESTORE_SETUP.md` - Updated security rules

## Features

### Dashboard Statistics
- **Current Streak**: Days of consecutive activity
- **Total Entries**: Number of journals written
- **Avg. Mood**: Combined score from journals and chats

### Charts
- Weekly mood trend (line chart)
- Journal entries per week (bar chart)

### Recent Entries
- Shows last 5 journal entries
- Clickable to view full entry
- Displays date, emotion, and preview

### Journal Detail View
- Read-only display of full entry
- Shows emotion, mental state, and timestamps
- Cannot be edited (by design)
- Back navigation to dashboard

## Troubleshooting

### Streak Not Updating
- Check if journal was saved successfully
- Verify Firestore has the entry
- Check browser console for errors

### Charts Empty
- Create some journal entries first
- Check that data is loading in network tab
- Verify statistics API is working

### Journal Detail Not Loading
- Verify journal entry exists
- Check that you're the owner
- Look for console errors

### Permission Denied
- Update Firestore security rules (see Step 1)
- Ensure rules are published
- Check user is authenticated

## Next Steps

The implementation is complete and ready to use! Users can:
- Track their journal writing streaks
- See their mental wellness trends
- Review their progress over time
- View their historical entries

Enjoy using Sarinika! 🎉

