/**
 * Encryption utilities for chat messages and journal entries
 * Uses Web Crypto API with AES-GCM for authenticated encryption
 * 
 * THREAT MODEL:
 * - Encryption/Decryption happens CLIENT-SIDE ONLY
 * - The server (Firebase) stores encrypted data but CANNOT decrypt it
 * - Only the authenticated user on their own device can decrypt their messages
 * - Keys are stored in browser IndexedDB and never sent to the server
 * - If the user clears browser data, they will lose access to encrypted messages
 *   (unless they have a backup of their encryption key)
 * 
 * SECURITY PROPERTIES:
 * - Each encryption uses a unique random salt (stored with encrypted data)
 * - Each encryption uses a unique random IV (stored with encrypted data)
 * - Keys are derived using PBKDF2 with 100,000 iterations
 * - User-specific encryption key is stable across sessions (stored in IndexedDB)
 */

const DB_NAME = "serenica-crypto"
const DB_VERSION = 1
const STORE_NAME = "userKeys"

// In-memory cache to prevent race conditions and redundant IndexedDB access
const keyCache = new Map<string, Promise<CryptoKey>>()

/**
 * Gets or creates a stable encryption key for the user
 * This key is stored in IndexedDB and persists across sessions
 * The key is unique per user and never sent to the server
 * Uses an in-memory cache to prevent race conditions
 */
async function getUserEncryptionKey(userId: string): Promise<CryptoKey> {
  // Check if we already have a pending or resolved key for this user
  if (keyCache.has(userId)) {
    return keyCache.get(userId)!
  }

  // Create a promise for getting/creating the key
  const keyPromise = getUserEncryptionKeyInternal(userId)
  keyCache.set(userId, keyPromise)
  
  // Remove from cache if it fails (so we can retry)
  keyPromise.catch(() => {
    keyCache.delete(userId)
  })
  
  return keyPromise
}

/**
 * Internal function that actually gets or creates the encryption key
 */
async function getUserEncryptionKeyInternal(userId: string): Promise<CryptoKey> {
  try {
    // Open IndexedDB
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)
      request.onerror = () => {
        console.error("Failed to open IndexedDB:", request.error)
        reject(request.error)
      }
      request.onsuccess = () => resolve(request.result)
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME)
        }
      }
    })

    // Try to get existing key
    const existingKey = await new Promise<ArrayBuffer | null>((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readonly")
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get(userId)
      request.onerror = () => {
        console.error("Failed to get key from IndexedDB:", request.error)
        reject(request.error)
      }
      request.onsuccess = () => resolve(request.result || null)
    })

    if (existingKey) {
      // Verify key length
      if (existingKey.byteLength !== 32) {
        console.warn(`Existing key has wrong length (${existingKey.byteLength} bytes, expected 32). Regenerating...`)
        // Delete the invalid key and generate a new one
        await new Promise<void>((resolve, reject) => {
          const transaction = db.transaction([STORE_NAME], "readwrite")
          const store = transaction.objectStore(STORE_NAME)
          const request = store.delete(userId)
          request.onerror = () => reject(request.error)
          request.onsuccess = () => resolve()
        })
        // Fall through to generate new key
      } else {
        // Import existing key - create a copy to ensure we have a proper ArrayBuffer
        const keyBytes = new Uint8Array(existingKey)
        // Create a proper copy of the buffer
        const keyBuffer = new Uint8Array(keyBytes).buffer
        
        console.log("Using existing encryption key from IndexedDB", {
          userId,
          keyLength: keyBuffer.byteLength,
          keyHash: Array.from(keyBytes.slice(0, 4)).map(b => b.toString(16).padStart(2, '0')).join('')
        })
        
        return crypto.subtle.importKey(
          "raw",
          keyBuffer,
          { name: "PBKDF2" },
          false,
          ["deriveBits", "deriveKey"]
        )
      }
    }

    // Generate new key (32 bytes = 256 bits)
    console.log("Generating new encryption key for user:", userId)
    const keyMaterial = crypto.getRandomValues(new Uint8Array(32))
    // Create a proper copy of the buffer to ensure it's not shared
    const keyBuffer = new Uint8Array(keyMaterial).buffer

    // Store the key in IndexedDB
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readwrite")
      const store = transaction.objectStore(STORE_NAME)
      const request = store.put(keyBuffer, userId)
      request.onerror = () => {
        console.error("Failed to store key in IndexedDB:", request.error)
        reject(request.error)
      }
      request.onsuccess = () => {
        console.log("New encryption key stored in IndexedDB", {
          userId,
          keyLength: keyBuffer.byteLength,
          keyHash: Array.from(keyMaterial.slice(0, 4)).map(b => b.toString(16).padStart(2, '0')).join('')
        })
        resolve()
      }
    })

    // Verify the key was stored correctly by reading it back
    const verifyKey = await new Promise<ArrayBuffer | null>((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readonly")
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get(userId)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result || null)
    })
    
    if (!verifyKey || verifyKey.byteLength !== 32) {
      throw new Error("Failed to verify key storage - key was not stored correctly")
    }
    
    // Compare the stored key with what we tried to store
    const storedBytes = new Uint8Array(verifyKey)
    const originalBytes = new Uint8Array(keyBuffer)
    let matches = true
    for (let i = 0; i < 32; i++) {
      if (storedBytes[i] !== originalBytes[i]) {
        matches = false
        break
      }
    }
    
    if (!matches) {
      throw new Error("Key verification failed - stored key does not match original")
    }

    // Import the new key
    return crypto.subtle.importKey(
      "raw",
      keyBuffer,
      { name: "PBKDF2" },
      false,
      ["deriveBits", "deriveKey"]
    )
  } catch (error) {
    console.error("Error in getUserEncryptionKey:", error)
    throw new Error(`Failed to get encryption key: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * Derives an encryption key from the user's stable key and a per-encryption salt
 * Each encryption uses a unique salt, which is stored with the encrypted data
 */
async function deriveEncryptionKey(
  keyMaterial: CryptoKey,
  salt: Uint8Array
): Promise<CryptoKey> {
  // Ensure salt is a proper BufferSource by creating a new Uint8Array
  const saltBuffer = new Uint8Array(salt)
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltBuffer,
      iterations: 100000, // High iteration count for security
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false, // Key is not extractable
    ["encrypt", "decrypt"]
  )
}

/**
 * Safely encodes binary data to base64
 * Handles large payloads correctly by processing in chunks
 */
function encodeBase64(data: Uint8Array): string {
  // Convert Uint8Array to binary string in chunks to avoid stack overflow
  // Build string incrementally without using apply() to avoid call stack limits
  let binary = ""
  const chunkSize = 8192
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize)
    for (let j = 0; j < chunk.length; j++) {
      binary += String.fromCharCode(chunk[j])
    }
  }
  return btoa(binary)
}

/**
 * Safely decodes base64 to binary data
 * Handles large payloads correctly
 */
function decodeBase64(base64: string): Uint8Array {
  try {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes
  } catch (error) {
    throw new Error("Invalid base64 string")
  }
}

/**
 * Checks if a string is still in encrypted format (base64)
 * Useful for detecting when decryption failed and content is still encrypted
 */
export function isStillEncrypted(content: string): boolean {
  if (!content || content.length < 40) return false
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/
  return base64Regex.test(content) && content.length > 50
}

/**
 * Checks if a string appears to be encrypted
 * Encrypted format: base64([salt:16 bytes][iv:12 bytes][encrypted data])
 */
function isLikelyEncrypted(content: string): boolean {
  if (!content || content.length < 40) return false // Minimum: 16+12 bytes = 28 bytes = ~38 base64 chars

  // Base64 strings only contain A-Z, a-z, 0-9, +, /, and = (for padding)
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/
  if (!base64Regex.test(content)) return false

  try {
    const decoded = decodeBase64(content)
    // Encrypted content should be at least 28 bytes (16 salt + 12 IV)
    return decoded.length >= 28
  } catch {
    return false
  }
}

/**
 * Encrypts a message using AES-GCM
 * Format: base64([salt:16 bytes][iv:12 bytes][encrypted data])
 * 
 * Each encryption uses:
 * - A unique random 16-byte salt (stored with encrypted data)
 * - A unique random 12-byte IV (stored with encrypted data)
 * - The user's stable encryption key (from IndexedDB)
 */
export async function encryptMessage(message: string, userId: string): Promise<string> {
  if (!message) return message

  try {
    // Get or create the user's stable encryption key
    const keyMaterial = await getUserEncryptionKey(userId)

    // Generate a unique random salt for this encryption (16 bytes)
    const salt = crypto.getRandomValues(new Uint8Array(16))

    // Derive the encryption key using the salt
    const key = await deriveEncryptionKey(keyMaterial, salt)

    // Generate a random IV for this encryption (12 bytes for GCM)
    const iv = crypto.getRandomValues(new Uint8Array(12))

    // Encrypt the message
    const encryptedData = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      key,
      new TextEncoder().encode(message)
    )

    // Combine salt, IV, and encrypted data
    // Format: [salt:16 bytes][iv:12 bytes][encrypted data]
    const combined = new Uint8Array(salt.length + iv.length + encryptedData.byteLength)
    combined.set(salt, 0)
    combined.set(iv, salt.length)
    combined.set(new Uint8Array(encryptedData), salt.length + iv.length)

    // Convert to base64 for storage
    const encrypted = encodeBase64(combined)
    
    console.log("Message encrypted successfully", {
      userId,
      messageLength: message.length,
      encryptedLength: encrypted.length,
      saltLength: salt.length,
      ivLength: iv.length
    })
    
    return encrypted
  } catch (error) {
    console.error("Encryption error:", error)
    throw new Error("Failed to encrypt message")
  }
}

/**
 * Decrypts a message using AES-GCM
 * Expects base64-encoded data in format: [salt:16 bytes][iv:12 bytes][encrypted data]
 * Returns the original message if it's not encrypted (backward compatibility)
 */
export async function decryptMessage(encryptedMessage: string, userId: string): Promise<string> {
  if (!encryptedMessage) return encryptedMessage

  // First check if the message appears to be encrypted
  // If not, return it as-is (backward compatibility with unencrypted messages)
  if (!isLikelyEncrypted(encryptedMessage)) {
    return encryptedMessage
  }

  try {
    // Get the user's stable encryption key
    const keyMaterial = await getUserEncryptionKey(userId)

    // Decode from base64
    let combined: Uint8Array
    try {
      combined = decodeBase64(encryptedMessage)
    } catch (error) {
      // If base64 decoding fails, it's not encrypted
      console.warn("Base64 decoding failed, treating as unencrypted:", error)
      return encryptedMessage
    }

    // Check if we have enough data (at least 28 bytes: 16 salt + 12 IV)
    if (combined.length < 28) {
      console.warn("Encrypted data too short, expected at least 28 bytes, got:", combined.length)
      return encryptedMessage
    }

    // Extract salt (first 16 bytes), IV (next 12 bytes), and encrypted data (rest)
    // Create new Uint8Arrays to ensure proper typing
    const salt = new Uint8Array(combined.slice(0, 16))
    const iv = new Uint8Array(combined.slice(16, 28))
    const encryptedData = combined.slice(28)

    if (encryptedData.length === 0) {
      console.warn("No encrypted data found after salt and IV")
      return encryptedMessage
    }

    // Derive the decryption key using the stored salt
    const key = await deriveEncryptionKey(keyMaterial, salt)

    // Decrypt the message
    let decryptedData: ArrayBuffer
    try {
      console.log("Attempting decryption", {
        userId,
        messageLength: encryptedMessage.length,
        encryptedDataLength: encryptedData.length,
        saltLength: salt.length,
        ivLength: iv.length,
        saltHash: Array.from(salt.slice(0, 4)).map(b => b.toString(16).padStart(2, '0')).join('')
      })
      
      decryptedData = await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: iv,
        },
        key,
        encryptedData
      )
      
      console.log("Decryption successful", {
        userId,
        decryptedLength: decryptedData.byteLength
      })
    } catch (decryptError) {
      // OperationError typically means the key doesn't match (wrong key or corrupted data)
      // This often happens with old messages encrypted with the token-based system
      if (decryptError instanceof DOMException && decryptError.name === "OperationError") {
        console.error("Decryption OperationError - Key mismatch detected. This message was likely encrypted with a different key (possibly the old token-based system).", {
          userId,
          messageLength: encryptedMessage.length,
          encryptedDataLength: encryptedData.length,
          saltLength: salt.length,
          ivLength: iv.length,
          saltHash: Array.from(salt.slice(0, 4)).map(b => b.toString(16).padStart(2, '0')).join(''),
          messagePreview: encryptedMessage.substring(0, 50)
        })
        
        // Try to verify if the key in IndexedDB is correct by checking if we can read it
        try {
          const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION)
            request.onerror = () => reject(request.error)
            request.onsuccess = () => resolve(request.result)
            request.onupgradeneeded = (event) => {
              const db = (event.target as IDBOpenDBRequest).result
              if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME)
              }
            }
          })
          
          const storedKey = await new Promise<ArrayBuffer | null>((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], "readonly")
            const store = transaction.objectStore(STORE_NAME)
            const request = store.get(userId)
            request.onerror = () => reject(request.error)
            request.onsuccess = () => resolve(request.result || null)
          })
          
          if (storedKey) {
            console.error("Key exists in IndexedDB", {
              keyLength: storedKey.byteLength,
              keyHash: Array.from(new Uint8Array(storedKey).slice(0, 4)).map(b => b.toString(16).padStart(2, '0')).join('')
            })
          } else {
            console.error("No key found in IndexedDB - this should not happen if encryption worked")
          }
        } catch (keyCheckError) {
          console.error("Error checking key in IndexedDB:", keyCheckError)
        }
        
        throw new Error("DECRYPTION_KEY_MISMATCH: This message was encrypted with a different key and cannot be decrypted. It may have been encrypted with the old token-based system.")
      }
      throw decryptError
    }

    const decryptedText = new TextDecoder().decode(decryptedData)
    
    // Verify we got a valid decryption (not empty and reasonable length)
    if (!decryptedText || decryptedText.length === 0) {
      console.warn("Decryption resulted in empty string")
      return encryptedMessage
    }

    return decryptedText
  } catch (error) {
    // Check if this is a key mismatch error (old messages)
    if (error instanceof Error && error.message.includes("DECRYPTION_KEY_MISMATCH")) {
      console.warn("Cannot decrypt message - it was encrypted with a different key (likely old token-based system). Returning encrypted string.")
      // Return a user-friendly indicator that this is an old encrypted message
      // In the UI, you might want to show "[Encrypted - cannot decrypt]" instead
      return encryptedMessage
    }

    // Log the full error for debugging - handle DOMException and other error types
    let errorDetails: any = {
      userId,
      messageLength: encryptedMessage.length,
      messagePreview: encryptedMessage.substring(0, 50) + "..."
    }

    if (error instanceof DOMException) {
      errorDetails = {
        ...errorDetails,
        errorType: "DOMException",
        name: error.name,
        message: error.message,
        code: error.code,
        stack: error.stack
      }
    } else if (error instanceof Error) {
      errorDetails = {
        ...errorDetails,
        errorType: "Error",
        name: error.name,
        message: error.message,
        stack: error.stack
      }
    } else {
      errorDetails = {
        ...errorDetails,
        errorType: typeof error,
        error: String(error),
        errorStringified: JSON.stringify(error)
      }
    }

    console.error("Decryption failed:", errorDetails)
    
    // Check if this might be an old message encrypted with the token-based system
    // Old format: base64([iv:12 bytes][encrypted data]) - no salt prepended
    // New format: base64([salt:16 bytes][iv:12 bytes][encrypted data])
    try {
      const decoded = decodeBase64(encryptedMessage)
      if (decoded.length >= 12 && decoded.length < 28) {
        console.warn("Message appears to be in old format (no salt). This message was encrypted with the old token-based system and cannot be decrypted with the new stable key system.")
      }
    } catch (e) {
      // Ignore decode errors here
    }
    
    // If decryption fails, it might be an unencrypted message (backward compatibility)
    // or a corrupted message - return the original
    console.warn("Decryption failed, returning original message (may be unencrypted, corrupted, or encrypted with old system)")
    return encryptedMessage
  }
}

/**
 * Encrypts an array of messages
 */
export async function encryptMessages(
  messages: Array<{ id: string; role: string; content: string }>,
  userId: string
): Promise<Array<{ id: string; role: string; content: string }>> {
  const encryptedMessages = await Promise.all(
    messages.map(async (msg) => ({
      ...msg,
      content: await encryptMessage(msg.content, userId),
    }))
  )
  return encryptedMessages
}

/**
 * Decrypts an array of messages
 */
export async function decryptMessages(
  messages: Array<{ id: string; role: string; content: string }>,
  userId: string
): Promise<Array<{ id: string; role: string; content: string }>> {
  const decryptedMessages = await Promise.all(
    messages.map(async (msg) => ({
      ...msg,
      content: await decryptMessage(msg.content, userId),
    }))
  )
  return decryptedMessages
}

/**
 * Exports the user's encryption key as a base64-encoded string
 * This key can be saved by the user and used to restore access to encrypted data
 * if browser data is cleared.
 * 
 * WARNING: This key allows decryption of all user data. Keep it secure!
 * 
 * @param userId - The user's ID
 * @returns A base64-encoded string representing the encryption key
 */
export async function exportEncryptionKey(userId: string): Promise<string> {
  // Open IndexedDB
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
  })

  // Get the key from IndexedDB
  const keyBuffer = await new Promise<ArrayBuffer | null>((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readonly")
    const store = transaction.objectStore(STORE_NAME)
    const request = store.get(userId)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result || null)
  })

  if (!keyBuffer) {
    throw new Error("No encryption key found. Please create some encrypted content first.")
  }

  // Convert ArrayBuffer to Uint8Array and encode as base64
  const keyBytes = new Uint8Array(keyBuffer)
  return encodeBase64(keyBytes)
}

/**
 * Imports and restores a user's encryption key from a base64-encoded string
 * This allows users to restore access to encrypted data after clearing browser data.
 * 
 * WARNING: This will overwrite any existing key for this user!
 * 
 * @param userId - The user's ID
 * @param keyBase64 - The base64-encoded encryption key to import
 */
export async function importEncryptionKey(userId: string, keyBase64: string): Promise<void> {
  // Decode the base64 key
  let keyBytes: Uint8Array
  try {
    keyBytes = decodeBase64(keyBase64)
  } catch (error) {
    throw new Error("Invalid key format. Please check your backup key.")
  }

  // Validate key length (should be 32 bytes = 256 bits)
  if (keyBytes.length !== 32) {
    throw new Error("Invalid key length. Expected 32 bytes.")
  }

  // Open IndexedDB
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
  })

  // Store the key in IndexedDB
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite")
    const store = transaction.objectStore(STORE_NAME)
    const request = store.put(keyBytes.buffer, userId)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
  
  // Clear the cache so the new key will be loaded on next access
  keyCache.delete(userId)
}
