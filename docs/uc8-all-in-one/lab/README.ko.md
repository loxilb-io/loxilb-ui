# UC-8 all-in-one 실습 환경

이 디렉터리를 통째로 전용 Linux 테스트 호스트에 복사해 실행합니다. PostgreSQL, DB bootstrap, Gateway, OAM, UI, 합성 backend 두 개 및 client를 별도 Compose 프로젝트와 네트워크에 만듭니다. GPU나 실제 모델은 사용하지 않습니다. Gateway는 **privileged** 컨테이너로 호스트 커널을 공유합니다. UI는 HTTP이고 호스트 loopback에만 바인딩합니다. 공유·운영 호스트나 신뢰하지 않는 네트워크에는 사용하지 마세요. 비밀 파일과 DB 볼륨은 실습 후에도 남습니다.

**검증 상태:** Gateway `554c7932`는 cgroup 사전 마운트 우회 없이 동일 컨테이너 재시작 두 번과 두 Required-key 합성 모델 요청을 원격 테스트베드에서 확인했습니다. 최신 패키지의 기본 UI 실습과 정리를 클린 전용 프로젝트에서 리허설했습니다. 이전 `031f2aa` 패키지에서의 UI·quota·대기열 리허설과는 구분합니다. [PR #486 검증 기록](../VALIDATION.ko.html)을 참조하세요.

## 준비

- Linux Docker Engine, Docker Compose v2, Python 3, OpenSSL, curl, 브라우저; 사용 가능한 이미지 및 관련 Gateway 커널 요구사항. Mac Docker Desktop에서 실행하지 않습니다.
- 선택한 `UC8_PROJECT`와 해당 프로젝트의 볼륨·네트워크가 없어야 합니다. 프로젝트 기본값은 `uc8-manual`이며 `uc8-manual-v2`처럼 별도 이름을 지정할 수 있습니다. 이 경로의 `.env`나 `private/`가 이미 존재하면 초기화가 중단됩니다. 기존 실습을 삭제하거나 덮어쓰지 않습니다.
- Gateway/OAM/UI의 **서로 호환되는 이미지**를 준비하고 불변 digest를 기록합니다. 이전 QA에서는 로컬 빌드 Gateway `031f2aa`, OAM `f28dda04`와 UI 소스 `12d5834d942ffab6c9718cac9cb486028c2b08f0`로 빌드한 `uc8manual-ui:12d5834d`, `postgres:18.6`, `python:3.12-slim`을 사용했습니다. 초기 `latest` UI는 Objectives 메뉴가 없어 교체했습니다. 로컬 QA 태그는 외부 레지스트리에서 받을 수 있는 태그라는 뜻이 아닙니다.
- 이 `aigw-db-bootstrap.sql`은 OAM source `f28dda04a6795f358c674676f9b810108d2dbf61`에서 복사했으며 아래 공개 부모 커밋 `46acdf7f`의 동일 파일과 일치합니다. Gateway와 SQL 계약을 검토하고 필요한 경우 맞는 버전으로 바꾼 뒤 그 해시를 기록합니다.

고정 UI source를 직접 빌드할 경우 전용 Linux 호스트에서 다음 예시를 사용합니다. 이 빌드에는 Git, Docker 및 패키지 레지스트리 접근이 필요합니다.

```bash
git clone https://github.com/loxilb-io/loxilb-ui.git ui-source
git -C ui-source checkout --detach 12d5834d942ffab6c9718cac9cb486028c2b08f0
docker build -t uc8manual-ui:12d5834d ui-source
```

아래 빌드 태그는 실습 호스트의 로컬 태그이며 레지스트리에서 자동으로 다운로드되지 않습니다. 기존 QA에 사용한 OAM `f28dda04`는 2026-10-28 공개 원격 저장소에서 checkout할 수 없어 공개된 부모 `46acdf7f`로 새로 빌드해 시험했습니다. 다음은 고정 소스로 새 이미지를 준비하는 명령입니다. 시간이 걸리며 네트워크와 충분한 디스크가 필요합니다. `git submodule update`는 Gateway가 지정한 eBPF 및 그 하위 submodule을 받아야 합니다.

```bash
git clone https://github.com/loxilb-io/loxilb-inference-gateway.git gateway-source
git -C gateway-source checkout --detach 554c79328fe837ac9fb38766fb9a09c159ce2af7
git -C gateway-source submodule update --init --recursive
docker build -f gateway-source/Dockerfile.u24 -t uc8manual-gateway:554c7932 gateway-source
```

```bash
git clone https://github.com/loxilb-io/loxilb-oam.git oam-source
git -C oam-source checkout --detach 46acdf7ffb74f205161674b6ebc23a008eb1d08f
cmp aigw-db-bootstrap.sql oam-source/deploy/compose/database/aigw-db-bootstrap.sql
docker build -t uc8manual-oam:46acdf7f oam-source
```

2026-10-28 원격 Linux에서 위 세 소스를 새로 clone하여 빌드했고, Docker 빌드 캐시가 사용됐습니다. Gateway는 우회 없는 별도 환경에서 두 Required-key 모델 경로의 재시작 전후 요청을 검증했습니다. 이때 이미지 ID는 다음과 같습니다. 위 명령의 로컬 태그 이름은 검증 당시 이름과 달라도 빌드 명령과 실행에 지정하는 이름이 일치하면 됩니다.

| 구성 | 검증 이미지 ID |
|---|---|
| Gateway `554c7932` | `sha256:ee8475288310695e55ecc9772c7a85e6d7d8090676853e560a9e984833847c9c` |
| OAM `46acdf7f` | `sha256:7e1bf2c016da73fdcd1a9d93a19ec79985a7775d961e5540f61596ab426b7718` |
| UI `12d5834d` | `sha256:1ab11a91ef6503eb5b42820675e2bf0d20592f0a501140a88fec3a7d408e6523` |

소스 커밋은 고정하지만 Dockerfile의 기반 이미지·패키지 등은 변할 수 있으므로 다음 빌드의 이미지 ID가 같다고 보장하지 않습니다. 각 환경에서 새 이미지 ID와 실행 결과를 기록합니다. bootstrap SQL SHA-256은 `569d940f0fdd995061b13a51e23434b428266e162e8cf162e5ba74cd1457a2f5`입니다. 기존 단계별 스크린샷은 Gateway `031f2aa` 조합에서 캡처했습니다. 최신 조합의 기본 UI·quota·대기열 및 정리 결과는 [최신 리허설 기록](../VALIDATION.ko.html)에 구분해 기록했습니다.

## 시작

Linux 호스트의 실습 디렉터리에서 위에서 빌드한 이미지 태그를 지정합니다. 이미지 ID를 기록해 실제 실행한 결과와 연결하세요.

```bash
export UC8_GATEWAY_IMAGE='uc8manual-gateway:554c7932'
export UC8_OAM_IMAGE='uc8manual-oam:46acdf7f'
export UC8_UI_IMAGE='uc8manual-ui:12d5834d'
export UC8_POSTGRES_IMAGE='postgres:18.6'
export UC8_PYTHON_IMAGE='python:3.12-slim'
export UC8_PROJECT=uc8-manual
export UC8_UI_PORT=3019
bash start.sh
```

`UC8`을 입력하면 전용 네트워크와 컨테이너가 시작됩니다. `private/`와 `.env`는 생성된 환경의 상태이며 비밀 파일은 권한 600입니다. `status.sh`가 Gateway readiness·objective·API key, OAM, 두 backend와 UI에서 모두 200을 확인하지 못하면 다음 단계로 가지 않습니다. status 출력의 Gateway IP와 두 backend IP를 기록합니다. 브라우저로 호스트의 `http://localhost:3019/netlox/`에 접속합니다. 다른 PC에서 원격 실습을 할 때만 SSH 터널을 사용합니다.

```bash
ssh -N -L 127.0.0.1:3019:127.0.0.1:3019 <실습-호스트>
```

터널은 실행 중인 SSH 연결이 유지되는 동안만 사용할 수 있습니다. 페이지가 열리지 않으면 원격 호스트에서 `bash status.sh`를 실행하고 Mac에서 터널을 다시 실행한 뒤 `http://localhost:3019/netlox/`를 새로 고칩니다. 다른 포트를 선택했다면 SSH 양쪽 포트와 URL도 일치시킵니다.

초기 ID는 `admin`, 초기 비밀번호는 서버의 `private/admin-password`입니다. 첫 UI 접속은 새 관리자 계정과 비밀번호 변경을 요구합니다. 사용자가 직접 변경하고 새 비밀번호를 비밀 저장소에 보관하세요. 초기 파일은 변경 이후 새 비밀번호가 아닙니다. 로그인 정보는 문서와 캡처에 넣지 마세요.

UI에서 인스턴스를 추가할 때 Gateway 관리 주소는 **OAM 컨테이너에서 접근할 수 있는 Gateway 컨테이너 IP**, 포트 `11111`, HTTP, API version `v1`입니다. IP는 `bash status.sh`의 결과를 사용합니다. 실습 rule의 External IP도 이 Gateway IP, endpoint IP는 Backend IP와 port `8080`입니다. 고객 환경에서 주소는 실행마다 달라질 수 있습니다. 인스턴스가 Healthy라고 표시되는지 확인하고 실제 데이터 요청은 client 컨테이너에서 별도로 시험합니다.

## 중지

매뉴얼의 UI 자원 정리 후 이 디렉터리에서 `bash stop.sh`를 실행합니다. Compose 프로젝트의 컨테이너와 네트워크를 중지하지만 DB/config 볼륨과 `private/`를 보존합니다. Gateway `554c7932`에서는 사전 cgroup 마운트 우회 없이 동일 Gateway 재시작 후 objective와 두 Required-key rule의 요청을 확인했습니다. 다른 설정 조합과 운영 환경의 복구는 별도로 검증해야 합니다. 보존된 데이터를 자동 삭제하거나 다른 프로젝트에 `down -v`를 실행하지 마세요. 폐기 정책에 따른 삭제 전에는 정확한 볼륨과 비밀 파일의 소유권을 확인합니다.


### 실습을 완전히 폐기할 때

이 과정은 **현재 디렉터리의 전용 실습 DB와 Gateway 설정을 영구 삭제**합니다. 보관할 설정이 없고 이 프로젝트가 본인 실습임을 확인한 경우에만 실행합니다. 아래 명령 전에 `.env`의 프로젝트 이름과 `docker compose ps -a`에서 대상을 확인하세요. 이름이 예상과 다르거나 공유 환경이면 중단합니다.

```bash
docker compose ps -a
docker compose down --volumes --remove-orphans
```

삭제 후 프로젝트 이름을 적어 남은 리소스를 확인합니다. 세 결과가 모두 비어야 합니다. 이미지는 다른 프로젝트에서 사용할 수 있으므로 이 명령은 지우지 않습니다.

```bash
UC8_CLEAN_PROJECT=uc8-manual # .env에 저장된 본인 프로젝트 이름으로 변경
docker ps -aq --filter "label=com.docker.compose.project=$UC8_CLEAN_PROJECT"
docker volume ls -q --filter "label=com.docker.compose.project=$UC8_CLEAN_PROJECT"
docker network ls -q --filter "label=com.docker.compose.project=$UC8_CLEAN_PROJECT"
```

`private/`에는 관리자 초기 비밀번호와 실습 키가, `.env`에는 실습 구성값이 남습니다. 필요한 백업을 확인한 뒤 **해당 전용 디렉터리**에서 조직의 비밀 폐기 절차에 따라 삭제합니다. 터널을 실행한 셸은 Ctrl-C로 종료합니다. 소스 빌드 디렉터리와 이미지·빌드 캐시는 별도 보관 또는 폐기 대상입니다.
