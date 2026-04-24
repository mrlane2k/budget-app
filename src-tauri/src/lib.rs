mod commands;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            app.manage(commands::DesktopState::new(&app.handle())?);

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_vault_status,
            commands::unlock_vault,
            commands::lock_vault,
            commands::get_setup_status,
            commands::create_initial_user,
            commands::login,
            commands::logout,
            commands::get_settings,
            commands::update_settings,
            commands::change_password,
            commands::set_vault_passphrase,
            commands::change_vault_passphrase,
            commands::clear_vault_passphrase,
            commands::rotate_database_key,
            commands::import_legacy_database,
            commands::list_bills,
            commands::create_bill,
            commands::update_bill,
            commands::delete_bill,
            commands::upsert_bill_payment,
            commands::list_credit_cards,
            commands::create_credit_card,
            commands::update_credit_card,
            commands::delete_credit_card,
            commands::list_credit_card_transactions,
            commands::add_credit_card_ledger_entries,
            commands::get_credit_card_payment_summary,
            commands::list_accounts,
            commands::create_account,
            commands::update_account,
            commands::delete_account,
            commands::list_cash_transactions,
            commands::create_cash_transaction,
            commands::update_cash_transaction,
            commands::delete_cash_transaction,
            commands::list_transfers,
            commands::create_transfer
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
