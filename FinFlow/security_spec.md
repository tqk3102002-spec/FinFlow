# FinFlow Firestore Security Specification

## 1. Data Invariants
1. **Strict Ownership & PII Isolation**: Every `/users/{userId}` profile (containing private `email`) and every subcollection document (`wallets`, `investments`, `cashflows`, `budgets`) can only be read or mutated by the verified authenticated owner (`request.auth.uid == userId && request.auth.token.email_verified == true`). Listing `/users` is unconditionally denied.
2. **Master Gate**: Every subcollection document (`wallets`, `investments`, `cashflows`, `budgets`) must belong to an existing `/users/{userId}` parent document and store `ownerId == request.auth.uid == userId`.
3. **Anti-Update-Gap & Immutability**: Document `id`, `uid`/`ownerId`, and `createdAt` are immutable after creation. Every update is gated by `isValid[Entity](incoming())` and an explicit `affectedKeys().hasOnly([...])` action allowlist.
4. **Temporal Integrity**: `createdAt` on create and `updatedAt` on create/update must equal `request.time` (server timestamps).
5. **Bounded Payloads**: Every string enforces exact `maxLength` and regex patterns synchronized with `firebase-blueprint.json`. Document IDs match `^[a-zA-Z0-9_\-]+$` (<= 128 chars).

## 2. The "Dirty Dozen" Adversarial Payloads (All Must Return PERMISSION_DENIED)
1. **Cross-User Profile Read (PII Leak)**: User B attempts `get` on `/users/userA`.
2. **User Collection Enumeration**: Any user attempts `list` on `/users`.
3. **Unverified Email Write**: Authenticated user with `email_verified: false` attempts `create` on `/users/{uid}/wallets/w1`.
4. **Identity Spoofing on Create**: User A attempts to create `/users/userA/wallets/w1` with `ownerId: "userB"`.
5. **Shadow / Ghost Field Injection**: User A attempts to create or update `/users/userA` with an extra field `{ isAdmin: true }`.
6. **Immutable Field Tampering**: User A attempts to update `createdAt` or `ownerId` on an existing `cashflows` document.
7. **Client-Spoofed Timestamp**: User A attempts to create a `Wallet` with a client-supplied past timestamp instead of `request.time`.
8. **ID Poisoning / Resource Exhaustion**: User A attempts to create `/users/userA/wallets/` with a 200-character document ID containing special characters.
9. **Oversized String Payload (Denial of Wallet)**: User A attempts to write a 10KB `note` field (limit 240 chars) into `CashflowEntry`.
10. **Invalid Enum / Value Poisoning**: User A attempts to update `Wallet.balance` to `-50000` or `Wallet.type` to `"CRYPTO_MARGIN"`.
11. **Malformed Date / Ticker Regex**: User A attempts to create `InvestmentTrade` with `date: "2026/11/21"` or `symbol: "fpt-invalid!"`.
12. **Orphaned Subcollection Write**: Authenticated user attempts to create `/users/{uid}/budgets/b1` before parent `/users/{uid}` exists.
