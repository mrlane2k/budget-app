use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use bcrypt::{hash, verify, DEFAULT_COST};
use keyring::{Entry, Error as KeyringError};
use pbkdf2::pbkdf2_hmac;
use rand::{rngs::OsRng, RngCore};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use tauri::{AppHandle, Manager, State};

pub type CommandResult<T> = Result<T, String>;

const DEFAULT_PAY_CYCLE: &str = "bi-weekly";
const KEYRING_SERVICE: &str = "org.laneworks.budgetapp";
const DB_KEY_ENTRY: &str = "database-encryption-key";
const VAULT_ENVELOPE_ENTRY: &str = "vault-envelope";
const LEGACY_PLAINTEXT_DB_FILENAME: &str = "budget-app.sqlite";
const DB_FILENAME: &str = "budget-app-encrypted.sqlite";
const PBKDF2_ITERATIONS: u32 = 600_000;
const MINIMUM_VAULT_PASSPHRASE_LENGTH: usize = 8;

#[derive(Clone)]
pub struct SessionUser {
    user_id: i64,
    username: String,
}

pub struct DesktopState {
    db_path: PathBuf,
    legacy_db_path: PathBuf,
    session: Mutex<Option<SessionUser>>,
    cached_database_key: Mutex<Option<Vec<u8>>>,
}

impl DesktopState {
    pub fn new(app: &AppHandle) -> CommandResult<Self> {
        let app_data_dir = app
            .path()
            .app_data_dir()
            .map_err(|error| format!("Failed to resolve app data directory: {error}"))?;

        fs::create_dir_all(&app_data_dir)
            .map_err(|error| format!("Failed to create app data directory: {error}"))?;

        let db_path = app_data_dir.join(DB_FILENAME);
        let state = Self {
            db_path,
            legacy_db_path: app_data_dir.join(LEGACY_PLAINTEXT_DB_FILENAME),
            session: Mutex::new(None),
            cached_database_key: Mutex::new(None),
        };

        if !state.is_vault_passphrase_enabled()? {
            state.initialize()?;
        }
        Ok(state)
    }

    fn initialize(&self) -> CommandResult<()> {
        let connection = self.open_connection()?;
        connection
            .execute_batch(
                "
        PRAGMA foreign_keys = ON;
        PRAGMA journal_mode = WAL;

        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          pay_cycle TEXT NOT NULL DEFAULT 'bi-weekly',
          last_paycheck_date TEXT,
          monthly_income REAL NOT NULL DEFAULT 0,
          current_savings REAL NOT NULL DEFAULT 0,
          extra_cc_payment REAL NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS accounts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          institution_name TEXT,
          account_type TEXT NOT NULL,
          account_purpose TEXT NOT NULL,
          current_balance REAL NOT NULL DEFAULT 0,
          is_manual INTEGER NOT NULL DEFAULT 1,
          is_active INTEGER NOT NULL DEFAULT 1,
          plaid_account_id TEXT,
          last_four TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS bills (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          category TEXT,
          amount REAL NOT NULL,
          due_day INTEGER NOT NULL DEFAULT 1,
          due_date TEXT,
          is_autopay INTEGER NOT NULL DEFAULT 0,
          active INTEGER NOT NULL DEFAULT 1,
          frequency TEXT NOT NULL DEFAULT 'monthly',
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS bill_payments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          bill_id INTEGER NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
          year INTEGER NOT NULL,
          month INTEGER NOT NULL,
          status TEXT NOT NULL DEFAULT 'unpaid',
          amount_paid REAL,
          paid_at TEXT,
          UNIQUE (bill_id, year, month)
        );

        CREATE TABLE IF NOT EXISTS credit_cards (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          balance REAL NOT NULL DEFAULT 0,
          credit_limit REAL NOT NULL DEFAULT 0,
          minimum_payment REAL NOT NULL DEFAULT 0,
          apr REAL NOT NULL DEFAULT 0,
          due_day INTEGER NOT NULL DEFAULT 1,
          last_four TEXT,
          active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS credit_card_transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          card_id INTEGER NOT NULL REFERENCES credit_cards(id) ON DELETE CASCADE,
          type TEXT NOT NULL,
          amount REAL NOT NULL,
          note TEXT,
          category TEXT,
          merchant_name TEXT,
          source_account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
          transaction_date TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS transfer_groups (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          transfer_date TEXT NOT NULL,
          from_account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
          to_account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
          amount REAL NOT NULL,
          notes TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS cash_transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
          transaction_date TEXT NOT NULL,
          amount REAL NOT NULL,
          direction TEXT NOT NULL,
          category TEXT,
          merchant_name TEXT,
          description TEXT NOT NULL,
          transaction_kind TEXT NOT NULL,
          linked_bill_id INTEGER REFERENCES bills(id) ON DELETE SET NULL,
          transfer_group_id INTEGER REFERENCES transfer_groups(id) ON DELETE SET NULL,
          notes TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_accounts_user_active
          ON accounts (user_id, is_active, account_purpose);

        CREATE INDEX IF NOT EXISTS idx_bills_user_active
          ON bills (user_id, active);

        CREATE INDEX IF NOT EXISTS idx_bill_payments_bill_period
          ON bill_payments (bill_id, year, month);

        CREATE INDEX IF NOT EXISTS idx_credit_cards_user_active
          ON credit_cards (user_id, active);

        CREATE INDEX IF NOT EXISTS idx_credit_card_transactions_card_date
          ON credit_card_transactions (card_id, transaction_date, id);

        CREATE INDEX IF NOT EXISTS idx_transfer_groups_user_date
          ON transfer_groups (user_id, transfer_date, id);

        CREATE INDEX IF NOT EXISTS idx_cash_transactions_user_date
          ON cash_transactions (user_id, transaction_date, id);

        CREATE INDEX IF NOT EXISTS idx_cash_transactions_account_date
          ON cash_transactions (account_id, transaction_date, id);
        ",
            )
            .map_err(|error| format!("Failed to initialize local database: {error}"))?;

        Ok(())
    }

    fn open_connection(&self) -> CommandResult<Connection> {
        let database_key = self.load_database_key_for_access()?;
        self.open_connection_with_key(&database_key)
    }

    fn current_session(&self) -> CommandResult<SessionUser> {
        let session = self
            .session
            .lock()
            .map_err(|_| "Failed to access desktop session.".to_string())?;

        session.clone().ok_or_else(|| "Unauthorized".to_string())
    }

    fn set_session(&self, user: Option<SessionUser>) -> CommandResult<()> {
        let mut session = self
            .session
            .lock()
            .map_err(|_| "Failed to update desktop session.".to_string())?;
        *session = user;
        Ok(())
    }

    fn open_connection_with_key(&self, database_key: &[u8]) -> CommandResult<Connection> {
        let connection = Connection::open(&self.db_path)
            .map_err(|error| format!("Failed to open local database: {error}"))?;

        apply_database_key(&connection, database_key)?;
        connection
            .execute("PRAGMA foreign_keys = ON", [])
            .map_err(|error| format!("Failed to enable foreign keys: {error}"))?;
        Ok(connection)
    }

    fn cached_database_key(&self) -> CommandResult<Option<Vec<u8>>> {
        let cached = self
            .cached_database_key
            .lock()
            .map_err(|_| "Failed to access vault state.".to_string())?;
        Ok(cached.clone())
    }

    fn set_cached_database_key(&self, database_key: Option<Vec<u8>>) -> CommandResult<()> {
        let mut cached = self
            .cached_database_key
            .lock()
            .map_err(|_| "Failed to update vault state.".to_string())?;
        *cached = database_key;
        Ok(())
    }

    fn is_vault_passphrase_enabled(&self) -> CommandResult<bool> {
        Ok(load_vault_envelope()?.is_some())
    }

    fn legacy_import_available(&self) -> bool {
        self.legacy_db_path.is_file()
    }

    fn load_database_key_for_access(&self) -> CommandResult<Vec<u8>> {
        if let Some(database_key) = self.cached_database_key()? {
            return Ok(database_key);
        }

        if self.is_vault_passphrase_enabled()? {
            return Err("Vault is locked. Unlock it with your vault passphrase.".to_string());
        }

        match load_raw_database_key()? {
            Some(database_key) => Ok(database_key),
            None => {
                if self.db_path.exists() {
                    return Err(
                        "The encrypted database key is missing from the OS credential store."
                            .to_string(),
                    );
                }

                let database_key = generate_database_key();
                store_raw_database_key(&database_key)?;
                Ok(database_key)
            }
        }
    }
}

fn get_database_key_entry() -> CommandResult<Entry> {
    Entry::new(KEYRING_SERVICE, DB_KEY_ENTRY)
        .map_err(|error| format!("Failed to create keychain entry for database key: {error}"))
}

fn get_vault_entry() -> CommandResult<Entry> {
    Entry::new(KEYRING_SERVICE, VAULT_ENVELOPE_ENTRY)
        .map_err(|error| format!("Failed to create keychain entry for vault metadata: {error}"))
}

fn generate_database_key() -> Vec<u8> {
    let mut secret = vec![0_u8; 32];
    OsRng.fill_bytes(&mut secret);
    secret
}

fn load_raw_database_key() -> CommandResult<Option<Vec<u8>>> {
    let entry = get_database_key_entry()?;

    match entry.get_secret() {
        Ok(secret) => {
            if secret.len() != 32 {
                return Err("Stored database encryption key is invalid.".to_string());
            }
            Ok(Some(secret))
        }
        Err(KeyringError::NoEntry) => Ok(None),
        Err(error) => Err(format!(
            "Failed to access database encryption key from the OS credential store: {error}"
        )),
    }
}

fn store_raw_database_key(secret: &[u8]) -> CommandResult<()> {
    let entry = get_database_key_entry()?;
    entry.set_secret(secret).map_err(|error| {
        format!("Failed to store database encryption key in the OS credential store: {error}")
    })?;
    Ok(())
}

fn delete_keyring_entry(entry: &Entry) -> CommandResult<()> {
    match entry.delete_credential() {
        Ok(()) | Err(KeyringError::NoEntry) => Ok(()),
        Err(error) => Err(format!("Failed to update the OS credential store: {error}")),
    }
}

#[derive(Clone, Serialize, Deserialize)]
struct VaultEnvelope {
    version: u8,
    iterations: u32,
    salt_hex: String,
    nonce_hex: String,
    ciphertext_hex: String,
}

fn load_vault_envelope() -> CommandResult<Option<VaultEnvelope>> {
    let entry = get_vault_entry()?;

    match entry.get_secret() {
        Ok(secret) => serde_json::from_slice::<VaultEnvelope>(&secret)
            .map(Some)
            .map_err(|error| format!("Stored vault metadata is invalid: {error}")),
        Err(KeyringError::NoEntry) => Ok(None),
        Err(error) => Err(format!(
            "Failed to access vault metadata from the OS credential store: {error}"
        )),
    }
}

fn store_vault_envelope(envelope: &VaultEnvelope) -> CommandResult<()> {
    let encoded = serde_json::to_vec(envelope)
        .map_err(|error| format!("Failed to encode vault metadata: {error}"))?;

    let entry = get_vault_entry()?;
    entry.set_secret(&encoded).map_err(|error| {
        format!("Failed to store vault metadata in the OS credential store: {error}")
    })?;
    Ok(())
}

fn hex_encode(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut output = String::with_capacity(bytes.len() * 2);

    for byte in bytes {
        output.push(HEX[(byte >> 4) as usize] as char);
        output.push(HEX[(byte & 0x0f) as usize] as char);
    }

    output
}

fn hex_decode(value: &str) -> CommandResult<Vec<u8>> {
    if value.len() % 2 != 0 {
        return Err("Invalid hex-encoded vault metadata.".to_string());
    }

    let mut decoded = Vec::with_capacity(value.len() / 2);
    let bytes = value.as_bytes();

    for index in (0..bytes.len()).step_by(2) {
        let high = decode_hex_nibble(bytes[index])?;
        let low = decode_hex_nibble(bytes[index + 1])?;
        decoded.push((high << 4) | low);
    }

    Ok(decoded)
}

fn decode_hex_nibble(byte: u8) -> CommandResult<u8> {
    match byte {
        b'0'..=b'9' => Ok(byte - b'0'),
        b'a'..=b'f' => Ok(byte - b'a' + 10),
        b'A'..=b'F' => Ok(byte - b'A' + 10),
        _ => Err("Invalid hex-encoded vault metadata.".to_string()),
    }
}

fn derive_wrapping_key(passphrase: &str, salt: &[u8], iterations: u32) -> [u8; 32] {
    let mut key = [0_u8; 32];
    pbkdf2_hmac::<Sha256>(passphrase.as_bytes(), salt, iterations, &mut key);
    key
}

fn create_vault_envelope(database_key: &[u8], passphrase: &str) -> CommandResult<VaultEnvelope> {
    let mut salt = [0_u8; 16];
    let mut nonce = [0_u8; 12];
    OsRng.fill_bytes(&mut salt);
    OsRng.fill_bytes(&mut nonce);

    let wrapping_key = derive_wrapping_key(passphrase, &salt, PBKDF2_ITERATIONS);
    let cipher = Aes256Gcm::new_from_slice(&wrapping_key)
        .map_err(|_| "Failed to prepare vault encryption.".to_string())?;
    let ciphertext = cipher
        .encrypt(Nonce::from_slice(&nonce), database_key)
        .map_err(|_| "Failed to wrap the database encryption key.".to_string())?;

    Ok(VaultEnvelope {
        version: 1,
        iterations: PBKDF2_ITERATIONS,
        salt_hex: hex_encode(&salt),
        nonce_hex: hex_encode(&nonce),
        ciphertext_hex: hex_encode(&ciphertext),
    })
}

fn unwrap_database_key(envelope: &VaultEnvelope, passphrase: &str) -> CommandResult<Vec<u8>> {
    let salt = hex_decode(&envelope.salt_hex)?;
    let nonce = hex_decode(&envelope.nonce_hex)?;
    let ciphertext = hex_decode(&envelope.ciphertext_hex)?;

    let wrapping_key = derive_wrapping_key(passphrase, &salt, envelope.iterations);
    let cipher = Aes256Gcm::new_from_slice(&wrapping_key)
        .map_err(|_| "Failed to prepare vault decryption.".to_string())?;

    let database_key = cipher
        .decrypt(Nonce::from_slice(&nonce), ciphertext.as_ref())
        .map_err(|_| "The vault passphrase is incorrect.".to_string())?;

    if database_key.len() != 32 {
        return Err("The decrypted database key is invalid.".to_string());
    }

    Ok(database_key)
}

fn validate_vault_passphrase(passphrase: &str) -> CommandResult<()> {
    if passphrase.trim().len() < MINIMUM_VAULT_PASSPHRASE_LENGTH {
        return Err(format!(
            "Vault passphrase must be at least {MINIMUM_VAULT_PASSPHRASE_LENGTH} characters."
        ));
    }

    Ok(())
}

fn apply_database_key(connection: &Connection, secret: &[u8]) -> CommandResult<()> {
    let hex_key = hex_encode(secret);
    connection
        .execute_batch(&format!("PRAGMA key = \"x'{hex_key}'\";"))
        .map_err(|error| format!("Failed to apply encrypted database key: {error}"))?;

    connection
        .query_row("SELECT count(*) FROM sqlite_master", [], |row| {
            row.get::<_, i64>(0)
        })
        .map_err(|error| format!("Encrypted database key verification failed: {error}"))?;

    Ok(())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SetupStatusResponse {
    setup_required: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultStatusResponse {
    passphrase_enabled: bool,
    unlocked: bool,
    setup_required: Option<bool>,
    legacy_import_available: bool,
}

#[derive(Serialize, Clone)]
pub struct UserSettingsResponse {
    id: i64,
    username: String,
    pay_cycle: String,
    last_paycheck_date: Option<String>,
    monthly_income: f64,
    current_savings: f64,
    extra_cc_payment: f64,
    created_at: String,
}

#[derive(Serialize)]
pub struct SetupResponse {
    success: bool,
    user: UserSettingsResponse,
}

#[derive(Serialize)]
pub struct LoginResponse {
    success: bool,
    username: String,
}

#[derive(Serialize)]
pub struct SuccessResponse {
    success: bool,
    message: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LegacyImportResponse {
    success: bool,
    imported_users: i64,
    imported_accounts: i64,
    imported_bills: i64,
    imported_bill_payments: i64,
    imported_credit_cards: i64,
    imported_credit_card_transactions: i64,
    imported_transfers: i64,
    imported_cash_transactions: i64,
}

#[derive(Serialize, Clone)]
pub struct BillResponse {
    id: i64,
    user_id: i64,
    name: String,
    category: Option<String>,
    amount: f64,
    due_day: i64,
    due_date: Option<String>,
    is_autopay: i64,
    active: i64,
    status: Option<String>,
    amount_paid: Option<f64>,
    paid_at: Option<String>,
    payment_id: Option<i64>,
    frequency: String,
}

#[derive(Serialize)]
pub struct BillPaymentResponse {
    id: i64,
    bill_id: i64,
    year: i64,
    month: i64,
    status: String,
    amount_paid: Option<f64>,
    paid_at: Option<String>,
}

#[derive(Serialize, Clone)]
pub struct CreditCardResponse {
    id: i64,
    user_id: i64,
    name: String,
    balance: f64,
    credit_limit: f64,
    minimum_payment: f64,
    apr: f64,
    due_day: i64,
    last_four: Option<String>,
    active: i64,
}

#[derive(Serialize, Clone)]
pub struct CreditCardTransactionResponse {
    id: i64,
    card_id: i64,
    #[serde(rename = "type")]
    entry_type: String,
    amount: f64,
    note: Option<String>,
    category: Option<String>,
    merchant_name: Option<String>,
    source_account_id: Option<i64>,
    transaction_date: String,
    created_at: String,
}

#[derive(Serialize, Clone)]
pub struct CreditCardLedgerResult {
    card: CreditCardResponse,
    transactions: Vec<CreditCardTransactionResponse>,
}

#[derive(Serialize, Clone)]
pub struct CreditCardPaymentSummaryItem {
    paid: bool,
    amount_paid: f64,
}

#[derive(Serialize, Clone)]
pub struct TrendPointResponse {
    month: String,
    label: String,
    value: f64,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TrendsResponse {
    months: i64,
    bills_paid_by_month: Vec<TrendPointResponse>,
    disposable_spending_by_month: Vec<TrendPointResponse>,
    savings_contributions_by_month: Vec<TrendPointResponse>,
    credit_card_purchases_by_month: Vec<TrendPointResponse>,
    credit_card_payments_by_month: Vec<TrendPointResponse>,
    credit_card_interest_by_month: Vec<TrendPointResponse>,
    net_outflow_by_month: Vec<TrendPointResponse>,
}

#[derive(Serialize, Clone)]
pub struct AccountResponse {
    id: i64,
    user_id: i64,
    name: String,
    institution_name: Option<String>,
    last_four: Option<String>,
    account_type: String,
    account_purpose: String,
    current_balance: f64,
    is_manual: i64,
    is_active: i64,
    plaid_account_id: Option<String>,
    created_at: String,
}

#[derive(Serialize, Clone)]
pub struct CashTransactionResponse {
    id: i64,
    user_id: i64,
    account_id: i64,
    account_name: String,
    account_purpose: String,
    transaction_date: String,
    amount: f64,
    direction: String,
    category: Option<String>,
    merchant_name: Option<String>,
    description: String,
    transaction_kind: String,
    linked_bill_id: Option<i64>,
    transfer_group_id: Option<i64>,
    notes: Option<String>,
    created_at: String,
}

#[derive(Serialize, Clone)]
pub struct TransferResponse {
    id: i64,
    user_id: i64,
    transfer_date: String,
    amount: f64,
    notes: Option<String>,
    from_account_id: i64,
    from_account_name: String,
    to_account_id: i64,
    to_account_name: String,
    created_at: String,
}

fn ensure_setup_not_complete(connection: &Connection) -> CommandResult<()> {
    let count: i64 = connection
        .query_row("SELECT COUNT(*) FROM users", [], |row| row.get(0))
        .map_err(|error| format!("Failed to check setup status: {error}"))?;

    if count > 0 {
        return Err("Setup has already been completed.".to_string());
    }

    Ok(())
}

fn fetch_user_by_username(
    connection: &Connection,
    username: &str,
) -> CommandResult<Option<(i64, String, String)>> {
    connection
        .query_row(
            "
      SELECT id, username, password_hash
      FROM users
      WHERE username = ?1
      ",
            [username],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .optional()
        .map_err(|error| format!("Failed to load local user: {error}"))
}

fn verify_account_password(
    connection: &Connection,
    username: &str,
    current_password: &str,
) -> CommandResult<()> {
    let user = fetch_user_by_username(connection, username)?
        .ok_or_else(|| "User not found".to_string())?;

    let is_valid = verify(current_password, &user.2)
        .map_err(|error| format!("Failed to verify local password: {error}"))?;
    if !is_valid {
        return Err("Current password is incorrect".to_string());
    }

    Ok(())
}

fn fetch_user_settings(
    connection: &Connection,
    user_id: i64,
) -> CommandResult<UserSettingsResponse> {
    connection
        .query_row(
            "
      SELECT
        id,
        username,
        pay_cycle,
        last_paycheck_date,
        monthly_income,
        current_savings,
        extra_cc_payment,
        created_at
      FROM users
      WHERE id = ?1
      ",
            [user_id],
            |row| {
                Ok(UserSettingsResponse {
                    id: row.get(0)?,
                    username: row.get(1)?,
                    pay_cycle: row.get(2)?,
                    last_paycheck_date: row.get(3)?,
                    monthly_income: row.get(4)?,
                    current_savings: row.get(5)?,
                    extra_cc_payment: row.get(6)?,
                    created_at: row.get(7)?,
                })
            },
        )
        .map_err(|error| format!("Failed to load local settings: {error}"))
}

fn create_default_accounts(
    connection: &Connection,
    user_id: i64,
    current_savings: f64,
) -> CommandResult<()> {
    let mut statement = connection
        .prepare(
            "
      INSERT INTO accounts (
        user_id,
        name,
        account_type,
        account_purpose,
        current_balance,
        is_manual,
        is_active
      )
      VALUES (?1, ?2, ?3, ?4, ?5, 1, 1)
      ",
        )
        .map_err(|error| format!("Failed to prepare default accounts: {error}"))?;

    let defaults = [
        ("Bills Checking", "checking", "bills", 0.0),
        ("Disposable Checking", "checking", "disposable", 0.0),
        ("Savings", "savings", "savings", current_savings),
    ];

    for (name, account_type, account_purpose, current_balance) in defaults {
        statement
            .execute(params![
                user_id,
                name,
                account_type,
                account_purpose,
                current_balance
            ])
            .map_err(|error| format!("Failed to create default account {name}: {error}"))?;
    }

    Ok(())
}

fn normalize_optional_date(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn normalize_optional_text(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn round_money(value: f64) -> f64 {
    (value * 100.0).round() / 100.0
}

fn map_bill_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<BillResponse> {
    Ok(BillResponse {
        id: row.get(0)?,
        user_id: row.get(1)?,
        name: row.get(2)?,
        category: row.get(3)?,
        amount: row.get(4)?,
        due_day: row.get(5)?,
        due_date: row.get(6)?,
        is_autopay: row.get(7)?,
        active: row.get(8)?,
        frequency: row.get(9)?,
        status: row.get(10)?,
        amount_paid: row.get(11)?,
        paid_at: row.get(12)?,
        payment_id: row.get(13)?,
    })
}

fn map_credit_card_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<CreditCardResponse> {
    Ok(CreditCardResponse {
        id: row.get(0)?,
        user_id: row.get(1)?,
        name: row.get(2)?,
        balance: row.get(3)?,
        credit_limit: row.get(4)?,
        minimum_payment: row.get(5)?,
        apr: row.get(6)?,
        due_day: row.get(7)?,
        last_four: row.get(8)?,
        active: row.get(9)?,
    })
}

fn map_credit_card_transaction_row(
    row: &rusqlite::Row<'_>,
) -> rusqlite::Result<CreditCardTransactionResponse> {
    Ok(CreditCardTransactionResponse {
        id: row.get(0)?,
        card_id: row.get(1)?,
        entry_type: row.get(2)?,
        amount: row.get(3)?,
        note: row.get(4)?,
        category: row.get(5)?,
        merchant_name: row.get(6)?,
        source_account_id: row.get(7)?,
        transaction_date: row.get(8)?,
        created_at: row.get(9)?,
    })
}

fn map_account_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<AccountResponse> {
    Ok(AccountResponse {
        id: row.get(0)?,
        user_id: row.get(1)?,
        name: row.get(2)?,
        institution_name: row.get(3)?,
        last_four: row.get(4)?,
        account_type: row.get(5)?,
        account_purpose: row.get(6)?,
        current_balance: row.get(7)?,
        is_manual: row.get(8)?,
        is_active: row.get(9)?,
        plaid_account_id: row.get(10)?,
        created_at: row.get(11)?,
    })
}

fn map_cash_transaction_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<CashTransactionResponse> {
    Ok(CashTransactionResponse {
        id: row.get(0)?,
        user_id: row.get(1)?,
        account_id: row.get(2)?,
        account_name: row.get(3)?,
        account_purpose: row.get(4)?,
        transaction_date: row.get(5)?,
        amount: row.get(6)?,
        direction: row.get(7)?,
        category: row.get(8)?,
        merchant_name: row.get(9)?,
        description: row.get(10)?,
        transaction_kind: row.get(11)?,
        linked_bill_id: row.get(12)?,
        transfer_group_id: row.get(13)?,
        notes: row.get(14)?,
        created_at: row.get(15)?,
    })
}

fn map_transfer_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<TransferResponse> {
    Ok(TransferResponse {
        id: row.get(0)?,
        user_id: row.get(1)?,
        transfer_date: row.get(2)?,
        amount: row.get(3)?,
        notes: row.get(4)?,
        from_account_id: row.get(5)?,
        from_account_name: row.get(6)?,
        to_account_id: row.get(7)?,
        to_account_name: row.get(8)?,
        created_at: row.get(9)?,
    })
}

fn signed_amount(direction: &str, amount: f64) -> f64 {
    if direction == "inflow" {
        amount
    } else {
        -amount
    }
}

fn build_month_label(year: i64, month: i64) -> String {
    const MONTH_NAMES: [&str; 12] = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];

    let label = MONTH_NAMES
        .get(month.saturating_sub(1) as usize)
        .copied()
        .unwrap_or("Mon");
    format!("{label} {year}")
}

fn read_setup_required(connection: &Connection) -> CommandResult<bool> {
    let count: i64 = connection
        .query_row("SELECT COUNT(*) FROM users", [], |row| row.get(0))
        .map_err(|error| format!("Failed to check local setup status: {error}"))?;

    Ok(count == 0)
}

fn build_vault_status(state: &DesktopState) -> CommandResult<VaultStatusResponse> {
    let passphrase_enabled = state.is_vault_passphrase_enabled()?;
    let unlocked = if passphrase_enabled {
        state.cached_database_key()?.is_some()
    } else {
        true
    };

    let setup_required = if passphrase_enabled && !unlocked {
        None
    } else {
        Some(read_setup_required(&state.open_connection()?)?)
    };

    Ok(VaultStatusResponse {
        passphrase_enabled,
        unlocked,
        setup_required,
        legacy_import_available: state.legacy_import_available(),
    })
}

fn enable_vault_passphrase_with_key(
    state: &DesktopState,
    database_key: &[u8],
    passphrase: &str,
) -> CommandResult<()> {
    let envelope = create_vault_envelope(database_key, passphrase)?;
    store_vault_envelope(&envelope)?;
    delete_keyring_entry(&get_database_key_entry()?)?;
    state.set_cached_database_key(Some(database_key.to_vec()))?;
    Ok(())
}

fn disable_vault_passphrase_with_key(
    state: &DesktopState,
    database_key: &[u8],
) -> CommandResult<()> {
    store_raw_database_key(database_key)?;
    delete_keyring_entry(&get_vault_entry()?)?;
    state.set_cached_database_key(None)?;
    Ok(())
}

fn rotate_database_encryption_key_with_current_key(
    state: &DesktopState,
    current_database_key: &[u8],
    vault_passphrase: Option<&str>,
) -> CommandResult<()> {
    let connection = state.open_connection_with_key(current_database_key)?;
    let new_database_key = generate_database_key();
    let new_database_key_hex = hex_encode(&new_database_key);

    connection
        .execute_batch(&format!("PRAGMA rekey = \"x'{new_database_key_hex}'\";"))
        .map_err(|error| format!("Failed to rotate the encrypted database key: {error}"))?;

    if let Some(passphrase) = vault_passphrase {
        enable_vault_passphrase_with_key(state, &new_database_key, passphrase)?;
    } else {
        store_raw_database_key(&new_database_key)?;
        state.set_cached_database_key(None)?;
    }

    state.open_connection_with_key(&new_database_key)?;
    Ok(())
}

fn copy_legacy_users(source: &Connection, destination: &Connection) -> CommandResult<i64> {
    let mut select = source
        .prepare(
            "
      SELECT
        id,
        username,
        password_hash,
        pay_cycle,
        last_paycheck_date,
        monthly_income,
        current_savings,
        extra_cc_payment,
        created_at
      FROM users
      ORDER BY id
      ",
        )
        .map_err(|error| format!("Failed to read legacy users: {error}"))?;

    let rows = select
        .query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, Option<String>>(4)?,
                row.get::<_, f64>(5)?,
                row.get::<_, f64>(6)?,
                row.get::<_, f64>(7)?,
                row.get::<_, String>(8)?,
            ))
        })
        .map_err(|error| format!("Failed to map legacy users: {error}"))?;

    let mut count = 0;
    for row in rows {
        let (
            id,
            username,
            password_hash,
            pay_cycle,
            last_paycheck_date,
            monthly_income,
            current_savings,
            extra_cc_payment,
            created_at,
        ) = row.map_err(|error| format!("Failed to read legacy user row: {error}"))?;
        destination
            .execute(
                "
        INSERT INTO users (
          id,
          username,
          password_hash,
          pay_cycle,
          last_paycheck_date,
          monthly_income,
          current_savings,
          extra_cc_payment,
          created_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
        ",
                params![
                    id,
                    username,
                    password_hash,
                    pay_cycle,
                    last_paycheck_date,
                    monthly_income,
                    current_savings,
                    extra_cc_payment,
                    created_at
                ],
            )
            .map_err(|error| format!("Failed to import legacy user: {error}"))?;
        count += 1;
    }

    Ok(count)
}

fn copy_legacy_accounts(source: &Connection, destination: &Connection) -> CommandResult<i64> {
    let mut select = source
        .prepare(
            "
      SELECT
        id,
        user_id,
        name,
        institution_name,
        account_type,
        account_purpose,
        current_balance,
        is_manual,
        is_active,
        plaid_account_id,
        last_four,
        created_at
      FROM accounts
      ORDER BY id
      ",
        )
        .map_err(|error| format!("Failed to read legacy accounts: {error}"))?;

    let rows = select
        .query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, i64>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, Option<String>>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, String>(5)?,
                row.get::<_, f64>(6)?,
                row.get::<_, i64>(7)?,
                row.get::<_, i64>(8)?,
                row.get::<_, Option<String>>(9)?,
                row.get::<_, Option<String>>(10)?,
                row.get::<_, String>(11)?,
            ))
        })
        .map_err(|error| format!("Failed to map legacy accounts: {error}"))?;

    let mut count = 0;
    for row in rows {
        let (
            id,
            user_id,
            name,
            institution_name,
            account_type,
            account_purpose,
            current_balance,
            is_manual,
            is_active,
            plaid_account_id,
            last_four,
            created_at,
        ) = row.map_err(|error| format!("Failed to read legacy account row: {error}"))?;
        destination
            .execute(
                "
        INSERT INTO accounts (
          id,
          user_id,
          name,
          institution_name,
          account_type,
          account_purpose,
          current_balance,
          is_manual,
          is_active,
          plaid_account_id,
          last_four,
          created_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
        ",
                params![
                    id,
                    user_id,
                    name,
                    institution_name,
                    account_type,
                    account_purpose,
                    current_balance,
                    is_manual,
                    is_active,
                    plaid_account_id,
                    last_four,
                    created_at
                ],
            )
            .map_err(|error| format!("Failed to import legacy account: {error}"))?;
        count += 1;
    }

    Ok(count)
}

fn copy_legacy_bills(source: &Connection, destination: &Connection) -> CommandResult<i64> {
    let mut select = source
        .prepare(
            "
      SELECT
        id,
        user_id,
        name,
        category,
        amount,
        due_day,
        due_date,
        is_autopay,
        active,
        frequency,
        created_at
      FROM bills
      ORDER BY id
      ",
        )
        .map_err(|error| format!("Failed to read legacy bills: {error}"))?;

    let rows = select
        .query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, i64>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, Option<String>>(3)?,
                row.get::<_, f64>(4)?,
                row.get::<_, i64>(5)?,
                row.get::<_, Option<String>>(6)?,
                row.get::<_, i64>(7)?,
                row.get::<_, i64>(8)?,
                row.get::<_, String>(9)?,
                row.get::<_, String>(10)?,
            ))
        })
        .map_err(|error| format!("Failed to map legacy bills: {error}"))?;

    let mut count = 0;
    for row in rows {
        let (
            id,
            user_id,
            name,
            category,
            amount,
            due_day,
            due_date,
            is_autopay,
            active,
            frequency,
            created_at,
        ) = row.map_err(|error| format!("Failed to read legacy bill row: {error}"))?;
        destination
            .execute(
                "
        INSERT INTO bills (
          id,
          user_id,
          name,
          category,
          amount,
          due_day,
          due_date,
          is_autopay,
          active,
          frequency,
          created_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
        ",
                params![
                    id, user_id, name, category, amount, due_day, due_date, is_autopay, active,
                    frequency, created_at
                ],
            )
            .map_err(|error| format!("Failed to import legacy bill: {error}"))?;
        count += 1;
    }

    Ok(count)
}

fn copy_legacy_bill_payments(source: &Connection, destination: &Connection) -> CommandResult<i64> {
    let mut select = source
        .prepare(
            "
      SELECT
        id,
        bill_id,
        year,
        month,
        status,
        amount_paid,
        paid_at
      FROM bill_payments
      ORDER BY id
      ",
        )
        .map_err(|error| format!("Failed to read legacy bill payments: {error}"))?;

    let rows = select
        .query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, i64>(1)?,
                row.get::<_, i64>(2)?,
                row.get::<_, i64>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, Option<f64>>(5)?,
                row.get::<_, Option<String>>(6)?,
            ))
        })
        .map_err(|error| format!("Failed to map legacy bill payments: {error}"))?;

    let mut count = 0;
    for row in rows {
        let (id, bill_id, year, month, status, amount_paid, paid_at) =
            row.map_err(|error| format!("Failed to read legacy bill payment row: {error}"))?;
        destination
            .execute(
                "
        INSERT INTO bill_payments (
          id,
          bill_id,
          year,
          month,
          status,
          amount_paid,
          paid_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
        ",
                params![id, bill_id, year, month, status, amount_paid, paid_at],
            )
            .map_err(|error| format!("Failed to import legacy bill payment: {error}"))?;
        count += 1;
    }

    Ok(count)
}

fn copy_legacy_credit_cards(source: &Connection, destination: &Connection) -> CommandResult<i64> {
    if !sqlite_table_exists(source, "credit_cards")? {
        return Ok(0);
    }

    let mut select = source
        .prepare(
            "
      SELECT
        id,
        user_id,
        name,
        balance,
        credit_limit,
        minimum_payment,
        apr,
        due_day,
        last_four,
        active,
        created_at
      FROM credit_cards
      ORDER BY id
      ",
        )
        .map_err(|error| format!("Failed to read legacy credit cards: {error}"))?;

    let rows = select
        .query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, i64>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, f64>(3)?,
                row.get::<_, f64>(4)?,
                row.get::<_, f64>(5)?,
                row.get::<_, f64>(6)?,
                row.get::<_, i64>(7)?,
                row.get::<_, Option<String>>(8)?,
                row.get::<_, i64>(9)?,
                row.get::<_, String>(10)?,
            ))
        })
        .map_err(|error| format!("Failed to map legacy credit cards: {error}"))?;

    let mut count = 0;
    for row in rows {
        let (
            id,
            user_id,
            name,
            balance,
            credit_limit,
            minimum_payment,
            apr,
            due_day,
            last_four,
            active,
            created_at,
        ) = row.map_err(|error| format!("Failed to read legacy credit card row: {error}"))?;
        destination
            .execute(
                "
        INSERT INTO credit_cards (
          id,
          user_id,
          name,
          balance,
          credit_limit,
          minimum_payment,
          apr,
          due_day,
          last_four,
          active,
          created_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
        ",
                params![
                    id,
                    user_id,
                    name,
                    balance,
                    credit_limit,
                    minimum_payment,
                    apr,
                    due_day,
                    last_four,
                    active,
                    created_at
                ],
            )
            .map_err(|error| format!("Failed to import legacy credit card: {error}"))?;
        count += 1;
    }

    Ok(count)
}

fn copy_legacy_credit_card_transactions(
    source: &Connection,
    destination: &Connection,
) -> CommandResult<i64> {
    if !sqlite_table_exists(source, "credit_card_transactions")? {
        return Ok(0);
    }

    let mut select = source
        .prepare(
            "
      SELECT
        id,
        card_id,
        type,
        amount,
        note,
        category,
        merchant_name,
        source_account_id,
        transaction_date,
        created_at
      FROM credit_card_transactions
      ORDER BY id
      ",
        )
        .map_err(|error| format!("Failed to read legacy credit card transactions: {error}"))?;

    let rows = select
        .query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, i64>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, f64>(3)?,
                row.get::<_, Option<String>>(4)?,
                row.get::<_, Option<String>>(5)?,
                row.get::<_, Option<String>>(6)?,
                row.get::<_, Option<i64>>(7)?,
                row.get::<_, String>(8)?,
                row.get::<_, String>(9)?,
            ))
        })
        .map_err(|error| format!("Failed to map legacy credit card transactions: {error}"))?;

    let mut count = 0;
    for row in rows {
        let (
            id,
            card_id,
            entry_type,
            amount,
            note,
            category,
            merchant_name,
            source_account_id,
            transaction_date,
            created_at,
        ) = row.map_err(|error| {
            format!("Failed to read legacy credit card transaction row: {error}")
        })?;
        destination
            .execute(
                "
        INSERT INTO credit_card_transactions (
          id,
          card_id,
          type,
          amount,
          note,
          category,
          merchant_name,
          source_account_id,
          transaction_date,
          created_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
        ",
                params![
                    id,
                    card_id,
                    entry_type,
                    amount,
                    note,
                    category,
                    merchant_name,
                    source_account_id,
                    transaction_date,
                    created_at
                ],
            )
            .map_err(|error| format!("Failed to import legacy credit card transaction: {error}"))?;
        count += 1;
    }

    Ok(count)
}

fn copy_legacy_transfer_groups(source: &Connection, destination: &Connection) -> CommandResult<i64> {
    if !sqlite_table_exists(source, "transfer_groups")? {
        return Ok(0);
    }

    let mut select = source
        .prepare(
            "
      SELECT
        id,
        user_id,
        transfer_date,
        from_account_id,
        to_account_id,
        amount,
        notes,
        created_at
      FROM transfer_groups
      ORDER BY id
      ",
        )
        .map_err(|error| format!("Failed to read legacy transfers: {error}"))?;

    let rows = select
        .query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, i64>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, i64>(3)?,
                row.get::<_, i64>(4)?,
                row.get::<_, f64>(5)?,
                row.get::<_, Option<String>>(6)?,
                row.get::<_, String>(7)?,
            ))
        })
        .map_err(|error| format!("Failed to map legacy transfers: {error}"))?;

    let mut count = 0;
    for row in rows {
        let (id, user_id, transfer_date, from_account_id, to_account_id, amount, notes, created_at) =
            row.map_err(|error| format!("Failed to read legacy transfer row: {error}"))?;

        destination
            .execute(
                "
        INSERT INTO transfer_groups (
          id,
          user_id,
          transfer_date,
          from_account_id,
          to_account_id,
          amount,
          notes,
          created_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
        ",
                params![
                    id,
                    user_id,
                    transfer_date,
                    from_account_id,
                    to_account_id,
                    amount,
                    notes,
                    created_at
                ],
            )
            .map_err(|error| format!("Failed to import legacy transfer: {error}"))?;
        count += 1;
    }

    Ok(count)
}

fn copy_legacy_cash_transactions(
    source: &Connection,
    destination: &Connection,
) -> CommandResult<i64> {
    if !sqlite_table_exists(source, "cash_transactions")? {
        return Ok(0);
    }

    let mut select = source
        .prepare(
            "
      SELECT
        id,
        user_id,
        account_id,
        transaction_date,
        amount,
        direction,
        category,
        merchant_name,
        description,
        transaction_kind,
        linked_bill_id,
        transfer_group_id,
        notes,
        created_at
      FROM cash_transactions
      ORDER BY id
      ",
        )
        .map_err(|error| format!("Failed to read legacy cash transactions: {error}"))?;

    let rows = select
        .query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, i64>(1)?,
                row.get::<_, i64>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, f64>(4)?,
                row.get::<_, String>(5)?,
                row.get::<_, Option<String>>(6)?,
                row.get::<_, Option<String>>(7)?,
                row.get::<_, String>(8)?,
                row.get::<_, String>(9)?,
                row.get::<_, Option<i64>>(10)?,
                row.get::<_, Option<i64>>(11)?,
                row.get::<_, Option<String>>(12)?,
                row.get::<_, String>(13)?,
            ))
        })
        .map_err(|error| format!("Failed to map legacy cash transactions: {error}"))?;

    let mut count = 0;
    for row in rows {
        let (
            id,
            user_id,
            account_id,
            transaction_date,
            amount,
            direction,
            category,
            merchant_name,
            description,
            transaction_kind,
            linked_bill_id,
            transfer_group_id,
            notes,
            created_at,
        ) = row.map_err(|error| format!("Failed to read legacy cash transaction row: {error}"))?;

        destination
            .execute(
                "
        INSERT INTO cash_transactions (
          id,
          user_id,
          account_id,
          transaction_date,
          amount,
          direction,
          category,
          merchant_name,
          description,
          transaction_kind,
          linked_bill_id,
          transfer_group_id,
          notes,
          created_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
        ",
                params![
                    id,
                    user_id,
                    account_id,
                    transaction_date,
                    amount,
                    direction,
                    category,
                    merchant_name,
                    description,
                    transaction_kind,
                    linked_bill_id,
                    transfer_group_id,
                    notes,
                    created_at
                ],
            )
            .map_err(|error| format!("Failed to import legacy cash transaction: {error}"))?;
        count += 1;
    }

    Ok(count)
}

fn get_bill_for_user(
    connection: &Connection,
    user_id: i64,
    bill_id: i64,
) -> CommandResult<Option<BillResponse>> {
    connection
        .query_row(
            "
      SELECT
        b.id,
        b.user_id,
        b.name,
        b.category,
        b.amount,
        b.due_day,
        b.due_date,
        b.is_autopay,
        b.active,
        b.frequency,
        NULL AS status,
        NULL AS amount_paid,
        NULL AS paid_at,
        NULL AS payment_id
      FROM bills b
      WHERE b.id = ?1
        AND b.user_id = ?2
      ",
            params![bill_id, user_id],
            map_bill_row,
        )
        .optional()
        .map_err(|error| format!("Failed to load local bill: {error}"))
}

fn sqlite_table_exists(connection: &Connection, table_name: &str) -> CommandResult<bool> {
    let exists = connection
        .query_row(
            "
      SELECT EXISTS(
        SELECT 1
        FROM sqlite_master
        WHERE type = 'table'
          AND name = ?1
      )
      ",
            [table_name],
            |row| row.get::<_, i64>(0),
        )
        .map_err(|error| format!("Failed to inspect legacy database tables: {error}"))?;

    Ok(exists == 1)
}

fn get_credit_card_for_user(
    connection: &Connection,
    user_id: i64,
    card_id: i64,
) -> CommandResult<Option<CreditCardResponse>> {
    connection
        .query_row(
            "
      SELECT
        id,
        user_id,
        name,
        balance,
        credit_limit,
        minimum_payment,
        apr,
        due_day,
        last_four,
        active
      FROM credit_cards
      WHERE id = ?1
        AND user_id = ?2
      ",
            params![card_id, user_id],
            map_credit_card_row,
        )
        .optional()
        .map_err(|error| format!("Failed to load local credit card: {error}"))
}

fn list_credit_card_transactions_for_user(
    connection: &Connection,
    user_id: i64,
    card_id: i64,
) -> CommandResult<Vec<CreditCardTransactionResponse>> {
    let mut statement = connection
        .prepare(
            "
      SELECT
        cct.id,
        cct.card_id,
        cct.type,
        cct.amount,
        cct.note,
        cct.category,
        cct.merchant_name,
        cct.source_account_id,
        cct.transaction_date,
        cct.created_at
      FROM credit_card_transactions cct
      INNER JOIN credit_cards cc ON cc.id = cct.card_id
      WHERE cc.id = ?1
        AND cc.user_id = ?2
      ORDER BY cct.transaction_date DESC, cct.id DESC
      ",
        )
        .map_err(|error| format!("Failed to prepare local credit card transactions query: {error}"))?;

    let rows = statement
        .query_map(params![card_id, user_id], map_credit_card_transaction_row)
        .map_err(|error| format!("Failed to load local credit card transactions: {error}"))?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Failed to map local credit card transactions: {error}"))
}

fn sync_user_savings_from_accounts(connection: &Connection, user_id: i64) -> CommandResult<()> {
    let total: f64 = connection
        .query_row(
            "
      SELECT COALESCE(SUM(current_balance), 0)
      FROM accounts
      WHERE user_id = ?1
        AND account_purpose = 'savings'
        AND is_active = 1
      ",
            [user_id],
            |row| row.get(0),
        )
        .map_err(|error| format!("Failed to read local savings balances: {error}"))?;

    connection
        .execute(
            "UPDATE users SET current_savings = ?1 WHERE id = ?2",
            params![round_money(total), user_id],
        )
        .map_err(|error| format!("Failed to sync local savings balance: {error}"))?;

    Ok(())
}

fn adjust_account_balance(
    connection: &Connection,
    user_id: i64,
    account_id: i64,
    delta: f64,
) -> CommandResult<Option<AccountResponse>> {
    let account = get_account_for_user(connection, user_id, account_id)?;
    let Some(existing) = account else {
        return Ok(None);
    };

    let new_balance = round_money(existing.current_balance + delta);
    connection
        .execute(
            "
      UPDATE accounts
      SET current_balance = ?1
      WHERE id = ?2
        AND user_id = ?3
      ",
            params![new_balance, account_id, user_id],
        )
        .map_err(|error| format!("Failed to update local account balance: {error}"))?;

    let updated = get_account_for_user(connection, user_id, account_id)?;
    if matches!(updated.as_ref(), Some(account) if account.account_purpose == "savings") {
        sync_user_savings_from_accounts(connection, user_id)?;
    }

    Ok(updated)
}

fn get_account_for_user(
    connection: &Connection,
    user_id: i64,
    account_id: i64,
) -> CommandResult<Option<AccountResponse>> {
    connection
        .query_row(
            "
      SELECT
        id,
        user_id,
        name,
        institution_name,
        last_four,
        account_type,
        account_purpose,
        current_balance,
        is_manual,
        is_active,
        plaid_account_id,
        created_at
      FROM accounts
      WHERE id = ?1
        AND user_id = ?2
      ",
            params![account_id, user_id],
            map_account_row,
        )
        .optional()
        .map_err(|error| format!("Failed to load local account: {error}"))
}

fn get_cash_transaction_for_user(
    connection: &Connection,
    user_id: i64,
    transaction_id: i64,
) -> CommandResult<Option<CashTransactionResponse>> {
    connection
        .query_row(
            "
      SELECT
        ct.id,
        ct.user_id,
        ct.account_id,
        a.name AS account_name,
        a.account_purpose,
        ct.transaction_date,
        ct.amount,
        ct.direction,
        ct.category,
        ct.merchant_name,
        ct.description,
        ct.transaction_kind,
        ct.linked_bill_id,
        ct.transfer_group_id,
        ct.notes,
        ct.created_at
      FROM cash_transactions ct
      INNER JOIN accounts a ON a.id = ct.account_id
      WHERE ct.id = ?1
        AND ct.user_id = ?2
      ",
            params![transaction_id, user_id],
            map_cash_transaction_row,
        )
        .optional()
        .map_err(|error| format!("Failed to load local cash transaction: {error}"))
}

fn load_monthly_trend_points(
    connection: &Connection,
    user_id: i64,
    normalized_months: i64,
    aggregate_sql: &str,
) -> CommandResult<Vec<TrendPointResponse>> {
    let month_offset = format!("-{} months", normalized_months.saturating_sub(1));
    let query = format!(
        "
      WITH RECURSIVE months(month_index, month_start, month, year_number, month_number) AS (
        SELECT
          0,
          date('now', 'start of month', ?1),
          strftime('%Y-%m', date('now', 'start of month', ?1)),
          CAST(strftime('%Y', date('now', 'start of month', ?1)) AS INTEGER),
          CAST(strftime('%m', date('now', 'start of month', ?1)) AS INTEGER)
        UNION ALL
        SELECT
          month_index + 1,
          date(month_start, '+1 month'),
          strftime('%Y-%m', date(month_start, '+1 month')),
          CAST(strftime('%Y', date(month_start, '+1 month')) AS INTEGER),
          CAST(strftime('%m', date(month_start, '+1 month')) AS INTEGER)
        FROM months
        WHERE month_index + 1 < ?2
      )
      {aggregate_sql}
      "
    );

    let mut statement = connection
        .prepare(&query)
        .map_err(|error| format!("Failed to prepare local trends query: {error}"))?;

    let rows = statement
        .query_map(params![month_offset, normalized_months, user_id], |row| {
            let month: String = row.get(0)?;
            let year_number: i64 = row.get(1)?;
            let month_number: i64 = row.get(2)?;
            let value: f64 = row.get(3)?;

            Ok(TrendPointResponse {
                month,
                label: build_month_label(year_number, month_number),
                value: round_money(value),
            })
        })
        .map_err(|error| format!("Failed to load local trends: {error}"))?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Failed to map local trends: {error}"))
}

#[tauri::command]
pub fn get_vault_status(state: State<'_, DesktopState>) -> CommandResult<VaultStatusResponse> {
    build_vault_status(&state)
}

#[tauri::command]
pub fn unlock_vault(
    state: State<'_, DesktopState>,
    passphrase: String,
) -> CommandResult<VaultStatusResponse> {
    let envelope = load_vault_envelope()?
        .ok_or_else(|| "Vault passphrase protection is not enabled.".to_string())?;
    let database_key = unwrap_database_key(&envelope, &passphrase)?;

    state.set_cached_database_key(Some(database_key.clone()))?;
    if let Err(error) = state.initialize() {
        state.set_cached_database_key(None)?;
        return Err(error);
    }
    state.open_connection_with_key(&database_key)?;

    build_vault_status(&state)
}

#[tauri::command]
pub fn lock_vault(state: State<'_, DesktopState>) -> CommandResult<SuccessResponse> {
    state.set_session(None)?;
    state.set_cached_database_key(None)?;

    Ok(SuccessResponse {
        success: true,
        message: Some("Vault locked".to_string()),
    })
}

#[tauri::command]
pub fn get_setup_status(state: State<'_, DesktopState>) -> CommandResult<SetupStatusResponse> {
    let connection = state.open_connection()?;

    Ok(SetupStatusResponse {
        setup_required: read_setup_required(&connection)?,
    })
}

#[tauri::command]
pub fn create_initial_user(
    state: State<'_, DesktopState>,
    username: String,
    password: String,
) -> CommandResult<SetupResponse> {
    let username = username.trim().to_string();
    if username.is_empty() || password.is_empty() {
        return Err("Username and password are required.".to_string());
    }
    if password.len() < 8 {
        return Err("Password must be at least 8 characters.".to_string());
    }

    let mut connection = state.open_connection()?;
    ensure_setup_not_complete(&connection)?;

    let password_hash = hash(password, DEFAULT_COST)
        .map_err(|error| format!("Failed to hash password: {error}"))?;

    let transaction = connection
        .transaction()
        .map_err(|error| format!("Failed to start local setup transaction: {error}"))?;

    transaction
        .execute(
            "
      INSERT INTO users (
        username,
        password_hash,
        pay_cycle,
        last_paycheck_date,
        monthly_income,
        current_savings,
        extra_cc_payment
      )
      VALUES (?1, ?2, ?3, NULL, 0, 0, 0)
      ",
            params![username, password_hash, DEFAULT_PAY_CYCLE],
        )
        .map_err(|error| {
            if let rusqlite::Error::SqliteFailure(inner, _) = &error {
                if inner.extended_code == rusqlite::ffi::SQLITE_CONSTRAINT_UNIQUE {
                    return "That username is already in use.".to_string();
                }
            }

            format!("Failed to create local user: {error}")
        })?;

    let user_id = transaction.last_insert_rowid();
    create_default_accounts(&transaction, user_id, 0.0)?;
    transaction
        .commit()
        .map_err(|error| format!("Failed to commit local setup transaction: {error}"))?;

    let connection = state.open_connection()?;
    let user = fetch_user_settings(&connection, user_id)?;
    state.set_session(Some(SessionUser {
        user_id,
        username: user.username.clone(),
    }))?;

    Ok(SetupResponse {
        success: true,
        user,
    })
}

#[tauri::command]
pub fn login(
    state: State<'_, DesktopState>,
    username: String,
    password: String,
) -> CommandResult<LoginResponse> {
    let username = username.trim().to_string();
    if username.is_empty() || password.is_empty() {
        return Err("Username and password are required".to_string());
    }

    let connection = state.open_connection()?;
    let count: i64 = connection
        .query_row("SELECT COUNT(*) FROM users", [], |row| row.get(0))
        .map_err(|error| format!("Failed to check local setup status: {error}"))?;
    if count == 0 {
        return Err("Setup is required before logging in.".to_string());
    }

    let user = fetch_user_by_username(&connection, &username)?
        .ok_or_else(|| "Invalid credentials".to_string())?;

    let is_valid = verify(password, &user.2)
        .map_err(|error| format!("Failed to verify local password: {error}"))?;
    if !is_valid {
        return Err("Invalid credentials".to_string());
    }

    state.set_session(Some(SessionUser {
        user_id: user.0,
        username: user.1.clone(),
    }))?;

    Ok(LoginResponse {
        success: true,
        username: user.1,
    })
}

#[tauri::command]
pub fn logout(state: State<'_, DesktopState>) -> CommandResult<SuccessResponse> {
    state.set_session(None)?;
    if state.is_vault_passphrase_enabled()? {
        state.set_cached_database_key(None)?;
    }
    Ok(SuccessResponse {
        success: true,
        message: None,
    })
}

#[tauri::command]
pub fn get_settings(state: State<'_, DesktopState>) -> CommandResult<UserSettingsResponse> {
    let session = state.current_session()?;
    let connection = state.open_connection()?;
    fetch_user_settings(&connection, session.user_id)
}

#[tauri::command]
pub fn update_settings(
    state: State<'_, DesktopState>,
    pay_cycle: String,
    last_paycheck_date: String,
    monthly_income: f64,
    current_savings: f64,
) -> CommandResult<UserSettingsResponse> {
    let session = state.current_session()?;
    let connection = state.open_connection()?;
    let last_paycheck_date = normalize_optional_date(&last_paycheck_date);

    connection
        .execute(
            "
      UPDATE users
      SET
        pay_cycle = ?1,
        last_paycheck_date = ?2,
        monthly_income = ?3,
        current_savings = ?4
      WHERE id = ?5
      ",
            params![
                pay_cycle,
                last_paycheck_date,
                monthly_income,
                current_savings,
                session.user_id
            ],
        )
        .map_err(|error| format!("Failed to update local settings: {error}"))?;

    connection
        .execute(
            "
      UPDATE accounts
      SET current_balance = ?2
      WHERE id = (
        SELECT id
        FROM accounts
        WHERE user_id = ?1
          AND account_purpose = 'savings'
          AND is_active = 1
        ORDER BY id
        LIMIT 1
      )
      ",
            params![session.user_id, current_savings],
        )
        .map_err(|error| format!("Failed to sync local savings account: {error}"))?;

    fetch_user_settings(&connection, session.user_id)
}

#[tauri::command]
pub fn change_password(
    state: State<'_, DesktopState>,
    current_password: String,
    new_password: String,
) -> CommandResult<SuccessResponse> {
    let session = state.current_session()?;
    if current_password.is_empty() || new_password.is_empty() {
        return Err("Current and new password are required".to_string());
    }
    if new_password.len() < 8 {
        return Err("Password must be at least 8 characters.".to_string());
    }

    let connection = state.open_connection()?;
    let user = fetch_user_by_username(&connection, &session.username)?
        .ok_or_else(|| "User not found".to_string())?;

    let is_valid = verify(current_password, &user.2)
        .map_err(|error| format!("Failed to verify local password: {error}"))?;
    if !is_valid {
        return Err("Current password is incorrect".to_string());
    }

    let password_hash = hash(new_password, DEFAULT_COST)
        .map_err(|error| format!("Failed to hash local password: {error}"))?;

    connection
        .execute(
            "UPDATE users SET password_hash = ?1 WHERE id = ?2",
            params![password_hash, session.user_id],
        )
        .map_err(|error| format!("Failed to update local password: {error}"))?;

    Ok(SuccessResponse {
        success: true,
        message: Some("Password updated".to_string()),
    })
}

#[tauri::command]
pub fn set_vault_passphrase(
    state: State<'_, DesktopState>,
    account_password: String,
    passphrase: String,
) -> CommandResult<SuccessResponse> {
    validate_vault_passphrase(&passphrase)?;
    let session = state.current_session()?;
    if state.is_vault_passphrase_enabled()? {
        return Err("Vault passphrase protection is already enabled.".to_string());
    }

    let connection = state.open_connection()?;
    verify_account_password(&connection, &session.username, &account_password)?;
    let database_key = state.load_database_key_for_access()?;
    enable_vault_passphrase_with_key(&state, &database_key, &passphrase)?;

    Ok(SuccessResponse {
        success: true,
        message: Some("Vault passphrase enabled".to_string()),
    })
}

#[tauri::command]
pub fn change_vault_passphrase(
    state: State<'_, DesktopState>,
    current_passphrase: String,
    new_passphrase: String,
) -> CommandResult<SuccessResponse> {
    state.current_session()?;
    validate_vault_passphrase(&new_passphrase)?;

    let envelope = load_vault_envelope()?
        .ok_or_else(|| "Vault passphrase protection is not enabled.".to_string())?;
    let database_key = unwrap_database_key(&envelope, &current_passphrase)?;
    enable_vault_passphrase_with_key(&state, &database_key, &new_passphrase)?;

    Ok(SuccessResponse {
        success: true,
        message: Some("Vault passphrase updated".to_string()),
    })
}

#[tauri::command]
pub fn clear_vault_passphrase(
    state: State<'_, DesktopState>,
    current_passphrase: String,
) -> CommandResult<SuccessResponse> {
    state.current_session()?;

    let envelope = load_vault_envelope()?
        .ok_or_else(|| "Vault passphrase protection is not enabled.".to_string())?;
    let database_key = unwrap_database_key(&envelope, &current_passphrase)?;
    disable_vault_passphrase_with_key(&state, &database_key)?;

    Ok(SuccessResponse {
        success: true,
        message: Some("Vault passphrase removed".to_string()),
    })
}

#[tauri::command]
pub fn rotate_database_key(
    state: State<'_, DesktopState>,
    current_passphrase: Option<String>,
) -> CommandResult<SuccessResponse> {
    state.current_session()?;

    if state.is_vault_passphrase_enabled()? {
        let passphrase = current_passphrase.as_deref().ok_or_else(|| {
            "Current vault passphrase is required to rotate the database key.".to_string()
        })?;
        let envelope = load_vault_envelope()?
            .ok_or_else(|| "Vault passphrase protection is not enabled.".to_string())?;
        let current_database_key = unwrap_database_key(&envelope, passphrase)?;
        rotate_database_encryption_key_with_current_key(
            &state,
            &current_database_key,
            Some(passphrase),
        )?;
    } else {
        let current_database_key = state.load_database_key_for_access()?;
        rotate_database_encryption_key_with_current_key(&state, &current_database_key, None)?;
    }

    Ok(SuccessResponse {
        success: true,
        message: Some("Database encryption key rotated".to_string()),
    })
}

#[tauri::command]
pub fn import_legacy_database(
    state: State<'_, DesktopState>,
) -> CommandResult<LegacyImportResponse> {
    if !state.legacy_import_available() {
        return Err("No legacy local database was found to import.".to_string());
    }

    let mut destination = state.open_connection()?;
    ensure_setup_not_complete(&destination)?;

    let source = Connection::open(&state.legacy_db_path)
        .map_err(|error| format!("Failed to open legacy local database: {error}"))?;

    let transaction = destination
        .transaction()
        .map_err(|error| format!("Failed to start local import transaction: {error}"))?;

    let imported_users = copy_legacy_users(&source, &transaction)?;
    let imported_accounts = copy_legacy_accounts(&source, &transaction)?;
    let imported_bills = copy_legacy_bills(&source, &transaction)?;
    let imported_bill_payments = copy_legacy_bill_payments(&source, &transaction)?;
    let imported_credit_cards = copy_legacy_credit_cards(&source, &transaction)?;
    let imported_credit_card_transactions =
        copy_legacy_credit_card_transactions(&source, &transaction)?;
    let imported_transfers = copy_legacy_transfer_groups(&source, &transaction)?;
    let imported_cash_transactions = copy_legacy_cash_transactions(&source, &transaction)?;

    transaction
        .commit()
        .map_err(|error| format!("Failed to commit local import transaction: {error}"))?;

    Ok(LegacyImportResponse {
        success: true,
        imported_users,
        imported_accounts,
        imported_bills,
        imported_bill_payments,
        imported_credit_cards,
        imported_credit_card_transactions,
        imported_transfers,
        imported_cash_transactions,
    })
}

#[tauri::command]
pub fn list_bills(state: State<'_, DesktopState>) -> CommandResult<Vec<BillResponse>> {
    let session = state.current_session()?;
    let connection = state.open_connection()?;
    let mut statement = connection
        .prepare(
            "
      SELECT
        b.id,
        b.user_id,
        b.name,
        b.category,
        b.amount,
        b.due_day,
        b.due_date,
        b.is_autopay,
        b.active,
        b.frequency,
        bp.status,
        bp.amount_paid,
        bp.paid_at,
        bp.id AS payment_id
      FROM bills b
      LEFT JOIN bill_payments bp
        ON bp.bill_id = b.id
       AND bp.year = CAST(strftime('%Y', 'now', 'localtime') AS INTEGER)
       AND bp.month = CAST(strftime('%m', 'now', 'localtime') AS INTEGER)
      WHERE b.user_id = ?1
        AND b.active = 1
      ORDER BY
        CASE WHEN b.frequency = 'monthly' THEN b.due_day ELSE 32 END,
        COALESCE(b.due_date, date('now', 'localtime')),
        b.name
      ",
        )
        .map_err(|error| format!("Failed to prepare local bills query: {error}"))?;

    let rows = statement
        .query_map([session.user_id], map_bill_row)
        .map_err(|error| format!("Failed to load local bills: {error}"))?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Failed to map local bills: {error}"))
}

#[tauri::command]
pub fn create_bill(
    state: State<'_, DesktopState>,
    name: String,
    category: String,
    amount: f64,
    due_day: i64,
    due_date: Option<String>,
    is_autopay: bool,
    frequency: String,
) -> CommandResult<BillResponse> {
    let session = state.current_session()?;
    let connection = state.open_connection()?;

    connection
        .execute(
            "
      INSERT INTO bills (
        user_id,
        name,
        category,
        amount,
        due_day,
        is_autopay,
        frequency,
        due_date
      )
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
      ",
            params![
                session.user_id,
                name,
                if category.trim().is_empty() {
                    None::<String>
                } else {
                    Some(category)
                },
                amount,
                due_day,
                if is_autopay { 1 } else { 0 },
                frequency,
                due_date
            ],
        )
        .map_err(|error| format!("Failed to create local bill: {error}"))?;

    let bill_id = connection.last_insert_rowid();
    get_bill_for_user(&connection, session.user_id, bill_id)?
        .ok_or_else(|| "Failed to load newly created local bill.".to_string())
}

#[tauri::command]
pub fn update_bill(
    state: State<'_, DesktopState>,
    bill_id: i64,
    name: String,
    category: String,
    amount: f64,
    due_day: i64,
    due_date: Option<String>,
    is_autopay: bool,
    frequency: String,
) -> CommandResult<BillResponse> {
    let session = state.current_session()?;
    let connection = state.open_connection()?;

    if get_bill_for_user(&connection, session.user_id, bill_id)?.is_none() {
        return Err("Bill not found".to_string());
    }

    connection
        .execute(
            "
      UPDATE bills
      SET
        name = ?1,
        category = ?2,
        amount = ?3,
        due_day = ?4,
        is_autopay = ?5,
        frequency = ?6,
        due_date = ?7
      WHERE id = ?8
        AND user_id = ?9
      ",
            params![
                name,
                if category.trim().is_empty() {
                    None::<String>
                } else {
                    Some(category)
                },
                amount,
                due_day,
                if is_autopay { 1 } else { 0 },
                frequency,
                due_date,
                bill_id,
                session.user_id
            ],
        )
        .map_err(|error| format!("Failed to update local bill: {error}"))?;

    get_bill_for_user(&connection, session.user_id, bill_id)?
        .ok_or_else(|| "Failed to load updated local bill.".to_string())
}

#[tauri::command]
pub fn delete_bill(state: State<'_, DesktopState>, bill_id: i64) -> CommandResult<SuccessResponse> {
    let session = state.current_session()?;
    let connection = state.open_connection()?;

    if get_bill_for_user(&connection, session.user_id, bill_id)?.is_none() {
        return Err("Bill not found".to_string());
    }

    connection
        .execute(
            "
      UPDATE bills
      SET active = 0
      WHERE id = ?1
        AND user_id = ?2
      ",
            params![bill_id, session.user_id],
        )
        .map_err(|error| format!("Failed to delete local bill: {error}"))?;

    Ok(SuccessResponse {
        success: true,
        message: None,
    })
}

#[tauri::command]
pub fn upsert_bill_payment(
    state: State<'_, DesktopState>,
    bill_id: i64,
    year: i64,
    month: i64,
    status: String,
    amount_paid: Option<f64>,
) -> CommandResult<BillPaymentResponse> {
    let session = state.current_session()?;
    let connection = state.open_connection()?;

    if get_bill_for_user(&connection, session.user_id, bill_id)?.is_none() {
        return Err("Bill not found".to_string());
    }

    connection
        .execute(
            "
      INSERT INTO bill_payments (
        bill_id,
        year,
        month,
        status,
        amount_paid,
        paid_at
      )
      VALUES (
        ?1,
        ?2,
        ?3,
        ?4,
        ?5,
        CASE WHEN ?4 = 'paid' THEN CURRENT_TIMESTAMP ELSE NULL END
      )
      ON CONFLICT (bill_id, year, month) DO UPDATE SET
        status = excluded.status,
        amount_paid = excluded.amount_paid,
        paid_at = CASE
          WHEN excluded.status = 'paid' THEN CURRENT_TIMESTAMP
          ELSE NULL
        END
      ",
            params![bill_id, year, month, status, amount_paid],
        )
        .map_err(|error| format!("Failed to update local bill payment: {error}"))?;

    connection
        .query_row(
            "
      SELECT
        id,
        bill_id,
        year,
        month,
        status,
        amount_paid,
        paid_at
      FROM bill_payments
      WHERE bill_id = ?1
        AND year = ?2
        AND month = ?3
      ",
            params![bill_id, year, month],
            |row| {
                Ok(BillPaymentResponse {
                    id: row.get(0)?,
                    bill_id: row.get(1)?,
                    year: row.get(2)?,
                    month: row.get(3)?,
                    status: row.get(4)?,
                    amount_paid: row.get(5)?,
                    paid_at: row.get(6)?,
                })
            },
        )
        .map_err(|error| format!("Failed to load local bill payment: {error}"))
}

#[tauri::command]
pub fn list_credit_cards(
    state: State<'_, DesktopState>,
) -> CommandResult<Vec<CreditCardResponse>> {
    let session = state.current_session()?;
    let connection = state.open_connection()?;
    let mut statement = connection
        .prepare(
            "
      SELECT
        id,
        user_id,
        name,
        balance,
        credit_limit,
        minimum_payment,
        apr,
        due_day,
        last_four,
        active
      FROM credit_cards
      WHERE user_id = ?1
        AND active = 1
      ORDER BY apr DESC, name
      ",
        )
        .map_err(|error| format!("Failed to prepare local credit cards query: {error}"))?;

    let rows = statement
        .query_map([session.user_id], map_credit_card_row)
        .map_err(|error| format!("Failed to load local credit cards: {error}"))?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Failed to map local credit cards: {error}"))
}

#[tauri::command]
pub fn create_credit_card(
    state: State<'_, DesktopState>,
    name: String,
    balance: f64,
    credit_limit: f64,
    minimum_payment: f64,
    apr: f64,
    due_day: i64,
    last_four: Option<String>,
) -> CommandResult<CreditCardResponse> {
    let session = state.current_session()?;
    let connection = state.open_connection()?;

    if name.trim().is_empty() {
        return Err("Card name is required".to_string());
    }
    if !(1..=31).contains(&due_day) {
        return Err("Due day must be between 1 and 31".to_string());
    }

    connection
        .execute(
            "
      INSERT INTO credit_cards (
        user_id,
        name,
        balance,
        credit_limit,
        minimum_payment,
        apr,
        due_day,
        last_four
      )
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
      ",
            params![
                session.user_id,
                name.trim(),
                round_money(balance.max(0.0)),
                round_money(credit_limit.max(0.0)),
                round_money(minimum_payment.max(0.0)),
                round_money(apr.max(0.0)),
                due_day,
                normalize_optional_text(last_four.as_deref().unwrap_or(""))
            ],
        )
        .map_err(|error| format!("Failed to create local credit card: {error}"))?;

    let card_id = connection.last_insert_rowid();
    get_credit_card_for_user(&connection, session.user_id, card_id)?
        .ok_or_else(|| "Failed to load newly created local credit card.".to_string())
}

#[tauri::command]
pub fn update_credit_card(
    state: State<'_, DesktopState>,
    card_id: i64,
    name: String,
    balance: f64,
    credit_limit: f64,
    minimum_payment: f64,
    apr: f64,
    due_day: i64,
    last_four: Option<String>,
) -> CommandResult<CreditCardResponse> {
    let session = state.current_session()?;
    let connection = state.open_connection()?;

    if name.trim().is_empty() {
        return Err("Card name is required".to_string());
    }
    if !(1..=31).contains(&due_day) {
        return Err("Due day must be between 1 and 31".to_string());
    }
    if get_credit_card_for_user(&connection, session.user_id, card_id)?.is_none() {
        return Err("Card not found".to_string());
    }

    connection
        .execute(
            "
      UPDATE credit_cards
      SET
        name = ?1,
        balance = ?2,
        credit_limit = ?3,
        minimum_payment = ?4,
        apr = ?5,
        due_day = ?6,
        last_four = ?7
      WHERE id = ?8
        AND user_id = ?9
      ",
            params![
                name.trim(),
                round_money(balance.max(0.0)),
                round_money(credit_limit.max(0.0)),
                round_money(minimum_payment.max(0.0)),
                round_money(apr.max(0.0)),
                due_day,
                normalize_optional_text(last_four.as_deref().unwrap_or("")),
                card_id,
                session.user_id
            ],
        )
        .map_err(|error| format!("Failed to update local credit card: {error}"))?;

    get_credit_card_for_user(&connection, session.user_id, card_id)?
        .ok_or_else(|| "Failed to load updated local credit card.".to_string())
}

#[tauri::command]
pub fn delete_credit_card(
    state: State<'_, DesktopState>,
    card_id: i64,
) -> CommandResult<SuccessResponse> {
    let session = state.current_session()?;
    let connection = state.open_connection()?;

    if get_credit_card_for_user(&connection, session.user_id, card_id)?.is_none() {
        return Err("Card not found".to_string());
    }

    connection
        .execute(
            "
      UPDATE credit_cards
      SET active = 0
      WHERE id = ?1
        AND user_id = ?2
      ",
            params![card_id, session.user_id],
        )
        .map_err(|error| format!("Failed to delete local credit card: {error}"))?;

    Ok(SuccessResponse {
        success: true,
        message: None,
    })
}

#[tauri::command]
pub fn list_credit_card_transactions(
    state: State<'_, DesktopState>,
    card_id: i64,
) -> CommandResult<Vec<CreditCardTransactionResponse>> {
    let session = state.current_session()?;
    let connection = state.open_connection()?;

    if get_credit_card_for_user(&connection, session.user_id, card_id)?.is_none() {
        return Err("Card not found".to_string());
    }

    list_credit_card_transactions_for_user(&connection, session.user_id, card_id)
}

#[tauri::command]
pub fn add_credit_card_ledger_entries(
    state: State<'_, DesktopState>,
    card_id: i64,
    transaction_date: String,
    entries: Vec<HashMap<String, serde_json::Value>>,
) -> CommandResult<CreditCardLedgerResult> {
    let session = state.current_session()?;
    let mut connection = state.open_connection()?;

    if entries.is_empty() {
        return Err("Enter at least one valid ledger entry".to_string());
    }

    let transaction = connection
        .transaction()
        .map_err(|error| format!("Failed to start local credit card transaction: {error}"))?;

    let card = get_credit_card_for_user(&transaction, session.user_id, card_id)?
        .ok_or_else(|| "Card not found".to_string())?;
    if card.active != 1 {
        return Err("Card not found".to_string());
    }

    let mut balance_delta = 0.0;
    for entry in &entries {
        let entry_type = entry
            .get("type")
            .and_then(|value| value.as_str())
            .unwrap_or("")
            .trim()
            .to_string();

        let raw_amount = entry.get("amount").and_then(|value| value.as_f64()).unwrap_or(0.0);
        let amount = if entry_type == "adjustment" {
            round_money(raw_amount)
        } else {
            round_money(raw_amount.max(0.0))
        };

        let allowed_entry_type = matches!(
            entry_type.as_str(),
            "purchase" | "payment" | "interest" | "fee" | "adjustment"
        );
        if !allowed_entry_type || amount == 0.0 {
            return Err("Enter at least one valid ledger entry".to_string());
        }

        let source_account_id = entry.get("source_account_id").and_then(|value| value.as_i64());
        if let Some(account_id) = source_account_id {
            let account_exists = transaction
                .query_row(
                    "
          SELECT EXISTS(
            SELECT 1
            FROM accounts
            WHERE id = ?1
              AND user_id = ?2
              AND is_active = 1
          )
          ",
                    params![account_id, session.user_id],
                    |row| row.get::<_, i64>(0),
                )
                .map_err(|error| format!("Failed to validate source account: {error}"))?;

            if account_exists != 1 {
                return Err("Source account not found".to_string());
            }
        }

        transaction
            .execute(
                "
          INSERT INTO credit_card_transactions (
            card_id,
            type,
            amount,
            note,
            category,
            merchant_name,
            source_account_id,
            transaction_date
          )
          VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
          ",
                params![
                    card_id,
                    entry_type,
                    amount,
                    entry
                        .get("note")
                        .and_then(|value| value.as_str())
                        .and_then(normalize_optional_text),
                    entry
                        .get("category")
                        .and_then(|value| value.as_str())
                        .and_then(normalize_optional_text),
                    entry
                        .get("merchant_name")
                        .and_then(|value| value.as_str())
                        .and_then(normalize_optional_text),
                    source_account_id,
                    transaction_date
                ],
            )
            .map_err(|error| format!("Failed to save local credit card ledger entry: {error}"))?;

        match entry_type.as_str() {
            "payment" => balance_delta -= amount,
            "adjustment" => balance_delta += amount,
            _ => balance_delta += amount,
        }
    }

    let new_balance = round_money((card.balance + balance_delta).max(0.0));
    transaction
        .execute(
            "
      UPDATE credit_cards
      SET balance = ?1
      WHERE id = ?2
        AND user_id = ?3
      ",
            params![new_balance, card_id, session.user_id],
        )
        .map_err(|error| format!("Failed to update local credit card balance: {error}"))?;

    transaction
        .commit()
        .map_err(|error| format!("Failed to commit local credit card transaction: {error}"))?;

    let connection = state.open_connection()?;
    let card = get_credit_card_for_user(&connection, session.user_id, card_id)?
        .ok_or_else(|| "Failed to load updated local credit card.".to_string())?;
    let transactions = list_credit_card_transactions_for_user(&connection, session.user_id, card_id)?;

    Ok(CreditCardLedgerResult { card, transactions })
}

#[tauri::command]
pub fn get_credit_card_payment_summary(
    state: State<'_, DesktopState>,
) -> CommandResult<HashMap<i64, CreditCardPaymentSummaryItem>> {
    let session = state.current_session()?;
    let connection = state.open_connection()?;
    let mut statement = connection
        .prepare(
            "
      SELECT
        cc.id,
        COALESCE(SUM(cct.amount), 0) AS amount_paid
      FROM credit_cards cc
      LEFT JOIN credit_card_transactions cct
        ON cct.card_id = cc.id
       AND cct.type = 'payment'
       AND strftime('%Y', cct.transaction_date) = strftime('%Y', 'now', 'localtime')
       AND strftime('%m', cct.transaction_date) = strftime('%m', 'now', 'localtime')
      WHERE cc.user_id = ?1
        AND cc.active = 1
      GROUP BY cc.id
      ",
        )
        .map_err(|error| format!("Failed to prepare local credit card summary query: {error}"))?;

    let rows = statement
        .query_map([session.user_id], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, f64>(1)?))
        })
        .map_err(|error| format!("Failed to load local credit card summary: {error}"))?;

    let mut summary = HashMap::new();
    for row in rows {
        let (card_id, amount_paid) =
            row.map_err(|error| format!("Failed to map local credit card summary: {error}"))?;
        summary.insert(
            card_id,
            CreditCardPaymentSummaryItem {
                paid: amount_paid > 0.0,
                amount_paid: round_money(amount_paid),
            },
        );
    }

    Ok(summary)
}

#[tauri::command]
pub fn list_accounts(state: State<'_, DesktopState>) -> CommandResult<Vec<AccountResponse>> {
    let session = state.current_session()?;
    let connection = state.open_connection()?;
    let mut statement = connection
        .prepare(
            "
      SELECT
        id,
        user_id,
        name,
        institution_name,
        last_four,
        account_type,
        account_purpose,
        current_balance,
        is_manual,
        is_active,
        plaid_account_id,
        created_at
      FROM accounts
      WHERE user_id = ?1
        AND is_active = 1
      ORDER BY
        CASE account_purpose
          WHEN 'bills' THEN 1
          WHEN 'disposable' THEN 2
          WHEN 'savings' THEN 3
          WHEN 'credit_card' THEN 4
          ELSE 5
        END,
        name
      ",
        )
        .map_err(|error| format!("Failed to prepare local accounts query: {error}"))?;

    let rows = statement
        .query_map([session.user_id], map_account_row)
        .map_err(|error| format!("Failed to load local accounts: {error}"))?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Failed to map local accounts: {error}"))
}

#[tauri::command]
pub fn create_account(
    state: State<'_, DesktopState>,
    name: String,
    institution_name: Option<String>,
    last_four: Option<String>,
    account_type: String,
    account_purpose: String,
    current_balance: f64,
) -> CommandResult<AccountResponse> {
    let session = state.current_session()?;
    let connection = state.open_connection()?;

    let trimmed_name = name.trim();
    if trimmed_name.is_empty() {
        return Err("Account name is required".to_string());
    }

    if !matches!(account_type.as_str(), "checking" | "savings" | "credit_card") {
        return Err("Invalid account type".to_string());
    }

    if !matches!(
        account_purpose.as_str(),
        "bills" | "disposable" | "savings" | "credit_card"
    ) {
        return Err("Invalid account purpose".to_string());
    }

    if !current_balance.is_finite() {
        return Err("Current balance must be a valid number".to_string());
    }

    if matches!(last_four.as_deref(), Some(value) if !value.is_empty() && (value.len() != 4 || !value.chars().all(|ch| ch.is_ascii_digit()))) {
        return Err("Last four must be exactly 4 digits".to_string());
    }

    connection
        .execute(
            "
      INSERT INTO accounts (
        user_id,
        name,
        institution_name,
        last_four,
        account_type,
        account_purpose,
        current_balance,
        is_manual,
        is_active
      )
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 1, 1)
      ",
            params![
                session.user_id,
                trimmed_name,
                institution_name.and_then(|value| normalize_optional_text(&value)),
                last_four.and_then(|value| normalize_optional_text(&value)),
                account_type,
                account_purpose,
                round_money(current_balance)
            ],
        )
        .map_err(|error| format!("Failed to create local account: {error}"))?;

    let account_id = connection.last_insert_rowid();
    let account = get_account_for_user(&connection, session.user_id, account_id)?
        .ok_or_else(|| "Failed to load newly created local account.".to_string())?;

    if account.account_purpose == "savings" {
        sync_user_savings_from_accounts(&connection, session.user_id)?;
        return get_account_for_user(&connection, session.user_id, account_id)?
            .ok_or_else(|| "Failed to load updated local account.".to_string());
    }

    Ok(account)
}

#[tauri::command]
pub fn update_account(
    state: State<'_, DesktopState>,
    account_id: i64,
    name: String,
    institution_name: Option<String>,
    last_four: Option<String>,
    account_type: String,
    account_purpose: String,
    current_balance: f64,
) -> CommandResult<AccountResponse> {
    let session = state.current_session()?;
    let connection = state.open_connection()?;

    let trimmed_name = name.trim();
    if trimmed_name.is_empty() {
        return Err("Account name is required".to_string());
    }

    if !matches!(account_type.as_str(), "checking" | "savings" | "credit_card") {
        return Err("Invalid account type".to_string());
    }

    if !matches!(
        account_purpose.as_str(),
        "bills" | "disposable" | "savings" | "credit_card"
    ) {
        return Err("Invalid account purpose".to_string());
    }

    if !current_balance.is_finite() {
        return Err("Current balance must be a valid number".to_string());
    }

    if matches!(last_four.as_deref(), Some(value) if !value.is_empty() && (value.len() != 4 || !value.chars().all(|ch| ch.is_ascii_digit()))) {
        return Err("Last four must be exactly 4 digits".to_string());
    }

    let existing = get_account_for_user(&connection, session.user_id, account_id)?
        .ok_or_else(|| "Account not found".to_string())?;

    connection
        .execute(
            "
      UPDATE accounts
      SET
        name = ?1,
        institution_name = ?2,
        last_four = ?3,
        account_type = ?4,
        account_purpose = ?5,
        current_balance = ?6
      WHERE id = ?7
        AND user_id = ?8
      ",
            params![
                trimmed_name,
                institution_name.and_then(|value| normalize_optional_text(&value)),
                last_four.and_then(|value| normalize_optional_text(&value)),
                account_type,
                account_purpose,
                round_money(current_balance),
                account_id,
                session.user_id
            ],
        )
        .map_err(|error| format!("Failed to update local account: {error}"))?;

    if existing.account_purpose == "savings" || account_purpose == "savings" {
        sync_user_savings_from_accounts(&connection, session.user_id)?;
    }

    get_account_for_user(&connection, session.user_id, account_id)?
        .ok_or_else(|| "Failed to load updated local account.".to_string())
}

#[tauri::command]
pub fn delete_account(
    state: State<'_, DesktopState>,
    account_id: i64,
) -> CommandResult<SuccessResponse> {
    let session = state.current_session()?;
    let connection = state.open_connection()?;

    let existing = get_account_for_user(&connection, session.user_id, account_id)?
        .ok_or_else(|| "Account not found".to_string())?;

    connection
        .execute(
            "
      UPDATE accounts
      SET is_active = 0
      WHERE id = ?1
        AND user_id = ?2
      ",
            params![account_id, session.user_id],
        )
        .map_err(|error| format!("Failed to deactivate local account: {error}"))?;

    if existing.account_purpose == "savings" {
        sync_user_savings_from_accounts(&connection, session.user_id)?;
    }

    Ok(SuccessResponse {
        success: true,
        message: None,
    })
}

#[tauri::command]
pub fn list_cash_transactions(
    state: State<'_, DesktopState>,
    limit: Option<i64>,
) -> CommandResult<Vec<CashTransactionResponse>> {
    let session = state.current_session()?;
    let connection = state.open_connection()?;
    let safe_limit = limit.unwrap_or(50).clamp(1, 250);

    let mut statement = connection
        .prepare(
            "
      SELECT
        ct.id,
        ct.user_id,
        ct.account_id,
        a.name AS account_name,
        a.account_purpose,
        ct.transaction_date,
        ct.amount,
        ct.direction,
        ct.category,
        ct.merchant_name,
        ct.description,
        ct.transaction_kind,
        ct.linked_bill_id,
        ct.transfer_group_id,
        ct.notes,
        ct.created_at
      FROM cash_transactions ct
      INNER JOIN accounts a ON a.id = ct.account_id
      WHERE ct.user_id = ?1
      ORDER BY ct.transaction_date DESC, ct.id DESC
      LIMIT ?2
      ",
        )
        .map_err(|error| format!("Failed to prepare local cash transaction query: {error}"))?;

    let rows = statement
        .query_map(params![session.user_id, safe_limit], map_cash_transaction_row)
        .map_err(|error| format!("Failed to load local cash transactions: {error}"))?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Failed to map local cash transactions: {error}"))
}

#[tauri::command]
pub fn create_cash_transaction(
    state: State<'_, DesktopState>,
    account_id: i64,
    transaction_date: String,
    amount: f64,
    direction: String,
    transaction_kind: String,
    description: String,
    category: Option<String>,
    merchant_name: Option<String>,
    linked_bill_id: Option<i64>,
    notes: Option<String>,
) -> CommandResult<CashTransactionResponse> {
    let session = state.current_session()?;
    let mut connection = state.open_connection()?;

    if amount <= 0.0 || !amount.is_finite() {
        return Err("Amount must be greater than zero".to_string());
    }
    if !matches!(direction.as_str(), "inflow" | "outflow") {
        return Err("Invalid direction".to_string());
    }
    if !matches!(
        transaction_kind.as_str(),
        "bill_payment"
            | "discretionary_spend"
            | "transfer"
            | "income"
            | "savings_contribution"
            | "adjustment"
    ) {
        return Err("Invalid transaction kind".to_string());
    }
    if description.trim().is_empty() {
        return Err("Description is required".to_string());
    }
    if transaction_date.trim().is_empty() {
        return Err("Transaction date is required".to_string());
    }

    let transaction = connection
        .transaction()
        .map_err(|error| format!("Failed to start local cash transaction: {error}"))?;

    let account = get_account_for_user(&transaction, session.user_id, account_id)?
        .ok_or_else(|| "Account not found".to_string())?;
    if account.is_active != 1 {
        return Err("Account not found".to_string());
    }

    transaction
        .execute(
            "
      INSERT INTO cash_transactions (
        user_id,
        account_id,
        transaction_date,
        amount,
        direction,
        category,
        merchant_name,
        description,
        transaction_kind,
        linked_bill_id,
        notes
      )
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
      ",
            params![
                session.user_id,
                account_id,
                transaction_date,
                round_money(amount),
                direction,
                category.and_then(|value| normalize_optional_text(&value)),
                merchant_name.and_then(|value| normalize_optional_text(&value)),
                description.trim(),
                transaction_kind,
                linked_bill_id,
                notes.and_then(|value| normalize_optional_text(&value))
            ],
        )
        .map_err(|error| format!("Failed to create local cash transaction: {error}"))?;

    let transaction_id = transaction.last_insert_rowid();
    adjust_account_balance(
        &transaction,
        session.user_id,
        account_id,
        signed_amount(&direction, round_money(amount)),
    )?;

    transaction
        .commit()
        .map_err(|error| format!("Failed to commit local cash transaction: {error}"))?;

    let connection = state.open_connection()?;
    get_cash_transaction_for_user(&connection, session.user_id, transaction_id)?
        .ok_or_else(|| "Failed to load newly created local cash transaction.".to_string())
}

#[tauri::command]
pub fn update_cash_transaction(
    state: State<'_, DesktopState>,
    transaction_id: i64,
    account_id: i64,
    transaction_date: String,
    amount: f64,
    direction: String,
    transaction_kind: String,
    description: String,
    category: Option<String>,
    merchant_name: Option<String>,
    linked_bill_id: Option<i64>,
    notes: Option<String>,
) -> CommandResult<CashTransactionResponse> {
    let session = state.current_session()?;
    let mut connection = state.open_connection()?;

    if amount <= 0.0 || !amount.is_finite() {
        return Err("Amount must be greater than zero".to_string());
    }
    if !matches!(direction.as_str(), "inflow" | "outflow") {
        return Err("Invalid transaction payload".to_string());
    }
    if !matches!(
        transaction_kind.as_str(),
        "bill_payment"
            | "discretionary_spend"
            | "transfer"
            | "income"
            | "savings_contribution"
            | "adjustment"
    ) || description.trim().is_empty() || transaction_date.trim().is_empty()
    {
        return Err("Invalid transaction payload".to_string());
    }

    let transaction = connection
        .transaction()
        .map_err(|error| format!("Failed to start local cash transaction update: {error}"))?;

    let existing = get_cash_transaction_for_user(&transaction, session.user_id, transaction_id)?
        .ok_or_else(|| "Transaction not found".to_string())?;
    if existing.transfer_group_id.is_some() {
        return Err("Transfer transactions cannot be edited directly".to_string());
    }

    adjust_account_balance(
        &transaction,
        session.user_id,
        existing.account_id,
        -signed_amount(&existing.direction, existing.amount),
    )?;

    let next_account = get_account_for_user(&transaction, session.user_id, account_id)?
        .ok_or_else(|| "Account not found".to_string())?;
    if next_account.is_active != 1 {
        return Err("Account not found".to_string());
    }

    transaction
        .execute(
            "
      UPDATE cash_transactions
      SET
        account_id = ?1,
        transaction_date = ?2,
        amount = ?3,
        direction = ?4,
        category = ?5,
        merchant_name = ?6,
        description = ?7,
        transaction_kind = ?8,
        linked_bill_id = ?9,
        notes = ?10
      WHERE id = ?11
        AND user_id = ?12
      ",
            params![
                account_id,
                transaction_date,
                round_money(amount),
                direction,
                category.and_then(|value| normalize_optional_text(&value)),
                merchant_name.and_then(|value| normalize_optional_text(&value)),
                description.trim(),
                transaction_kind,
                linked_bill_id,
                notes.and_then(|value| normalize_optional_text(&value)),
                transaction_id,
                session.user_id
            ],
        )
        .map_err(|error| format!("Failed to update local cash transaction: {error}"))?;

    adjust_account_balance(
        &transaction,
        session.user_id,
        account_id,
        signed_amount(&direction, round_money(amount)),
    )?;

    transaction
        .commit()
        .map_err(|error| format!("Failed to commit local cash transaction update: {error}"))?;

    let connection = state.open_connection()?;
    get_cash_transaction_for_user(&connection, session.user_id, transaction_id)?
        .ok_or_else(|| "Failed to load updated local cash transaction.".to_string())
}

#[tauri::command]
pub fn delete_cash_transaction(
    state: State<'_, DesktopState>,
    transaction_id: i64,
) -> CommandResult<SuccessResponse> {
    let session = state.current_session()?;
    let mut connection = state.open_connection()?;

    let transaction = connection
        .transaction()
        .map_err(|error| format!("Failed to start local cash transaction delete: {error}"))?;

    let existing = get_cash_transaction_for_user(&transaction, session.user_id, transaction_id)?
        .ok_or_else(|| "Transaction not found".to_string())?;
    if existing.transfer_group_id.is_some() {
        return Err("Transfer transactions cannot be deleted directly".to_string());
    }

    adjust_account_balance(
        &transaction,
        session.user_id,
        existing.account_id,
        -signed_amount(&existing.direction, existing.amount),
    )?;

    transaction
        .execute(
            "DELETE FROM cash_transactions WHERE id = ?1 AND user_id = ?2",
            params![transaction_id, session.user_id],
        )
        .map_err(|error| format!("Failed to delete local cash transaction: {error}"))?;

    transaction
        .commit()
        .map_err(|error| format!("Failed to commit local cash transaction delete: {error}"))?;

    Ok(SuccessResponse {
        success: true,
        message: None,
    })
}

#[tauri::command]
pub fn list_transfers(
    state: State<'_, DesktopState>,
    limit: Option<i64>,
) -> CommandResult<Vec<TransferResponse>> {
    let session = state.current_session()?;
    let connection = state.open_connection()?;
    let safe_limit = limit.unwrap_or(25).clamp(1, 100);

    let mut statement = connection
        .prepare(
            "
      SELECT
        tg.id,
        tg.user_id,
        tg.transfer_date,
        tg.amount,
        tg.notes,
        tg.from_account_id,
        fa.name AS from_account_name,
        tg.to_account_id,
        ta.name AS to_account_name,
        tg.created_at
      FROM transfer_groups tg
      INNER JOIN accounts fa ON fa.id = tg.from_account_id
      INNER JOIN accounts ta ON ta.id = tg.to_account_id
      WHERE tg.user_id = ?1
      ORDER BY tg.transfer_date DESC, tg.id DESC
      LIMIT ?2
      ",
        )
        .map_err(|error| format!("Failed to prepare local transfers query: {error}"))?;

    let rows = statement
        .query_map(params![session.user_id, safe_limit], map_transfer_row)
        .map_err(|error| format!("Failed to load local transfers: {error}"))?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Failed to map local transfers: {error}"))
}

#[tauri::command]
pub fn create_transfer(
    state: State<'_, DesktopState>,
    from_account_id: i64,
    to_account_id: i64,
    transfer_date: String,
    amount: f64,
    notes: Option<String>,
) -> CommandResult<TransferResponse> {
    let session = state.current_session()?;
    let mut connection = state.open_connection()?;

    if from_account_id == to_account_id {
        return Err("Transfer accounts must be different".to_string());
    }
    if amount <= 0.0 || !amount.is_finite() {
        return Err("Amount must be greater than zero".to_string());
    }
    if transfer_date.trim().is_empty() {
        return Err("Transfer date is required".to_string());
    }

    let transaction = connection
        .transaction()
        .map_err(|error| format!("Failed to start local transfer transaction: {error}"))?;

    let from_account = get_account_for_user(&transaction, session.user_id, from_account_id)?
        .ok_or_else(|| "Transfer could not be created".to_string())?;
    let to_account = get_account_for_user(&transaction, session.user_id, to_account_id)?
        .ok_or_else(|| "Transfer could not be created".to_string())?;

    if from_account.is_active != 1 || to_account.is_active != 1 {
        return Err("Transfer could not be created".to_string());
    }

    transaction
        .execute(
            "
      INSERT INTO transfer_groups (
        user_id,
        transfer_date,
        from_account_id,
        to_account_id,
        amount,
        notes
      )
      VALUES (?1, ?2, ?3, ?4, ?5, ?6)
      ",
            params![
                session.user_id,
                transfer_date,
                from_account_id,
                to_account_id,
                round_money(amount),
                notes.clone().and_then(|value| normalize_optional_text(&value))
            ],
        )
        .map_err(|error| format!("Failed to create local transfer: {error}"))?;

    let transfer_id = transaction.last_insert_rowid();

    transaction
        .execute(
            "
      INSERT INTO cash_transactions (
        user_id,
        account_id,
        transaction_date,
        amount,
        direction,
        category,
        merchant_name,
        description,
        transaction_kind,
        transfer_group_id,
        notes
      )
      VALUES (?1, ?2, ?3, ?4, 'outflow', 'Transfer', NULL, ?5, 'transfer', ?6, ?7)
      ",
            params![
                session.user_id,
                from_account_id,
                transfer_date,
                round_money(amount),
                format!("Transfer to {}", to_account.name),
                transfer_id,
                notes.clone().and_then(|value| normalize_optional_text(&value))
            ],
        )
        .map_err(|error| format!("Failed to create local source transfer entry: {error}"))?;

    transaction
        .execute(
            "
      INSERT INTO cash_transactions (
        user_id,
        account_id,
        transaction_date,
        amount,
        direction,
        category,
        merchant_name,
        description,
        transaction_kind,
        transfer_group_id,
        notes
      )
      VALUES (?1, ?2, ?3, ?4, 'inflow', 'Transfer', NULL, ?5, 'transfer', ?6, ?7)
      ",
            params![
                session.user_id,
                to_account_id,
                transfer_date,
                round_money(amount),
                format!("Transfer from {}", from_account.name),
                transfer_id,
                notes.clone().and_then(|value| normalize_optional_text(&value))
            ],
        )
        .map_err(|error| format!("Failed to create local destination transfer entry: {error}"))?;

    adjust_account_balance(
        &transaction,
        session.user_id,
        from_account_id,
        -round_money(amount),
    )?;
    adjust_account_balance(
        &transaction,
        session.user_id,
        to_account_id,
        round_money(amount),
    )?;

    transaction
        .commit()
        .map_err(|error| format!("Failed to commit local transfer: {error}"))?;

    let connection = state.open_connection()?;
    connection
        .query_row(
            "
      SELECT
        tg.id,
        tg.user_id,
        tg.transfer_date,
        tg.amount,
        tg.notes,
        tg.from_account_id,
        fa.name AS from_account_name,
        tg.to_account_id,
        ta.name AS to_account_name,
        tg.created_at
      FROM transfer_groups tg
      INNER JOIN accounts fa ON fa.id = tg.from_account_id
      INNER JOIN accounts ta ON ta.id = tg.to_account_id
      WHERE tg.id = ?1
      ",
            [transfer_id],
            map_transfer_row,
        )
        .map_err(|error| format!("Failed to load local transfer: {error}"))
}

#[tauri::command]
pub fn get_monthly_trends(
    state: State<'_, DesktopState>,
    months: Option<i64>,
) -> CommandResult<TrendsResponse> {
    let session = state.current_session()?;
    let connection = state.open_connection()?;
    let normalized_months = match months.unwrap_or(6) {
        12 => 12,
        _ => 6,
    };

    let bills_paid_by_month = load_monthly_trend_points(
        &connection,
        session.user_id,
        normalized_months,
        "
      SELECT
        m.month,
        m.year_number,
        m.month_number,
        COALESCE(SUM(
          CASE
            WHEN b.id IS NOT NULL AND bp.amount_paid IS NOT NULL THEN bp.amount_paid
            WHEN b.id IS NOT NULL AND bp.status = 'paid' THEN b.amount
            ELSE 0
          END
        ), 0) AS value
      FROM months m
      LEFT JOIN bill_payments bp
        ON substr(COALESCE(bp.paid_at, printf('%04d-%02d-01', bp.year, bp.month)), 1, 7) = m.month
      LEFT JOIN bills b
        ON b.id = bp.bill_id
       AND b.user_id = ?3
      GROUP BY m.month_index, m.month, m.year_number, m.month_number
      ORDER BY m.month_index
      ",
    )?;

    let disposable_spending_by_month = load_monthly_trend_points(
        &connection,
        session.user_id,
        normalized_months,
        "
      SELECT
        m.month,
        m.year_number,
        m.month_number,
        COALESCE(SUM(ct.amount), 0) AS value
      FROM months m
      LEFT JOIN cash_transactions ct
        ON substr(ct.transaction_date, 1, 7) = m.month
       AND ct.user_id = ?3
       AND ct.direction = 'outflow'
       AND ct.transaction_kind = 'discretionary_spend'
      GROUP BY m.month_index, m.month, m.year_number, m.month_number
      ORDER BY m.month_index
      ",
    )?;

    let savings_contributions_by_month = load_monthly_trend_points(
        &connection,
        session.user_id,
        normalized_months,
        "
      SELECT
        m.month,
        m.year_number,
        m.month_number,
        COALESCE(SUM(ct.amount), 0) AS value
      FROM months m
      LEFT JOIN cash_transactions ct
        ON substr(ct.transaction_date, 1, 7) = m.month
       AND ct.user_id = ?3
       AND ct.direction = 'inflow'
      LEFT JOIN accounts a
        ON a.id = ct.account_id
       AND a.user_id = ?3
       AND a.account_purpose = 'savings'
      WHERE a.id IS NOT NULL OR ct.id IS NULL
      GROUP BY m.month_index, m.month, m.year_number, m.month_number
      ORDER BY m.month_index
      ",
    )?;

    let credit_card_purchases_by_month = load_monthly_trend_points(
        &connection,
        session.user_id,
        normalized_months,
        "
      SELECT
        m.month,
        m.year_number,
        m.month_number,
        COALESCE(SUM(cct.amount), 0) AS value
      FROM months m
      LEFT JOIN credit_card_transactions cct
        ON substr(cct.transaction_date, 1, 7) = m.month
       AND cct.type = 'purchase'
      LEFT JOIN credit_cards cc
        ON cc.id = cct.card_id
       AND cc.user_id = ?3
      WHERE cc.id IS NOT NULL OR cct.id IS NULL
      GROUP BY m.month_index, m.month, m.year_number, m.month_number
      ORDER BY m.month_index
      ",
    )?;

    let credit_card_payments_by_month = load_monthly_trend_points(
        &connection,
        session.user_id,
        normalized_months,
        "
      SELECT
        m.month,
        m.year_number,
        m.month_number,
        COALESCE(SUM(cct.amount), 0) AS value
      FROM months m
      LEFT JOIN credit_card_transactions cct
        ON substr(cct.transaction_date, 1, 7) = m.month
       AND cct.type = 'payment'
      LEFT JOIN credit_cards cc
        ON cc.id = cct.card_id
       AND cc.user_id = ?3
      WHERE cc.id IS NOT NULL OR cct.id IS NULL
      GROUP BY m.month_index, m.month, m.year_number, m.month_number
      ORDER BY m.month_index
      ",
    )?;

    let credit_card_interest_by_month = load_monthly_trend_points(
        &connection,
        session.user_id,
        normalized_months,
        "
      SELECT
        m.month,
        m.year_number,
        m.month_number,
        COALESCE(SUM(cct.amount), 0) AS value
      FROM months m
      LEFT JOIN credit_card_transactions cct
        ON substr(cct.transaction_date, 1, 7) = m.month
       AND cct.type = 'interest'
      LEFT JOIN credit_cards cc
        ON cc.id = cct.card_id
       AND cc.user_id = ?3
      WHERE cc.id IS NOT NULL OR cct.id IS NULL
      GROUP BY m.month_index, m.month, m.year_number, m.month_number
      ORDER BY m.month_index
      ",
    )?;

    let net_outflow_by_month = bills_paid_by_month
        .iter()
        .zip(disposable_spending_by_month.iter())
        .zip(savings_contributions_by_month.iter())
        .zip(credit_card_payments_by_month.iter())
        .map(|(((bills, disposable), savings), cc_payments)| TrendPointResponse {
            month: bills.month.clone(),
            label: bills.label.clone(),
            value: round_money(
                bills.value + disposable.value + savings.value + cc_payments.value,
            ),
        })
        .collect();

    Ok(TrendsResponse {
        months: normalized_months,
        bills_paid_by_month,
        disposable_spending_by_month,
        savings_contributions_by_month,
        credit_card_purchases_by_month,
        credit_card_payments_by_month,
        credit_card_interest_by_month,
        net_outflow_by_month,
    })
}
