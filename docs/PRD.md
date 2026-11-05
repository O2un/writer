# writer PRD (초안)

> 상태: 초안 · 작성일 2026-10-30

## 1. 개요

writer는 devlog(Astro 블로그) 글의 초안 작성, 검토, 수정을 맡는 LLM 에이전트 프로그램이다. MCP 서버로 동작하고, Claude Code에서 도구로 호출한다. 블로그 빌드나 배포와는 무관한 로컬 전용 툴이다. devlog 레포에는 `tools/writer` 서브모듈로 붙어 있다.

## 2. 목표

1. **정밀도**: 스킬을 한 번 호출해서 끝내지 않는다. 초안 → 규칙 검사 → 비평 → 수정 루프를 돌려서 devlog 작성 규칙을 더 정확하게 지킨다.
2. **MCP 개발 포트폴리오**: MCP 서버를 설계하고 구현한 사례로 쓴다. 도구 정의, 입출력 스키마, 에러 처리까지 포함한다.
3. **LLM 툴 개발 포트폴리오**: Anthropic SDK 기반의 에이전트 루프, tool use, 구조화 출력을 직접 구현한 사례로 쓴다.

### 비목표

- 블로그 사이트 기능(페이지, 컴포넌트, 배포)은 다루지 않는다.
- 여러 사용자가 쓰는 서비스나 호스팅은 만들지 않는다.
- 글을 공개하는 작업(`draft: false` 전환, `post-index.md` 행 추가)을 자동으로 하지 않는다. 사용자가 확인한 뒤에만 한다.

## 3. 핵심 요구사항: LLM Provider 교체

API 비용 없이 실사용하면서, 구현은 API 기준으로 제대로 갖춘다.

| Provider | 호출 방식 | 과금 | 용도 |
|---|---|---|---|
| `anthropic-api` | Anthropic SDK + API 키 | API 토큰 과금 | 정식 구현. 포트폴리오 시연, 남이 쓰는 경우 |
| `claude-code` | `claude -p` 헤드리스 호출 | Claude 구독 | 본인 실사용 |

- 설정값 하나(예: `LLM_PROVIDER`)로 바꿔 끼운다.
- Provider 인터페이스는 "메시지와 출력 스키마를 받으면 텍스트나 JSON을 돌려주는" 수준으로 좁게 정의한다. 루프 제어, 도구 실행, 규칙 검사는 writer 코어가 맡는다. 어느 Provider를 쓰든 동작이 같아야 한다.
- API Provider는 tool use, 구조화 출력, 프롬프트 캐싱 등 SDK 기능을 제대로 활용한다. claude-code Provider는 같은 인터페이스에 맞추는 어댑터다.

## 4. 아키텍처

```
Claude Code ──MCP(stdio)──▶ writer
                             ├─ mcp/      MCP 서버, 도구 정의
                             ├─ loop/     작성·검토 루프 오케스트레이션
                             ├─ rules/    결정적 규칙 검사 (LLM 미사용)
                             ├─ content/  글 찾기, frontmatter와 본문 파싱
                             ├─ templates/ 글 템플릿 목록
                             └─ llm/      Provider 인터페이스
                                  ├─ anthropic-api
                                  └─ claude-code
```

- **언어**: TypeScript (Node). MCP SDK와 Anthropic SDK 둘 다 공식 지원한다.
- **사이트 경로**: 상대경로를 하드코딩하지 않고 설정(`SITE_ROOT`)으로 받는다. writer 레포만 따로 clone해도 쓸 수 있게 하기 위해서다.

## 5. MCP 도구 (초안)

| 도구 | LLM 사용 | 설명 |
|---|---|---|
| `check_post` | X | 글 하나에 규칙 검사를 돌리고 위반 목록을 돌려준다 |
| `list_posts` | X | `post-index.md`와 `src/content/blog`에서 기존 글과 소재를 조회한다 |
| `review_post` | O | 규칙 검사와 LLM 비평을 합쳐 검토 의견을 낸다. 파일은 고치지 않는다 |
| `revise_post` | O | 검토 → 수정 루프를 돌려 수정안을 만든다. 저장은 옵션이다 |
| `draft_post` | O | 소재와 메모를 받아 초안을 만든다. `draft: true`로만 저장한다 |

LLM을 쓰지 않는 도구부터 구현해서 MCP 연결을 먼저 검증한다.

## 6. 규칙 검사 (rules/)

각주 규칙과 사이트가 내는 JSON Schema로 글을 코드로 검사한다. 위반 결과는 다음 루프의 피드백으로 넣는다.

- **frontmatter**: 사이트의 JSON Schema에 맞는지 본다. 스키마에 없는 필드와 없는 `thumbnail` 파일도 잡는다.
- **각주 짝**: 본문의 표시와 설명 줄이 서로 맞는지, 같은 설명 줄이 중복되지 않았는지 본다.
- **각주 링크**: 설명 줄에 http(s) 링크가 있는지 본다. 설명 문장은 없어도 된다.
- **각주 위치**: 설명 줄이 템플릿의 참고 자료 절 안에 있고, 그 절이 글의 끝인지 본다. 제목 깊이는 보지 않는다.
- **각주 설명 길이**: 150자를 넘으면 경고한다.

LLM 비평은 코드로 판정할 수 없는 항목만 맡는다. 예를 들면 사실 주장에 근거가 있는지, 문장이 명료한지, 수정 흔적("X가 아니라 Y")이 남았는지 같은 것이다.

## 7. 루프 설계

1. 입력: 글 경로 또는 소재·메모
2. 생성 또는 수정 (LLM)
3. 규칙 검사 (코드) → 위반이 있으면 2로 돌아간다
4. 비평 (LLM, 구조화 출력) → 지적이 있으면 2로 돌아간다
5. 종료 조건: 위반 0건이고 비평 통과, 또는 최대 반복 횟수 도달
6. 출력: 최종본, 반복 기록, 남은 지적

- 최대 반복 횟수는 설정값으로 둔다. 구독 Provider는 Claude Code 본체와 사용 한도를 같이 쓰므로 기본값을 작게 잡는다.
- 반복 기록(각 회차의 위반과 수정 요약)은 디버깅과 포트폴리오 시연에 쓴다.

## 8. 안전·운영

- writer는 devlog 파일을 `draft: true` 초안으로만 저장한다. 기존 공개 글을 덮어쓰려면 명시적인 옵션이 있어야 한다.
- API 키는 환경변수로만 받고 레포에 커밋하지 않는다.
- **[확인 필요]** 구독(claude.ai 로그인)으로 돌리는 방식은 본인이 개인 툴에서 쓰는 용도로 한정되는 것으로 알고 있다. Agent SDK 기반 제품을 남에게 배포하면서 claude.ai 로그인을 쓰게 하는 것은 Anthropic이 허용하지 않는 것으로 기억한다. 구현 전에 현재 약관과 문서로 확인하고, README에 "남이 쓸 때는 `anthropic-api` Provider 사용"을 명시한다.
- `claude-code` Provider는 `claude -p`에 `--output-format json`과 `--json-schema`를 넘겨 스키마를 강제하고, `--tools ""`와 `--strict-mcp-config`로 도구와 MCP 서버를 끈다.

## 9. 마일스톤

1. **M1 뼈대**: TS 프로젝트, MCP 서버, `check_post` (LLM 없음), 템플릿 선택 구조. Claude Code에서 호출되는지 확인한다.
2. **M2 Provider**: 인터페이스, `anthropic-api` 구현, `claude-code` 어댑터.
3. **M3 루프**: `review_post`, `revise_post`, 반복 기록.
4. **M4 초안**: `draft_post`, `list_posts` 연동. 기존 글을 읽어 템플릿 내용을 채우고, 그중 하나를 골라 초안을 쓴다.
5. **M5 포트폴리오**: README, 아키텍처 설명, 시연 기록.

## 10. 열린 질문

- 비평 기준을 devlog의 `devlog-content-writing` 스킬 문서에서 읽어 올지, writer에 별도 프롬프트로 둘지
- 카테고리별 규칙(방탈출, 게임, 에세이 등)을 어디까지 코드로 검사할지
- `revise_post`가 파일에 바로 쓸지, diff만 돌려줄지
