# Signed Git packaging fixtures

`git-preparation.bundle` contains three signed commits/tags:

- `baseline`: exactly the original upstream manifest and TSX source at
  `acbbdfb5439ec6b10bf778a8dbbae29fb71bca6f`; extraction succeeds with an
  unavailable npm sentinel but its export is raw TSX, not compiled JavaScript.
- `preparation-trap`: synthetic baseline with an exact `prepare` hook. This is
  deliberately not an upstream defect. Extraction invokes the unavailable npm
  sentinel and fails even with `ignoreScripts: true`.
- `corrected`: current manifest, README and compiled `dist/tui.js`, for extraction
  without npm preparation. Tests require exact manifest/output parity.

Created in an isolated temporary repository with signed commits. Regenerate the
corrected commit and bundle after manifest or compiled output changes; never
silently weaken parity checks. The project remains uncommitted during review.
CI only reads the signed objects and needs no private signing key.
