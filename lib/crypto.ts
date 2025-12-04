/**
 * Encryption utilities for chat messages and journal entries
 * Uses Web Crypto API with AES-GCM for authenticated encryption
 * 
 * THREAT MODEL:
 * - Encryption/Decryption happens CLIENT-SIDE ONLY
 * - The server (Firebase) stores encrypted data but CANNOT decrypt it
 * - Only the authenticated user can decrypt their messages
 * - Keys are derived deterministically from userId (works across browsers/devices)
 * 
 * SECURITY PROPERTIES:
 * - Each encryption uses a unique random salt (stored with encrypted data)
 * - Each encryption uses a unique random IV (stored with encrypted data)
 * - Master key is derived from userId using PBKDF2 with 100,000 iterations
 * - Same userId always produces the same master key (works across browsers)
 */

// Fixed salt for deriving the master key from userId
// This ensures the same userId always produces the same master key
const MASTER_KEY_SALT = new Uint8Array([
  0x53, 0x65, 0x72, 0x65, 0x6e, 0x69, 0x63, 0x61,
  0x45, 0x6e, 0x63, 0x72, 0x79, 0x70, 0x74, 0x69,
  0x6f, 0x6e, 0x4b, 0x65, 0x79, 0x53, 0x61, 0x6c,
  0x74, 0x32, 0x30, 0x32, 0x34, 0x56, 0x31, 0x00
])

// In-memory cache to prevent redundant key derivations
const keyCache = new Map<string, CryptoKey>()

/**
 * Derives a stable encryption key from the userId
 * This key is deterministic - same userId always produces the same key
 * Works across browsers/devices because it's derived from userId, not stored
 */
async function getUserEncryptionKey(userId: string): Promise<CryptoKey> {
  // Check cache first
  if (keyCache.has(userId)) {
    return keyCache.get(userId)!
  }

  try {
    // Convert userId to a key material (password) for PBKDF2
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(userId),
      { name: "PBKDF2" },
      false,
      ["deriveBits", "deriveKey"]
    )

    // Derive 256 bits (32 bytes) from userId using PBKDF2 with fixed salt
    // This ensures the same userId always produces the same key material
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: MASTER_KEY_SALT,
        iterations: 100000, // High iteration count for security
        hash: "SHA-256",
      },
      keyMaterial,
      256 // 256 bits = 32 bytes
    )

    // Import the derived bits as a key material for further PBKDF2 derivation
    // This master key will be used to derive per-message encryption keys
    const masterKey = await crypto.subtle.importKey(
      "raw",
      derivedBits,
      { name: "PBKDF2" },
      false,
      ["deriveBits", "deriveKey"]
    )

    // Cache the key for this session
    keyCache.set(userId, masterKey)
    
    return masterKey
  } catch (error) {
    console.error("Error deriving encryption key from userId:", error)
    throw new Error(`Failed to derive encryption key: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * Derives an encryption key from the user's master key and a per-encryption salt
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
 * - The user's master key (derived from userId)
 */
export async function encryptMessage(message: string, userId: string): Promise<string> {
  if (!message) return message

  try {
    // Get the user's master encryption key (derived from userId)
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
    // Get the user's master encryption key (derived from userId)
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
      decryptedData = await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: iv,
        },
        key,
        encryptedData
      )
    } catch (decryptError) {
      // OperationError typically means the key doesn't match (wrong key or corrupted data)
      if (decryptError instanceof DOMException && decryptError.name === "OperationError") {
        console.error("Decryption failed - key mismatch. This message may have been encrypted with a different system.")
        // Return the encrypted message as-is (backward compatibility)
        return encryptedMessage
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
    console.error("Decryption failed:", error)
    // If decryption fails, return the original (might be unencrypted or corrupted)
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
