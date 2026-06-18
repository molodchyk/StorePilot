# StorePilot Release Hygiene

Last reviewed: 2026-06-18.

This document records the repo cleanliness rules that should hold when StorePilot is prepared for a versioned release.

## GitHub Releases

When `manifest.json` is bumped for a release-ready version, the GitHub Releases page should be updated for that same version after validation passes.

Current rule:

- Tag releases as `v<manifest version>`, for example `v1.3.0.1`.
- Use the same version in `manifest.json`, `CHANGELOG.md`, AMO submission notes, extension package name, source package name, and GitHub release tag.
- Attach the current extension package from `artifacts/storepilot-<version>.zip`.
- Attach the current AMO source package from `artifacts/source/storepilot-source-<version>.zip`.
- Do not create a GitHub release for every tiny unversioned fix. Prepare the release only when the project has intentionally bumped version and is ready to upload.
- Do not leave an older GitHub release marked Latest after a newer release-ready version is validated and uploaded.

## Local Artifact Hygiene

The `artifacts/` folder is ignored and can be regenerated. Before release, keep only:

- `artifacts/storepilot-<current version>.zip`
- `artifacts/source/storepilot-source-<current version>.zip`
- current screenshot artifacts referenced by `AMO_SUBMISSION.md` and `store-listing/amo/media/screenshots.md`

Delete old version zips. They make the workspace harder to review and increase the risk of uploading the wrong package.

## Repository Hygiene

- Keep one canonical license file: `LICENSE`.
- Do not keep duplicate `LICENSE.txt` or other duplicate license files unless a store explicitly requires them.
- Do not track generated zips or `dist/` output.
- Keep generated source packages based on `git ls-files` so ignored local files cannot leak into AMO source uploads.
- If a release creates temporary diagnostics, screenshots, or test files, either move the useful ones into the expected artifact path or delete them before commit.

## Validation

`scripts/test-firefox-release.ps1` enforces:

- `LICENSE.txt` is absent.
- no zip files are tracked by git.
- only the current version's extension and source zips exist under `artifacts/`.
- the current package and source package contain the expected files.
