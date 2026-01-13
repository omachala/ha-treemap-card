# Heroshot

This folder contains heroshot configuration and encrypted session data.

## Files

- `config.json` - Screenshot definitions (URLs, selectors, output settings)
- `session.enc` - Encrypted browser session (cookies, localStorage)

## Safe to commit

This folder is safe to commit to source control:

- `config.json` contains no secrets
- `session.enc` is encrypted with AES-256-GCM

## CI/CD Usage

To use heroshot in CI, add your session key as a secret:

```yaml
- run: npx heroshot --session-key=${{ secrets.HEROSHOT_SESSION_KEY }}
```

To get your session key, run: `heroshot session-key`

Learn more: https://heroshot.sh/docs
