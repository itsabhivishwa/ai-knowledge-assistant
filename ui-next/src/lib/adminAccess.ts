import { promises as fs } from "fs";
import path from "path";

export type AdminRole = "admin";

export interface AdminRecord {
  email: string;
  role: AdminRole;
  addedAt: string;
  addedBy: string;
}

const adminStorePath = path.join(process.cwd(), "data", "admin-access.json");
const auditLogPath = path.join(process.cwd(), "data", "admin-audit.log");

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const parseEmailList = (value?: string) =>
  (value || "")
    .split(",")
    .map(normalizeEmail)
    .filter(Boolean);

const bootstrapAdmins = () => {
  const explicitSuperAdmins = parseEmailList(process.env.SUPER_ADMIN_EMAILS);
  const legacyAdmins = parseEmailList(process.env.ADMIN_EMAILS || process.env.NEXT_PUBLIC_ADMIN_EMAILS);
  return Array.from(new Set([...explicitSuperAdmins, ...legacyAdmins]));
};

async function readStoredAdmins(): Promise<AdminRecord[]> {
  try {
    const raw = await fs.readFile(adminStorePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((record): AdminRecord => ({
        email: normalizeEmail(String(record.email || "")),
        role: "admin",
        addedAt: String(record.addedAt || new Date().toISOString()),
        addedBy: String(record.addedBy || "unknown"),
      }))
      .filter((record) => record.email);
  } catch (error: unknown) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
}

async function writeStoredAdmins(records: AdminRecord[]) {
  await fs.mkdir(path.dirname(adminStorePath), { recursive: true });
  await fs.writeFile(adminStorePath, JSON.stringify(records, null, 2), "utf8");
}

export async function listAdminRecords(): Promise<AdminRecord[]> {
  const storedAdmins = await readStoredAdmins();
  const merged = new Map<string, AdminRecord>();

  for (const record of storedAdmins) {
    merged.set(record.email, record);
  }

  for (const email of bootstrapAdmins()) {
    merged.set(email, {
      email,
      role: "admin",
      addedAt: "bootstrap",
      addedBy: "env",
    });
  }

  return Array.from(merged.values()).sort((a, b) => a.email.localeCompare(b.email));
}

export async function getAdminRole(email?: string | null): Promise<AdminRole | null> {
  if (!email) return null;
  const normalizedEmail = normalizeEmail(email);
  const admins = await listAdminRecords();
  return admins.find((admin) => admin.email === normalizedEmail)?.role || null;
}

export async function upsertAdmin(email: string, actorEmail: string) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    throw new Error("Valid email is required.");
  }

  const storedAdmins = await readStoredAdmins();
  const existingIndex = storedAdmins.findIndex((admin) => admin.email === normalizedEmail);
  const record: AdminRecord = {
    email: normalizedEmail,
    role: "admin",
    addedAt: new Date().toISOString(),
    addedBy: normalizeEmail(actorEmail),
  };

  if (existingIndex >= 0) storedAdmins[existingIndex] = record;
  else storedAdmins.push(record);

  await writeStoredAdmins(storedAdmins);
  await appendAdminAudit("upsert", normalizedEmail, "admin", actorEmail);
  return record;
}

export async function removeAdmin(email: string, actorEmail: string) {
  const normalizedEmail = normalizeEmail(email);
  const actor = normalizeEmail(actorEmail);
  if (normalizedEmail === actor) {
    throw new Error("You cannot remove your own admin access.");
  }

  const storedAdmins = await readStoredAdmins();
  const filteredAdmins = storedAdmins.filter((admin) => admin.email !== normalizedEmail);
  await writeStoredAdmins(filteredAdmins);
  await appendAdminAudit("remove", normalizedEmail, "admin", actorEmail);
}

async function appendAdminAudit(action: string, targetEmail: string, role: AdminRole, actorEmail: string) {
  await fs.mkdir(path.dirname(auditLogPath), { recursive: true });
  const entry = JSON.stringify({
    action,
    targetEmail,
    role,
    actorEmail: normalizeEmail(actorEmail),
    timestamp: new Date().toISOString(),
  });
  await fs.appendFile(auditLogPath, `${entry}\n`, "utf8");
}
