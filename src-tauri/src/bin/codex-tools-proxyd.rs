fn main() {
    if let Err(error) = app_lib::proxy_daemon::run_cli_from_env() {
        eprintln!("{error}");
        std::process::exit(1);
    }
}
