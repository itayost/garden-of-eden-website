import crypto from "crypto";

interface DecryptedRequest {
  decryptedData: Record<string, unknown>;
  aesKeyBuffer: Buffer;
  initialVectorBuffer: Buffer;
}

export function decryptFlowRequest(
  body: {
    encrypted_aes_key: string;
    encrypted_flow_data: string;
    initial_vector: string;
  },
  privateKeyPem: string
): DecryptedRequest {
  const privateKey = crypto.createPrivateKey({
    key: privateKeyPem,
    format: "pem",
  });

  // Decrypt AES key with RSA-OAEP
  const encryptedAesKey = Buffer.from(body.encrypted_aes_key, "base64");
  const aesKeyBuffer = crypto.privateDecrypt(
    {
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    encryptedAesKey
  );

  // Decrypt flow data with AES-128-GCM
  const encryptedFlowData = Buffer.from(body.encrypted_flow_data, "base64");
  const initialVectorBuffer = Buffer.from(body.initial_vector, "base64");

  // Last 16 bytes are the GCM auth tag
  const TAG_LENGTH = 16;
  const encrypted = encryptedFlowData.subarray(0, -TAG_LENGTH);
  const authTag = encryptedFlowData.subarray(-TAG_LENGTH);

  const decipher = crypto.createDecipheriv(
    "aes-128-gcm",
    aesKeyBuffer,
    initialVectorBuffer
  );
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
  const decryptedData = JSON.parse(decrypted.toString("utf-8"));

  return { decryptedData, aesKeyBuffer, initialVectorBuffer };
}

export function encryptFlowResponse(
  data: Record<string, unknown>,
  aesKeyBuffer: Buffer,
  initialVectorBuffer: Buffer
): string {
  // Flip IV — bitwise NOT each byte
  const flippedIV = Buffer.alloc(initialVectorBuffer.length);
  for (let i = 0; i < initialVectorBuffer.length; i++) {
    flippedIV[i] = ~initialVectorBuffer[i] & 0xff;
  }

  const plaintext = JSON.stringify(data);
  const cipher = crypto.createCipheriv("aes-128-gcm", aesKeyBuffer, flippedIV);
  const encryptedBuffer = Buffer.concat([
    cipher.update(plaintext, "utf-8"),
    cipher.final(),
    cipher.getAuthTag(),
  ]);

  return encryptedBuffer.toString("base64");
}
