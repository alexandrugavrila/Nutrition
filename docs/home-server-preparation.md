# Home server deployment preparation

Status: design prepared; no VM, server package, DNS, firewall, certificate trust
store or production database has been changed. LAN-only access was selected by
the user; external access is deferred.

## Proposed topology

Use a dedicated QEMU Linux VM under the existing Proxmox host. Install Docker
Engine/Compose inside that guest, not on the hypervisor. Starting sizing proposal:
2 vCPU, 4 GiB RAM, 40 GiB disk, subject to the host inventory and backup capacity.
Reserve a guest LAN address and a DNS name such as `nutrition.internal`; the
application name must point at the guest, not the Proxmox management host.

Run Caddy as a host service in the guest, terminating LAN HTTPS and forwarding to
the Docker edge on loopback port 8080. See `deploy/home/Caddyfile.example`.
Use these application environment values once the hostname is confirmed:

```
PROD_HTTP_BIND_ADDRESS=127.0.0.1
PROD_HTTP_PORT=8080
CORS_ALLOW_ORIGINS=https://nutrition.internal
DB_AUTO_CREATE=false
```

Keep production secure session cookies enabled. Allow HTTPS from the intended
LAN clients and SSH from administrator devices. Do not expose PostgreSQL, the
backend port or port 8080 to the LAN. Do not configure router port forwarding.
Caddy may use port 80 for redirects; restrict it to the same intended LAN scope.

`tls internal` uses Caddy's local CA. Export only the public root certificate,
verify its fingerprint over the authenticated administrative connection, then
install that certificate in the trust stores of the devices/browsers that will
use the app. Do not copy the CA private key to clients. Persist and back up the
CA state securely so restarts do not require re-enrollment. Trust enrollment is
an explicit per-device operation, not performed by this preparation task.

The real Caddy/edge/backend path still needs tests for redirects, forwarded
headers, origin checks, client-address handling, certificate renewal and secure
cookies. The previous localhost image rehearsal used a different test TLS proxy.
Do not claim real ingress validation until the guest and trusted clients exist.

## Inventory and access needed

The user has confirmed a Proxmox host and no app-specific deployment or HTTPS.
A basic unauthenticated network check found SSH and the Proxmox management port
reachable. CPU/RAM availability, Proxmox version, storage capacity, VM list,
backup targets, DNS management and SSH access to a future guest remain unknown.

The user can log in to Proxmox themselves and run these read-only node-shell
commands without sharing a password with the assistant:

```sh
pveversion
uname -m
free -h
df -h /
pvesm status
qm list
pct list
```

After reviewing the results, select the guest OS/template, VM ID, storage,
network bridge and reserved address. Configure an ordinary administrative guest
user with SSH-key access (password remains with the user). Record the host-key
fingerprint through the Proxmox console before the first SSH connection.
Creating the guest and installing services is a separate concrete provisioning
step; no resource allocation has yet been made.

The November 2025 dump is a candidate source for the first server installation.
Confirm it is the intended latest dataset before loading it. Preserve the dump
and use the already-reviewed disposable repair/rehearsal procedure; actual
production repair still requires review. Reuse the staged account cutover rather
than bypassing adoption just because the server VM is new.

## Release enforcement finding

Read-only GitHub API inspection on 2026-10-17 found the repository's canonical
name is `alexandrugavrila/nutrition-tracker`. Both `main` and `development` report
`protected: false`, required status enforcement `off`, and no required contexts.
The sole repository ruleset (`default`, ID 16802547) is disabled and contains only
branch-deletion/non-fast-forward rules. It does not enforce the six release checks.

The updated `.github/BRANCH_PROTECTION.md` is the desired contract. A repository
administrator must configure it and verify the actual named checks before merging.
The available GitHub connector supports reading these settings, not changing them.
No GitHub setting was changed during this inspection.

## References

- [Proxmox Linux containers guide: Docker in a QEMU VM](https://pve.proxmox.com/wiki/Linux_Container)
- [Caddy local HTTPS and client trust](https://caddyserver.com/docs/automatic-https)
- [Caddy tls internal directive](https://caddyserver.com/docs/caddyfile/directives/tls)
- [Release cutover runbook](release-cutover.md)

## Preparation validation (2026-10-17)

- Focused configuration/release tests: 36 passed, including digest-only pull
  behavior, paired arguments and rejection of mutable tags.
- Migrated PostgreSQL suite: 238 passed; authenticated API: 3 passed.
- Frontend: 77 tests passed; all 9 browser workflows passed. Evidence is in
  the local `wrapup-e2e.log` and `wrapup-frontend.log` files.
- Caddy accepted the proposed example with `caddy validate` in a disposable
  container. This validates syntax, not DNS, client trust or actual server ingress.
- The attempted end-to-end private-registry digest rehearsal was blocked by
  Docker Desktop daemon access to the temporary loopback registry (IPv6 timeout,
  then IPv4 connection refusal). Both temporary registries were removed; no
  daemon settings were changed. Published-digest end-to-end validation remains
  pending until release images are available from a reachable registry.
- The original dirty feature worktree's six file checksums remain unchanged.
- No application schema/API changes were made. Isolated runners were used instead
  of branch database synchronization wrappers to avoid application database access.
