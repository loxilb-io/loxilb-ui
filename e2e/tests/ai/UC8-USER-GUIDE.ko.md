> 이 문서는 이전 Gateway `031f2aa` 기반 QA 참고 자료입니다. 최신 all-in-one 기본 실습은 `docs/uc8-all-in-one`의 별도 배포 패키지를 확인하세요. 이 테스트 브랜치는 해당 패키지 PR과 독립적이므로 병합 순서에 따라 경로가 아직 없을 수 있습니다.

# UC-8 UI 사용자 매뉴얼: 멀티테넌트 추론과 우선순위

이 문서는 하나의 추론 서비스를 여러 팀이 공유할 때 UI에서 objective, 테넌트, API 키와 admission 제어를 설정하고 확인하는 방법을 설명합니다. 네트워크 식별자와 일부 세부 스케줄링 설정은 CLI를 사용합니다. 먼저 전용 시험 환경에서 실행한 뒤 운영 환경에 맞게 값을 정하세요.

예시는 Support 팀의 실시간 요청과 Research 팀의 배치 요청을 구분합니다. **Tenant**는 요청의 소유 및 제한 단위이고 **priority band**는 요청의 우선순위입니다. 우선순위가 높아도 이미 실행 중인 요청을 중단하지 않습니다. 이 기능을 GPU 시간·메모리 할당이나 클러스터 전체 공정성으로 해석하지 마세요.

## 1. 준비

- Gateway, OAM 및 UI가 연결되고 UI에 대상 Gateway가 등록되어 있어야 합니다. 관리 권한이 있는 계정으로 로그인하고 인스턴스를 선택합니다.
- `/status/ready`와 objective 및 API key 저장소 조회가 성공해야 합니다. `/version` 응답만으로 준비 완료라고 판단하지 마세요. 조회 실패·권한 거절을 빈 목록으로 취급하지 않습니다.
- 예시 값을 환경에 맞게 정합니다: Gateway VIP와 서비스 포트, 백엔드 IP와 포트, 모델 이름, 고유한 rule·objective·tenant·key 이름. 실습은 다른 서비스에 영향을 주지 않는 전용 환경에서 진행합니다.
- UI에서 발급되는 API 키 원문은 한 번 표시됩니다. 승인된 비밀 저장소에 보관하고 스크린샷, 명령줄 인자, 로그와 공유 문서에 넣지 마세요.
- 기존 UC-8 CLI 매뉴얼 `docs/use-cases/shared-inference/`의 setup, identity, scheduling, networks, overload, recovery 장에는 전용 환경 구성 및 상세 CLI 예제가 있습니다. 이 문서의 UI 절차와 함께 사용합니다.

## 2. Objective 만들기

Objective는 요청에 적용할 우선순위의 이름입니다. 우선 같은 이름의 기존 항목이 없는지 확인합니다.

1. 대상 인스턴스의 **AI Gateway → Objectives**를 열고 **Add**를 누릅니다.
2. **Name**에 `support-interactive`처럼 고유한 이름을 입력합니다. **Priority**에 `10`을 입력하고 **Add**를 선택합니다.
3. 성공 창을 닫고 목록에서 이름과 `critical` 표시를 확인합니다. 필요하면 `loxicmd get objective -o json`으로 이름과 priority를 별도로 대조합니다.
4. 수정하려면 행을 선택하고 **Edit**을 누릅니다. 예를 들어 전용 시험에서 `-5`로 바꾸면 목록에 `sheddable`이 표시됩니다. 사용 중인 objective는 변경 영향을 확인한 뒤 수정하세요.

검증된 예시는 priority `10 → critical`, `-5 → sheddable`입니다. 각각의 값을 모든 업무에 그대로 적용하기보다 권한과 실제 스케줄링 정책을 먼저 결정하세요.

## 3. 테넌트 정책 설정

1. **AI Gateway → Rate Limits**에서 **AI Tenant Rate Limits** 표의 **Add**를 선택합니다.
2. **Tenant ID**에 `support`처럼 고유한 ID를 입력하고 **Request Priority**를 펼칩니다.
3. **Priority Class**를 `critical`로 선택합니다. **Default Objective**와 **Allowed Objectives (comma-separated)**에 앞서 만든 `support-interactive`를 입력합니다. 허용 목록에 여러 이름을 넣을 때는 쉼표로 구분합니다.
4. **Apply**를 누르고 성공 여부를 확인합니다. `loxicmd get ratelimit <tenant-id> -o json` 또는 정상 응답한 Gateway 조회에서 tenant, priority class, default 및 allowed objective를 비교합니다.
5. Research에도 별도 tenant와 objective를 만들고 원하는 priority cap을 지정합니다. 동일 tenant의 키를 여러 개 발급하더라도 tenant를 별도로 늘린 것으로 간주하지 않습니다.

테넌트 priority class는 허용 상한과 관련된 설정입니다. 이 값 하나만으로 모든 요청이 그 band에 들어간다고 가정하지 마세요. 실제로 사용할 objective를 기본값과 허용 목록에 설정하고 요청별 effective 상태를 확인합니다. 현재 검증된 API에는 tenant 삭제 기능이 없으므로 시험 후 설정을 중립화하더라도 전용 DB에 행이 남을 수 있습니다.

## 4. 테넌트 API 키 발급

1. **AI Gateway → AI API Keys**에서 **Add**를 누릅니다.
2. **Tenant ID**에 앞서 설정한 tenant ID, **Name**에 고유한 키 이름을 입력합니다.
3. **Request Priority**를 펼쳐 필요한 **Priority Class**, **Default Objective**, **Allowed Objectives (comma-separated)**를 지정합니다. 테넌트 정책 및 objective 허용 범위와 일치시키세요.
4. **Add**를 누르고 표시되는 키 원문을 승인된 비밀 저장소에 안전하게 저장한 뒤 확인 창을 닫습니다.
5. 목록의 키 ID와 설정을 확인하고, 필요한 경우 `loxicmd get apikey <key-id> -o json`의 성공 응답과 비교합니다. 키 원문이 아니라 키 ID로 운영 기록을 남깁니다.

서비스에서 API 키 인증을 요구한다면 추론 클라이언트는 `X-Api-Key` 헤더로 키를 전달합니다. 키 없는 요청은 인증 설정에 따라 거부됩니다. UI에서 키와 priority 설정을 저장한 사실만으로 실제 요청의 우선순위가 입증되지는 않으므로 아래 트래픽과 대기 상태를 함께 확인합니다.

## 5. 추론 서비스와 admission 제어

1. **Traffic → Load Balancer**에서 **Add**를 누르고 **Rule Name**에 고유 이름을 입력합니다.
2. **Basic Settings**에서 TCP, **External IP**에 전용 Gateway VIP, **Port Min**에 서비스 포트를 입력합니다.
3. **Advanced Settings**에서 **Mode**를 `fullproxy`로 지정합니다. Host, Path Prefix `/`, Path Match Mode `prefix`를 서비스 라우팅에 맞게 입력합니다.
4. **AI Gateway**를 펼쳐 **Model Name**을 입력하고 이 예시에서는 **SSE Mode**를 켭니다. 이어서 **Admission Control**을 펼칩니다.
5. 다음은 작은 전용 시험값입니다. 운영값은 백엔드 용량과 시간 제한에 맞춰 결정하세요.

   | 항목 | 시험값 | 의미 |
   |---|---:|---|
   | Admission Mode | `enforce` | 제한을 실제 요청에 적용 |
   | Max Outstanding | `1` | 동시에 처리할 요청의 상한 |
   | Queue Depth | `1` | 처리 슬롯이 찼을 때 대기할 요청 수 |
   | Queue Wait (ms) | `5000` | 대기 제한 시간, 밀리초 |

6. **Endpoints**에서 **Add**를 누르고 백엔드 **IP**와 **Target Port**를 입력한 후 규칙을 저장합니다. 목록에서 정확한 rule과 설정을 다시 확인합니다.
7. 전용 synthetic backend를 사용한다면 고유 요청을 하나 보내 HTTP 200과 독립 backend receipt 1개를 확인합니다. 하나를 백엔드에서 잡아 둔 상태에서 두 번째를 대기시키고 세 번째를 보내면, 위 시험값에서는 세 번째가 429로 거부되고 백엔드 수신은 0이어야 합니다. 첫 요청을 해제한 뒤 두 번째의 200과 수신 1개를 확인합니다.

UI 저장 성공, Gateway의 실제 적용 값, 클라이언트 응답 및 백엔드 수신은 각각 따로 확인해야 합니다. `504 admission_queue_timeout`과 `429 admission_ttl_expired`는 서로 다른 대기 만료 조건에서 관찰됐으며, 모든 429/504의 원인이 같다는 의미는 아닙니다.

## 6. 우선순위와 분배 상태 읽기

Load Balancer의 대상 rule에서 **AI Gateway** 상세의 **Priority band state**를 열어 Critical, Standard, Sheddable 행과 대기 수를 확인합니다. 실제 대기 중인 동일 시점의 Gateway effective 정보 및 backend 수신 순서와 대조합니다.

전용 시험에서 한 요청을 실행 중으로 유지하고 sheddable 요청과 critical 요청을 각각 대기시켰습니다. UI와 Gateway가 각각 대기 1건을 표시했고, 실행 요청을 해제하자 critical이 sheddable보다 먼저 백엔드에 도착했습니다. 이는 통제된 한 실험의 결과입니다.

Weighted `8:3:1`, band별 세부 비율·대기 시간, tenant wake `rr` 및 기타 전문가 필드는 이 UI의 직접 입력 항목이 아닙니다. 기존 CLI 매뉴얼의 scheduling 장에서 설정하고 UI 상세의 **Wake Policy** 또는 **In-band Order**와 Gateway readback으로 확인합니다. 전용 시험에서는 혼합 대기의 첫 12회 처리 분포 `8:3:1`, 같은 band의 tenant 교대 사례를 확인했습니다. 장기 공정성이나 GPU 자원 배분을 보장하는 수치는 아닙니다.

UI는 `fc_*` 9개와 `ai_*` 3개 전문가 필드를 입력하지 않습니다. CLI에서 지정한 12개 값이 UI의 별도 **Max Outstanding** 편집 후 보존되는 대표 사례와 nonzero→0/false/inherit 재설정 사례를 확인했습니다. 변경 전후에는 항상 성공한 Gateway readback을 비교하세요.

## 7. 네트워크 식별자

**AI Gateway → Network Identity**는 검증한 버전에서 읽기 전용 목록입니다. 생성·수정은 CLI를 사용합니다. 예를 들어 전용 테스트 클라이언트 CIDR을 제한하려면 실제 전용 주소와 고유 이름을 넣습니다.

```sh
loxicmd create netidentity <unique-name> --tenant=<tenant-id> --cidr=<client-ip>/32 --services=<gateway-vip>:<service-port> --enforce=strict --forward-identity
loxicmd get netidentity -o json
```

UI에서 이름, tenant, CIDR 및 `strict` 표시를 확인합니다. 키의 tenant와 binding tenant가 일치하면 전용 실험에서 200·백엔드 수신 1회였고, 다르면 403·수신 0회였습니다. `advisory` 실험에서는 불일치 키가 자신의 tenant로 허용됐습니다. 서비스와 보안 정책에 맞게 선택하세요.

소프트웨어 VLAN 310 및 VXLAN VNI 322에 대해서도 별도 컨테이너에서 실제 패킷 수신, UI 표시 및 binding 삭제 후 차단을 확인했습니다. 이는 물리 스위치 또는 운영 VXLAN fabric의 격리 보증이 아닙니다. 설정과 네트워크 생성·삭제 절차는 기존 CLI 매뉴얼의 networks 장을 따릅니다.

## 8. 장애 시 확인과 복구

Objectives 페이지에서 저장소에 연결할 수 없다는 경고가 나타나면 성공한 Gateway 조회의 `source`와 `store_reachable`을 확인합니다. 이미 적용된 objective가 LKG에서 보이는 것과 새 설정을 저장할 수 있는 것은 별개입니다. 관찰된 저장소 장애에서는 objective 추가가 503으로 거부됐습니다.

별도 Gateway를 저장소에 연결되지 않은 채 콜드 시작한 시험에서는 objective가 LKG에서 표시됐지만 readiness와 API key 조회는 503이었습니다. **장애 전에 실제 200으로 동작한 기존 유효 API 키**도 해당 콜드 인스턴스에서는 503·백엔드 수신 0회였고, 저장소 연결 복구 후 같은 키가 200·수신 1회로 돌아왔습니다. 별도로 설정된 network credential 요청은 같은 장애 상태에서 200으로 처리됐습니다. 이 결과를 모든 인증 정책이나 모든 배포 형태로 일반화하지 마세요.

연결 복구 후 **Refresh**를 눌러 새 조회에서 `source=store`, `store_reachable=true`를 확인합니다. 시험 중 브라우저 새로고침만으로 이전 경고가 한동안 남은 사례가 있어, 명시적 Refresh와 실제 조회 결과를 확인하세요.

동일 Gateway 컨테이너 재시작은 전용 시험에서 실패한 미해결 관찰이 있습니다. 새 컨테이너를 보호된 설정 사본으로 시작해 복구한 결과와 동일 컨테이너 재시작 성공은 별개입니다. 운영 복구 절차를 적용하기 전에 팀의 검증된 백업·복구 계획을 따르세요.

## 9. 감사와 정리

감사 수집기가 있다면 **Maintenance → Audit**에서 named sink를 추가할 수 있습니다. 전용 시험에서는 별도 모의 수신기에 TLS로 연결하고 단일 추론의 request ID, 완료 이벤트 및 상태 200이 같은 감사 레코드에 도착했는지 확인했습니다. 상용 SIEM의 호환성, 상호 TLS 및 무손실 재전송은 이 시험에 포함되지 않습니다. 원시 감사 레코드와 키를 공유 자료에 넣지 마세요.

실습 후 본인이 만든 rule, key, objective, network identity 및 감사 sink만 삭제하거나 중립화합니다. 삭제 확인은 정상적인 재조회에서 해당 고유 이름이 없는지 확인합니다. tenant는 삭제 API가 없으므로 중립화 후 남는 행을 기록합니다. 공유 자원에 일괄 삭제를 적용하지 마세요.

## 검증 범위

UI `12d5834d942ffab6c9718cac9cb486028c2b08f0`, Gateway `031f2aa31876723417bfcd3ae1220752e6b6cab8`, OAM `f28dda04a6795f358c674676f9b810108d2dbf61`, CLI `ad1e7776bc1be8f04510d4a08091d5963d96688f`와 전용 synthetic backend에서 Playwright/Chromium과 실제 요청으로 확인한 범위를 기준으로 작성했습니다. 독립적인 사람의 전체 수동 실습, 물리 네트워크 및 실제 상용 SIEM 검증은 수행하지 않았습니다. 상세 QA 재현과 자동화는 `UC8-QA.md` 및 해당 `uc8-*.spec.ts`를 참조하세요.
