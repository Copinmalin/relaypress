# Y3 operator preflight

This note records the intended next step for RelayPress.

The goal is to add an admin-only readiness check for one approved job and one connected account before any separate live action.

The readiness check must not perform any external network write.

Checklist:

- Selected job exists.
- Selected job has the expected platform.
- Selected job status is approved.
- Selected job has no external id.
- Selected job has no completion timestamp.
- Selected content is non-empty.
- Selected content is within the provider limit.
- Selected account has the expected provider.
- Selected account status is connected.
- Selected account has the required scope.

No live provider action should be sent by this readiness check.
