const DEVICE_ID_KEY = "zxmax_admin_device_id";
const DEVICE_TOKEN_KEY = "zxmax_admin_device_token";
const DEVICE_EXPIRES_KEY = "zxmax_admin_device_expires";

export const ADMIN_CONFIRM_EMAIL = "jnpereiraalves@gmail.com";

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
