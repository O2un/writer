# writer 아키텍처

writer가 어떻게 나뉘어 있고, 각 부분이 왜 그렇게 생겼는지 적는다. 기능 목록과 사용법은 [README](../README.md), 규칙 검사의 판단은 [rules.md](rules.md)에 있다.

## 한눈에

```
Claude Code (호출한 쪽)
│  조사, 초안 작성, 파일 쓰기, 작성자와 대화
│
└─MCP(stdio)─▶ writer
               ├─ mcp/        서버 instructions, 도구 5개
               ├─ content/    글 찾기, frontmatter·본문 파싱
               ├─ rules/      결정적 규칙 검사 (LLM 없음)
               ├─ templates/  사이트 템플릿 파일 읽기, 내장 기본값
               ├─ writing/    내장 글쓰기 원칙, 사이트 안내 문서 읽기
               ├─ review/     LLM 비평 요청과 응답 형식
               ├─ loop/       수정 한 회차: 수정 목록 요청, 적용, 재검사
               └─ llm/        Provider 인터페이스
                    ├─ anthropic-api  (Anthropic SDK, API 키)
                    └─ claude-code    (claude -p, Claude 구독)

사이트 레포 (SITE_ROOT)
├─ src/content/blog/                     글 (읽기만 한다)
├─ .astro/collections/blog.schema.json   frontmatter JSON Schema
├─ writer.templates.json                 글 템플릿 (없으면 내장 기본값)
└─ writer.guide.md                       사이트 글쓰기 안내 (없으면 내장 원칙만)
```

## 일을 나누는 기준

### 쓰는 쪽과 검토하는 쪽을 나눈다

서버 안에서 LLM을 부르는 도구는 `review_post`와 `revise_post` 둘뿐이다. 초안은 호출한 쪽(Claude Code)이 쓴다.

호출한 쪽은 웹 검색, 브라우저, 대화 맥락을 쓸 수 있다. 서버 안의 LLM은 도구 없이 글 한 편만 받는다. 그래서 조사와 작성은 호출한 쪽이 더 잘한다. 반대로 검토는 글을 쓴 맥락과 떨어진 새 맥락에서 같은 기준으로 보는 편이 낫다. 자기가 쓴 글을 자기가 검토하면 같은 판단을 반복한다.

초안을 서버가 쓰는 `draft_post`도 처음 계획에는 있었다. 서버 안의 LLM은 검색을 못 하니 조사를 누가 하느냐는 문제가 생겼고, 그래서 템플릿만 내주는 `get_template`으로 바꿨다.

### 파일은 호출한 쪽이 쓴다

writer는 글 파일을 읽기만 한다. `revise_post`도 수정 목록(`quote`, `replacement`)만 돌려준다. 작성자가 승인한 것만 호출한 쪽이 적용한다.

- 서버가 회차 사이의 상태를 들고 있지 않는다. 다음 회차는 수정이 적용된 파일을 다시 읽는다.
- 회차별 기록은 git diff와 대화에 남는다.
- 작성자가 보지 않은 변경이 파일에 들어가지 않는다.

### 코드로 판정할 수 있는 것은 LLM에 맡기지 않는다

frontmatter 스키마, 각주 짝·위치·링크·길이, 공개된 글에 남은 TODO는 `rules/`가 코드로 검사한다. 같은 글에는 항상 같은 결과가 나오고 비용이 들지 않는다. 그래서 `check_post`는 저장할 때마다 돌린다.

LLM 비평은 코드로 판정할 수 없는 것만 맡는다. 사실 주장의 근거, 문장의 명료함, 수정 흔적, 줄임말 같은 것이다. 비평 지침에는 "frontmatter와 각주 구조는 코드가 본다"고 적어서 두 쪽이 같은 것을 두 번 지적하지 않게 했다.

### 사이트의 하네스에 기대지 않는다

writer는 사이트의 스킬이나 `CLAUDE.md` 같은 에이전트 지시 문서를 읽지 않는다. 그런 문서를 모두 지워도 같은 순서와 기준으로 돌아야 한다.

| 필요한 것 | 어디서 오나 |
|---|---|
| 작업 순서 | MCP 서버 instructions. 연결될 때 호출한 쪽에 전달된다 |
| 일반 글쓰기 원칙 | `writing/principles.ts`. 초안(`get_template`), 검토, 수정에 같은 목록이 들어간다 |
| 사이트 기준 | `writer.guide.md`, `writer.templates.json`. writer가 정한 형식의 사이트 설정 파일이다 |
| 글 형식 | 사이트가 만드는 JSON Schema |

처음에는 검토 기준으로 사이트의 글쓰기 스킬 파일을 그대로 읽었다. 스킬에는 기준과 함께 "이 도구는 이럴 때 쓴다" 같은 하네스 지시가 섞여 있었고, 스킬이 없으면 `review_post`가 멈췄다. 지금은 일반 원칙을 writer 안에 두고, 사이트 파일에는 그 사이트에만 해당하는 것만 둔다.

### 사이트 값은 설정에서 읽는다

사이트 경로, 글 폴더, 스키마, 템플릿, 안내 문서를 모두 환경변수로 받는다. 템플릿의 절 이름이나 참고 자료 제목도 코드에 없다. writer 레포만 따로 clone해서 다른 사이트에 붙여도 쓸 수 있게 하기 위해서다.

스키마, 템플릿, 안내 문서는 도구를 호출할 때마다 파일의 수정 시각을 보고 바뀌었으면 다시 읽는다. 세션 도중 사이트 스키마에 장르를 추가했는데 `check_post`가 시작할 때 읽은 스키마로 검사해서 틀린 error를 낸 일이 있었다. 템플릿 ID 목록만은 도구 입력 스키마라서 시작할 때 정해진다.

## Provider

```ts
interface LlmProvider {
  complete(request: LlmRequest): Promise<string>;
  completeJson<T>(request: LlmRequest, schema: z.ZodType<T>): Promise<T>;
}
```

인터페이스는 "시스템 프롬프트와 본문, 출력 스키마를 받아 텍스트나 JSON을 돌려준다"까지만 정한다. 루프 제어, 규칙 검사, 수정 적용은 writer 코어가 한다. 그래서 어느 Provider를 쓰든 동작이 같다.

| Provider | 호출 | 구조화 출력 | 용도 |
|---|---|---|---|
| `anthropic-api` | Anthropic SDK, 스트리밍 | `output_config.format`에 zod 스키마. 시스템 프롬프트에 프롬프트 캐싱 | 정식 구현, 남이 쓰는 경우 |
| `claude-code` | `claude -p` 자식 프로세스 | `--json-schema` | 본인 실사용 (구독) |

`claude-code` Provider는 `--tools ""`와 `--strict-mcp-config`로 도구와 MCP 서버를 끄고, `--no-session-persistence`로 세션 기록을 남기지 않는다. 임시 폴더에서 실행해서 사이트의 `CLAUDE.md`를 읽지 않는다.

## 수정 한 회차 (`loop/`)

```
글 읽기 ─▶ 규칙 검사 ─▶ 고칠 것 모으기 ─┬─ 없음 ─▶ nothing-to-fix (LLM 호출 없음)
                                       └─ 있음 ─▶ LLM: 수정 목록
                                                   ─▶ 순서대로 적용 (quote가 정확히 한 번 나올 때만)
                                                   ─▶ 적용한 글을 다시 규칙 검사
                                                   ─▶ applied / rejected / 남은 위반
```

- 고칠 것은 규칙 error, 작성자가 고른 비평 지적, 작성자 피드백이다. 규칙 warning은 고치라고 넘기지 않는다.
- 비평 지적은 작성자가 고른 것만 넘긴다. 실제 글로 돌렸을 때 비평 `error` 6건이 모두 작성자 확인에서 문제가 아니었다. 글만 봐서는 일부러 쓴 표현을 구분하기 어렵다.
- LLM이 낸 `quote`가 글에 없거나 여러 번 나오면 그 수정은 적용하지 않고 이유와 함께 돌려준다. 엉뚱한 곳이 바뀌는 것을 막는다.

## 초안의 빈칸

초안에서 작성자가 채울 곳은 본문에 `<!-- TODO: ... -->`, frontmatter에 `# TODO:` 주석으로 남긴다. 둘 다 사이트에 보이지 않는다. 대신 `todo` 규칙이 공개된 글(`draft`가 `true`가 아닌 글)에 남은 TODO를 info로 알린다. 내용을 채운 뒤 주석만 남은 경우도 있어서 통과 여부에는 영향을 주지 않는다.

템플릿의 항목은 `research`(공개 자료를 조사해 각주와 함께 채울 것)와 `prompt`(작성자가 직접 쓸 것)로 나뉜다. 감상이나 경험은 지어내지 않는다. 템플릿은 가이드라인이라 절이 빠지거나 이름이 달라도 위반이 아니다.

## 테스트

- 규칙, 파서, 설정, 템플릿, Provider, 수정 적용, 설정 파일 다시 읽기를 단위 테스트한다.
- MCP 도구는 SDK의 `InMemoryTransport`로 실제 클라이언트와 서버를 붙여 호출한다. LLM 자리에는 가짜 Provider를 넣는다.
- `claude-code` Provider는 프로세스 실행 함수를 주입받아서, 실제 `claude`를 띄우지 않고 인자와 출력 처리를 검사한다.
