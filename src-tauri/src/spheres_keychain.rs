//! Reuse the provisioned Spheres helper after the updater replaces the bundle.
#[cfg(not(test))]
use buzz_credential_store::configure_local_dev_helper;
use buzz_credential_store::Error;
#[cfg(not(test))]
use nix::unistd::{Uid, User};
use std::os::unix::fs::MetadataExt;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

const BUNDLE_ID: &str = "com.askbellboy.buzz.preview";

#[cfg(not(test))]
pub(super) fn configure(config: &tauri::Config) {
    let Some(leaf) = option_env!("BUZZ_SPHERES_HELPER_CERTIFICATE") else {
        return;
    };
    if config.identifier != BUNDLE_ID
        || config.product_name.as_deref() != Some("Spheres")
        || tauri::is_dev()
        || !crate::dock::bundled()
        || std::env::var_os("BUZZ_DEV_CREDENTIAL_HELPER").is_some()
    {
        return;
    }
    let uid = Uid::effective();
    let Ok(Some(user)) = User::from_uid(uid) else {
        return;
    };
    let support = user.dir.join("Library/Application Support/Spheres Preview");
    match discover(&support, uid.as_raw(), leaf) {
        Ok(Some(helper)) => configure_local_dev_helper(Ok(helper)),
        Ok(None) => {}
        Err(error) => configure_local_dev_helper(Err(error)),
    }
}

fn discover(support: &Path, uid: u32, leaf: &str) -> Result<Option<PathBuf>, Error> {
    for (name, identifier) in [
        ("Spheres Keychain Bridge v1", BUNDLE_ID),
        (
            "Spheres Keychain Helper v1",
            "com.askbellboy.buzz.preview.keychain-helper",
        ),
    ] {
        if let Some(path) = verified_helper(support, name, identifier, uid, leaf)? {
            return Ok(Some(path));
        }
    }
    Ok(None)
}

fn verified_helper(
    support: &Path,
    name: &str,
    identifier: &str,
    uid: u32,
    leaf: &str,
) -> Result<Option<PathBuf>, Error> {
    let helper = support.join(name);
    let metadata = match std::fs::symlink_metadata(&helper) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(_) => return Err(Error::Unavailable),
    };
    let directory = std::fs::symlink_metadata(support).map_err(|_| Error::Unavailable)?;
    if !directory.is_dir()
        || directory.uid() != uid
        || directory.mode() & 0o077 != 0
        || !metadata.is_file()
        || metadata.uid() != uid
        || metadata.mode() & 0o777 != 0o700
    {
        return Err(Error::Unavailable);
    }

    let requirement = format!("=identifier \"{identifier}\" and certificate leaf = H\"{leaf}\"");
    let verified = Command::new("/usr/bin/codesign")
        .args(["--verify", "--strict", "-R", &requirement])
        .arg(&helper)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .is_ok_and(|status| status.success());
    if !verified {
        return Err(Error::Unavailable);
    }
    Ok(Some(helper))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::os::unix::fs::{symlink, PermissionsExt};

    #[test]
    fn discovery_refuses_an_untrusted_or_symlinked_bridge() {
        let support = tempfile::tempdir().unwrap();
        let path = support.path();
        std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o700)).unwrap();
        let uid = std::fs::metadata(path).unwrap().uid();
        let unknown_leaf = "0000000000000000000000000000000000000000";
        assert_eq!(discover(path, uid, unknown_leaf), Ok(None));

        let helper = path.join("Spheres Keychain Helper v1");
        std::fs::write(&helper, "#!/bin/sh\nexit 0\n").unwrap();
        std::fs::set_permissions(&helper, std::fs::Permissions::from_mode(0o700)).unwrap();
        assert_eq!(discover(path, uid, unknown_leaf), Err(Error::Unavailable));

        symlink(&helper, path.join("Spheres Keychain Bridge v1")).unwrap();
        assert_eq!(discover(path, uid, unknown_leaf), Err(Error::Unavailable));
    }
}
