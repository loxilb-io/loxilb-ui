import base64
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('package', Path(__file__).with_name('snapshot_db_package.py'))
pkg = importlib.util.module_from_spec(spec); spec.loader.exec_module(pkg)


class PackageSafety(unittest.TestCase):
    def payload(self):
        dump=b'database dump'; snapshot=b'{"kind":"loxilb-snapshot"}'
        return {'format':1,'dump':base64.b64encode(dump).decode(),'snapshot':base64.b64encode(snapshot).decode(),
                'dump_sha256':hashlib.sha256(dump).hexdigest(),'snapshot_sha256':hashlib.sha256(snapshot).hexdigest(),
                'source':{'system_identifier':'source','postgres_major':18}}

    def test_roundtrip_wrong_key_and_tamper(self):
        raw=pkg.seal(self.payload(),b'k'*32)
        self.assertNotIn(b'database dump',raw)
        self.assertEqual(pkg.unseal(raw,b'k'*32)[1],b'database dump')
        for altered,key in [(raw,b'x'*32),(raw[:-1]+bytes([raw[-1]^1]),b'k'*32),(raw[:15],b'k'*32)]:
            with self.assertRaises(ValueError):pkg.unseal(altered,key)

    def test_key_permissions_symlink_and_exclusive_output(self):
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/'key';pkg.write_new(path,b'k'*32)
            self.assertEqual(pkg.read_key(path),b'k'*32)
            with self.assertRaises(FileExistsError):pkg.write_new(path,b'x'*32)
            path.chmod(0o644)
            with self.assertRaises(ValueError):pkg.read_key(path)
            link=Path(tmp)/'link';link.symlink_to(path)
            with self.assertRaises(OSError):pkg.read_key(link)

    def test_extract_snapshot_is_authenticated_and_never_overwrites(self):
        from argparse import Namespace
        with tempfile.TemporaryDirectory() as tmp:
            key=Path(tmp)/'key';pkg.write_new(key,b'k'*32)
            archive=Path(tmp)/'archive';pkg.write_new(archive,pkg.seal(self.payload(),b'k'*32))
            output=Path(tmp)/'snapshot.json'
            args=Namespace(package=archive,key_file=key,output=output)
            pkg.extract_snapshot(args)
            self.assertEqual(output.read_bytes(),b'{"kind":"loxilb-snapshot"}')
            self.assertEqual(output.stat().st_mode & 0o777,0o600)
            with self.assertRaises(FileExistsError):pkg.extract_snapshot(args)
            archive.write_bytes(archive.read_bytes()[:-1]+b'x')
            args.output=Path(tmp)/'tampered.json'
            with self.assertRaises(ValueError):pkg.extract_snapshot(args)
            self.assertFalse(args.output.exists())

    def test_restore_guards_run_before_any_sql_mutation(self):
        with tempfile.TemporaryDirectory() as tmp:
            key=Path(tmp)/'key';pkg.write_new(key,b'k'*32)
            archive=Path(tmp)/'archive';pkg.write_new(archive,pkg.seal(self.payload(),b'k'*32))
            from argparse import Namespace
            args=Namespace(package=archive,key_file=key,database='recovery_owned',container='target',owner='owner',db_user='admin')
            for target,count in [({'system_identifier':'source','postgres_major':18},'0'),({'system_identifier':'other','postgres_major':17},'0'),({'system_identifier':'other','postgres_major':18},'1')]:
                with patch.object(pkg,'inspect_container'),patch.object(pkg,'identity',return_value=target),patch.object(pkg,'sql',return_value=count) as sql:
                    with self.assertRaises(ValueError):pkg.restore(args)
                    self.assertFalse(any('CREATE' in call.args[-1] or 'UPDATE' in call.args[-1] for call in sql.call_args_list))

    def test_unknown_management_tables_cannot_export_sessions(self):
        from argparse import Namespace
        args=Namespace(container='source',owner='owned',db_user='admin',database='db')
        with patch.object(pkg,'inspect_container'),patch.object(pkg,'identity'),patch.object(pkg,'sql',return_value='users\ntoken\nnew_sessions'),patch.object(pkg,'pg') as pg:
            with self.assertRaisesRegex(ValueError,'Unsupported management schema'):
                pkg.export(args)
            pg.assert_not_called()

    def test_noninternal_or_published_destination_is_refused(self):
        info={'Config':{'Labels':{'owner':'o'}},'State':{'Running':True},'NetworkSettings':{'Networks':{'net':{}}},'HostConfig':{'PortBindings':{}}}
        with patch.object(pkg,'command',side_effect=[json.dumps([info]).encode(),b'[{"Internal":false}]']):
            with self.assertRaises(ValueError):pkg.inspect_container('pg','o',True)
        info['HostConfig']['PortBindings']={'5432/tcp':[{}]}
        with patch.object(pkg,'command',return_value=json.dumps([info]).encode()):
            with self.assertRaises(ValueError):pkg.inspect_container('pg','o',True)


if __name__=='__main__':unittest.main()
