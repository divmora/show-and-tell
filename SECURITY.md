# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |
| < 0.1.0 | :x:                |

---

## Reporting a Vulnerability

The **DIVMORA Technologies** team and the maintainers of **ShowAndTell** take security seriously. If you discover a security vulnerability, please do **not** open a public issue, discussion, or pull request.

Instead, please report security concerns privately via:
1. **Email:** Send full details to **security@divmora.com**.
2. **GitHub Security Advisories:** Submit a private advisory at [GitHub Security Advisories](https://github.com/divmora/show-and-tell/security/advisories/new).

For organization-wide security principles and policies, please review the [DIVMORA Security Policy](https://github.com/divmora/.github/blob/main/SECURITY.md).

### Information to Include
- Detailed description of the vulnerability and its potential impact.
- Clear steps to reproduce or proof-of-concept (PoC) code.
- Affected versions, browser environment, and configuration.
- Any suggested mitigations or patches if available.

### Response & Disclosure SLA
- **Acknowledgment:** We will acknowledge receipt of your report within **48 hours**.
- **Triage & Assessment:** Our security and engineering team will investigate, validate, and keep you informed.
- **Fix & Release:** A fix will be developed, tested, and released as quickly as possible.
- **Coordinated Disclosure:** Appropriate credit will be acknowledged in release notes and security advisories (unless anonymity is requested).

---

## Security Best Practices

When deploying and embedding the ShowAndTell SDK:
- **Media Permissions**: ShowAndTell only requests display capture (`getDisplayMedia`) and microphone access (`getUserMedia`) upon explicit user interaction (e.g., button click). Never bypass user permission prompts.
- **Client-Side Storage**: In-flight video chunks buffered into `IndexedDB` remain strictly scoped to the origin host. Ensure proper origin isolation and avoid hosting untrusted scripts on the same origin.
- **Upload Endpoint Protection**: If configuring an `uploadEndpoint` in production, ensure strict CORS policies, authentication tokens, and server-side file upload limits (e.g., max payload size, MIME-type validation).
- **Shadow DOM Isolation**: UI widgets and recording controls are encapsulated within Shadow DOM boundaries to prevent CSS bleed and DOM tampering from third-party scripts.
