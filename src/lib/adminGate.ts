const DEVICE_ID_KEY = "zxmax_admin_device_id";
const DEVICE_TOKEN_KEY = "zxmax_admin_device_token";
const DEVICE_EXPIRES_KEY = "zxmax_admin_device_expires";

export const ADMIN_CONFIRM_EMAIL = "e-mail do administrador"; // real e-mail configurado apenas no servidor (admin-login)

export function getOrCreateDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (id && id.length >= 8) return id;
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  } catch {
    return "fallback-device";
  }
}

export function readTrustedDevice(): { deviceId: string; deviceToken: string; expiresAt: number } | null {
  try {
    const deviceId = localStorage.getItem(DEVICE_ID_KEY) || "";
    const deviceToken = localStorage.getItem(DEVICE_TOKEN_KEY) || "";
    const expiresAt = Number(localStorage.getItem(DEVICE_EXPIRES_KEY) || 0);
    if (!deviceId || !deviceToken || !expiresAt || expiresAt < Date.now()) return null;
    return { deviceId, deviceToken, expiresAt };
  } catch {
    return null;
  }
}

export function saveTrustedDevice(deviceToken: string, expiresAt: string | number) {
  try {
    getOrCreateDeviceId();
    localStorage.setItem(DEVICE_TOKEN_KEY, deviceToken);
    localStorage.setItem(DEVICE_EXPIRES_KEY, String(typeof expiresAt === "number" ? expiresAt : new Date(expiresAt).getTime()));
  } catch {}
}

export function clearTrustedDevice() {
  try {
    localStorage.removeItem(DEVICE_TOKEN_KEY);
    localStorage.removeItem(DEVICE_EXPIRES_KEY);
  } catch {}
}

function bufToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let str = "";
  bytes.forEach((b) => {
    str += String.fromCharCode(b);
  });
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function webAuthnEnroll(userId: string, displayName: string): Promise<string> {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: "ZXMAX Admin", id: window.location.hostname },
      user: {
        id: new TextEncoder().encode(userId).slice(0, 64),
        name: displayName,
        displayName,
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred",
      },
      timeout: 90_000,
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error("Não foi possível usar a senha do celular.");
  return bufToB64(cred.rawId);
}

export async function webAuthnAssert(credentialIds: string[]): Promise<string> {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const allow = credentialIds
    .map((id) => {
      try {
        const pad = id.replace(/-/g, "+").replace(/_/g, "/");
        const bin = atob(pad + "===".slice((pad.length + 3) % 4));
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return { type: "public-key" as const, id: bytes };
      } catch {
        return null;
      }
    })
    .filter(Boolean) as PublicKeyCredentialDescriptor[];

  const cred = (await navigator.credentials.get({
    publicKey: {
      challenge,
      timeout: 90_000,
      userVerification: "required",
      allowCredentials: allow.length ? allow : undefined,
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error("Confirmação cancelada.");
  return bufToB64(cred.rawId);
}

export function webAuthnAvailable(): boolean {
  return typeof window !== "undefined" && !!window.PublicKeyCredential;
}
