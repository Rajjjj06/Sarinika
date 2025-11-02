# Streak & Statistics Implementation

## Overview
This document outlines the complete implementation of streak tracking, statistics calculation, and mood scoring for the Sarinika mental wellness application.

## Features Implemented

### 1. Streak Tracking
- **Streak Calculation**: Users earn a streak by writing a journal entry OR having a chat conversation daily
- **Streak Logic**: 
  - Tracks consecutive days of activity (journal or chat)
  - Streak is broken if no activity on current day or yesterday
  - Counts from most recent activity backwards
- **Streak API**: `/api/stats` endpoint calculates current streak

### 2. Statistics Dashboard
- **Current Streak**: Shows consecutive days of activity
- **Total Entries**: Shows total number of journal entries written
- **Average Mood**: Calculated from journal emotions and chat sentiment analysis
- **Real-time Updates**: All statistics update when new data is added

### 3. Mood Scoring System

#### Journal-Based Mood
Emotion to score mapping:
- **Happy**: 9/10
- **Calm**: 8/10
- **Energetic**: 8/10
- **Thoughtful**: 6/10
- **Anxious**: 4/10
- **Sad**: 3/10

#### Chat-Based Mood
- Analyzes user messages for positive/negative keywords
- Adjusts score based on sentiment
- Ranges from 1-10

#### Combined Score
- Averages journal emotion scores and chat sentiment
- Provides overall mental wellness indicator

### 4. Data Visualization

#### Weekly Mood Trend
- Line chart showing mood scores for last 7 days
- Based on journal entries only (by emotion)
- Displays "0" for days without entries

#### Journal Entries Chart
- Bar chart showing entries per week
- Last 4 weeks of data
- Helps track consistency

### 5. Recent Entries
- Shows 5 most recent journal entries
- Displays date, emotion, and preview
- Clickable links to full journal view
- Empty state when no entries exist

### 6. Journal Detail View
- **Location**: `/journal/[id]`
- **Features**:
  - Read-only view of full journal entry
  - Displays emotion and mental state badges
  - Shows creation and last update timestamps
  - Cannot be edited or deleted from this view
  - Back to dashboard navigation

## API Endpoints

### `/api/stats`
**Method**: GET  
**Parameters**: `userId` (query param)  
**Returns**:
```json
{
  "streak": 5,
  "totalEntries": 23,
  "avgMood": 7.2,
  "journalCount": 15,
  "chatCount": 8
}
```

## Database Structure

### journalEntries Collection
```javascript
{
  userId: string,
  content: string,
  emotion: string,      // "Happy" | "Calm" | etc.
  mentalState: string,  // AI-determined mental state
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### chats Collection
```javascript
{
  userId: string,
  name: string,
  messages: Array<{ role: string, content: string }>,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

## Firestore Security Rules

Updated rules to include journal entries:
```javascript
match /journalEntries/{entryId} {
  allow read, write: if request.auth != null && request.resource.data.userId == request.auth.uid;
  allow create: if request.auth != null;
}
```

## How It Works

### Streak Calculation Flow
1. Collect all activity dates from journals and chats
2. Sort dates in descending order
3. Check if today or yesterday has activity
4. If no recent activity, streak = 0
5. Count consecutive days from most recent activity

### Daily Activity Rules
- **Journal Entry**: Saving a new journal entry counts as activity for that day
- **Chat Conversation**: Creating or updating a chat counts as activity
- **Both Count**: If user does both journal and chat same day, still counts as 1 day

### Mood Calculation Flow
1. Fetch all journal entries for user
2. Convert emotions to scores using mapping
3. Fetch all chats for user
4. Analyze chat messages for sentiment
5. Average all scores together
6. Round to 1 decimal place

## Testing the Implementation

### To Test Streak
1. Create a journal entry today
2. Check dashboard - streak should be 1
3. Create another entry tomorrow
4. Check dashboard - streak should be 2
5. Skip a day without activity
6. Next day, check if streak is reset to 0

### To Test Mood Scoring
1. Create journals with different emotions
2. Check dashboard for average mood
3. Create chats with positive/negative content
4. Verify mood score adjusts accordingly

### To Test Recent Entries
1. Create multiple journal entries
2. Check dashboard shows last 5
3. Click on an entry
4. Verify full view displays correctly
5. Verify cannot edit from detail view

## Edge Cases Handled

1. **No Data**: Shows "0 days", "0 entries", "0/10 mood"
2. **Empty Charts**: Charts render with 0 values
3. **Missing User**: Redirects to login
4. **Unauthorized Access**: Prevents viewing other users' journals
5. **Missing Journal ID**: Redirects to dashboard
6. **Concurrent Activity**: Only counts once per day
7. **Time Zones**: Uses local date for streak calculation

## Performance Considerations

- Statistics calculated on-demand (not cached)
- Journal entries queried once per page load
- Charts use real-time data
- Efficient date filtering
- Minimum Firebase reads/writes

## Future Enhancements

Potential improvements:
- Cache statistics in user document
- Add streak milestones/celebrations
- More sophisticated sentiment analysis
- Export mood trends as CSV
- Compare streak to friends (if social features added)
- Weekly/monthly streak badges

## Notes

- Streak resets if user misses a day
- Mood score is calculated from all historical data
- Charts show last 7 days and 4 weeks respectively
- All timestamps use Firebase server timestamp
- Journal detail view is read-only by design
- Recent entries limited to 5 for performance

