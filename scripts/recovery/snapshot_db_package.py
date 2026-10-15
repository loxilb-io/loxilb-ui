#!/usr/bin/env python3
"""Operator-only encrypted auth DB package. Requires cryptography and Docker/PG.

No HTTP endpoint, database credentials in argv, in-place restore, role restore,
management session restore, or automatic Gateway cutover is provided.
"""
import argparse
import base64
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys

MAGIC = b'LXDBPKG1'
AAD = b'loxilb-auth-recovery-v1'
MAX_PACKAGE = 256 * 1024 * 1024
SCHEMAS = ('aigw', 'aigw_mgmt')


class RecoveryError(ValueError):
    """An operator-safe message containing no database values."""



def command(args, data=None):
    result = subprocess.run(args, input=data, capture_output=True, timeout=180)
    if result.returncode:
        # SQL/driver stderr can contain credential hashes or row values.
        raise RecoveryError('External command failed; inspect protected host diagnostics')
    return result.stdout


def inspect_container(name, owner, isolated=False):
    info = json.loads(command(['docker', 'inspect', name]))[0]
    if info['Config'].get('Labels', {}).get('owner') != owner or not info['State']['Running']:
        raise RecoveryError('Container ownership or running state mismatch')
    if isolated:
        networks = info['NetworkSettings']['Networks']
        if not networks or info['HostConfig'].get('PortBindings'):
            raise RecoveryError('Restore requires private networks and no published ports')
        for network in networks:
            if not json.loads(command(['docker', 'network', 'inspect', network]))[0]['Internal']:
                raise RecoveryError('Every restore-container network must be internal')
    return info


def pg(args, container, user, database, data=None):
    return command(['docker', 'exec', '-i', container] + args + ['-U', user, '-d', database], data)


def sql(container, user, database, query):
    return pg(['psql', '-X', '-v', 'ON_ERROR_STOP=1', '-Atc', query], container, user, database).decode().strip()


def identity(container, user, database):
    # Requires a DB custodian, deliberately stronger than an OAM UI role.
    system = sql(container, user, database, 'SELECT system_identifier FROM pg_control_system()')
    version = int(sql(container, user, database, 'SHOW server_version_num')) // 10000
    return {'system_identifier': system, 'postgres_major': version}


def read_key(path):
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    try:
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode) or info.st_mode & 0o077 or info.st_uid != os.geteuid():
            raise RecoveryError('Key must be an owner-only regular file owned by this user')
        key = os.read(fd, 33)
        if len(key) != 32:
            raise RecoveryError('Key file must contain exactly 32 random bytes')
        return key
    finally:
        os.close(fd)


def write_new(path, data):
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'wb') as out:
        out.write(data)
        out.flush()
        os.fsync(out.fileno())


def seal(payload, key):
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    raw = json.dumps(payload, separators=(',', ':')).encode()
    if len(raw) > MAX_PACKAGE:
        raise RecoveryError('Package exceeds the memory/size budget')
    nonce = os.urandom(12)
    return MAGIC + nonce + AESGCM(key).encrypt(nonce, raw, AAD)


def unseal(raw, key):
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    if not raw.startswith(MAGIC) or len(raw) > MAX_PACKAGE + 64:
        raise RecoveryError('Invalid package header or size')
    try:
        payload = json.loads(AESGCM(key).decrypt(raw[8:20], raw[20:], AAD))
        if payload['format'] != 1:
            raise RecoveryError('Unknown package format')
        dump = base64.b64decode(payload['dump'], validate=True)
        snapshot = base64.b64decode(payload['snapshot'], validate=True)
        if hashlib.sha256(dump).hexdigest() != payload['dump_sha256'] or hashlib.sha256(snapshot).hexdigest() != payload['snapshot_sha256']:
            raise RecoveryError('Package digest mismatch')
        return payload, dump, snapshot
    except Exception:
        raise RecoveryError('Package authentication or content validation failed') from None


def export(args):
    inspect_container(args.container, args.owner)
    source = identity(args.container, args.db_user, args.database)
    management_tables = set(sql(args.container, args.db_user, args.database,
        "SELECT table_name FROM information_schema.tables WHERE table_schema='aigw_mgmt'").splitlines())
    if 'users' not in management_tables or management_tables - {'users', 'token'}:
        raise RecoveryError('Unsupported management schema; review session exclusions before exporting')
    snapshot = Path(args.snapshot).read_bytes()
    doc = json.loads(snapshot)
    if doc.get('kind') != 'loxilb-snapshot' or not doc.get('checksum') or not doc.get('schema_version'):
        raise RecoveryError('A Gateway snapshot document is required')
    # Snapshot/DB are separate captures. Operators must quiesce configuration
    # writers; this tool makes no cross-store atomicity claim.
    dump = pg(['pg_dump', '-Fc', '--no-owner', '--no-acl', '--schema=aigw', '--schema=aigw_mgmt',
               '--exclude-table=aigw_mgmt.token'], args.container, args.db_user, args.database)
    payload = {'format': 1, 'captured_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
               'source': source, 'snapshot_schema': doc['schema_version'],
               'dump_sha256': hashlib.sha256(dump).hexdigest(), 'snapshot_sha256': hashlib.sha256(snapshot).hexdigest(),
               'dump': base64.b64encode(dump).decode(), 'snapshot': base64.b64encode(snapshot).decode(),
               'management_sessions': 'excluded', 'restore_policy': 'new-isolated-cluster-db-all-api-keys-disabled'}
    write_new(args.output, seal(payload, read_key(args.key_file)))
    print(json.dumps(summary(payload)))


def summary(payload):
    return {key: payload[key] for key in ('format', 'captured_utc', 'snapshot_schema', 'management_sessions', 'restore_policy')}


def extract_snapshot(args):
    _, _, snapshot = unseal(Path(args.package).read_bytes(), read_key(args.key_file))
    write_new(args.output, snapshot)
    print('Gateway snapshot extracted to a new owner-only file')


def restore(args):
    payload, dump, _ = unseal(Path(args.package).read_bytes(), read_key(args.key_file))
    if not re.fullmatch(r'recovery_[a-z0-9_]{1,40}', args.database):
        raise RecoveryError('Destination name must match recovery_[a-z0-9_]{1,40}')
    inspect_container(args.container, args.owner, isolated=True)
    target = identity(args.container, args.db_user, 'postgres')
    if target['system_identifier'] == payload['source']['system_identifier']:
        raise RecoveryError('Source PostgreSQL cluster cannot be a restore target')
    if target['postgres_major'] != payload['source']['postgres_major']:
        raise RecoveryError('PostgreSQL major version mismatch')
    existing = sql(args.container, args.db_user, 'postgres', "SELECT count(*) FROM pg_database WHERE datname='" + args.database + "'")
    if existing != '0':
        raise RecoveryError('Destination database already exists; never overwrite or merge')
    # CREATE DATABASE is the concurrency guard: no IF NOT EXISTS and no cleanup
    # on failure. Preserve a failed, owned destination for diagnosis.
    sql(args.container, args.db_user, 'postgres', 'CREATE DATABASE ' + args.database + ' TEMPLATE template0')
    sql(args.container, args.db_user, 'postgres', 'REVOKE CONNECT ON DATABASE ' + args.database + ' FROM PUBLIC')
    pg(['pg_restore', '--single-transaction', '--exit-on-error', '--no-owner', '--no-acl'], args.container, args.db_user, args.database, dump)
    sql(args.container, args.db_user, args.database, 'UPDATE aigw.api_keys SET enabled=FALSE')
    enabled = sql(args.container, args.db_user, args.database, 'SELECT count(*) FROM aigw.api_keys WHERE enabled')
    sessions = sql(args.container, args.db_user, args.database, "SELECT count(*) FROM information_schema.tables WHERE table_schema='aigw_mgmt' AND table_name='token'")
    if enabled != '0' or sessions != '0':
        raise RecoveryError('Restored database quarantine verification failed')
    print(json.dumps({**summary(payload), 'database':args.database, 'enabled_api_keys':0,
                      'restored_management_sessions':0, 'cutover_performed':False}))


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='action', required=True)
    key = sub.add_parser('keygen'); key.add_argument('--key-file', required=True)
    for action in ('export', 'inspect', 'restore', 'extract-snapshot'):
        p = sub.add_parser(action); p.add_argument('--key-file', required=True)
        if action in ('export', 'restore'):
            p.add_argument('--container', required=True); p.add_argument('--owner', required=True)
            p.add_argument('--db-user', required=True); p.add_argument('--database', required=True)
        if action == 'export':
            p.add_argument('--snapshot', required=True); p.add_argument('--output', required=True)
        else:
            p.add_argument('--package', required=True)
        if action == 'extract-snapshot':
            p.add_argument('--output', required=True)
    args = parser.parse_args()
    try:
        if args.action == 'keygen':
            write_new(args.key_file, os.urandom(32)); print('Owner-only encryption key created')
        elif args.action == 'export': export(args)
        elif args.action == 'restore': restore(args)
        elif args.action == 'extract-snapshot': extract_snapshot(args)
        else: print(json.dumps(summary(unseal(Path(args.package).read_bytes(), read_key(args.key_file))[0])))
    except RecoveryError as err:
        print(str(err), file=sys.stderr)
        return 1
    except Exception as err:
        # Do not stringify arbitrary SQL/JSON exceptions, which may include data.
        print('Recovery package operation failed (' + type(err).__name__ + '); no automatic cutover or cleanup was performed.', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
