# INT-1 concurrency scope

The local runner uses real PostgreSQL sessions against one disposable,
loopback-only cluster and exercises three step-3A races:

1. Same external parent and same canonical payload: one transaction commits;
   the waiting request returns the exact same stored JSON result.
2. Same external parent and changed payload: the waiter is rejected with
   `OP_RESERVATION_PAYLOAD_MISMATCH`.
3. Different external parents and the same canonical `business_key`: one
   transaction wins; the other is rejected with
   `OP_RESERVATION_BUSINESS_KEY_CONFLICT`.

Advisory locks use the stable order parent identity, then canonical business
key. The tests use bounded lock/statement timeouts to expose deadlocks rather
than waiting indefinitely. A legacy direct unique-key race remains as a
separate schema-level check.

Physical reservation concurrency is intentionally not claimed by INT-1 step
3A. The operation core writes only a parent and prepared-only child journal;
integration remains technically disabled, and RES-2 owns physical locks. A
future activation lot must add physical concurrency coverage after the official
OP-to-ARTICLE business dependency and global writer integration are ratified.

