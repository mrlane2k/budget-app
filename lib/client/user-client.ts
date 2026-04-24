import { ClientRequestError } from "@/lib/client/errors";
import { isTauriDesktopRuntime, request } from "@/lib/client/transport";

export interface SetupStatus {
  setupRequired?: boolean;
}

export interface VaultStatus {
  passphraseEnabled: boolean;
  unlocked: boolean;
  setupRequired: boolean | null;
  legacyImportAvailable: boolean;
}

export interface UserSettings {
  id: number;
  username: string;
  pay_cycle: string;
  last_paycheck_date: string | null;
  monthly_income: number;
  current_savings: number;
  extra_cc_payment?: number;
  created_at?: string;
}

type SuccessResponse = {
  success: true;
  message?: string;
};

type LoginResponse = SuccessResponse & {
  username: string;
};

type SetupResponse = SuccessResponse & {
  user: UserSettings;
};

type LegacyImportResponse = SuccessResponse & {
  importedUsers: number;
  importedAccounts: number;
  importedBills: number;
  importedBillPayments: number;
  importedCreditCards?: number;
  importedCreditCardTransactions?: number;
  importedTransfers?: number;
  importedCashTransactions?: number;
  importedMonthlyBudgets?: number;
  importedMonthlyCloses?: number;
  archivedLegacyDatabase?: boolean;
};

async function requireDesktopRuntime(): Promise<void> {
  if (!await isTauriDesktopRuntime()) {
    throw new ClientRequestError("Vault controls are only available in the desktop app.");
  }
}

export async function getSetupStatus(): Promise<SetupStatus> {
  return request<SetupStatus>({
    path: "/api/setup/status",
    tauriCommand: "get_setup_status",
  });
}

export async function getVaultStatus(): Promise<VaultStatus> {
  if (!await isTauriDesktopRuntime()) {
    return {
      passphraseEnabled: false,
      unlocked: true,
      setupRequired: null,
      legacyImportAvailable: false,
    };
  }

  return request<VaultStatus>({
    path: "/api/desktop/vault/status",
    tauriCommand: "get_vault_status",
  });
}

export async function unlockVault(input: {
  passphrase: string;
}): Promise<VaultStatus> {
  await requireDesktopRuntime();
  return request<VaultStatus>({
    path: "/api/desktop/vault/unlock",
    method: "POST",
    body: input,
    tauriCommand: "unlock_vault",
    tauriArgs: input,
  });
}

export async function lockVault(): Promise<SuccessResponse> {
  await requireDesktopRuntime();
  return request<SuccessResponse>({
    path: "/api/desktop/vault/lock",
    method: "POST",
    tauriCommand: "lock_vault",
  });
}

export async function createInitialUser(input: {
  username: string;
  password: string;
}): Promise<SetupResponse> {
  return request<SetupResponse>({
    path: "/api/setup",
    method: "POST",
    body: input,
    tauriCommand: "create_initial_user",
    tauriArgs: input,
  });
}

export async function login(input: {
  username: string;
  password: string;
}): Promise<LoginResponse> {
  return request<LoginResponse>({
    path: "/api/auth/login",
    method: "POST",
    body: input,
    tauriCommand: "login",
    tauriArgs: input,
  });
}

export async function logout(): Promise<SuccessResponse> {
  return request<SuccessResponse>({
    path: "/api/auth/logout",
    method: "POST",
    tauriCommand: "logout",
  });
}

export async function getSettings(): Promise<UserSettings> {
  return request<UserSettings>({
    path: "/api/settings",
    tauriCommand: "get_settings",
  });
}

export async function updateSettings(input: {
  pay_cycle: string;
  last_paycheck_date: string;
  monthly_income: number;
  current_savings: number;
}): Promise<UserSettings> {
  return request<UserSettings>({
    path: "/api/settings",
    method: "PUT",
    body: input,
    tauriCommand: "update_settings",
    tauriArgs: input,
  });
}

export async function changePassword(input: {
  current_password: string;
  new_password: string;
}): Promise<SuccessResponse> {
  return request<SuccessResponse>({
    path: "/api/settings",
    method: "PUT",
    body: input,
    tauriCommand: "change_password",
    tauriArgs: input,
  });
}

export async function setVaultPassphrase(input: {
  account_password: string;
  passphrase: string;
}): Promise<SuccessResponse> {
  await requireDesktopRuntime();
  return request<SuccessResponse>({
    path: "/api/desktop/vault/passphrase",
    method: "POST",
    body: input,
    tauriCommand: "set_vault_passphrase",
    tauriArgs: input,
  });
}

export async function changeVaultPassphrase(input: {
  current_passphrase: string;
  new_passphrase: string;
}): Promise<SuccessResponse> {
  await requireDesktopRuntime();
  return request<SuccessResponse>({
    path: "/api/desktop/vault/passphrase",
    method: "PUT",
    body: input,
    tauriCommand: "change_vault_passphrase",
    tauriArgs: input,
  });
}

export async function clearVaultPassphrase(input: {
  current_passphrase: string;
}): Promise<SuccessResponse> {
  await requireDesktopRuntime();
  return request<SuccessResponse>({
    path: "/api/desktop/vault/passphrase",
    method: "DELETE",
    body: input,
    tauriCommand: "clear_vault_passphrase",
    tauriArgs: input,
  });
}

export async function importLegacyDatabase(): Promise<LegacyImportResponse> {
  await requireDesktopRuntime();
  return request<LegacyImportResponse>({
    path: "/api/desktop/vault/import",
    method: "POST",
    tauriCommand: "import_legacy_database",
  });
}

export async function rotateDatabaseKey(input?: {
  current_passphrase?: string;
}): Promise<SuccessResponse> {
  await requireDesktopRuntime();
  return request<SuccessResponse>({
    path: "/api/desktop/vault/rekey",
    method: "POST",
    body: input,
    tauriCommand: "rotate_database_key",
    tauriArgs: input ?? {},
  });
}
