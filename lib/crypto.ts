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

/**
 * Gets or creates a stable encryption key for the user
 * This key is stored in IndexedDB and persists across sessions
 * The key is unique per user and never sent to the server
 */
async function getUserEncryptionKey(userId: string): Promise<CryptoKey> {
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

  // Try to get existing key
  const existingKey = await new Promise<ArrayBuffer | null>((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readonly")
    const store = transaction.objectStore(STORE_NAME)
    const request = store.get(userId)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result || null)
  })

  if (existingKey) {
    // Import existing key
    return crypto.subtle.importKey(
      "raw",
      existingKey,
      { name: "PBKDF2" },
      false,
      ["deriveBits", "deriveKey"]
    )
  }

  // Generate new key (32 bytes = 256 bits)
  const keyMaterial = crypto.getRandomValues(new Uint8Array(32))

  // Store the key in IndexedDB
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite")
    const store = transaction.objectStore(STORE_NAME)
    const request = store.put(keyMaterial.buffer, userId)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })

  // Import the new key
  return crypto.subtle.importKey(
    "raw",
    keyMaterial.buffer,
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  )
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
    return encodeBase64(combined)
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
      return encryptedMessage
    }

    // Check if we have enough data (at least 28 bytes: 16 salt + 12 IV)
    if (combined.length < 28) {
      return encryptedMessage
    }

    // Extract salt (first 16 bytes), IV (next 12 bytes), and encrypted data (rest)
    // Create new Uint8Arrays to ensure proper typing
    const salt = new Uint8Array(combined.slice(0, 16))
    const iv = new Uint8Array(combined.slice(16, 28))
    const encryptedData = combined.slice(28)

    // Derive the decryption key using the stored salt
    const key = await deriveEncryptionKey(keyMaterial, salt)

    // Decrypt the message
    const decryptedData = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      key,
      encryptedData
    )

    return new TextDecoder().decode(decryptedData)
  } catch (error) {
    // If decryption fails, it might be an unencrypted message (backward compatibility)
    // or a corrupted message - return the original
    console.warn("Decryption failed, returning original message (may be unencrypted):", error)
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
}
