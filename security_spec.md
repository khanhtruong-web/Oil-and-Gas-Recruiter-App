# Security Specification - Oil & Gas Recruitment Manager

## Data Invariants
1. A Candidate document cannot exist without an `ownerId` that matches the authenticated `request.auth.uid`.
2. Candidates can only be read, created, updated, or deleted by their `ownerId`.
3. The `currentStatus` field must be one of the predefined enum values.
4. `addedAt` is immutable after creation.
5. User settings can only be accessed by the user whose `uid` matches the document ID.

## The "Dirty Dozen" Payloads

1. **Identity Spoofing**: Create a candidate with an `ownerId` other than the requester's UID.
2. **Shadow Field**: Adding `isVerified: true` to a candidate document.
3. **Invalid Enum**: Setting `currentStatus` to "SuperHero".
4. **Bypassing Immutability**: Attempting to change `addedAt` in an update.
5. **Unauthorized Read**: User A trying to get User B's candidate list.
6. **Large Payload**: Injecting a 1MB string into the `candidateName` field.
7. **Junk ID**: Creating a candidate with a 2KB junk string as the document ID.
8. **Setting-Hopping**: User A trying to update User B's `driveRootFolderId` in settings.
9. **Missing Required**: Creating a candidate without `yearsExp`.
10. **Type Mismatch**: Sending a boolean for `yearsExp` instead of a number.
11. **Spoofed Timestamp**: Sending a client-side date string instead of `request.time` for `updatedAt`.
12. **Orphaned Write**: Creating a candidate with a corrupted `driveFileId` (though this is more of a logical check, we enforce ID size).

## The Test Runner
(I will generate the security rules now)
