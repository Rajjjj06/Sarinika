import { auth, db } from "./firebase"
import { doc, getDoc, collection, getDocs, query, orderBy, limit } from "firebase/firestore"

/**
 * Check if Firestore is properly configured
 */
export async function checkFirestoreConnection(): Promise<{ connected: boolean; message: string }> {
  try {
    const user = auth.currentUser
    if (!user) {
      return {
        connected: false,
        message: "User not authenticated. Please sign in first.",
      }
    }

    // Try to read a document to verify connection
    const testDoc = doc(db, "users", user.uid)
    await getDoc(testDoc)

    return {
      connected: true,
      message: "Firestore connected successfully!",
    }
  } catch (error: any) {
    console.error("Firestore connection error:", error)

    // Check for specific error types
    if (error?.code === "permission-denied") {
      return {
        connected: false,
        message: "Permission denied. Please update Firestore security rules.",
      }
    }

    if (error?.code === "unavailable" || error?.code === "deadline-exceeded") {
      return {
        connected: false,
        message: "Cannot connect to Firestore. Make sure the database is created in Firebase Console.",
      }
    }

    return {
      connected: false,
      message: "Firestore is not configured. Please create the database in Firebase Console.",
    }
  }
}

/**
 * Check if Firestore database exists
 */
export async function checkFirestoreExists(): Promise<boolean> {
  try {
    const user = auth.currentUser
    if (!user) return false

    const testDoc = doc(db, "users", user.uid)
    await getDoc(testDoc)
    return true
  } catch (error) {
    return false
  }
}

/**
 * Get all users from Firestore
 */
export async function getAllUsers() {
  try {
    const usersRef = collection(db, "users")
    const querySnapshot = await getDocs(usersRef)
    
    const users: any[] = []
    querySnapshot.forEach((doc) => {
      users.push({
        id: doc.id,
        ...doc.data()
      })
    })
    
    console.log("All users:", users)
    return users
  } catch (error) {
    console.error("Error getting users:", error)
    throw error
  }
}

/**
 * Get all users with pagination and ordering
 */
export async function getUsersPaginated(pageSize: number = 10) {
  try {
    const usersRef = collection(db, "users")
    const q = query(usersRef, orderBy("createdAt", "desc"), limit(pageSize))
    const querySnapshot = await getDocs(q)
    
    const users: any[] = []
    querySnapshot.forEach((doc) => {
      console.log(doc.id, " => ", doc.data())
      users.push({
        id: doc.id,
        ...doc.data()
      })
    })
    
    return users
  } catch (error) {
    console.error("Error getting users:", error)
    throw error
  }
}

