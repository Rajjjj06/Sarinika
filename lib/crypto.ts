/**
 * Encryption utilities for chat messages
 * Uses Web Crypto API with AES-GCM for authenticated encryption
 * Keys are derived from the user's Firebase Auth token
 */

/**
 * Derives an encryption key from the user's Firebase Auth token
 * This ensures only the authenticated user can decrypt their messages
 */
async function deriveKeyFromToken(userId: string, token: string): Promise<CryptoKey> {
  // Combine userId and token for key derivation
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`${userId}:${token}`),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  )

  // Derive a 256-bit key using PBKDF2
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode("serenica-chat-encryption-salt"), // Fixed salt for consistency
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
 * Gets the current user's Firebase Auth token
 */
async function getAuthToken(): Promise<string> {
  const { auth } = await import("@/lib/firebase")
  const user = auth.currentUser
  if (!user) {
    throw new Error("User not authenticated")
  }
  return user.getIdToken()
}

/**
 * Encrypts a message using AES-GCM
 * Returns base64-encoded encrypted data with IV prepended
 */
export async function encryptMessage(message: string, userId: string): Promise<string> {
  if (!message) return message

  try {
    const token = await getAuthToken()
    const key = await deriveKeyFromToken(userId, token)

    // Generate a random IV (Initialization Vector) for each encryption
    const iv = crypto.getRandomValues(new Uint8Array(12)) // 12 bytes for GCM

    // Encrypt the message
    const encryptedData = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      key,
      new TextEncoder().encode(message)
    )

    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encryptedData.byteLength)
    combined.set(iv, 0)
    combined.set(new Uint8Array(encryptedData), iv.length)

    // Convert to base64 for storage - use a safer method for large arrays
    let binaryString = ""
    for (let i = 0; i < combined.length; i++) {
      binaryString += String.fromCharCode(combined[i])
    }
    return btoa(binaryString)
  } catch (error) {
    console.error("Encryption error:", error)
    throw new Error("Failed to encrypt message")
  }
}

/**
 * Checks if a string appears to be encrypted (valid base64 and long enough)
 */
function isLikelyEncrypted(content: string): boolean {
  if (!content || content.length < 20) return false
  
  // Base64 strings only contain A-Z, a-z, 0-9, +, /, and = (for padding)
  // They also have a length that's a multiple of 4 (after padding)
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/
  
  // Check if it matches base64 pattern and is long enough
  if (!base64Regex.test(content)) return false
  
  // Try to decode - if it fails, it's not valid base64
  try {
    const decoded = atob(content)
    // Encrypted content should be at least 12 bytes (IV) + some encrypted data
    return decoded.length >= 12
  } catch {
    return false
  }
}

/**
 * Decrypts a message using AES-GCM
 * Expects base64-encoded encrypted data with IV prepended
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
    const token = await getAuthToken()
    const key = await deriveKeyFromToken(userId, token)

    // Decode from base64 - use a safer method that handles all characters
    let combined: Uint8Array
    try {
      // Use a more robust base64 decoding
      const binaryString = atob(encryptedMessage)
      combined = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        combined[i] = binaryString.charCodeAt(i)
      }
    } catch (error) {
      // If base64 decoding fails, it's not encrypted
      return encryptedMessage
    }

    // Check if we have enough data (at least 12 bytes for IV)
    if (combined.length < 12) {
      return encryptedMessage
    }

    // Extract IV (first 12 bytes) and encrypted data (rest)
    const iv = combined.slice(0, 12)
    const encryptedData = combined.slice(12)

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


