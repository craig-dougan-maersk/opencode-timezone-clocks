# Signed Git packaging fixtures

`git-preparation.bundle` contains three signed commits/tags in a linear chain:

- `baseline`: exactly the original upstream manifest and TSX source at
  `acbbdfb5439ec6b10bf778a8dbbae29fb71bca6f`; extraction succeeds with an
  unavailable npm sentinel but its export is raw TSX, not compiled JavaScript.
  Its `src/tui.tsx` SHA-256 is pinned by the suite.
- `preparation-trap`: synthetic baseline with an exact `prepare` hook. This is
  deliberately not an upstream defect. Extraction invokes the unavailable npm
  sentinel and fails even with `ignoreScripts: true`.
- `corrected`: the reviewed release commit — current manifest, README, source and
  compiled `dist/tui.js` — for extraction without npm preparation. Tests require
  exact parity between the working tree (`package.json`, `src/tui.tsx`,
  `dist/tui.js`) and this commit.

Earlier revisions reconstructed the working source from `baseline` plus the two
packaging-only edits. The baseline is fixed upstream, so deliberate feature work
cannot be expressed that way. Provenance is still pinned by the `baseline`
fingerprint and the preparation-trap extraction failure; drift is now caught by
parsing the working tree against the signed `corrected` commit instead.

Created in an isolated temporary repository with signed commits. Regenerate the
corrected commit and bundle after manifest, source or compiled output changes;
never silently weaken parity checks. The project remains uncommitted during
review. CI only reads the signed objects and needs no private signing key.
