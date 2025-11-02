# Firestore Chat History Setup Guide

## Overview

Your chat application now uses Firestore to store all chat conversations in the database. This means:
- All chats are saved to Firestore
- Each user has their own chat history
- Chats persist across devices
- No data loss when clearing browser storage

## Firestore Structure

Your Firestore database should have the following structure:

```
chats/
  {chatId}/
    - userId: string (user's Firebase UID)
    - name: string (chat name)
    - messages: array (conversation messages)
    - createdAt: timestamp
    - updatedAt: timestamp

users/
  {userId}/
    - uid: string
    - email: string
    - displayName: string
    - photoURL: string
    - createdAt: timestamp
    - updatedAt: timestamp
```

## Security Rules

You need to add Firestore security rules to allow users to read/write their own chats:

### Step 1: Go to Firebase Console

1. Visit [Firebase Console](https://console.firebase.google.com/)
2. Select your project (serenica-acb7d)
3. Click on "Firestore Database" in the left sidebar
4. Click on "Rules" tab

### Step 2: Add Security Rules

Replace your existing rules with these:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Users can read/write their own user document
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Users can read/write their own chats
    match /chats/{chatId} {
      allow read, write: if request.auth != null && request.resource.data.userId == request.auth.uid;
      allow create: if request.auth != null;
    }
    
    // Users can read/write their own journal entries
    match /journalEntries/{entryId} {
      allow read, write: if request.auth != null && request.resource.data.userId == request.auth.uid;
      allow create: if request.auth != null;
    }
    
    // Deny all other access
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

### Step 3: Publish Rules

Click "Publish" to save the rules.

## Testing the Setup

1. **Login**: Sign in with your Google account
2. **Chat**: Start a conversation in the chat page
3. **Check Firestore**: Go to Firebase Console > Firestore Database
4. **Verify**: You should see a "chats" collection with your conversation
5. **Profile**: Go to profile page to see your chat history
6. **Continue**: Click "Continue" on any chat to resume the conversation

## Features

✅ **Automatic Saving**: Every message is saved to Firestore  
✅ **User Isolation**: Each user only sees their own chats  
✅ **Chat History**: View all conversations in profile  
✅ **Continue Chat**: Resume any previous conversation  
✅ **Rename Chats**: Customize chat names  
✅ **Delete Chats**: Remove unwanted conversations  
✅ **Persistent**: All data stored in database  

## Troubleshooting

### "Permission Denied" Error

**Solution**: Make sure Firestore security rules are published correctly (see Step 2 above)

### Chats Not Appearing

**Check**:
1. Firebase Console > Firestore > Rules (must be published)
2. Browser console for errors
3. Network tab in browser dev tools
4. Verify user is logged in

### Profile Photo Not Showing

**Check**:
1. User has a Google profile photo
2. Photo URL is valid
3. CORS is enabled in Firebase storage settings

### Chat Not Saving

**Solution**:
1. Check browser console for errors
2. Verify Firestore is enabled in Firebase Console
3. Check network connectivity
4. Ensure user is authenticated

## Environment Variables

Make sure these are set in your `.env.local`:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
GROQ_API_KEY=your_groq_key
```

## Database Costs

Firestore offers a generous free tier:
- 50,000 reads/day
- 20,000 writes/day
- 20,000 deletes/day

This should be more than enough for development and small-scale production.

## Next Steps

1. Set up Firestore security rules
2. Test chat creation
3. Verify history appears in profile
4. Test continue chat functionality
5. Monitor Firebase Console for usage

Your chats are now safely stored in the cloud! 🎉

