import crypto from "node:crypto";

export const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

export const signPayload = (payload, secret) => {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
};

export const verifySignedPayload = (token, secret) => {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  const expected = crypto.createHmac("sha256", secret).update(encoded).digest("base64url");
  if (signature.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;

  return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
};
